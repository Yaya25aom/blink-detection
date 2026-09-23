import { pool } from "../config/database.js";

const NORMAL_BLINK_MIN = 12;
const NORMAL_BLINK_MAX = 20;

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const scoreDay = (row: Record<string, unknown>) => {
  const sessions = Number(row.session_count ?? 0);
  if (sessions === 0) return null;
  const duration = Number(row.total_duration_seconds ?? 0);
  const blinks = Number(row.total_blinks ?? 0);
  const blinkRate = duration > 0 ? blinks / (duration / 60) : 0;
  const lowSessions = Number(row.low_session_count ?? 0);
  const maxContinuousMinutes = Number(row.max_continuous_seconds ?? 0) / 60;
  const reminderCount = Number(row.reminder_count ?? 0);
  const completedReminders = Number(row.completed_reminders ?? 0);
  const lowDuration = Number(row.low_duration_seconds ?? 0);

  const rateScore = clampScore(((blinkRate - 6) / 6) * 100);
  const blinkHealth = clampScore(rateScore * 0.7 + (1 - lowSessions / sessions) * 100 * 0.3);
  const continuousUse = clampScore(100 - Math.max(0, maxContinuousMinutes - 30) / 60 * 100);
  const breakBehavior = reminderCount > 0 ? clampScore(completedReminders / reminderCount * 100) : 70;
  const riskExposure = duration > 0 ? clampScore(100 - lowDuration / duration * 100) : 0;
  const eyeHealthScore = Math.round(
    blinkHealth * 0.4 + continuousUse * 0.25 + breakBehavior * 0.2 + riskExposure * 0.15,
  );
  return {
    blink_rate: blinkRate,
    max_continuous_minutes: maxContinuousMinutes,
    blink_health: Math.round(blinkHealth),
    continuous_use: Math.round(continuousUse),
    break_behavior: Math.round(breakBehavior),
    risk_exposure: Math.round(riskExposure),
    eye_health_score: eyeHealthScore,
  };
};

const getMultiDayRows = async (userId: string, from: string, to: string) => {
  const result = await pool.query(
    `
    WITH session_daily AS (
      SELECT
        (((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date)::text AS local_date,
        COUNT(*)::INTEGER AS session_count,
        COALESCE(SUM(total_blinks), 0)::INTEGER AS total_blinks,
        COALESCE(SUM(duration_seconds), 0)::INTEGER AS total_duration_seconds,
        COALESCE(MAX(duration_seconds), 0)::INTEGER AS max_continuous_seconds,
        COUNT(*) FILTER (WHERE average_blinks_per_minute < 12)::INTEGER AS low_session_count,
        COALESCE(SUM(duration_seconds) FILTER (WHERE average_blinks_per_minute < 12), 0)::INTEGER AS low_duration_seconds
      FROM detection_service.detection_session
      WHERE user_id = $1 AND ended_at IS NOT NULL
        AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $2::date AND $3::date
      GROUP BY ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date
    ), reminder_daily AS (
      SELECT
        (timezone('Asia/Bangkok', triggered_at)::date)::text AS local_date,
        COUNT(*)::INTEGER AS reminder_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::INTEGER AS completed_reminders
      FROM plan_service.plan_reminder_event
      WHERE user_id = $1
        AND timezone('Asia/Bangkok', triggered_at)::date BETWEEN $2::date AND $3::date
      GROUP BY timezone('Asia/Bangkok', triggered_at)::date
    )
    SELECT sd.*, COALESCE(rd.reminder_count, 0)::INTEGER AS reminder_count,
      COALESCE(rd.completed_reminders, 0)::INTEGER AS completed_reminders
    FROM session_daily sd LEFT JOIN reminder_daily rd USING (local_date)
    ORDER BY sd.local_date
    `,
    [userId, from, to],
  );
  return result.rows;
};

