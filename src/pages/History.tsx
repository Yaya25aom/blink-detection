import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuActivity,
  LuBell,
  LuCalendarDays,
  LuCheck,
  LuClock3,
  LuEye,
  LuHistory,
  LuMonitor,
  LuRefreshCw,
} from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import "./History.css";

type HistoryEvent = {
  id: string;
  type: "USAGE" | "REMINDER";
  occurred_at: string;
  date: string;
  title: string;
  description: string;
  duration_seconds?: number;
  blink_rate?: number;
  status?: "PENDING" | "COMPLETED" | "SKIPPED";
};

type HistoryData = {
  summary: { total_duration_seconds: number; average_blinks_per_minute: number; reminder_count: number; active_days: number };
  daily: Array<{ date: string; duration_seconds: number; total_blinks: number; reminders: number; blink_rate: number }>;
  interesting_events: Array<{ id: string; type: "LOW_BLINK" | "LONG_SESSION"; occurred_at: string; title: string; description: string }>;
  continuous_limit_minutes: number;
  events: HistoryEvent[];
};

type Filter = "ALL" | "USAGE" | "REMINDER";

const inputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} ชม. ${minutes % 60} นาที` : `${minutes} นาที`;
};
const displayDate = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function History() {
  const today = inputDate(new Date());
  const initialFrom = inputDate(new Date(Date.now() - 6 * 86_400_000));
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(today);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/history?from=${from}&to=${to}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถโหลดประวัติได้");
      setData(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ไม่สามารถโหลดประวัติได้");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const events = useMemo(() => data?.events.filter((event) => filter === "ALL" || event.type === filter) ?? [], [data, filter]);
  const grouped = useMemo(() => events.reduce<Record<string, HistoryEvent[]>>((result, event) => {
    const date = event.date.slice(0, 10);
    (result[date] ??= []).push(event);
    return result;
  }, {}), [events]);

  return <section className="history-page">
    <div className="history-heading"><div><span>ACTIVITY HISTORY</span><h1><LuHistory />ประวัติย้อนหลัง</h1><p>ตรวจสอบพฤติกรรมการใช้งาน Detection Sessions และการตอบรับแจ้งเตือน</p></div><div className="history-range"><label>จาก<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>ถึง<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><button onClick={() => void loadHistory()} title="รีเฟรช"><LuRefreshCw /></button></div></div>
    {loading && <div className="history-state">กำลังโหลดประวัติ...</div>}
    {error && <div className="history-state error">{error}</div>}
    {!loading && !error && data && <>
      <div className="history-metrics">
        <article><span><LuClock3 /></span><div><small>รวมเวลาการใช้งาน</small><strong>{formatDuration(data.summary.total_duration_seconds)}</strong></div></article>
        <article><span><LuEye /></span><div><small>Blink Rate เฉลี่ย</small><strong>{data.summary.average_blinks_per_minute.toFixed(1)} ครั้ง/นาที</strong></div></article>
        <article><span><LuBell /></span><div><small>การแจ้งเตือนที่เกิดขึ้น</small><strong>{data.summary.reminder_count} ครั้ง</strong></div></article>
        <article><span><LuCalendarDays /></span><div><small>วันที่มีการใช้งาน</small><strong>{data.summary.active_days} วัน</strong></div></article>
      </div>

      <div className="history-layout">
        <aside className="history-side-panel">
          <div className="history-panel-title"><LuCalendarDays /><div><h2>ช่วงวันที่เลือก</h2><p>{displayDate(from)}<br />ถึง {displayDate(to)}</p></div></div>
          <div className="history-period-stats"><div><LuMonitor /><span><small>เวลาเฉลี่ย/วันที่ใช้งาน</small><strong>{data.summary.active_days ? formatDuration(data.summary.total_duration_seconds / data.summary.active_days) : "0 นาที"}</strong></span></div><div><LuEye /><span><small>Blink Rate เฉลี่ย</small><strong>{data.summary.average_blinks_per_minute.toFixed(1)} ครั้ง/นาที</strong></span></div><div><LuBell /><span><small>แจ้งเตือนทั้งหมด</small><strong>{data.summary.reminder_count} ครั้ง</strong></span></div></div>
          <div className="history-tip"><LuActivity /><div><strong>เคล็ดลับ</strong><p>ดูประวัติอย่างสม่ำเสมอเพื่อสังเกตช่วงที่ Blink Rate ต่ำและปรับช่วงพักสายตาให้เหมาะสม</p></div></div>
        </aside>

        <main className="history-timeline-panel">
          <div className="history-panel-heading"><div><h2>ไทม์ไลน์เหตุการณ์ย้อนหลัง</h2><p>{events.length} เหตุการณ์ในช่วงที่เลือก</p></div><div className="history-filters"><button className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>ทั้งหมด</button><button className={filter === "USAGE" ? "active" : ""} onClick={() => setFilter("USAGE")}>การใช้งาน</button><button className={filter === "REMINDER" ? "active" : ""} onClick={() => setFilter("REMINDER")}>การแจ้งเตือน</button></div></div>
          <div className="history-timeline">{Object.entries(grouped).map(([date, dateEvents]) => <section key={date}><h3>{displayDate(date)}</h3>{dateEvents.map((event) => <article key={event.id}><span className={`history-event-dot ${event.type.toLowerCase()}`}>{event.type === "USAGE" ? <LuMonitor /> : <LuBell />}</span><time>{new Date(event.occurred_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>{event.title}</strong><p>{event.description}</p></div><span className={`history-event-type ${event.type.toLowerCase()}`}>{event.type === "USAGE" ? "การใช้งาน" : "การแจ้งเตือน"}</span>{event.status === "COMPLETED" && <LuCheck className="history-completed" />}</article>)}</section>)}{events.length === 0 && <div className="history-empty">ไม่พบเหตุการณ์ในช่วงวันที่และตัวกรองนี้</div>}</div>
        </main>

        <aside className="history-insight-panel">
          <div><h2>เหตุการณ์ที่น่าสนใจ</h2><p>รายการที่ควรใส่ใจจากพฤติกรรมการใช้งาน</p></div>
          <div className="history-interest-rules"><span><LuEye />Blink Rate ต่ำกว่า 12 ครั้ง/นาที</span><span><LuClock3 />ใช้งานต่อเนื่องตั้งแต่ {data.continuous_limit_minutes} นาที</span></div>
          <div className="history-highlights">{data.interesting_events.map((event) => <div key={event.id}><span className={event.type === "LOW_BLINK" ? "low-blink" : "long-session"}>{event.type === "LOW_BLINK" ? <LuEye /> : <LuClock3 />}</span><div><strong>{event.title}</strong><small>{event.description}</small><time>{new Date(event.occurred_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div></div>)}{data.interesting_events.length === 0 && <div className="history-empty">ไม่พบ Blink Rate ต่ำหรือการใช้งานต่อเนื่องเกินเกณฑ์ในช่วงนี้</div>}</div>
        </aside>
      </div>
    </>}
  </section>;
}
