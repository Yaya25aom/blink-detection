import { pool } from "../config/database.js";

const NORMAL_BLINK_MIN = 12;
const NORMAL_BLINK_MAX = 20;

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
