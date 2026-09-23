const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
const PRODUCTION_WEB_BASE_URL = "https://blink-detection-two.vercel.app";
const HELPER_BASE_URL = "http://127.0.0.1:17321";

type ExtensionAuth = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  apiBaseUrl: string;
  webBaseUrl: string;
};

type NotificationSettings = {
  lowBlinkRate?: boolean;
  faceMissing?: boolean;
  poorLighting?: boolean;
  planCompleted?: boolean;
  muted?: boolean;
};

type ActivePlanMeasure = {
  plan_measure_id: number;
  measure_code: string;
  measure_name: string;
  target_value: number | string | null;
  interval_minutes: number | null;
  reminder_mode: "FLEXIBLE" | "SCHEDULED";
  is_enabled: boolean;
};

type ActivePlan = {
  plan_id: number;
  plan_name: string;
  measures: ActivePlanMeasure[];
};

type ExtensionMessage =
  | { type: "BLINKCARE_STATUS"; monitoring: boolean }
  | { type: "BLINKCARE_ALERT"; title: string; message: string; category?: string }
  | { type: "BLINKCARE_BLINK_DETECTED"; ear: number; durationMs: number }
  | { type: "BLINKCARE_ERROR"; message: string }
  | { type: "BLINKCARE_DETECTION_UPDATE"; blinkCount: number; blinksPerMinute: number; activeSeconds: number; personPresent: boolean; lightingLevel: "GOOD" | "DARK" | "UNKNOWN" }
  | { type: "BLINKCARE_POPUP_START" }
  | { type: "BLINKCARE_POPUP_STOP" }
  | { type: "BLINKCARE_OPEN_LOGIN" }
  | { type: "BLINKCARE_PLAN_UPDATED" }
  | { type: "BLINKCARE_GET_NOTIFICATION_HISTORY" }
  | { type: "BLINKCARE_GET_DEVICE_STATUS" }
  | { type: "BLINKCARE_AUTH_SYNC"; accessToken: string; refreshToken: string; apiBaseUrl: string; webBaseUrl: string; notificationSettings?: NotificationSettings }
  | { type: "BLINKCARE_AUTH_CLEAR"; apiBaseUrl: string; webBaseUrl: string };

let authOperation: Promise<void> = Promise.resolve();
let planOperation: Promise<void> = Promise.resolve();
let blinkOperation: Promise<void> = Promise.resolve();
let activePlan: ActivePlan | null = null;
let lastPlanLoadedAt = 0;
let previousActiveSeconds = 0;
let continuousActiveSeconds = 0;
let lastHelperPollAt = 0;

const enqueueAuthOperation = (operation: () => Promise<void>) => {
  authOperation = authOperation.then(operation, operation);
  return authOperation;
};

const readUserId = (token: string) => {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return payload.user_id === undefined ? null : String(payload.user_id);
  } catch {
    return null;
  }
};

const getAuth = async (): Promise<ExtensionAuth | null> => {
  const stored = await chrome.storage.local.get("blinkcareAuth");
  return (stored.blinkcareAuth as ExtensionAuth | undefined) ?? null;
};

const saveAuth = async (auth: ExtensionAuth) => {
  await chrome.storage.local.set({
    blinkcareAuth: auth,
    blinkcareWebBaseUrl: auth.webBaseUrl,
    blinkcareAuthenticatedUserId: auth.userId,
  });
};

