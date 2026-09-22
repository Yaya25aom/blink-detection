import { useEffect } from "react";
import {
  DETECTION_TELEMETRY_EVENT,
  type DetectionTelemetry,
} from "../services/detectionTelemetry";
import { showPlanNotification } from "../services/planNotification";
import { getCurrentUserId } from "../utils/token";

const COOLDOWN_MS = 5 * 60 * 1000;

export default function DetectionHealthAlerts() {
  useEffect(() => {
    let missingFaceSeconds = 0;
    let darkSeconds = 0;
    let activeUserId = getCurrentUserId();
    const lastAlert: Record<string, number> = {};

    const canAlert = (key: string, timestamp: number) => {
      if (timestamp - (lastAlert[key] ?? 0) < COOLDOWN_MS) return false;
      lastAlert[key] = timestamp;
      return true;
    };

    const handleTelemetry = (event: Event) => {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) {
        activeUserId = null;
        missingFaceSeconds = 0;
        darkSeconds = 0;
        return;
      }
      if (currentUserId !== activeUserId) {
        activeUserId = currentUserId;
        missingFaceSeconds = 0;
        darkSeconds = 0;
        Object.keys(lastAlert).forEach((key) => delete lastAlert[key]);
      }

      const telemetry = (event as CustomEvent<DetectionTelemetry>).detail;
      if (!telemetry.monitoring) {
        missingFaceSeconds = 0;
        darkSeconds = 0;
        return;
      }

      missingFaceSeconds = telemetry.personPresent ? 0 : missingFaceSeconds + 1;
      darkSeconds = telemetry.lightingLevel === "DARK" ? darkSeconds + 1 : 0;

      if (
        telemetry.personPresent &&
        telemetry.sessionActiveSeconds >= 60 &&
        telemetry.blinkRate < 12 &&
        canAlert("low-blink", telemetry.timestamp)
      ) {
        void showPlanNotification(
          "อัตราการกะพริบตาต่ำกว่ามาตรฐาน",
          `ขณะนี้ ${telemetry.blinkRate} ครั้ง/นาที ควรกะพริบอย่างน้อย 12 ครั้ง/นาที`,
          undefined,
          "LOW_BLINK",
        );
      }

      if (missingFaceSeconds >= 30 && canAlert("face-missing", telemetry.timestamp)) {
        void showPlanNotification(
          "ไม่พบใบหน้า",
          "ระบบหยุดนับเวลาใช้งานชั่วคราว กรุณากลับมาอยู่ในมุมกล้อง",
          undefined,
          "FACE_MISSING",
        );
      }

      if (darkSeconds >= 10 && canAlert("poor-lighting", telemetry.timestamp)) {
        void showPlanNotification(
          "แสงไม่เพียงพอสำหรับการตรวจจับ",
          "บริเวณใบหน้ามืดเกินไป กรุณาเพิ่มแสงเพื่อให้ตรวจจับได้ชัดเจน",
          undefined,
          "POOR_LIGHTING",
        );
      }
    };

    window.addEventListener(DETECTION_TELEMETRY_EVENT, handleTelemetry);
    return () => window.removeEventListener(DETECTION_TELEMETRY_EVENT, handleTelemetry);
  }, []);

  return null;
}
