export {};

const apiBaseUrl = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  ? "http://localhost:3000/api"
  : "https://api.blinkcare.website/api";

let lastAuthState: string | null = null;
let currentUserId: string | null = null;

document.documentElement.dataset.blinkcareExtension = chrome.runtime.getManifest().version;

const syncAuth = () => {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");
  const nextAuthState = `${accessToken ?? ""}:${refreshToken ?? ""}`;

  if (nextAuthState === lastAuthState) return;
  lastAuthState = nextAuthState;

  if (accessToken && refreshToken) {
    let notificationSettings = {};
    try {
      const payloadPart = accessToken.split(".")[1];
      const normalized = payloadPart?.replace(/-/g, "+").replace(/_/g, "/") ?? "";
      const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
      currentUserId = String(payload.user_id);
      notificationSettings = JSON.parse(
        localStorage.getItem(`blinkCareNotificationSettings:${payload.user_id}`) ?? "{}",
      );
    } catch {
      notificationSettings = {};
    }
    void chrome.runtime.sendMessage({
      type: "BLINKCARE_AUTH_SYNC",
      accessToken,
      refreshToken,
      apiBaseUrl,
      webBaseUrl: location.origin,
      notificationSettings,
    });
  } else {
    currentUserId = null;
    void chrome.runtime.sendMessage({
      type: "BLINKCARE_AUTH_CLEAR",
      apiBaseUrl,
      webBaseUrl: location.origin,
    });
  }
};

const syncNotificationHistory = async () => {
  if (!currentUserId) return;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "BLINKCARE_GET_NOTIFICATION_HISTORY",
    });
    if (!response?.ok || !Array.isArray(response.history)) return;
    const key = `blinkCareNotificationHistory:${currentUserId}`;
    const websiteHistory = JSON.parse(localStorage.getItem(key) ?? "[]");
    const merged = [...response.history, ...(Array.isArray(websiteHistory) ? websiteHistory : [])]
      .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 20);
    localStorage.setItem(key, JSON.stringify(merged));
    window.dispatchEvent(new Event("blinkcare:notification-history-updated"));
  } catch {
    // The extension may be reloading while this content script is still alive.
  }
};

syncAuth();
window.addEventListener("storage", syncAuth);
window.addEventListener("blinkcare:auth-updated", syncAuth);
window.addEventListener("blinkcare:notification-settings-updated", () => {
  lastAuthState = null;
  syncAuth();
});
window.addEventListener("blinkcare:plan-updated", () => {
  void chrome.runtime.sendMessage({ type: "BLINKCARE_PLAN_UPDATED" });
});
setInterval(syncAuth, 1_500);
void syncNotificationHistory();
setInterval(() => void syncNotificationHistory(), 2_000);

const syncLiveDetection = async () => {
  try {
    const status = await chrome.runtime.sendMessage({
      type: "BLINKCARE_GET_LIVE_DETECTION",
    });
    window.dispatchEvent(new CustomEvent("blinkcare:extension-detection", {
      detail: status,
    }));
    window.postMessage({
      source: "BLINKCARE_EXTENSION",
      type: "BLINKCARE_LIVE_DETECTION",
      payload: status,
    }, "*");
  } catch {
    window.dispatchEvent(new CustomEvent("blinkcare:extension-detection", {
      detail: { ok: false, monitoring: false },
    }));
  }
};

void syncLiveDetection();
setInterval(() => void syncLiveDetection(), 250);

window.addEventListener("blinkcare:extension-command", (event: Event) => {
  const detail = (event as CustomEvent<{ requestId?: string; action?: "START" | "STOP" | "PAUSE" | "RESUME" }>).detail;
  if (!detail?.requestId || !detail.action) return;
  const type = `BLINKCARE_POPUP_${detail.action}`;
  void chrome.runtime.sendMessage({ type })
    .then((response) => {
      window.dispatchEvent(new CustomEvent("blinkcare:extension-command-response", {
        detail: { requestId: detail.requestId, ...response },
      }));
    })
    .catch((error: unknown) => {
      window.dispatchEvent(new CustomEvent("blinkcare:extension-command-response", {
        detail: {
          requestId: detail.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    });
});

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.data?.source !== "BLINKCARE_WEB") return;
  if (event.data?.type !== "BLINKCARE_EXTENSION_COMMAND") return;
  const detail = event.data.payload as { requestId?: string; action?: "START" | "STOP" | "PAUSE" | "RESUME" };
  if (!detail?.requestId || !detail.action) return;
  const type = `BLINKCARE_POPUP_${detail.action}`;
  void chrome.runtime.sendMessage({ type })
    .then((response) => {
      window.postMessage({
        source: "BLINKCARE_EXTENSION",
        type: "BLINKCARE_EXTENSION_COMMAND_RESPONSE",
        payload: { requestId: detail.requestId, ...response },
      }, "*");
    })
    .catch((error: unknown) => {
      window.postMessage({
        source: "BLINKCARE_EXTENSION",
        type: "BLINKCARE_EXTENSION_COMMAND_RESPONSE",
        payload: {
          requestId: detail.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }, "*");
    });
});

window.addEventListener("blinkcare:device-status-request", () => {
  void chrome.runtime.sendMessage({ type: "BLINKCARE_GET_DEVICE_STATUS" })
    .then((status) => {
      window.dispatchEvent(new CustomEvent("blinkcare:device-status-response", {
        detail: status,
      }));
    })
    .catch(() => {
      window.dispatchEvent(new CustomEvent("blinkcare:device-status-response", {
        detail: { ok: false, installed: true },
      }));
    });
});