const notificationCopy = (measure: ActivePlanMeasure, planName: string) => {
  const messages: Record<string, { title: string; message: string }> = {
    EYE_BREAK: { title: "ถึงเวลาพักสายตาแล้ว", message: "หยุดมองหน้าจอสักครู่และผ่อนคลายดวงตา" },
    DRY_EYE_BREAK: { title: "พักสายตาเพื่อลดอาการตาแห้ง", message: "หลับตาเบา ๆ และพักจากหน้าจอสักครู่" },
    RULE_20_20_20: { title: "ใช้กฎ 20-20-20", message: "มองวัตถุไกลประมาณ 20 ฟุต เป็นเวลา 20 วินาที" },
    STRAIN_20_20_20: { title: "ใช้กฎ 20-20-20", message: "มองวัตถุไกลประมาณ 20 ฟุต เป็นเวลา 20 วินาที" },
    DRY_20_20_20: { title: "ใช้กฎ 20-20-20", message: "มองไกลและกะพริบตาช้า ๆ เพื่อพักดวงตา" },
    BLINK_EXERCISE: { title: "ถึงเวลาฝึกกะพริบตา", message: "หลับตาเบา ๆ แล้วกะพริบช้า ๆ ให้ครบ" },
    STRAIN_BREAK: { title: "พักจากงานที่ใช้สายตา", message: "เปลี่ยนจุดโฟกัสและผ่อนคลายดวงตา" },
    BRIGHTNESS: { title: "ตรวจความสว่างหน้าจอ", message: "ปรับความสว่างจอให้ใกล้เคียงกับแสงรอบตัว" },
    SESSION_LIMIT: { title: "ใช้งานหน้าจอต่อเนื่องครบกำหนด", message: "ควรหยุดพักและออกจากหน้าจอสักครู่" },
    DAILY_LIMIT: { title: "ถึงขีดจำกัดเวลาหน้าจอวันนี้แล้ว", message: "เวลาที่ตรวจพบการใช้งานหน้าจอครบตามเป้าหมายแล้ว" },
    OFFLINE_BREAK: { title: "ถึงเวลาพักแบบไม่ใช้หน้าจอ", message: "ลองเดินหรือทำกิจกรรมที่ไม่ใช้หน้าจอสักครู่" },
  };
  const copy = messages[measure.measure_code] ?? {
    title: "แจ้งเตือนดูแลสุขภาพตา",
    message: measure.measure_name,
  };
  return { ...copy, message: `${copy.message} · ${planName}` };
};

