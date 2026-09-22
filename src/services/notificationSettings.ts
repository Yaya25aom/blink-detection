import { getCurrentUserId } from "../utils/token";

export type NotificationSettings = {
  lowBlinkRate: boolean;
  faceMissing: boolean;
  poorLighting: boolean;
  planCompleted: boolean;
  muted: boolean;
};

export type NotificationCategory =
  | "PLAN_REMINDER"
  | "LOW_BLINK"
  | "FACE_MISSING"
  | "POOR_LIGHTING"
  | "PLAN_COMPLETED";

export type NotificationHistoryItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
};

const accountKey = (name: string) => `${name}:${getCurrentUserId() ?? "guest"}`;
const settingsKey = () => accountKey("blinkCareNotificationSettings");
const historyKey = () => accountKey("blinkCareNotificationHistory");

export const defaultNotificationSettings: NotificationSettings = {
  lowBlinkRate: true,
  faceMissing: true,
  poorLighting: true,
  planCompleted: true,
  muted: false,
};

export const readNotificationSettings = (): NotificationSettings => {
  try {
    return {
      ...defaultNotificationSettings,
      ...JSON.parse(localStorage.getItem(settingsKey()) ?? "{}"),
    };
  } catch {
    return defaultNotificationSettings;
  }
};

export const saveNotificationSettings = (settings: NotificationSettings) => {
  localStorage.setItem(settingsKey(), JSON.stringify(settings));
  window.dispatchEvent(new Event("blinkcare:notification-settings-updated"));
};

export const isNotificationEnabled = (category: NotificationCategory) => {
  const settings = readNotificationSettings();
  if (category === "LOW_BLINK") return settings.lowBlinkRate;
  if (category === "FACE_MISSING") return settings.faceMissing;
  if (category === "POOR_LIGHTING") return settings.poorLighting;
  if (category === "PLAN_COMPLETED") return settings.planCompleted;
  return true;
};

export const addNotificationHistory = (
  category: NotificationCategory,
  title: string,
  body: string,
) => {
  const item: NotificationHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    category,
    title,
    body,
    createdAt: new Date().toISOString(),
  };
  const history = readNotificationHistory();
  localStorage.setItem(historyKey(), JSON.stringify([item, ...history].slice(0, 20)));
  window.dispatchEvent(new Event("blinkcare:notification-history-updated"));
};

export const readNotificationHistory = (): NotificationHistoryItem[] => {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey()) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