export const getMultiDayDashboard = async (userId: string, from: string, to: string) => {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousToDate = new Date(start.getTime() - 86_400_000);
  const previousFromDate = new Date(previousToDate.getTime() - (days - 1) * 86_400_000);
  const previousFrom = previousFromDate.toISOString().slice(0, 10);
  const previousTo = previousToDate.toISOString().slice(0, 10);
  const [rows, previousRows, riskHoursResult] = await Promise.all([
    getMultiDayRows(userId, from, to),
    getMultiDayRows(userId, previousFrom, previousTo),
    pool.query(
      `SELECT EXTRACT(HOUR FROM ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'))::INTEGER AS hour,
        COALESCE(SUM(duration_seconds), 0)::INTEGER AS duration_seconds,
        COUNT(*)::INTEGER AS occurrences
       FROM detection_service.detection_session
       WHERE user_id = $1 AND ended_at IS NOT NULL AND average_blinks_per_minute < 12
         AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $2::date AND $3::date
       GROUP BY EXTRACT(HOUR FROM ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'))
       ORDER BY duration_seconds DESC LIMIT 3`,
      [userId, from, to],
    ),
  ]);

  const buildDays = (source: Record<string, unknown>[]): Array<Record<string, unknown>> =>
    source.map((row) => ({ ...row, ...(scoreDay(row) ?? {}) }));
  const daily = buildDays(rows);
  const previousDaily = buildDays(previousRows);
  const average = (items: Record<string, unknown>[], key: string) => items.length
    ? items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / items.length
    : 0;
  const summarize = (items: Record<string, unknown>[]) => ({
    eye_health_score: average(items, "eye_health_score"),
    blink_rate: items.reduce((sum, item) => sum + Number(item.total_blinks ?? 0), 0) /
      Math.max(1, items.reduce((sum, item) => sum + Number(item.total_duration_seconds ?? 0), 0) / 60),
    average_screen_seconds: average(items, "total_duration_seconds"),
    risk_days: items.filter((item) => Number(item.eye_health_score ?? 0) < 60).length,
    break_behavior: average(items, "break_behavior"),
  });
  const summary = summarize(daily);
  const previous = summarize(previousDaily);
  const percentChange = (current: number, prior: number) => prior > 0 ? (current - prior) / prior * 100 : null;
  const completedReminders = daily.reduce((sum, item) => sum + Number(item.completed_reminders ?? 0), 0);
  const reminderCount = daily.reduce((sum, item) => sum + Number(item.reminder_count ?? 0), 0);
  return {
    from, to, previous_from: previousFrom, previous_to: previousTo,
    summary, previous,
    previous_daily: previousDaily,
    factors: {
      blink_health: average(daily, "blink_health"),
      continuous_use: average(daily, "continuous_use"),
      break_behavior: average(daily, "break_behavior"),
      risk_exposure: average(daily, "risk_exposure"),
    },
    daily,
    risk_hours: riskHoursResult.rows.map((row) => ({
      hour: Number(row.hour), duration_minutes: Math.round(Number(row.duration_seconds) / 60), occurrences: Number(row.occurrences),
    })),
    plan_results: {
      blink_rate_change_percent: percentChange(summary.blink_rate, previous.blink_rate),
      screen_time_change_percent: percentChange(summary.average_screen_seconds, previous.average_screen_seconds),
      risk_days_change: summary.risk_days - previous.risk_days,
      completed_reminders: completedReminders,
      reminder_count: reminderCount,
      adherence_percent: reminderCount > 0 ? completedReminders / reminderCount * 100 : 0,
    },
  };
};

