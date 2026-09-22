import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuActivity,
  LuArrowLeft,
  LuArrowRight,
  LuCalendarDays,
  LuCircleCheck,
  LuCircleX,
  LuChevronDown,
  LuChevronUp,
  LuEye,
  LuFilePlus2,
  LuHistory,
  LuListChecks,
  LuMonitor,
  LuPlus,
  LuRefreshCw,
  LuSearch,
  LuTarget,
  LuTimerReset,
} from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import Plan from "./Plan";
import "./Plans.css";

type PlanMeasure = {
  plan_measure_id: number;
  measure_code: string;
  measure_name: string;
  target_value: number | string | null;
  target_unit: string | null;
  interval_minutes: number | null;
  reminder_mode: "FLEXIBLE" | "SCHEDULED";
  estimated_rounds: number | null;
  occurred_rounds: number;
  completed_rounds: number;
  skipped_rounds: number;
  is_enabled: boolean;
};

type PlanSummary = {
  plan_id: string;
  plan_name: string;
  goal_code: string;
  goal_name: string;
  start_date: string;
  end_date: string;
  effective_status: "ACTIVE" | "UPCOMING" | "COMPLETED";
  total_days: number;
  timeline_progress: number;
  session_count: number;
  active_seconds: number;
  total_blinks: number;
  average_blinks_per_minute: number;
  estimated_reminder_rounds: number;
  used_days: number;
  occurred_rounds: number;
  completed_rounds: number;
  skipped_rounds: number;
  baseline_avg_session_seconds: number;
  daily_metrics: Array<{
    period: "BASELINE" | "CURRENT";
    date: string;
    active_seconds: number;
    total_blinks: number;
    blink_rate: number;
  }>;
  measures: PlanMeasure[];
};

