import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuActivity,
  LuClock3,
  LuEye,
  LuRefreshCw,
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
    average_blinks_per_session: number;
    average_blinks_per_minute: number;
  };
  hourly_trend: Array<{
    hour: number;
    total_blinks: number;
    duration_seconds: number;
    blink_rate: number;
  }>;
  app_usage: Array<{
    app_name: string;
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

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
  }).format(new Date(date));

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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/dashboard?date=${date}`);
      if (!response.ok) throw new Error(response.status === 401 ? "Please sign in to view your dashboard" : "Unable to load dashboard data");
      const result = await response.json();
      setData(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const health = useMemo(() => {
    if (!data || data.summary.session_count === 0) return { label: "No data", tone: "empty" };
    if (data.summary.average_blinks_per_minute < data.normal_range.min) return { label: "Below normal", tone: "low" };
    if (data.summary.average_blinks_per_minute > data.normal_range.max) return { label: "Above normal", tone: "medium" };
    return { label: "Normal", tone: "normal" };
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
            <article className="metric-card"><LuEye /><span>Total blinks</span><strong>{data.summary.total_blinks.toLocaleString()}</strong><small>{data.summary.session_count} completed sessions</small></article>
            <article className="metric-card"><LuActivity /><span>Avg. blinks / session</span><strong>{data.summary.average_blinks_per_session.toFixed(1)}</strong><small>Total blinks divided by sessions</small></article>
            <article className="metric-card"><LuActivity /><span>Avg. blinks / min</span><strong>{data.summary.average_blinks_per_minute.toFixed(1)}</strong><small className={`health-label ${health.tone}`}>{health.label}</small></article>
            <article className="metric-card"><LuClock3 /><span>Total screen time</span><strong>{formatDuration(data.summary.total_duration_seconds)}</strong><small>Across completed sessions</small></article>
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
            <article className="dashboard-panel">
              <div className="panel-heading"><div><h2>App Usage Summary</h2><p>Screen time and blink health by application</p></div></div>
              <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Application</th><th>Duration</th><th>Blinks</th><th>Rate / min</th><th>Status</th></tr></thead><tbody>
                {data.app_usage.map((app) => <tr key={app.app_name}><td><strong>{app.app_name}</strong></td><td>{formatDuration(app.duration_seconds)}</td><td>{app.total_blinks}</td><td>{app.blink_rate.toFixed(1)}</td><td><span className={`table-status ${app.blink_rate < data.normal_range.min ? "low" : "normal"}`}>{app.blink_rate < data.normal_range.min ? "Below normal" : "Normal"}</span></td></tr>)}
                {data.app_usage.length === 0 && <tr><td className="table-empty" colSpan={5}>No app usage recorded</td></tr>}
              </tbody></table></div>
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
