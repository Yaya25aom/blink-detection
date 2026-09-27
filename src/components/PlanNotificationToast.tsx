import { useEffect, useRef, useState } from "react";
import { LuCheck, LuEye, LuExternalLink, LuX } from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import type { PlanNotificationDetail } from "../services/planNotification";
import { showPlanNotification } from "../services/planNotification";
import "./PlanNotificationToast.css";
import PlanActivityGuide from "./PlanActivityGuide";

export default function PlanNotificationToast() {
  const [message, setMessage] = useState<PlanNotificationDetail | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const dismissTimer = useRef<number | undefined>(undefined);

  const respond = async (status: "COMPLETED" | "SKIPPED") => {
    const reminderEventId = message?.reminderEventId;
    setMessage(null);
    setShowGuide(false);
    if (!reminderEventId) return;
    try {
      await apiFetch(`/plans/reminders/${reminderEventId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      window.dispatchEvent(new Event("blinkcare:plan-progress-updated"));
      if (status === "COMPLETED") {
        window.setTimeout(() => void showPlanNotification(
          "ทำตามแผนสำเร็จ",
          "บันทึกการทำตามมาตรการของคุณเรียบร้อยแล้ว",
          undefined,
          "PLAN_COMPLETED",
        ), 250);
      }
    } catch (error) {
      console.error("Unable to update reminder response:", error);
    }
  };

  useEffect(() => {
    const showToast = (event: Event) => {
      const notificationEvent = event as CustomEvent<PlanNotificationDetail>;
      window.clearTimeout(dismissTimer.current);
      setShowGuide(false);
      setMessage(notificationEvent.detail);
      dismissTimer.current = window.setTimeout(() => {
        setMessage((current) => {
          if (current?.reminderEventId) {
            void apiFetch(`/plans/reminders/${current.reminderEventId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "SKIPPED" }),
            }).then(() => window.dispatchEvent(new Event("blinkcare:plan-progress-updated")));
          }
          return null;
        });
      }, 20_000);
    };

    window.addEventListener("blinkcare:notification", showToast);
    return () => {
      window.clearTimeout(dismissTimer.current);
      window.removeEventListener("blinkcare:notification", showToast);
    };
  }, []);

  if (!message) return null;

  if (showGuide) return <PlanActivityGuide title={message.title} measureCode={message.measureCode} onComplete={() => void respond("COMPLETED")} onSkip={() => void respond("SKIPPED")} onClose={() => setShowGuide(false)} />;

  return (
    <div className="plan-notification-toast" role="status" aria-live="polite">
      <span className="toast-icon"><LuEye /></span>
      <div>
        <strong>{message.title}</strong>
        <p>{message.body}</p>
        {message.reminderEventId && <div className="toast-actions"><button className="toast-guide" onClick={() => { window.clearTimeout(dismissTimer.current); setShowGuide(true); }}><LuExternalLink />ดูวิธีทำ</button><button className="toast-complete" onClick={() => void respond("COMPLETED")}><LuCheck />ทำแล้ว</button><button className="toast-skip" onClick={() => void respond("SKIPPED")}>ข้าม</button></div>}
      </div>
      <button className="toast-close" onClick={() => void respond("SKIPPED")} aria-label="ปิดการแจ้งเตือน" title="ปิดและนับเป็นข้าม">
        <LuX />
      </button>
    </div>
  );
}
