import { useEffect, useState } from "react";
import { LuEye, LuX } from "react-icons/lu";
import "./PlanNotificationToast.css";

type ToastMessage = {
  title: string;
  body: string;
};

export default function PlanNotificationToast() {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  useEffect(() => {
    let dismissTimer: number | undefined;

    const showToast = (event: Event) => {
      const notificationEvent = event as CustomEvent<ToastMessage>;
      window.clearTimeout(dismissTimer);
      setMessage(notificationEvent.detail);
      dismissTimer = window.setTimeout(() => setMessage(null), 8000);
    };

    window.addEventListener("blinkcare:notification", showToast);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener("blinkcare:notification", showToast);
    };
  }, []);

  if (!message) return null;

  return (
    <div className="plan-notification-toast" role="status" aria-live="polite">
      <span className="toast-icon"><LuEye /></span>
      <div>
        <strong>{message.title}</strong>
        <p>{message.body}</p>
      </div>
      <button onClick={() => setMessage(null)} aria-label="ปิดการแจ้งเตือน" title="ปิด">
        <LuX />
      </button>
    </div>
  );
}
