import {
  addNotificationHistory,
  isNotificationEnabled,
  readNotificationSettings,
  type NotificationCategory,
} from "./notificationSettings";

export type ActivePlanMeasure = {
  plan_measure_id: number;
  measure_code: string;
  measure_name: string;
  target_value: number | string | null;
  target_unit: string | null;
  interval_minutes: number | null;
  reminder_mode: "FLEXIBLE" | "SCHEDULED";
  is_enabled: boolean;
};

export type ActivePlan = {
  plan_id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  goal_code: string;
  goal_name: string;
  measures: ActivePlanMeasure[];
};

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  return Notification.requestPermission();
};

export type PlanNotificationDetail = {
  title: string;
  body: string;
  reminderEventId?: number;
  category: NotificationCategory;
};

const playNotificationSound = async () => {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  try {
    if (context.state === "suspended") await context.resume();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
    gain.connect(context.destination);

    [740, 988].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.14);
      oscillator.stop(context.currentTime + 0.26 + index * 0.14);
    });
    window.setTimeout(() => void context.close(), 650);
  } catch {
    await context.close();
  }
};

export const showPlanNotification = async (
  title: string,
  body: string,
  reminderEventId?: number,
  category: NotificationCategory = "PLAN_REMINDER",
) => {
  if (!isNotificationEnabled(category)) return false;

  addNotificationHistory(category, title, body);
  window.dispatchEvent(new CustomEvent("blinkcare:notification", {
    detail: { title, body, reminderEventId, category } satisfies PlanNotificationDetail,
  }));

  if (!readNotificationSettings().muted) void playNotificationSound();

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return false;

  new Notification(title, {
    body,
    icon: "/favicon.svg",
    tag: "blinkcare-eye-health-reminder",
    silent: readNotificationSettings().muted,
  });
  return true;
};