function TrendChart({ title, unit, plan, value }: {
  title: string;
  unit: string;
  plan: PlanSummary;
  value: (metric: PlanSummary["daily_metrics"][number]) => number;
}) {
  const current = plan.daily_metrics.filter((metric) => metric.period === "CURRENT");
  const baseline = plan.daily_metrics.filter((metric) => metric.period === "BASELINE");
  const baselineAverage = baseline.length
    ? baseline.reduce((sum, metric) => sum + value(metric), 0) / baseline.length
    : 0;
  const values = current.map(value);
  const max = Math.max(1, baselineAverage, ...values) * 1.15;
  const points = values.map((metricValue, index) => {
    const x = values.length <= 1 ? 300 : 36 + (index * 528) / (values.length - 1);
    const y = 160 - (metricValue / max) * 125;
    return `${x},${y}`;
  }).join(" ");
  const baselineY = 160 - (baselineAverage / max) * 125;

  return <section className="tracking-chart-panel">
    <div><h3>{title}</h3><p>เปรียบเทียบค่าเฉลี่ย 7 วันก่อนเริ่มแผนกับช่วงปัจจุบัน</p></div>
    <div className="tracking-chart-legend"><span className="baseline">ก่อนเริ่มแผน {baselineAverage.toFixed(1)} {unit}</span><span>ช่วงในแผน</span></div>
    <div className="tracking-trend-chart">
      {current.length > 0 ? <svg viewBox="0 0 600 190" role="img" aria-label={title}>
        {[35, 77, 119, 160].map((y) => <line key={y} x1="36" x2="564" y1={y} y2={y} className="tracking-chart-grid-line" />)}
        {baseline.length > 0 && <line x1="36" x2="564" y1={baselineY} y2={baselineY} className="tracking-chart-baseline" />}
        <polyline points={points} className="tracking-chart-current-line" />
        {values.map((metricValue, index) => {
          const [x, y] = points.split(" ")[index].split(",");
          return <circle key={`${x}-${y}`} cx={x} cy={y} r="4" className="tracking-chart-point"><title>{metricValue.toFixed(1)} {unit}</title></circle>;
        })}
      </svg> : <div className="tracking-chart-empty">ยังไม่มี Detection Session ในช่วงแผน</div>}
    </div>
    <div className="tracking-chart-dates">{current.map((metric) => <span key={metric.date}>{new Date(metric.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>)}</div>
  </section>;
}

function TrackingDetail({ plan, onBack }: { plan: PlanSummary; onBack: () => void }) {
  const completion = plan.occurred_rounds ? Math.round(plan.completed_rounds / plan.occurred_rounds * 100) : 0;
  const currentMetrics = plan.daily_metrics.filter((metric) => metric.period === "CURRENT");
  const baselineMetrics = plan.daily_metrics.filter((metric) => metric.period === "BASELINE");
  const summarize = (metrics: PlanSummary["daily_metrics"]) => {
    const activeSeconds = metrics.reduce((sum, metric) => sum + metric.active_seconds, 0);
    const blinks = metrics.reduce((sum, metric) => sum + metric.total_blinks, 0);
    return {
      blinkRate: activeSeconds > 0 ? blinks / (activeSeconds / 60) : 0,
      dailyScreenMinutes: metrics.length > 0 ? activeSeconds / 60 / metrics.length : 0,
    };
  };
  const currentSummary = summarize(currentMetrics);
  const baselineSummary = summarize(baselineMetrics);
  const currentContinuousMinutes = plan.session_count > 0 ? plan.active_seconds / 60 / plan.session_count : 0;
  const baselineContinuousMinutes = plan.baseline_avg_session_seconds / 60;
  const comparison = (current: number, baseline: number, lowerIsBetter = false) => {
    const change = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
    const improved = lowerIsBetter ? change < 0 : change > 0;
    return { change, improved, hasBaseline: baseline > 0 };
  };
  const blinkComparison = comparison(currentSummary.blinkRate, baselineSummary.blinkRate);
  const screenComparison = comparison(currentSummary.dailyScreenMinutes, baselineSummary.dailyScreenMinutes, true);
  const continuousComparison = comparison(currentContinuousMinutes, baselineContinuousMinutes, true);
  return <div className="tracking-detail">
    <button className="tracking-back" onClick={onBack}><LuArrowLeft />กลับไปเลือกแผน</button>
    <div className="tracking-plan-header"><div className={`plan-goal-mark ${plan.goal_code.toLowerCase()}`}><LuEye /></div><div><h2>{plan.plan_name}</h2><p>{plan.goal_name} · {formatDate(plan.start_date)} - {formatDate(plan.end_date)}</p></div><span className={`plan-status ${plan.effective_status.toLowerCase()}`}>{statusLabel[plan.effective_status]}</span></div>
    <section className="tracking-overview">
      <div className="completion-ring" style={{ background: `conic-gradient(#386ee8 ${completion}%, #e8edf5 0)` }}><span>{completion}%</span></div>
      <div className="tracking-overview-copy"><h3>ความสำเร็จโดยรวม</h3><strong>{completion >= 70 ? "ทำได้ดี" : "กำลังสร้างพฤติกรรม"}</strong><p>ทำสำเร็จ {plan.completed_rounds} จาก {plan.occurred_rounds} รอบที่เกิดขึ้น</p></div>
      <div className="tracking-kpis"><div><LuCalendarDays /><strong>{plan.occurred_rounds}</strong><span>รอบที่เกิดขึ้น</span></div><div><LuCircleCheck /><strong>{plan.completed_rounds}</strong><span>ทำสำเร็จ</span></div><div><LuCircleX /><strong>{plan.skipped_rounds}</strong><span>ข้าม</span></div><div><LuTimerReset /><strong>{plan.used_days} วัน</strong><span>ใช้งานแล้ว</span></div></div>
    </section>
    <section className="tracking-measures"><div className="tracking-section-heading"><h3>ผลการดำเนินการตามมาตรการ</h3><p>ผลตอบรับจากการแจ้งเตือนของแต่ละมาตรการ</p></div>{plan.measures.map((measure) => { const percent = measure.occurred_rounds ? Math.round(measure.completed_rounds / measure.occurred_rounds * 100) : 0; return <div className="tracking-measure-row" key={measure.plan_measure_id}><span className="measure-result-icon"><LuTimerReset /></span><div><strong>{measure.measure_name}</strong><small>{measure.interval_minutes ? `${measure.reminder_mode === "FLEXIBLE" ? "เมื่อใช้ต่อเนื่อง" : "ทุก"} ${measure.interval_minutes} นาที` : measure.target_unit}</small></div><span><small>รอบที่เกิดขึ้น</small><strong>{measure.occurred_rounds}</strong></span><span className="success"><small>ทำสำเร็จ</small><strong>{measure.completed_rounds}</strong></span><span className="skip"><small>ข้าม</small><strong>{measure.skipped_rounds}</strong></span><div className="tracking-measure-progress"><div><span style={{ width: `${percent}%` }} /></div><strong>{percent}%</strong></div></div>; })}</section>
    <section className="tracking-summary-section">
      <div className="tracking-section-heading"><h3>สรุปการใช้งานช่วงนี้</h3><p>เปรียบเทียบช่วงที่อยู่ในแผนกับค่าเฉลี่ย 7 วันก่อนเริ่มแผน</p></div>
      <div className="tracking-usage-summary">
        <div><LuEye /><span><small>Blink Rate เฉลี่ย</small><strong>{currentSummary.blinkRate.toFixed(1)} ครั้ง/นาที</strong>{blinkComparison.hasBaseline ? <em className={blinkComparison.improved ? "improved" : "declined"}>{blinkComparison.change >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(blinkComparison.change).toFixed(0)}% <small>จาก {baselineSummary.blinkRate.toFixed(1)} ครั้ง/นาที</small></em> : <em>ยังไม่มีข้อมูลก่อนเริ่มแผน</em>}</span></div>
        <div><LuMonitor /><span><small>เวลาใช้งานหน้าจอเฉลี่ย</small><strong>{Math.round(currentSummary.dailyScreenMinutes)} นาที/วัน</strong>{screenComparison.hasBaseline ? <em className={screenComparison.improved ? "improved" : "declined"}>{screenComparison.change >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(screenComparison.change).toFixed(0)}% <small>จาก {Math.round(baselineSummary.dailyScreenMinutes)} นาที/วัน</small></em> : <em>ยังไม่มีข้อมูลก่อนเริ่มแผน</em>}</span></div>
        <div><LuTimerReset /><span><small>ใช้งานหน้าจอต่อเนื่องเฉลี่ย</small><strong>{Math.round(currentContinuousMinutes)} นาที/ครั้ง</strong>{continuousComparison.hasBaseline ? <em className={continuousComparison.improved ? "improved" : "declined"}>{continuousComparison.change >= 0 ? "เพิ่มขึ้น" : "ลดลง"} {Math.abs(continuousComparison.change).toFixed(0)}% <small>จาก {Math.round(baselineContinuousMinutes)} นาที/ครั้ง</small></em> : <em>ยังไม่มีข้อมูลก่อนเริ่มแผน</em>}</span></div>
      </div>
    </section>
    <div className="tracking-charts"><TrendChart title="แนวโน้ม Blink Rate" unit="ครั้ง/นาที" plan={plan} value={(metric) => metric.blink_rate} /><TrendChart title="แนวโน้มเวลาหน้าจอ" unit="นาที" plan={plan} value={(metric) => metric.active_seconds / 60} /></div>
  </div>;
}

function TrackingPlanList({ plans, onSelect }: { plans: PlanSummary[]; onSelect: (plan: PlanSummary) => void }) {
  return <div className="tracking-plan-list">{plans.map((plan) => <article key={plan.plan_id}><div className={`plan-goal-mark ${plan.goal_code.toLowerCase()}`}><LuEye /></div><div><h3>{plan.plan_name}</h3><p>{plan.goal_name}</p><span><LuCalendarDays /> {formatDate(plan.start_date)} - {formatDate(plan.end_date)}</span></div><span className={`plan-status ${plan.effective_status.toLowerCase()}`}>{statusLabel[plan.effective_status]}</span><button onClick={() => onSelect(plan)}>ดูผลการติดตาม<LuArrowRight /></button></article>)}</div>;
}

type Tab = "plans" | "tracking" | "history";
type Sort = "newest" | "progress" | "name";

const formatDate = (value: string) => new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
}).format(new Date(value));

