import { useCallback, useEffect, useMemo, useState } from "react";
import { LuActivity, LuCalendarCheck, LuCalendarDays, LuClock3, LuEye, LuFrown, LuMeh, LuShieldAlert, LuSmile, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import "./MultiDayDashboard.css";

type DailyMetric = {
  local_date: string; total_duration_seconds: number; total_blinks: number; session_count: number;
  eye_health_score: number; blink_rate: number; max_continuous_minutes: number;
  blink_health: number; continuous_use: number; break_behavior: number; risk_exposure: number;
};
type MultiDayData = {
  from: string; to: string;
  summary: { eye_health_score: number; blink_rate: number; average_screen_seconds: number; risk_days: number; break_behavior: number };
  previous: { eye_health_score: number; blink_rate: number; average_screen_seconds: number; risk_days: number; break_behavior: number };
  factors: { blink_health: number; continuous_use: number; break_behavior: number; risk_exposure: number };
  daily: DailyMetric[];
  previous_daily: DailyMetric[];
  risk_hours: Array<{ hour: number; duration_minutes: number; occurrences: number }>;
  plan_results: { blink_rate_change_percent: number | null; screen_time_change_percent: number | null; risk_days_change: number; completed_reminders: number; reminder_count: number; adherence_percent: number };
};

const inputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return inputDate(value); };
const duration = (seconds: number) => { const minutes = Math.round(seconds / 60); return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`; };
const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : null;
const scoreTone = (score: number) => score >= 80 ? "good" : score >= 60 ? "watch" : "risk";

function ChangeBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="multi-change neutral">-</span>;
  return <span className={`multi-change ${value >= 0 ? "up" : "down"}`}>{value >= 0 ? "↑" : "↓"} {Math.abs(value).toFixed(0)}{suffix}</span>;
}

function ScoreChart({ daily }: { daily: DailyMetric[] }) {
  const width = 700, height = 250, left = 42, bottom = 35, top = 18;
  const x = (index: number) => left + index * ((width - left - 15) / Math.max(1, daily.length - 1));
  const y = (value: number) => top + (100 - value) / 100 * (height - top - bottom);
  const points = daily.map((day, index) => `${x(index)},${y(day.eye_health_score)}`).join(" ");
  return <svg className="multi-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="แนวโน้ม Eye Health Score">
    {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={left} x2={width - 15} y1={y(tick)} y2={y(tick)} /><text x={left - 10} y={y(tick) + 4}>{tick}</text></g>)}
    {points && <polyline points={points} />}
    {daily.map((day, index) => <g key={day.local_date}><circle className={scoreTone(day.eye_health_score)} cx={x(index)} cy={y(day.eye_health_score)} r="5" /><text className="score-value" x={x(index)} y={y(day.eye_health_score) - 12}>{day.eye_health_score}</text><text x={x(index)} y={height - 10}>{new Date(`${day.local_date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</text></g>)}
  </svg>;
}

function BlinkComparison({ current, previous }: { current: DailyMetric[]; previous: DailyMetric[] }) {
  const size = Math.max(current.length, previous.length, 1);
  const groups = Array.from({ length: size }, (_, index) => ({ current: current[index]?.blink_rate ?? 0, previous: previous[index]?.blink_rate ?? 0 }));
  const compact = groups.length <= 10 ? groups : Array.from({ length: Math.ceil(groups.length / 5) }, (_, index) => {
    const values = groups.slice(index * 5, index * 5 + 5);
    return { current: values.reduce((sum, value) => sum + value.current, 0) / values.length, previous: values.reduce((sum, value) => sum + value.previous, 0) / values.length };
  });
  const max = Math.max(20, ...compact.flatMap((item) => [item.current, item.previous]));
  return <div className="comparison-chart"><div className="comparison-legend"><span className="previous">ช่วงก่อนหน้า</span><span className="current">ช่วงปัจจุบัน</span></div><div className="comparison-bars">{compact.map((item, index) => <div className="bar-group" key={index}><div><i className="previous" style={{ height: `${item.previous / max * 100}%` }} /><i className="current" style={{ height: `${item.current / max * 100}%` }} /></div><span>{compact.length <= 10 ? index + 1 : `ช่วง ${index + 1}`}</span></div>)}</div><small>Blink Rate (ครั้ง/นาที)</small></div>;
}

function MoodIcon({ score }: { score: number | null }) {
  if (score === null) return <LuMeh />;
  if (score >= 80) return <LuSmile />;
  if (score >= 60) return <LuMeh />;
  return <LuFrown />;
}

