import { useNavigate, useSearchParams } from "react-router-dom";
import PlanActivityGuide from "../components/PlanActivityGuide";
import { apiFetch } from "../services/apiClient";

export default function PlanActivity() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reminderEventId = Number(params.get("event"));
  const measureCode = params.get("measure") ?? undefined;
  const title = params.get("title") ?? "กิจกรรมพักสายตา";

  const respond = async (status: "COMPLETED" | "SKIPPED") => {
    if (reminderEventId > 0) {
      await apiFetch(`/plans/reminders/${reminderEventId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      window.dispatchEvent(new Event("blinkcare:plan-progress-updated"));
    }
    navigate("/plans", { replace: true });
  };

  return <PlanActivityGuide title={title} measureCode={measureCode} onComplete={() => void respond("COMPLETED")} onSkip={() => void respond("SKIPPED")} onClose={() => navigate("/plans", { replace: true })} />;
}
