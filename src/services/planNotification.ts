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

export const showPlanNotification = async (title: string, body: string) => {
  window.dispatchEvent(new CustomEvent("blinkcare:notification", {
    detail: { title, body },
  }));

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return false;

  new Notification(title, {
    body,
    icon: "/favicon.svg",
    tag: "blinkcare-eye-health-reminder",
  });
  return true;
};