export const getDashboardSummary = async (userId: string, date?: string) => {
  const selectedDate = date ?? new Date().toISOString().slice(0, 10);
  const params = [userId, selectedDate];

  const [summaryResult, sessionsResult, trendResult, appsResult, risksResult, previousResult] =
    await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*)::INTEGER AS session_count,
          COALESCE(SUM(total_blinks), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(duration_seconds), 0)::INTEGER AS total_duration_seconds,
          CASE WHEN COALESCE(SUM(duration_seconds), 0) > 0
            THEN COALESCE(SUM(total_blinks), 0)::DECIMAL
              / (SUM(duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS average_blinks_per_minute
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          session_id,
          started_at AT TIME ZONE 'UTC' AS started_at,
          ended_at AT TIME ZONE 'UTC' AS ended_at,
          COALESCE(duration_seconds, 0)::INTEGER AS duration_seconds,
          COALESCE(total_blinks, 0)::INTEGER AS total_blinks,
          COALESCE(average_blinks_per_minute, 0)::DECIMAL AS average_blinks_per_minute
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        ORDER BY started_at DESC
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          EXTRACT(HOUR FROM ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'))::INTEGER AS hour,
          COALESCE(SUM(total_blinks), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(duration_seconds), 0)::INTEGER AS duration_seconds,
          CASE WHEN COALESCE(SUM(duration_seconds), 0) > 0
            THEN COALESCE(SUM(total_blinks), 0)::DECIMAL
              / (SUM(duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS blink_rate
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        GROUP BY EXTRACT(HOUR FROM ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'))
        ORDER BY EXTRACT(HOUR FROM ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok'))
        `,
        params,
      ),
      pool.query(
        `
        WITH usage_stats AS (
          SELECT
            aus.usage_id,
            aus.app_name,
            aus.duration_seconds,
            COUNT(br.id)::INTEGER AS blink_count
          FROM detection_service.app_usage_session aus
          JOIN detection_service.detection_session ds ON ds.session_id = aus.session_id
          LEFT JOIN detection_service.blink_record br
            ON br.detection_id = aus.session_id
            AND br.timestamp >= aus.started_at
            AND br.timestamp < aus.ended_at
          WHERE ds.user_id = $1
            AND ds.ended_at IS NOT NULL
            AND ((ds.started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date
            AND aus.ended_at IS NOT NULL
          GROUP BY aus.usage_id, aus.app_name, aus.duration_seconds
        )
        SELECT
          app_name,
          COALESCE(SUM(blink_count), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(duration_seconds), 0)::INTEGER AS duration_seconds,
          CASE WHEN COALESCE(SUM(duration_seconds), 0) > 0
            THEN COALESCE(SUM(blink_count), 0)::DECIMAL
              / (SUM(duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS blink_rate
        FROM usage_stats
        GROUP BY app_name
        ORDER BY duration_seconds DESC, app_name
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          aus.app_name,
          aus.started_at AT TIME ZONE 'UTC' AS started_at,
          aus.ended_at AT TIME ZONE 'UTC' AS ended_at,
          COALESCE(aus.duration_seconds, 0)::INTEGER AS duration_seconds,
          COUNT(br.id)::INTEGER AS blink_count,
          CASE WHEN COALESCE(aus.duration_seconds, 0) > 0
            THEN COUNT(br.id)::DECIMAL / (aus.duration_seconds::DECIMAL / 60)
            ELSE 0
          END AS blink_rate
        FROM detection_service.app_usage_session aus
        JOIN detection_service.detection_session ds ON ds.session_id = aus.session_id
        LEFT JOIN detection_service.blink_record br
          ON br.detection_id = aus.session_id
          AND br.timestamp >= aus.started_at
          AND br.timestamp < aus.ended_at
        WHERE ds.user_id = $1
          AND ds.ended_at IS NOT NULL
          AND aus.duration_seconds > 0
          AND ((ds.started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        GROUP BY aus.usage_id, aus.app_name, aus.started_at, aus.ended_at, aus.duration_seconds
        HAVING COUNT(br.id) > 0
          AND COUNT(br.id)::DECIMAL / (aus.duration_seconds::DECIMAL / 60) < $3
        ORDER BY blink_rate ASC, aus.duration_seconds DESC
        LIMIT 3
        `,
        [...params, NORMAL_BLINK_MIN],
      ),
      pool.query(
        `
        WITH previous_sessions AS (
          SELECT total_blinks, duration_seconds
          FROM detection_service.detection_session
          WHERE user_id = $1 AND ended_at IS NOT NULL
            AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date - 1
        ), previous_apps AS (
          SELECT COUNT(DISTINCT aus.app_name)::INTEGER AS total_apps_used
          FROM detection_service.app_usage_session aus
          JOIN detection_service.detection_session ds ON ds.session_id = aus.session_id
          WHERE ds.user_id = $1 AND ds.ended_at IS NOT NULL AND aus.ended_at IS NOT NULL
            AND ((ds.started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date = $2::date - 1
        )
        SELECT
          COUNT(*)::INTEGER AS session_count,
          COALESCE(SUM(total_blinks), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(duration_seconds), 0)::INTEGER AS total_duration_seconds,
          CASE WHEN COALESCE(SUM(duration_seconds), 0) > 0
            THEN COALESCE(SUM(total_blinks), 0)::DECIMAL / (SUM(duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS average_blinks_per_minute,
          (SELECT total_apps_used FROM previous_apps) AS total_apps_used
        FROM previous_sessions
        `,
        params,
      ),
    ]);

  const summary = summaryResult.rows[0];
  const previous = previousResult.rows[0];
  const toNumber = (value: unknown) => Number(value ?? 0);
  const totalAppsUsed = appsResult.rows.length;
  const blinkRate = toNumber(summary.average_blinks_per_minute);
  const screenHours = toNumber(summary.total_duration_seconds) / 3600;
  const blinkRisk = blinkRate > 0 ? Math.min(60, Math.max(0, ((NORMAL_BLINK_MIN - blinkRate) / NORMAL_BLINK_MIN) * 60)) : 0;
  const screenRisk = Math.min(40, Math.max(0, ((screenHours - 2) / 4) * 40));
  const riskScore = Math.round(blinkRisk + screenRisk);
  const riskLevel = summary.session_count === 0 ? "none" : riskScore >= 55 ? "high" : riskScore >= 25 ? "medium" : "low";
  const percentageChange = (current: number, prior: number) => prior > 0
    ? Number((((current - prior) / prior) * 100).toFixed(1))
    : null;

  return {
    date: selectedDate,
    normal_range: { min: NORMAL_BLINK_MIN, max: NORMAL_BLINK_MAX },
    summary: {
      session_count: toNumber(summary.session_count),
      total_blinks: toNumber(summary.total_blinks),
      total_duration_seconds: toNumber(summary.total_duration_seconds),
      total_apps_used: totalAppsUsed,
      average_blinks_per_minute: toNumber(summary.average_blinks_per_minute),
    },
    dry_eye_risk: {
      score: riskScore,
      level: riskLevel,
      blink_component: Math.round(blinkRisk),
      screen_time_component: Math.round(screenRisk),
    },
    comparison: {
      total_blinks_percent: percentageChange(toNumber(summary.total_blinks), toNumber(previous.total_blinks)),
      blink_rate_percent: percentageChange(blinkRate, toNumber(previous.average_blinks_per_minute)),
      screen_time_percent: percentageChange(toNumber(summary.total_duration_seconds), toNumber(previous.total_duration_seconds)),
      apps_used_percent: percentageChange(totalAppsUsed, toNumber(previous.total_apps_used)),
      previous_has_data: toNumber(previous.session_count) > 0,
      previous_total_blinks: toNumber(previous.total_blinks),
      previous_blink_rate: toNumber(previous.average_blinks_per_minute),
      previous_screen_time_seconds: toNumber(previous.total_duration_seconds),
      previous_apps_used: toNumber(previous.total_apps_used),
    },
    hourly_trend: trendResult.rows.map((row) => ({
      hour: toNumber(row.hour),
      total_blinks: toNumber(row.total_blinks),
      duration_seconds: toNumber(row.duration_seconds),
      blink_rate: toNumber(row.blink_rate),
    })),
    app_usage: appsResult.rows.map((row) => ({
      app_name: row.app_name,
      total_blinks: toNumber(row.total_blinks),
      duration_seconds: toNumber(row.duration_seconds),
      blink_rate: toNumber(row.blink_rate),
    })),
    risk_periods: risksResult.rows.map((row) => {
      const blinkRate = toNumber(row.blink_rate);
      return {
        app_name: row.app_name,
        started_at: row.started_at,
        ended_at: row.ended_at,
        duration_seconds: toNumber(row.duration_seconds),
        blink_count: toNumber(row.blink_count),
        blink_rate: blinkRate,
        risk_level: blinkRate < 8 ? "high" : "medium",
      };
    }),
    sessions: sessionsResult.rows.map((row) => ({
      ...row,
      duration_seconds: toNumber(row.duration_seconds),
      total_blinks: toNumber(row.total_blinks),
      average_blinks_per_minute: toNumber(row.average_blinks_per_minute),
    })),
  };
};