export default function MultiDayDashboard() {
  const today = inputDate(new Date());
  const [to, setTo] = useState(today);
  const [from, setFrom] = useState(shiftDate(today, -6));
  const [preset, setPreset] = useState<"7" | "30" | "custom">("7");
  const [data, setData] = useState<MultiDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await apiFetch(`/dashboard/multi-day?from=${from}&to=${to}`); const result = await response.json(); if (!response.ok) throw new Error(result.message); setData(result.data); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "ไม่สามารถโหลดข้อมูลได้"); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);

  const setDays = (days: number) => { setPreset(String(days) as "7" | "30"); setTo(today); setFrom(shiftDate(today, -(days - 1))); };
  const comparisons = useMemo(() => data ? {
    score: change(data.summary.eye_health_score, data.previous.eye_health_score),
    blink: change(data.summary.blink_rate, data.previous.blink_rate),
    screen: change(data.summary.average_screen_seconds, data.previous.average_screen_seconds),
    risks: data.summary.risk_days - data.previous.risk_days,
  } : null, [data]);
  const heatmapDays = useMemo(() => {
    if (!data) return [];
    const values = [];
    for (let date = data.from; date <= data.to; date = shiftDate(date, 1)) {
      values.push(data.daily.find((item) => item.local_date === date) ?? { local_date: date, eye_health_score: null });
    }
    return values;
  }, [data]);

  return <section className="multi-page">
    <header className="multi-heading"><div><span>MULTI-DAY OVERVIEW</span><h1>ภาพรวมหลายวัน</h1><p>สรุปภาพรวมและแนวโน้มสุขภาพดวงตาจากพฤติกรรมการใช้งานจริง</p></div><div className="multi-controls"><label><LuCalendarDays /><input type="date" value={from} max={to} onChange={(event) => { setPreset("custom"); setFrom(event.target.value); }} /><span>ถึง</span><input type="date" value={to} min={from} max={today} onChange={(event) => { setPreset("custom"); setTo(event.target.value); }} /></label><div><button className={preset === "7" ? "active" : ""} onClick={() => setDays(7)}>7 วัน</button><button className={preset === "30" ? "active" : ""} onClick={() => setDays(30)}>30 วัน</button><button className={preset === "custom" ? "active" : ""}>กำหนดเอง</button></div></div></header>
    {loading && <div className="multi-state">กำลังประมวลผลข้อมูล...</div>}{error && <div className="multi-state error">{error}</div>}
    {!loading && !error && data && comparisons && <>
      <div className="multi-metrics">
        <article><span className="metric-symbol green"><EyeIcon /></span><div><small>Eye Health Score เฉลี่ย</small><strong>{data.summary.eye_health_score.toFixed(0)} <em>/ 100</em></strong><ChangeBadge value={comparisons.score} /><p>ช่วงก่อนหน้า ({data.previous.eye_health_score.toFixed(0)})</p></div></article>
        <article><span className="metric-symbol blue"><LuEye /></span><div><small>Blink Rate เฉลี่ย</small><strong>{data.summary.blink_rate.toFixed(1)} <em>ครั้ง/นาที</em></strong><ChangeBadge value={comparisons.blink} /><p>ช่วงก่อนหน้า ({data.previous.blink_rate.toFixed(1)})</p></div></article>
        <article><span className="metric-symbol violet"><LuClock3 /></span><div><small>เวลาหน้าจอเฉลี่ย</small><strong>{duration(data.summary.average_screen_seconds)}</strong><ChangeBadge value={comparisons.screen} /><p>ต่อวันที่มีการใช้งาน</p></div></article>
        <article><span className="metric-symbol red"><LuShieldAlert /></span><div><small>วันที่มีความเสี่ยงสูง</small><strong>{data.summary.risk_days} <em>วัน</em></strong><ChangeBadge value={comparisons.risks} suffix=" วัน" /><p>Eye Score ต่ำกว่า 60</p></div></article>
      </div>
      <div className="multi-main-grid">
        <article className="multi-panel score-panel"><div className="multi-panel-title"><div><h2>แนวโน้ม Eye Health Score</h2><p>คะแนนรวมรายวันจาก 4 ปัจจัยด้านพฤติกรรม</p></div></div><ScoreChart daily={data.daily} /><div className="score-legend"><span className="good">ดีมาก (80–100)</span><span className="watch">เริ่มเสี่ยง (60–79)</span><span className="risk">ควรปรับปรุง (0–59)</span></div></article>
        <article className="multi-panel comparison-panel"><div className="multi-panel-title"><div><h2>เปรียบเทียบกับช่วงก่อนหน้า</h2><p>Blink Rate ของช่วงปัจจุบันและช่วงก่อนหน้าที่มีระยะเท่ากัน</p></div></div><BlinkComparison current={data.daily} previous={data.previous_daily} /></article>
      </div>
      <div className="multi-lower-grid">
        <article className="multi-panel"><div className="multi-panel-title"><div><h2>Heatmap ความเสี่ยงรายวัน</h2><p>สีหน้าแสดงระดับ Eye Health Score ของแต่ละวัน</p></div></div><div className="daily-heatmap">{heatmapDays.map((day) => <div key={day.local_date}><span>{new Date(`${day.local_date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short" })}</span><b className={day.eye_health_score === null ? "empty" : scoreTone(day.eye_health_score)}><MoodIcon score={day.eye_health_score} /></b><small>{new Date(`${day.local_date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</small></div>)}</div></article>
        <article className="multi-panel"><div className="multi-panel-title"><div><h2>ช่วงเวลาที่เสี่ยงที่สุด</h2><p>ช่วงที่พบ Blink Rate ต่ำบ่อยที่สุด</p></div></div><div className="risk-hour-list">{data.risk_hours.map((item) => <div key={item.hour}><strong>{String(item.hour).padStart(2, "0")}:00 – {String((item.hour + 1) % 24).padStart(2, "0")}:00</strong><span><i style={{ width: `${Math.min(100, item.duration_minutes * 2)}%` }} /></span><small>{item.duration_minutes} นาที</small></div>)}{!data.risk_hours.length && <p className="multi-empty">ไม่พบช่วงเสี่ยงในช่วงนี้</p>}</div></article>
        <article className="multi-panel plan-result-panel"><div className="multi-panel-title"><div><h2>ผลของแผนคุณ</h2><p>เปรียบเทียบผลลัพธ์กับช่วงก่อนหน้า</p></div></div><div className="plan-result-list"><div><LuEye /><span>Blink Rate</span><strong className={(data.plan_results.blink_rate_change_percent ?? 0) >= 0 ? "positive" : "negative"}>{data.plan_results.blink_rate_change_percent === null ? "-" : `${data.plan_results.blink_rate_change_percent >= 0 ? "+" : ""}${data.plan_results.blink_rate_change_percent.toFixed(0)}%`}</strong></div><div><LuClock3 /><span>เวลาหน้าจอเฉลี่ย</span><strong className={(data.plan_results.screen_time_change_percent ?? 0) <= 0 ? "positive" : "negative"}>{data.plan_results.screen_time_change_percent === null ? "-" : `${data.plan_results.screen_time_change_percent > 0 ? "+" : ""}${data.plan_results.screen_time_change_percent.toFixed(0)}%`}</strong></div><div><LuShieldAlert /><span>วันที่เสี่ยง</span><strong className={data.plan_results.risk_days_change <= 0 ? "positive" : "negative"}>{data.plan_results.risk_days_change > 0 ? "+" : ""}{data.plan_results.risk_days_change} วัน</strong></div><div><LuCalendarCheck /><span>ทำตามแผนสำเร็จ</span><strong className="positive">{data.plan_results.completed_reminders}/{data.plan_results.reminder_count} ครั้ง</strong></div></div><div className="plan-adherence"><span>ความสม่ำเสมอ</span><strong>{data.plan_results.adherence_percent.toFixed(0)}%</strong><i><b style={{ width: `${data.plan_results.adherence_percent}%` }} /></i></div></article>
      </div>
      <section className="weekly-insight"><h2><LuActivity /> Insight ช่วงนี้</h2><div><article><LuTrendingUp /><span><strong>Blink Rate {comparisons.blink !== null && comparisons.blink >= 0 ? "ดีขึ้น" : "ลดลง"}</strong><p>{comparisons.blink === null ? "ยังไม่มีข้อมูลช่วงก่อนหน้า" : `${Math.abs(comparisons.blink).toFixed(0)}% จากช่วงก่อนหน้า`}</p></span></article><article><LuShieldAlert /><span><strong>วันที่ควรระวัง {data.summary.risk_days} วัน</strong><p>{data.summary.risk_days ? "ควรเพิ่มช่วงพักในวันที่คะแนนต่ำ" : "ยังไม่พบวันที่มีความเสี่ยงสูง"}</p></span></article><article><LuTrendingDown /><span><strong>เวลาหน้าจอ{comparisons.screen !== null && comparisons.screen <= 0 ? "ลดลง" : "เพิ่มขึ้น"}</strong><p>{comparisons.screen === null ? "ยังไม่มีข้อมูลช่วงก่อนหน้า" : `${Math.abs(comparisons.screen).toFixed(0)}% จากช่วงก่อนหน้า`}</p></span></article><article><LuCalendarCheck /><span><strong>ทำตามแผนได้ {data.plan_results.adherence_percent.toFixed(0)}%</strong><p>{data.plan_results.completed_reminders} จาก {data.plan_results.reminder_count} รอบที่เกิดขึ้น</p></span></article></div></section>
    </>}
  </section>;
}

function EyeIcon() { return <LuActivity />; }
