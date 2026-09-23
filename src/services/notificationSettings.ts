import { getCurrentUserId } from "../utils/token";
import { apiFetch } from "./apiClient";

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
  void apiFetch("/notifications/events", {
    method: "POST",
    body: JSON.stringify({
      event_key: item.id,
      category,
      title,
      body,
      source: "WEB",
      occurred_at: item.createdAt,
    }),
  }).catch(() => undefined);
};

export const readNotificationHistory = (): NotificationHistoryItem[] => {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey()) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const syncNotificationHistory = async (): Promise<NotificationHistoryItem[]> => {
  const local = readNotificationHistory();
  await Promise.all(local.map((item) => apiFetch("/notifications/events", {
    method: "POST",
    body: JSON.stringify({
      event_key: item.id,
      category: item.category,
      title: item.title,
      body: item.body,
      source: "WEB_IMPORT",
      occurred_at: item.createdAt,
    }),
  }).catch(() => null)));
  const response = await apiFetch("/notifications/events?limit=20");
  if (!response.ok) throw new Error("Unable to load notification history");
  const result = await response.json();
  const remote: NotificationHistoryItem[] = (result.data ?? []).map((item: {
    event_key: string; category: NotificationCategory; title: string; body: string; occurred_at: string;
  }) => ({
    id: item.event_key,
    category: item.category,
    title: item.title,
    body: item.body,
    createdAt: item.occurred_at,
  }));
  const merged = [...remote, ...local]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 20);
  localStorage.setItem(historyKey(), JSON.stringify(merged));
  return merged;
};
