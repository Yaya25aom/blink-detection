import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuActivity,
  LuArrowRight,
  LuCalendarDays,
  LuChartNoAxesCombined,
  LuClock3,
  LuEye,
  LuHistory,
  LuPlay,
  LuRefreshCw,
  LuShieldCheck,
} from "react-icons/lu";
import heroImage from "../assets/overview-eye-care-hero.webp";
import planCtaImage from "../assets/overview-plan-cta.webp";
import { apiFetch } from "../services/apiClient";
import "./Overview.css";

type DashboardData = {
  normal_range: { min: number; max: number };
  summary: { session_count: number; total_duration_seconds: number; average_blinks_per_minute: number };
  app_usage: Array<{ app_name: string; duration_seconds: number; blink_rate: number }>;
  risk_periods: Array<{ app_name: string; started_at: string; blink_rate: number; risk_level: "high" | "medium" }>;
};

type PlanData = {
  plan_id: string;
  plan_name: string;
  goal_name: string;
  start_date: string;
  end_date: string;
  effective_status: "ACTIVE" | "UPCOMING" | "COMPLETED";
  occurred_rounds: number;
  completed_rounds: number;
};

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const formatMinutes = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} ชม. ${minutes % 60} นาที` : `${minutes} นาที`;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export default function Overview({ onNavigate }: { onNavigate: (page: string) => void }) {
  const isGuest = !localStorage.getItem("accessToken");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    if (!localStorage.getItem("accessToken")) {
      setDashboard(null);
      setPlans([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [dashboardResponse, plansResponse] = await Promise.all([
        apiFetch(`/dashboard?date=${localDate()}`),
        apiFetch("/plans"),
      ]);
      if (!dashboardResponse.ok || !plansResponse.ok) throw new Error("ไม่สามารถโหลดข้อมูล Overview ได้");
      const [dashboardResult, plansResult] = await Promise.all([dashboardResponse.json(), plansResponse.json()]);
      setDashboard(dashboardResult.data);
      setPlans(plansResult.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ไม่สามารถโหลดข้อมูล Overview ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const activePlan = plans.find((plan) => plan.effective_status === "ACTIVE");
  const activePlanCount = plans.filter((plan) => plan.effective_status === "ACTIVE").length;
  const completion = activePlan?.occurred_rounds
    ? Math.round(activePlan.completed_rounds / activePlan.occurred_rounds * 100)
    : 0;
  const health = useMemo(() => {
    if (isGuest) return { label: "-", tone: "empty" };
    if (!dashboard || dashboard.summary.session_count === 0) return { label: "ยังไม่มีข้อมูล", tone: "empty" };
    const rate = dashboard.summary.average_blinks_per_minute;
    if (rate < dashboard.normal_range.min) return { label: "ควรเฝ้าระวัง", tone: "high" };
    if (rate > dashboard.normal_range.max) return { label: "สูงกว่าปกติ", tone: "medium" };
    return { label: "ปกติ", tone: "normal" };
  }, [dashboard, isGuest]);

  const viewDashboard: DashboardData = dashboard ?? {
    normal_range: { min: 12, max: 20 },
    summary: { session_count: 0, total_duration_seconds: 0, average_blinks_per_minute: 0 },
    app_usage: [],
    risk_periods: [],
  };

  const quickActions = [
    { title: "ตรวจจับแบบเรียลไทม์", text: "เริ่มตรวจจับการกะพริบตาและเวลาหน้าจอ", icon: LuPlay, page: "Realtime" },
    { title: "ดูสรุปวันนี้", text: "ดูกราฟและรายละเอียดสุขภาพตาประจำวัน", icon: LuChartNoAxesCombined, page: "Dashboard" },
    { title: "จัดการแผน", text: "ดูแผน มาตรการ และผลการติดตาม", icon: LuCalendarDays, page: "Plan" },
    { title: "ดูประวัติการใช้งาน", text: "เลือกวันที่เพื่อตรวจสอบกิจกรรมย้อนหลัง", icon: LuHistory, page: "Dashboard" },
  ];

  return <section className="overview-page">
    <div className="overview-heading"><div><span>BLINKCARE OVERVIEW</span><h1>ภาพรวมการดูแลดวงตา</h1><p>ตรวจสอบกิจกรรมวันนี้ แผนดูแล และความเสี่ยงล่าสุดได้ในหน้าเดียว</p></div><button onClick={() => void loadOverview()} title="รีเฟรชข้อมูล"><LuRefreshCw /></button></div>
    {loading && <div className="overview-state">กำลังโหลดข้อมูล...</div>}
    {error && <div className="overview-state error">{error}</div>}
    {!loading && !error && <>
      <section className="overview-hero" style={{ backgroundImage: `url(${heroImage})` }}><div><small>ดูแลดวงตาให้ดีขึ้นทุกวัน</small><h2>เริ่มจากการติดตาม<br />พฤติกรรมหน้าจอของคุณ</h2><p>ตรวจจับการกะพริบตา ดูเวลาใช้งาน และติดตามแผนดูแลดวงตาอย่างต่อเนื่อง</p><button onClick={() => onNavigate("Realtime")}><LuPlay />เริ่มตรวจจับแบบเรียลไทม์</button></div></section>

      <div className="overview-section-heading"><h2>เมนูลัด</h2><p>ไปยังฟังก์ชันหลักของ BlinkCare</p></div>
      <div className="overview-shortcuts">{quickActions.map(({ title, text, icon: Icon, page }) => <button key={page} onClick={() => onNavigate(page)}><span><Icon /></span><div><strong>{title}</strong><small>{text}</small></div><LuArrowRight /></button>)}</div>

      <div className="overview-section-heading"><h2>สรุปภาพรวมวันนี้</h2></div>
      <div className="overview-metrics">
        <article><span><CalendarIcon /></span><div><strong>{isGuest ? "-" : viewDashboard.summary.session_count}</strong><small>Detection Sessions วันนี้</small></div></article>
        <article><span><LuClock3 /></span><div><strong>{isGuest ? "-" : formatMinutes(viewDashboard.summary.total_duration_seconds)}</strong><small>เวลาที่ตรวจพบการใช้งาน</small></div></article>
        <article><span><LuCalendarDays /></span><div><strong>{isGuest ? "-" : activePlanCount}</strong><small>แผนที่กำลังใช้งาน</small></div></article>
        <article><span><LuShieldCheck /></span><div><strong className={health.tone}>{health.label}</strong><small>สุขภาพตาจากข้อมูลล่าสุด</small></div></article>
      </div>

      <div className="overview-columns">
        <section className="overview-panel active-plan-panel"><div className="overview-panel-heading"><div><h2>แผนที่กำลังใช้งาน</h2><p>แผนดูแลดวงตาปัจจุบันของคุณ</p></div><button onClick={() => onNavigate("Plan")}>ดูแผนทั้งหมด<LuArrowRight /></button></div>{activePlan ? <div className="overview-active-plan"><span className="overview-plan-icon"><LuEye /></span><div className="overview-plan-copy"><span className="overview-status">กำลังดำเนินการ</span><h3>{activePlan.plan_name}</h3><p>{activePlan.goal_name}</p><small><LuCalendarDays /> {formatDate(activePlan.start_date)} - {formatDate(activePlan.end_date)}</small><div className="overview-plan-progress"><div><span style={{ width: `${completion}%` }} /></div><strong>{completion}%</strong></div></div><div className="overview-plan-actions"><button onClick={() => onNavigate("Plan")}>ดูแผน</button><button onClick={() => onNavigate("Plan")}>ติดตามผล</button></div></div> : <div className="overview-empty">{isGuest ? "-" : "ยังไม่มีแผนที่กำลังใช้งาน"}</div>}</section>

        <section className="overview-panel"><div className="overview-panel-heading"><div><h2>ความเสี่ยงล่าสุด</h2><p>ช่วงที่ควรใส่ใจจากข้อมูลวันนี้</p></div><button onClick={() => onNavigate("Dashboard")}>ดูรายละเอียด<LuArrowRight /></button></div>{viewDashboard.risk_periods[0] ? <div className="overview-risk"><LuShieldCheck /><div><strong>{health.label}</strong><p>{viewDashboard.risk_periods[0].app_name} · Blink Rate {viewDashboard.risk_periods[0].blink_rate.toFixed(1)} ครั้ง/นาที</p><small>{new Date(viewDashboard.risk_periods[0].started_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</small></div></div> : <div className="overview-empty">{isGuest ? "-" : "ไม่พบช่วงที่ต่ำกว่าเกณฑ์ในวันนี้"}</div>}</section>

        <section className="overview-panel"><div className="overview-panel-heading"><div><h2>การใช้งานแอปล่าสุด</h2><p>เรียงตามเวลาที่ใช้งานวันนี้</p></div><button onClick={() => onNavigate("Dashboard")}>ดูทั้งหมด<LuArrowRight /></button></div><div className="overview-app-list">{viewDashboard.app_usage.slice(0, 5).map((app) => <div key={app.app_name}><span>{app.app_name.slice(0, 1).toUpperCase()}</span><strong>{app.app_name}</strong><small>{formatMinutes(app.duration_seconds)}</small><em className={app.blink_rate < viewDashboard.normal_range.min ? "risk" : "normal"}>{app.blink_rate.toFixed(1)}/นาที</em></div>)}{viewDashboard.app_usage.length === 0 && <div className="overview-empty">{isGuest ? "-" : "ยังไม่มีข้อมูลการใช้งานแอปวันนี้"}</div>}</div></section>
      </div>
      <section className="overview-plan-cta" style={{ backgroundImage: `url(${planCtaImage})` }}>
        <div><h2>สร้างแผนการดูแลดวงตาในแบบของคุณ</h2><p>เลือกเป้าหมายและมาตรการที่เหมาะกับพฤติกรรมการใช้งานหน้าจอของคุณ</p></div>
        <button onClick={() => onNavigate("Plan")}><LuCalendarDays />สร้างแผนใหม่<LuArrowRight /></button>
      </section>
    </>}
  </section>;
}

function CalendarIcon() {
  return <LuActivity />;
}