const createSystemNotification = async (
  title: string,
  message: string,
  options: { reminderEventId?: number; category?: string } = {},
) => {
  const stored = await chrome.storage.local.get("blinkcareNotificationSettings");
  const settings = (stored.blinkcareNotificationSettings ?? {}) as NotificationSettings;
  if (options.category === "LOW_BLINK" && settings.lowBlinkRate === false) return;
  if (options.category === "FACE_MISSING" && settings.faceMissing === false) return;
  if (options.category === "POOR_LIGHTING" && settings.poorLighting === false) return;
  if (options.category === "PLAN_COMPLETED" && settings.planCompleted === false) return;

  const auth = await getAuth();
  if (auth) {
    const eventId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const historyKey = `blinkcareNotificationHistory:${auth.userId}`;
    const storedHistory = await chrome.storage.local.get(historyKey);
    const history = Array.isArray(storedHistory[historyKey]) ? storedHistory[historyKey] : [];
    await chrome.storage.local.set({
      [historyKey]: [{
        id: eventId,
        category: options.category ?? "PLAN_REMINDER",
        title,
        body: message,
        createdAt: new Date().toISOString(),
      }, ...history].slice(0, 20),
    });
    const eventResponse = await authenticatedFetch(auth, "/notifications/events", {
      method: "POST",
      body: JSON.stringify({
        event_key: eventId,
        category: options.category ?? "PLAN_REMINDER",
        title,
        body: message,
        source: "EXTENSION",
        occurred_at: new Date().toISOString(),
      }),
    });
    if (!eventResponse.ok) {
      console.error("Unable to save notification event:", await eventResponse.text());
    }
  }

  if (settings.muted !== true) {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ target: "offscreen", type: "BLINKCARE_PLAY_NOTIFICATION_SOUND" });
  }

  const notificationId = `blinkcare-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
    priority: 2,
    silent: true,
    requireInteraction: true,
    buttons: options.reminderEventId
      ? [{ title: "ทำสำเร็จ" }, { title: "ข้ามรอบนี้" }]
      : undefined,
  });
  if (options.reminderEventId) {
    await chrome.storage.local.set({
      [`blinkcareNotificationAction:${notificationId}`]: options.reminderEventId,
    });
  }
};

const saveBlinkRecord = async (ear: number, durationMs: number) => {
  const auth = await getAuth();
  const stored = await chrome.storage.local.get("blinkcareSessionId");
  if (!auth || !stored.blinkcareSessionId) return;
  const response = await authenticatedFetch(auth, "/detection/blink", {
    method: "POST",
    body: JSON.stringify({
      detection_id: stored.blinkcareSessionId,
      ear,
      duration_ms: durationMs,
    }),
  });
  if (!response.ok) {
    console.error("Unable to save blink record:", await response.text());
  }
};

const authenticatedFetch = async (
  auth: ExtensionAuth,
  endpoint: string,
  options: RequestInit = {},
) => {
  const request = (accessToken: string) => fetch(`${auth.apiBaseUrl}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let response = await request(auth.accessToken);
  if (response.status !== 401) return response;

  const refreshResponse = await fetch(`${auth.apiBaseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  if (!refreshResponse.ok) throw new Error("AUTH_REQUIRED");

  const refreshed = await refreshResponse.json();
  auth.accessToken = refreshed.accessToken;
  await saveAuth(auth);
  response = await request(auth.accessToken);
  return response;
};

const loadActivePlan = async (force = false) => {
  if (!force && Date.now() - lastPlanLoadedAt < 5 * 60_000) return activePlan;
  const auth = await getAuth();
  if (!auth) return null;
  const response = await authenticatedFetch(auth, "/plans/active");
  if (!response.ok) return activePlan;
  const result = await response.json();
  activePlan = result.data ?? null;
  lastPlanLoadedAt = Date.now();
  return activePlan;
};

const createReminderEvent = async (plan: ActivePlan, measure: ActivePlanMeasure) => {
  const auth = await getAuth();
  if (!auth) return undefined;
  const response = await authenticatedFetch(auth, "/plans/reminders", {
    method: "POST",
    body: JSON.stringify({
      plan_id: plan.plan_id,
      plan_measure_id: measure.plan_measure_id,
    }),
  });
  if (!response.ok) return undefined;
  const result = await response.json();
  return Number(result.data?.reminder_event_id) || undefined;
};

const triggerPlanReminder = async (plan: ActivePlan, measure: ActivePlanMeasure) => {
  const reminderEventId = await createReminderEvent(plan, measure);
  const copy = notificationCopy(measure, plan.plan_name);
  await createSystemNotification(copy.title, copy.message, { reminderEventId, category: "PLAN_REMINDER" });
};

const localDateKey = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const processPlanMeasures = async (activeSeconds: number, personPresent: boolean) => {
  const plan = await loadActivePlan();
  const auth = await getAuth();
  if (!plan || !auth) return;

  const delta = Math.max(0, activeSeconds - previousActiveSeconds);
  previousActiveSeconds = activeSeconds;
  continuousActiveSeconds = personPresent ? continuousActiveSeconds + delta : 0;

  const dailyKey = `blinkcareDailyActive:${auth.userId}:${localDateKey()}`;
  const dailyStored = await chrome.storage.local.get(dailyKey);
  const dailyActiveSeconds = Number(dailyStored[dailyKey] ?? 0) + delta;
  if (delta > 0) await chrome.storage.local.set({ [dailyKey]: dailyActiveSeconds });

  for (const measure of plan.measures) {
    if (!measure.is_enabled) continue;
    const keyBase = `blinkcareMeasure:${auth.userId}:${plan.plan_id}:${measure.plan_measure_id}`;

    if (measure.measure_code === "DAILY_LIMIT") {
      const threshold = Number(measure.target_value ?? 0) * 3600;
      const key = `${keyBase}:daily:${localDateKey()}`;
      const alerted = (await chrome.storage.local.get(key))[key] === true;
      if (threshold > 0 && dailyActiveSeconds >= threshold && !alerted) {
        await chrome.storage.local.set({ [key]: true });
        await triggerPlanReminder(plan, measure);
      }
      continue;
    }

    const threshold = Number(measure.interval_minutes ?? 0) * 60;
    if (threshold <= 0) continue;
    const continuous = measure.reminder_mode === "FLEXIBLE" || measure.measure_code === "SESSION_LIMIT";

    if (continuous) {
      const key = `${keyBase}:continuousRound`;
      if (!personPresent) {
        await chrome.storage.local.remove(key);
      } else {
        const currentRound = Math.floor(continuousActiveSeconds / threshold);
        const notifiedRound = Number((await chrome.storage.local.get(key))[key] ?? 0);
        if (currentRound > 0 && currentRound > notifiedRound) {
          await chrome.storage.local.set({ [key]: currentRound });
          await triggerPlanReminder(plan, measure);
        }
      }
      continue;
    }

    if (delta > 0) {
      const key = `${keyBase}:progress`;
      const stored = await chrome.storage.local.get(key);
      const progress = Number(stored[key] ?? 0) + delta;
      if (progress >= threshold) {
        await chrome.storage.local.set({ [key]: progress % threshold });
        await triggerPlanReminder(plan, measure);
      } else {
        await chrome.storage.local.set({ [key]: progress });
      }
    }
  }
};

const hasOffscreenDocument = async () => {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return contexts.length > 0;
};

const ensureOffscreenDocument = async () => {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Use the camera locally for detection and play BlinkCare notification sounds.",
  });
};

const updateBadge = async (monitoring: boolean) => {
  await chrome.action.setBadgeText({ text: monitoring ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#4f5de4" });
  await chrome.storage.local.set({ blinkcareMonitoring: monitoring });
};

const startBackendSession = async (auth: ExtensionAuth) => {
  const existing = await chrome.storage.local.get("blinkcareSessionId");
  if (existing.blinkcareSessionId) throw new Error("มี Session ที่ยังไม่ถูกปิด กรุณากดหยุดก่อนเริ่มใหม่");

  const response = await authenticatedFetch(auth, "/detection/start", { method: "POST" });
  const result = await response.json();
  if (!response.ok || !result.data?.session_id) {
    throw new Error(result.message || "ไม่สามารถสร้าง Detection Session ได้");
  }
  await chrome.storage.local.set({
    blinkcareSessionId: result.data.session_id,
    blinkcareSessionUserId: auth.userId,
  });
  const appUsageResponse = await authenticatedFetch(auth, "/app-usage/session", {
    method: "POST",
    body: JSON.stringify({ session_id: result.data.session_id }),
  });
  if (!appUsageResponse.ok) {
    console.error("Unable to start desktop app tracking:", await appUsageResponse.text());
  }

  try {
    const helperResponse = await fetch(`${HELPER_BASE_URL}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: result.data.session_id,
        api_base_url: auth.apiBaseUrl,
      }),
    });
    if (!helperResponse.ok) throw new Error(`Helper returned ${helperResponse.status}`);
  } catch (error) {
    console.error("Unable to start local app tracking:", error);
  }
};