const statusLabel = {
  ACTIVE: "กำลังดำเนินการ",
  UPCOMING: "กำลังจะเริ่ม",
  COMPLETED: "สิ้นสุดแล้ว",
};

function PlanCard({ plan, onEdit }: { plan: PlanSummary; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const completionPercent = plan.occurred_rounds > 0
    ? Math.round((plan.completed_rounds / plan.occurred_rounds) * 100)
    : 0;

  return (
    <article className="plan-summary-card">
      <div className="plan-identity">
        <div className={`plan-goal-mark ${plan.goal_code.toLowerCase()}`}><LuEye /></div>
        <div className="plan-card-title">
          <div><h3>{plan.plan_name}</h3><p>{plan.goal_name}</p></div>
          <span className={`plan-status ${plan.effective_status.toLowerCase()}`}>{statusLabel[plan.effective_status]}</span>
        </div>
        <div className="plan-date"><LuCalendarDays /> {formatDate(plan.start_date)} - {formatDate(plan.end_date)} · {plan.total_days} วัน</div>
        <div className="plan-measure-count"><LuTarget /> {plan.measures.length} มาตรการในแผน</div>
      </div>

      <div className="plan-performance">
        <div className="plan-progress-heading"><span>ความคืบหน้า</span><strong>{completionPercent}%</strong></div>
        <div className="plan-progress"><span style={{ width: `${completionPercent}%` }} /></div>
        <p className="progress-caption">ทำสำเร็จ {plan.completed_rounds} จาก {plan.occurred_rounds} รอบที่เกิดขึ้น</p>

        <div className="plan-facts">
          <div className="occurred"><LuCalendarDays /><span><strong>{plan.occurred_rounds}</strong>รอบที่เกิดขึ้น</span></div>
          <div className="completed"><LuCircleCheck /><span><strong>{plan.completed_rounds}</strong>ทำสำเร็จ</span></div>
          <div className="skipped"><LuCircleX /><span><strong>{plan.skipped_rounds}</strong>ข้าม</span></div>
          <div className="used-days"><LuTimerReset /><span><strong>{plan.used_days} วัน</strong>ใช้งานแล้ว</span></div>
        </div>

        {expanded && (
          <div className="plan-measure-details">
            <div className="measure-section-title"><strong>การดำเนินการตามมาตรการ</strong><span>ติดตามผลของแต่ละมาตรการจากการแจ้งเตือนจริง</span></div>
            {plan.measures.map((measure) => {
              const measureProgress = measure.occurred_rounds > 0
                ? Math.round((measure.completed_rounds / measure.occurred_rounds) * 100)
                : 0;
              const condition = measure.interval_minutes
                ? `${measure.reminder_mode === "FLEXIBLE" ? "เมื่อใช้งานต่อเนื่อง" : "ทุก"} ${measure.interval_minutes} นาที`
                : `${measure.target_value ?? "-"} ${measure.target_unit ?? ""}`;
              return <div className="measure-result-row" key={measure.plan_measure_id}>
                <span className="measure-result-icon"><LuTimerReset /></span>
                <div className="measure-result-copy"><strong>{measure.measure_name}</strong><span>{condition}</span></div>
                <div className="measure-result-stat"><span>รอบที่เกิดขึ้น</span><strong>{measure.occurred_rounds}</strong></div>
                <div className="measure-result-stat completed"><span>ทำสำเร็จ</span><strong>{measure.completed_rounds}</strong></div>
                <div className="measure-result-stat skipped"><span>ข้าม</span><strong>{measure.skipped_rounds}</strong></div>
                <div className="measure-result-progress"><div><span style={{ width: `${measureProgress}%` }} /></div><strong>{measureProgress}%</strong></div>
              </div>;
            })}
          </div>
        )}
      </div>
      <div className="plan-card-actions">
        <button className="plan-detail-button primary" onClick={onEdit}>
          แก้ไขแผน<LuArrowRight />
        </button>
        <button className="plan-detail-button secondary" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <LuChevronUp /> : <LuChevronDown />}{expanded ? "ซ่อนรายละเอียด" : "ดูรายละเอียด"}
        </button>
      </div>
    </article>
  );
}

