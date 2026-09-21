import { useEffect } from "react";
import { apiFetch } from "../services/apiClient";
import {
  showPlanNotification,
  type ActivePlan,
  type ActivePlanMeasure,
} from "../services/planNotification";
import {
  DETECTION_TELEMETRY_EVENT,
  type DetectionTelemetry,
} from "../services/detectionTelemetry";

const PLAN_REFRESH_MS = 5 * 60 * 1000;

const notificationCopy = (measure: ActivePlanMeasure, planName: string) => {
  const messages: Record<string, { title: string; body: string }> = {
    EYE_BREAK: { title: "ถึงเวลาพักสายตาแล้ว", body: "หยุดมองหน้าจอสักครู่และผ่อนคลายดวงตา" },
    DRY_EYE_BREAK: { title: "พักสายตาเพื่อลดอาการตาแห้ง", body: "หลับตาเบา ๆ และพักจากหน้าจอสักครู่" },
    RULE_20_20_20: { title: "ใช้กฎ 20-20-20", body: "มองวัตถุไกลประมาณ 20 ฟุต เป็นเวลา 20 วินาที" },
    STRAIN_20_20_20: { title: "ใช้กฎ 20-20-20", body: "มองวัตถุไกลประมาณ 20 ฟุต เป็นเวลา 20 วินาที" },
    DRY_20_20_20: { title: "ใช้กฎ 20-20-20", body: "มองไกลและกะพริบตาช้า ๆ เพื่อพักดวงตา" },
    BLINK_EXERCISE: { title: "ถึงเวลาฝึกกะพริบตา", body: "หลับตาเบา ๆ แล้วกะพริบช้า ๆ ให้ครบ" },
    STRAIN_BREAK: { title: "พักจากงานที่ใช้สายตา", body: "เปลี่ยนจุดโฟกัสและผ่อนคลายดวงตา" },
    BRIGHTNESS: { title: "ตรวจความสว่างหน้าจอ", body: "ปรับความสว่างจอให้ใกล้เคียงกับแสงรอบตัว" },
    SESSION_LIMIT: { title: "ใช้งานหน้าจอต่อเนื่องครบกำหนด", body: "ควรหยุดพักและออกจากหน้าจอสักครู่" },
    DAILY_LIMIT: { title: "ถึงขีดจำกัดเวลาหน้าจอวันนี้แล้ว", body: "เวลาที่ตรวจพบการใช้งานหน้าจอครบตามเป้าหมายแล้ว" },
    OFFLINE_BREAK: { title: "ถึงเวลาพักแบบไม่ใช้หน้าจอ", body: "ลองเดินหรือทำกิจกรรมที่ไม่ใช้หน้าจอสักครู่" },
  };

  return messages[measure.measure_code] ?? {
    title: "แจ้งเตือนดูแลสุขภาพตา",
    body: `${measure.measure_name} ตามแผน “${planName}”`,
  };
};

export default function PlanReminder() {
  useEffect(() => {
    if (!localStorage.getItem("accessToken")) return;

    let activePlan: ActivePlan | null = null;
    let stopped = false;

    const loadPlan = async () => {
      try {
        const response = await apiFetch("/plans/active");
        if (!response.ok) return;
        const result = await response.json();
        if (!stopped) activePlan = result.data;
      } catch (error) {
        console.error("Unable to load plan reminders:", error);
      }
    };

    const notify = (measure: ActivePlanMeasure) => {
      if (!activePlan) return;
      const copy = notificationCopy(measure, activePlan.plan_name);
      void showPlanNotification(copy.title, `${copy.body} · ${activePlan.plan_name}`);
    };

    const handleTelemetry = (event: Event) => {
      if (!activePlan) return;
      const telemetry = (event as CustomEvent<DetectionTelemetry>).detail;

      for (const measure of activePlan.measures) {
        if (!measure.is_enabled) continue;

        const keyBase = `blinkCareReminder:${activePlan.plan_id}:${measure.plan_measure_id}`;
        const thresholdSeconds = Number(measure.interval_minutes ?? 0) * 60;

        if (measure.measure_code === "DAILY_LIMIT") {
          const targetSeconds = Number(measure.target_value ?? 0) * 3600;
          const now = new Date();
          const dateKey = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
            .toISOString()
            .slice(0, 10);
          const alertedKey = `${keyBase}:daily:${dateKey}`;
          if (targetSeconds > 0 && telemetry.dailyActiveSeconds >= targetSeconds && !localStorage.getItem(alertedKey)) {
            localStorage.setItem(alertedKey, "true");
            notify(measure);
          }
          continue;
        }

        if (thresholdSeconds <= 0) continue;

        const requiresContinuousUse =
          measure.reminder_mode === "FLEXIBLE" ||
          measure.measure_code === "SESSION_LIMIT";

        if (requiresContinuousUse) {
          const triggeredKey = `${keyBase}:continuousTriggered`;
          if (!telemetry.personPresent) {
            localStorage.removeItem(triggeredKey);
          } else if (
            telemetry.continuousActiveSeconds >= thresholdSeconds &&
            !localStorage.getItem(triggeredKey)
          ) {
            localStorage.setItem(triggeredKey, "true");
            notify(measure);
          }
          continue;
        }

        if (telemetry.deltaActiveSeconds > 0) {
          const progressKey = `${keyBase}:activeSeconds`;
          const progress = Number(localStorage.getItem(progressKey) ?? 0) + telemetry.deltaActiveSeconds;
          if (progress >= thresholdSeconds) {
            localStorage.setItem(progressKey, String(progress % thresholdSeconds));
            notify(measure);
          } else {
            localStorage.setItem(progressKey, String(progress));
          }
        }
      }
    };

    const handlePlanUpdated = () => void loadPlan();
    void loadPlan();
    const refreshTimer = window.setInterval(() => void loadPlan(), PLAN_REFRESH_MS);
    window.addEventListener("blinkcare:plan-updated", handlePlanUpdated);
    window.addEventListener(DETECTION_TELEMETRY_EVENT, handleTelemetry);

    return () => {
      stopped = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener("blinkcare:plan-updated", handlePlanUpdated);
      window.removeEventListener(DETECTION_TELEMETRY_EVENT, handleTelemetry);
    };
  }, []);

  return null;
}
