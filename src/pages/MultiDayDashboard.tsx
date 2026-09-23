import { useCallback, useEffect, useMemo, useState } from "react";
import { LuActivity, LuCalendarDays, LuClock3, LuCoffee, LuEye, LuShieldAlert } from "react-icons/lu";
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
  risk_hours: Array<{ hour: number; duration_minutes: number; occurrences: number }>;
};

const inputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const shiftDate = (date: string, days: number) => { const value = new Date(`${date}T00:00:00`); value.setDate(value.getDate() + days); return inputDate(value); };
const duration = (seconds: number) => { const minutes = Math.round(seconds / 60); return `${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที`; };
const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : null;
const scoreTone = (score: number) => score >= 80 ? "good" : score >= 60 ? "watch" : "risk";
const scoreLabel = (score: number) => score >= 80 ? "พฤติกรรมดูแลดวงตาดี" : score >= 60 ? "เริ่มมีพฤติกรรมเสี่ยง" : "ควรพักและปรับพฤติกรรม";

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
        <article className="multi-panel factor-panel"><div className="multi-panel-title"><div><h2>องค์ประกอบคะแนน</h2><p>ค่าเฉลี่ยในช่วงวันที่เลือก</p></div></div>{[["Blink Health", 40, data.factors.blink_health, LuEye], ["Continuous Use", 25, data.factors.continuous_use, LuClock3], ["Break Behavior", 20, data.factors.break_behavior, LuCoffee], ["Risk Exposure", 15, data.factors.risk_exposure, LuShieldAlert]].map(([name, weight, value, Icon]) => { const FactorIcon = Icon as typeof LuEye; return <div className="factor-row" key={String(name)}><FactorIcon /><div><span>{String(name)} <small>{Number(weight)}%</small></span><div><i style={{ width: `${Number(value)}%` }} /></div></div><strong>{Number(value).toFixed(0)}</strong></div>; })}<div className={`score-result ${scoreTone(data.summary.eye_health_score)}`}><span>คะแนนรวม</span><strong>{data.summary.eye_health_score.toFixed(0)}/100</strong><small>{scoreLabel(data.summary.eye_health_score)}</small></div></article>
      </div>
      <div className="multi-lower-grid">
        <article className="multi-panel"><div className="multi-panel-title"><div><h2>Heatmap ความเสี่ยงรายวัน</h2><p>สีแสดงระดับ Eye Health Score ของแต่ละวัน</p></div></div><div className="daily-heatmap">{data.daily.map((day) => <div key={day.local_date}><span>{new Date(`${day.local_date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short" })}</span><b className={scoreTone(day.eye_health_score)}>{day.eye_health_score}</b><small>{new Date(`${day.local_date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</small></div>)}</div></article>
        <article className="multi-panel"><div className="multi-panel-title"><div><h2>ช่วงเวลาที่เสี่ยงที่สุด</h2><p>ช่วงที่พบ Blink Rate ต่ำบ่อยที่สุด</p></div></div><div className="risk-hour-list">{data.risk_hours.map((item) => <div key={item.hour}><strong>{String(item.hour).padStart(2, "0")}:00 – {String((item.hour + 1) % 24).padStart(2, "0")}:00</strong><span><i style={{ width: `${Math.min(100, item.duration_minutes * 2)}%` }} /></span><small>{item.duration_minutes} นาที</small></div>)}{!data.risk_hours.length && <p className="multi-empty">ไม่พบช่วงเสี่ยงในช่วงนี้</p>}</div></article>
        <article className="multi-panel insight-panel"><div className="multi-panel-title"><div><h2>Insight ช่วงนี้</h2><p>สิ่งที่ควรให้ความสำคัญ</p></div></div><strong className={scoreTone(data.summary.eye_health_score)}>{scoreLabel(data.summary.eye_health_score)}</strong><p>Blink Health {data.factors.blink_health.toFixed(0)} คะแนน · การพักตามแผน {data.factors.break_behavior.toFixed(0)} คะแนน</p><p>ลองลดช่วงใช้งานต่อเนื่องและทำตามรอบพักเพื่อเพิ่มคะแนนในช่วงถัดไป</p></article>
      </div>
    </>}
  </section>;
}

function EyeIcon() { return <LuActivity />; }