const finishBackendSession = async (authOverride?: ExtensionAuth | null) => {
  const stored = await chrome.storage.local.get([
    "blinkcareSessionId", "blinkcareSessionUserId", "blinkCount", "activeSeconds",
  ]);
  if (!stored.blinkcareSessionId) return;

  const auth = authOverride ?? await getAuth();
  if (!auth || String(stored.blinkcareSessionUserId) !== auth.userId) {
    throw new Error("บัญชีปัจจุบันไม่ตรงกับเจ้าของ Detection Session");
  }

  const duration = Number(stored.activeSeconds ?? 0);
  const blinks = Number(stored.blinkCount ?? 0);
  const average = duration > 0 ? blinks / (duration / 60) : 0;
  try {
    await fetch(`${HELPER_BASE_URL}/session/stop`, { method: "POST" });
    await new Promise((resolve) => setTimeout(resolve, 300));
  } catch (error) {
    console.error("Unable to stop local app tracking:", error);
  }
  const appUsageResponse = await authenticatedFetch(auth, "/app-usage/end", { method: "POST" });
  if (!appUsageResponse.ok) {
    console.error("Unable to stop desktop app tracking:", await appUsageResponse.text());
  }
  const response = await authenticatedFetch(auth, "/detection/end", {
    method: "POST",
    body: JSON.stringify({
      session_id: stored.blinkcareSessionId,
      duration_seconds: duration,
      total_blinks: blinks,
      average_blinks_per_minute: average,
      average_ear: 0,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึก Detection Session ได้");
  await chrome.storage.local.remove(["blinkcareSessionId", "blinkcareSessionUserId"]);
};

const refreshActiveDesktopApp = async () => {
  const now = Date.now();
  if (now - lastHelperPollAt < 1_000) return;
  lastHelperPollAt = now;
  try {
    const response = await fetch(`${HELPER_BASE_URL}/status`);
    if (!response.ok) throw new Error(`Helper returned ${response.status}`);
    const status = await response.json();
    await chrome.storage.local.set({
      blinkcareHelperConnected: status.connected === true,
      blinkcareActiveApp: status.tracking && typeof status.active_app === "string"
        ? status.active_app
        : null,
    });
  } catch {
    await chrome.storage.local.set({
      blinkcareHelperConnected: false,
      blinkcareActiveApp: null,
    });
  }
};

const stopDetection = async () => {
  const stored = await chrome.storage.local.get("blinkcareMonitoring");
  if (stored.blinkcareMonitoring === true) {
    await chrome.runtime.sendMessage({ target: "offscreen", type: "BLINKCARE_STOP" });
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
};

const syncAuth = async (
  message: Extract<ExtensionMessage, { type: "BLINKCARE_AUTH_SYNC" }>,
) => {
  const userId = readUserId(message.accessToken);
  if (!userId) return;

  const previousAuth = await getAuth();
  if (previousAuth && previousAuth.userId !== userId) {
    await stopDetection();
    await finishBackendSession(previousAuth);
  }

  await saveAuth({ ...message, userId });
  await chrome.storage.local.set({
    blinkcareNotificationSettings: message.notificationSettings ?? {},
  });
  activePlan = null;
  lastPlanLoadedAt = 0;
  await loadActivePlan(true);
};

const clearAuth = async (
  message: Extract<ExtensionMessage, { type: "BLINKCARE_AUTH_CLEAR" }>,
) => {
  const previousAuth = await getAuth();
  await chrome.storage.local.set({ blinkcareWebBaseUrl: message.webBaseUrl });

  if (previousAuth) {
    await stopDetection();
    await finishBackendSession(previousAuth);
  }

  await chrome.storage.local.remove([
    "blinkcareAuth", "blinkcareAuthenticatedUserId", "blinkcareSessionId", "blinkcareSessionUserId",
  ]);
  activePlan = null;
  lastPlanLoadedAt = 0;
  previousActiveSeconds = 0;
  continuousActiveSeconds = 0;
};

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ blinkcareMonitoring: false });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  void (async () => {
    const key = `blinkcareNotificationAction:${notificationId}`;
    const stored = await chrome.storage.local.get(key);
    const reminderEventId = Number(stored[key]);
    if (!reminderEventId) return;
    const auth = await getAuth();
    if (!auth) return;
    const status = buttonIndex === 0 ? "COMPLETED" : "SKIPPED";
    const response = await authenticatedFetch(auth, `/plans/reminders/${reminderEventId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (response.ok && status === "COMPLETED") {
      await createSystemNotification(
        "บันทึกการทำตามแผนแล้ว",
        "เยี่ยมมาก ระบบบันทึกรอบที่ทำสำเร็จให้คุณแล้ว",
        { category: "PLAN_COMPLETED" },
      );
    }
    await chrome.storage.local.remove(key);
    await chrome.notifications.clear(notificationId);
  })().catch((error) => console.error("Unable to update reminder response:", error));
});

chrome.notifications.onClosed.addListener((notificationId) => {
  void chrome.storage.local.remove(`blinkcareNotificationAction:${notificationId}`);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "BLINKCARE_STATUS") void updateBadge(message.monitoring);

  if (message.type === "BLINKCARE_ALERT") {
    void createSystemNotification(message.title, message.message, { category: message.category });
  }

  if (message.type === "BLINKCARE_BLINK_DETECTED") {
    blinkOperation = blinkOperation
      .then(() => saveBlinkRecord(message.ear, message.durationMs))
      .catch((error) => console.error("Unable to queue blink record:", error));
  }

  if (message.type === "BLINKCARE_DETECTION_UPDATE") {
    void chrome.storage.local.set({
      blinkCount: message.blinkCount,
      blinksPerMinute: message.blinksPerMinute,
      activeSeconds: message.activeSeconds,
      personPresent: message.personPresent,
      lightingLevel: message.lightingLevel,
    });
    planOperation = planOperation
      .then(() => processPlanMeasures(message.activeSeconds, message.personPresent))
      .catch((error) => console.error("Unable to process plan reminders:", error));
    void refreshActiveDesktopApp();
  }

  if (message.type === "BLINKCARE_ERROR") {
    void chrome.storage.local.set({ blinkcareMonitoring: false, blinkcareLastError: message.message });
    void finishBackendSession().catch((error) => console.error("Unable to close failed session:", error));
  }

  if (message.type === "BLINKCARE_AUTH_SYNC") {
    void enqueueAuthOperation(() => syncAuth(message))
      .catch((error) => console.error("Unable to sync BlinkCare account:", error));
  }

  if (message.type === "BLINKCARE_AUTH_CLEAR") {
    void enqueueAuthOperation(() => clearAuth(message))
      .catch((error) => console.error("Unable to clear BlinkCare account:", error));
  }

  if (message.type === "BLINKCARE_OPEN_LOGIN") {
    void chrome.tabs.create({ url: `${PRODUCTION_WEB_BASE_URL}/login` })
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "BLINKCARE_PLAN_UPDATED") {
    activePlan = null;
    lastPlanLoadedAt = 0;
    void loadActivePlan(true).catch((error) => console.error("Unable to refresh active plan:", error));
  }

  if (message.type === "BLINKCARE_GET_NOTIFICATION_HISTORY") {
    void getAuth()
      .then(async (auth) => {
        if (!auth) return [];
        const key = `blinkcareNotificationHistory:${auth.userId}`;
        return (await chrome.storage.local.get(key))[key] ?? [];
      })
      .then((history) => sendResponse({ ok: true, history }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }

  if (message.type === "BLINKCARE_GET_DEVICE_STATUS") {
    lastHelperPollAt = 0;
    void refreshActiveDesktopApp()
      .then(() => chrome.storage.local.get([
        "blinkcareAuthenticatedUserId",
        "blinkcareHelperConnected",
        "blinkcareActiveApp",
        "blinkcareMonitoring",
      ]))
      .then((stored) => sendResponse({
        ok: true,
        installed: true,
        connected: true,
        authenticated: stored.blinkcareAuthenticatedUserId !== undefined,
        helperConnected: stored.blinkcareHelperConnected === true,
        activeApp: typeof stored.blinkcareActiveApp === "string" ? stored.blinkcareActiveApp : null,
        monitoring: stored.blinkcareMonitoring === true,
        version: chrome.runtime.getManifest().version,
      })).catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }

  if (message.type === "BLINKCARE_POPUP_START") {
    void getAuth().then(async (auth) => {
      if (!auth) throw new Error("AUTH_REQUIRED");
      await startBackendSession(auth);
      await chrome.storage.local.remove("blinkcareLastError");
      await chrome.storage.local.set({ blinkCount: 0, blinksPerMinute: 0, activeSeconds: 0, personPresent: false });
      previousActiveSeconds = 0;
      continuousActiveSeconds = 0;
      lastHelperPollAt = 0;
      await loadActivePlan(true);
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({ target: "offscreen", type: "BLINKCARE_START" });
    }).then(() => sendResponse({ ok: true })).catch((error: unknown) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    return true;
  }

  if (message.type === "BLINKCARE_POPUP_STOP") {
    void stopDetection()
      .then(() => blinkOperation)
      .then(() => finishBackendSession())
      .then(() => chrome.storage.local.set({ blinkcareActiveApp: null }))
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }
});
