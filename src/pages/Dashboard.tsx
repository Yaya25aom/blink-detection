import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  LuActivity,
  LuClock3,
  LuEye,
  LuMonitor,
  LuRefreshCw,
  LuShieldCheck,
  LuTriangleAlert,
} from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import "./Dashboard.css";

type DashboardData = {
  date: string;
  normal_range: { min: number; max: number };
  summary: {
    session_count: number;
    total_blinks: number;
    total_duration_seconds: number;
    total_apps_used: number;
    average_blinks_per_minute: number;
  };
  dry_eye_risk: {
    score: number;
    level: "none" | "low" | "medium" | "high";
    blink_component: number;
    screen_time_component: number;
  };
  comparison: {
    total_blinks_percent: number | null;
    blink_rate_percent: number | null;
    screen_time_percent: number | null;
    apps_used_percent: number | null;
    previous_has_data: boolean;
    previous_total_blinks: number;
    previous_blink_rate: number;
    previous_screen_time_seconds: number;
    previous_apps_used: number;
  };
  hourly_trend: Array<{
    hour: number;
    total_blinks: number;
    duration_seconds: number;
    blink_rate: number;
  }>;
  app_usage: Array<{
    usage_id: string;
    is_active: boolean;
    app_name: string;
    started_at: string;
    ended_at: string;
    total_blinks: number;
    duration_seconds: number;
    blink_rate: number;
  }>;
  risk_periods: Array<{
    app_name: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    blink_count: number;
    blink_rate: number;
    risk_level: "high" | "medium";
  }>;
  sessions: Array<{
    session_id: string;
    started_at: string;
    ended_at: string;
    duration_seconds: number;
    total_blinks: number;
    average_blinks_per_minute: number;
  }>;
};

type AppSortKey = "started_at" | "app_name" | "duration_seconds" | "total_blinks" | "blink_rate" | "status";
const appColumns: { key: AppSortKey; label: string }[] = [
  { key: "started_at", label: "ช่วงเวลา" },
  { key: "app_name", label: "แอปพลิเคชัน" },
  { key: "duration_seconds", label: "ระยะเวลา" },
  { key: "total_blinks", label: "กระพริบตา" },
  { key: "blink_rate", label: "ครั้ง / นาที" },
  { key: "status", label: "สถานะ" },
];
const appStatus = (rate: number, min: number, max: number) => rate < min
  ? { rank: 0, tone: "low", label: "ต่ำกว่าเกณฑ์" }
  : rate > max ? { rank: 2, tone: "high", label: "สูงกว่าเกณฑ์" }
  : { rank: 1, tone: "normal", label: "อยู่ในเกณฑ์" };

const localDate = () => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatTime = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(date));

const comparisonText = (value: number | null, hasPrevious: boolean, previous: string) => {
  if (!hasPrevious || value === null) return { badge: "-", previous: "ยังไม่มีข้อมูลวันก่อนหน้า", tone: "neutral" };
  if (value === 0) return { badge: "0%", previous: `จากวันก่อนหน้า (${previous})`, tone: "neutral" };
  return {
    badge: `${value > 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1)}%`,
    previous: `จากวันก่อนหน้า (${previous})`,
    tone: value > 0 ? "up" : "down",
  };
};

function MetricCard({
  icon,
  label,
  value,
  comparison,
  detail,
  detailTone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  comparison: { badge: string; previous: string; tone: string };
  detail: string;
  detailTone?: string;
}) {
  return (
    <article className="metric-card">
      {icon}<span>{label}</span><strong>{value}</strong>
      <small className={`metric-comparison ${comparison.tone}`}>{comparison.badge}</small>
      <small className="metric-previous">{comparison.previous}</small>
      <small className={detailTone ? `health-label ${detailTone}` : "metric-detail"}>{detail}</small>
    </article>
  );
}