export default function Plans() {
  const [creating, setCreating] = useState(false);
  const [trackingPlanId, setTrackingPlanId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plans");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("ALL");
  const [sort, setSort] = useState<Sort>("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/plans");
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถโหลดแผนได้");
      setPlans(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ไม่สามารถโหลดแผนได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);
  useEffect(() => {
    const refresh = () => void loadPlans();
    window.addEventListener("blinkcare:plan-progress-updated", refresh);
    return () => window.removeEventListener("blinkcare:plan-progress-updated", refresh);
  }, [loadPlans]);

  const activePlans = plans.filter((plan) => plan.effective_status === "ACTIVE");
  const completedPlans = plans.filter((plan) => plan.effective_status === "COMPLETED");
  const tabPlans = tab === "history" ? completedPlans : tab === "tracking" ? activePlans : plans;
  const goalOptions = useMemo(() => Array.from(new Map(
    plans.map((plan) => [plan.goal_code, plan.goal_name]),
  )), [plans]);
  const visiblePlans = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th-TH");
    return tabPlans
      .filter((plan) => goalFilter === "ALL" || plan.goal_code === goalFilter)
      .filter((plan) => !keyword
        || plan.plan_name.toLocaleLowerCase("th-TH").includes(keyword)
        || plan.goal_name.toLocaleLowerCase("th-TH").includes(keyword))
      .sort((a, b) => {
        if (sort === "progress") {
          const aProgress = a.occurred_rounds ? a.completed_rounds / a.occurred_rounds : 0;
          const bProgress = b.occurred_rounds ? b.completed_rounds / b.occurred_rounds : 0;
          return bProgress - aProgress;
        }
        if (sort === "name") return a.plan_name.localeCompare(b.plan_name, "th");
        return Number(b.plan_id) - Number(a.plan_id);
      });
  }, [goalFilter, search, sort, tabPlans]);
  const averageProgress = useMemo(() => {
    const occurred = activePlans.reduce((sum, plan) => sum + plan.occurred_rounds, 0);
    const completed = activePlans.reduce((sum, plan) => sum + plan.completed_rounds, 0);
    return occurred ? Math.round((completed / occurred) * 100) : 0;
  }, [activePlans]);

  if (creating) return <Plan onBack={() => { setCreating(false); void loadPlans(); }} />;
  const trackingPlan = plans.find((plan) => plan.plan_id === trackingPlanId);
  if (trackingPlan) return <section className="plans-page"><TrackingDetail plan={trackingPlan} onBack={() => setTrackingPlanId(null)} /></section>;

  return (
    <section className="plans-page">
      <div className="plans-heading">
        <div><span>PERSONAL EYE CARE</span><h1>{tab === "tracking" ? "ติดตามผล" : "แผนดูแลดวงตา"}</h1><p>{tab === "tracking" ? "เลือกแผนเพื่อดูผลการดำเนินงานและแนวโน้มสุขภาพดวงตา" : "สร้างแผน ติดตามเวลาที่ใช้งานจริง และดูผลจาก Detection Session"}</p></div>
        <button className="create-plan-button" onClick={() => setCreating(true)}><LuPlus />สร้างแผนใหม่</button>
      </div>

      {tab !== "tracking" && <div className="plan-stat-grid">
        <div><span className="stat-symbol indigo"><LuListChecks /></span><p>แผนทั้งหมด<strong>{plans.length}</strong><small>{activePlans.length} แผนกำลังดำเนินการ</small></p></div>
        <div><span className="stat-symbol green"><LuActivity /></span><p>กำลังดำเนินการ<strong>{activePlans.length}</strong><small>อยู่ในช่วงวันที่ของแผน</small></p></div>
        <div><span className="stat-symbol blue"><LuCircleCheck /></span><p>สิ้นสุดแล้ว<strong>{completedPlans.length}</strong><small>ดูย้อนหลังได้ในประวัติ</small></p></div>
        <div><span className="stat-symbol coral"><LuTimerReset /></span><p>ความสำเร็จโดยรวม<strong>{averageProgress}%</strong><small>จากรอบที่เกิดขึ้นทั้งหมด</small></p></div>
      </div>}

      <div className="plans-workspace">
        <div className="plans-tabs">
          <button className={tab === "plans" ? "active" : ""} onClick={() => setTab("plans")}><LuListChecks />แผนของฉัน</button>
          <button className={tab === "tracking" ? "active" : ""} onClick={() => setTab("tracking")}><LuActivity />ติดตามผล</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><LuHistory />ประวัติแผน</button>
          <button className="refresh-plans" onClick={() => void loadPlans()} title="รีเฟรช"><LuRefreshCw /></button>
        </div>

        {tab !== "tracking" && <div className="plans-list-heading">
          <div><h2>{tab === "plans" ? "แผนทั้งหมด" : "ประวัติแผน"}</h2><p>{visiblePlans.length} รายการ · ข้อมูลจาก Detection Session จริง</p></div>
          <div className="plan-filters">
            <label className="plan-search"><LuSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อแผนหรือเป้าหมาย" /></label>
            <select value={goalFilter} onChange={(event) => setGoalFilter(event.target.value)} aria-label="กรองตามเป้าหมาย"><option value="ALL">ทุกเป้าหมาย</option>{goalOptions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="เรียงลำดับ"><option value="newest">ล่าสุดก่อน</option><option value="progress">ความคืบหน้าสูงสุด</option><option value="name">ชื่อแผน</option></select>
          </div>
        </div>}
        {tab === "tracking" && <div className="plans-list-heading"><div><h2>เลือกแผนที่ต้องการติดตาม</h2><p>กดดูผลการติดตามเพื่อเปิดรายงานของแผนนั้น</p></div></div>}
        {loading && <div className="plans-state">กำลังโหลดข้อมูลแผน...</div>}
        {error && <div className="plans-state error">{error}</div>}
        {!loading && !error && <div className="plans-list">{tab === "tracking" ? <TrackingPlanList plans={visiblePlans} onSelect={(plan) => setTrackingPlanId(plan.plan_id)} /> : visiblePlans.map((plan) => <PlanCard key={plan.plan_id} plan={plan} onEdit={() => setCreating(true)} />)}{visiblePlans.length === 0 && <div className="plans-empty"><LuFilePlus2 /><h3>ยังไม่มีแผนในหมวดนี้</h3><p>สร้างแผนเพื่อเริ่มติดตามพฤติกรรมการใช้หน้าจอ</p><button onClick={() => setCreating(true)}><LuPlus />สร้างแผนใหม่</button></div>}</div>}
      </div>
    </section>
  );
}