function BlinkTrend({ data }: { data: DashboardData }) {
  const width = 760;
  const height = 270;
  const pad = { top: 18, right: 18, bottom: 38, left: 42 };
  const maxRate = Math.max(24, ...data.hourly_trend.map((point) => point.blink_rate));
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const x = (hour: number) => pad.left + (hour / 23) * chartWidth;
  const y = (value: number) => pad.top + chartHeight - (value / maxRate) * chartHeight;
  const points = data.hourly_trend.map((point) => `${x(point.hour)},${y(point.blink_rate)}`).join(" ");
  const yTicks = [0, 6, 12, 18, 24].filter((value) => value <= maxRate);

  return (
    <div className="trend-wrap">
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Hourly blink rate trend">
        <rect
          className="normal-zone"
          x={pad.left}
          y={y(data.normal_range.max)}
          width={chartWidth}
          height={y(data.normal_range.min) - y(data.normal_range.max)}
        />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis-label" x={pad.left - 10} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        {[0, 6, 12, 18, 23].map((hour) => (
          <text key={hour} className="axis-label" x={x(hour)} y={height - 12} textAnchor="middle">
            {String(hour).padStart(2, "0")}:00
          </text>
        ))}
        {points && <polyline className="trend-line" points={points} />}
        {data.hourly_trend.map((point) => {
          const low = point.blink_rate < data.normal_range.min;
          return (
            <g key={point.hour}>
              <circle className={low ? "trend-dot low" : "trend-dot normal"} cx={x(point.hour)} cy={y(point.blink_rate)} r="6" />
              <text className="point-value" x={x(point.hour)} y={y(point.blink_rate) - 12} textAnchor="middle">
                {point.blink_rate.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>
      {data.hourly_trend.length === 0 && <div className="chart-empty">No completed sessions for this date</div>}
    </div>
  );
}

export default function Dashboard() {
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const [appSort, setAppSort] = useState<{ key: AppSortKey; direction: "asc" | "desc" }>({ key: "started_at", direction: "desc" });
  const sortedApps = useMemo(() => {
    if (!data) return [];
    const value = (app: DashboardData["app_usage"][number]) => appSort.key === "status"
      ? appStatus(app.blink_rate, data.normal_range.min, data.normal_range.max).rank
      : appSort.key === "started_at" ? Date.parse(app.started_at) : app[appSort.key];
    return [...data.app_usage].sort((a, b) => {
      const left = value(a), right = value(b);
      const order = typeof left === "string" && typeof right === "string"
        ? left.localeCompare(right, "th", { numeric: true, sensitivity: "base" })
        : Number(left) - Number(right);
      return order * (appSort.direction === "asc" ? 1 : -1) ||
        Date.parse(b.started_at) - Date.parse(a.started_at) || a.usage_id.localeCompare(b.usage_id);
    });
  }, [data, appSort]);

  const loadDashboard = useCallback(async (silent = false) => {
    const version = ++requestVersion.current;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const response = await apiFetch(`/dashboard?date=${date}`);
      if (!response.ok) throw new Error(response.status === 401 ? "Please sign in to view your dashboard" : "Unable to load dashboard data");
      const result = await response.json();
      if (version === requestVersion.current) { setData(result.data); setError(""); }
    } catch (requestError) {
      if (!silent && version === requestVersion.current) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard data");
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async (silent = false) => {
      await loadDashboard(silent);
      if (!stopped && date === localDate()) timer = setTimeout(() => void refresh(true), 5000);
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); requestVersion.current++; };
  }, [date, loadDashboard]);

  const health = useMemo(() => {
    if (!data || data.summary.session_count === 0) return { label: "ยังไม่มีข้อมูล", tone: "empty" };
    if (data.summary.average_blinks_per_minute < data.normal_range.min) return { label: "ต่ำกว่าเกณฑ์", tone: "low" };
    if (data.summary.average_blinks_per_minute > data.normal_range.max) return { label: "สูงกว่าเกณฑ์", tone: "medium" };
    return { label: "อยู่ในเกณฑ์", tone: "normal" };
  }, [data]);

  const riskCopy = useMemo(() => {
    if (!data || data.dry_eye_risk.level === "none") return { label: "No data", thaiLabel: "ยังไม่มีข้อมูล", tone: "none" };
    if (data.dry_eye_risk.level === "high") return { label: "High", thaiLabel: "ความเสี่ยงสูง", tone: "high" };
    if (data.dry_eye_risk.level === "medium") return { label: "Medium", thaiLabel: "ความเสี่ยงปานกลาง", tone: "medium" };
    return { label: "Low", thaiLabel: "ความเสี่ยงต่ำ", tone: "low" };
  }, [data]);

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">DAILY HEALTH SUMMARY</span>
          <h1>Dashboard</h1>
          <p>Review your completed eye-tracking sessions and screen habits.</p>
        </div>
        <div className="date-actions">
          <input aria-label="Dashboard date" type="date" value={date} max={localDate()} onChange={(event) => setDate(event.target.value)} />
          <button className="icon-button" onClick={() => void loadDashboard()} title="Refresh dashboard" aria-label="Refresh dashboard">
            <LuRefreshCw />
          </button>
        </div>
      </div>

      {loading && <div className="dashboard-state">Loading your summary...</div>}
      {error && <div className="dashboard-state error">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="metric-grid">
            <article className={`risk-summary-card ${riskCopy.tone}`}>
              <div className="risk-summary-main"><span><LuShieldCheck /></span><div><small>Dry Eye Risk</small><strong>{riskCopy.label}</strong><p>{riskCopy.thaiLabel}</p></div></div>
            </article>
            <MetricCard icon={<LuEye />} label="Total blinks" value={data.summary.total_blinks.toLocaleString()} comparison={comparisonText(data.comparison.total_blinks_percent, data.comparison.previous_has_data, `${data.comparison.previous_total_blinks.toLocaleString()} ครั้ง`)} detail={`${data.summary.session_count} completed sessions`} />
            <MetricCard icon={<LuMonitor />} label="Total App used" value={data.summary.total_apps_used.toLocaleString()} comparison={comparisonText(data.comparison.apps_used_percent, data.comparison.previous_has_data, `${data.comparison.previous_apps_used} แอป`)} detail="แอปที่ตรวจพบในวันนี้" />
            <MetricCard icon={<LuActivity />} label="Avg. blinks / min" value={data.summary.average_blinks_per_minute.toFixed(1)} comparison={comparisonText(data.comparison.blink_rate_percent, data.comparison.previous_has_data, `${data.comparison.previous_blink_rate.toFixed(1)} ครั้ง/นาที`)} detail={health.label} detailTone={health.tone} />
            <MetricCard icon={<LuClock3 />} label="Total screen time" value={formatDuration(data.summary.total_duration_seconds)} comparison={comparisonText(data.comparison.screen_time_percent, data.comparison.previous_has_data, formatDuration(data.comparison.previous_screen_time_seconds))} detail="Across completed sessions" />
          </div>

          <div className="dashboard-grid">
            <article className="dashboard-panel trend-panel">
              <div className="panel-heading">
                <div><h2>Blink Rate Trend</h2><p>Weighted average blink rate by hour</p></div>
                <div className="normal-key"><span />Normal {data.normal_range.min}-{data.normal_range.max}/min</div>
              </div>
              <BlinkTrend data={data} />
            </article>

            <article className="dashboard-panel risk-panel">
              <div className="panel-heading"><div><h2>Top Risk Periods</h2><p>Lowest blink-rate periods</p></div><LuTriangleAlert /></div>
              <div className="risk-list">
                {data.risk_periods.map((period, index) => (
                  <div className="risk-row" key={`${period.started_at}-${period.app_name}`}>
                    <span className="risk-rank">{index + 1}</span>
                    <div><strong>{period.app_name}</strong><small>{formatTime(period.started_at)}-{formatTime(period.ended_at)} · {formatDuration(period.duration_seconds)}</small></div>
                    <div className="risk-rate"><strong>{period.blink_rate.toFixed(1)}</strong><span className={`risk-badge ${period.risk_level}`}>{period.risk_level}</span></div>
                  </div>
                ))}
                {data.risk_periods.length === 0 && <div className="empty-list">No below-normal periods found</div>}
              </div>
            </article>
          </div>

          <div className="dashboard-grid lower-grid">
            <article className="dashboard-panel app-usage-panel">
              <div className="panel-heading app-usage-heading">
                <div><h2>App Usage Timeline</h2><p>แต่ละช่วงการใช้แอป · เวลาไทย · วันนี้อัปเดตทุก 5 วินาที</p></div>
                <span className="app-sort-hint">กดหัวคอลัมน์เพื่อเรียงข้อมูล ↕</span>
              </div>
              <div className="data-table-wrap" tabIndex={0} role="region" aria-label="ช่วงเวลาการใช้แอป เลื่อนแนวนอนได้">
                <table className="data-table app-usage-table">
                  <thead><tr>{appColumns.map(({ key, label }) => (
                    <th key={key} scope="col" aria-sort={appSort.key === key ? (appSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className={appSort.key === key ? "app-sort-button selected" : "app-sort-button"}
                        onClick={() => setAppSort(current => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }))}>
                        {label}<span aria-hidden="true">{appSort.key === key ? (appSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    </th>
                  ))}</tr></thead>
                  <tbody>
                    {sortedApps.map((app) => {
                      const status = appStatus(app.blink_rate, data.normal_range.min, data.normal_range.max);
                      return <tr key={app.usage_id} className={app.is_active ? "app-usage-active" : undefined}>
                        <td><span className="app-time">{formatTime(app.started_at)}–{app.is_active ? "ตอนนี้" : formatTime(app.ended_at)}</span>
                          {app.is_active && <span className="app-live-badge">กำลังใช้งาน</span>}</td>
                        <td><span className="app-name"><span className="app-icon"><LuMonitor /></span><strong>{app.app_name}</strong></span></td>
                        <td><strong>{Math.floor(app.duration_seconds / 60)}</strong> นาที <span className="app-seconds">{app.duration_seconds % 60} วินาที</span></td>
                        <td><span className="app-blink-count">{app.total_blinks.toLocaleString()}</span></td>
                        <td><strong className={`app-rate ${status.tone}`}>{app.blink_rate.toFixed(1)}</strong></td>
                        <td><span className={`app-status-badge ${status.tone}`}>{status.label}</span></td>
                      </tr>;
                    })}
                    {sortedApps.length === 0 && <tr><td className="table-empty" colSpan={6}>ยังไม่มีช่วงการใช้แอปในวันที่เลือก</td></tr>}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="dashboard-panel session-panel">
              <div className="panel-heading"><div><h2>Daily Sessions</h2><p>Completed sessions for this date</p></div></div>
              <div className="session-list">
                {data.sessions.map((session) => <div className="session-row" key={session.session_id}><div><strong>{formatTime(session.started_at)}-{formatTime(session.ended_at)}</strong><small>{formatDuration(session.duration_seconds)}</small></div><div><strong>{session.total_blinks} blinks</strong><small>{session.average_blinks_per_minute.toFixed(1)} / min</small></div></div>)}
                {data.sessions.length === 0 && <div className="empty-list">No completed sessions</div>}
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
