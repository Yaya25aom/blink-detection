import { pool } from "../config/database.js";

const NORMAL_BLINK_MIN = 12;
const NORMAL_BLINK_MAX = 20;

export const getDashboardSummary = async (userId: string, date?: string) => {
  const selectedDate = date ?? new Date().toISOString().slice(0, 10);
  const params = [userId, selectedDate];

  const [summaryResult, sessionsResult, trendResult, appsResult, risksResult] =
    await Promise.all([
      pool.query(
        `
        SELECT
          COUNT(*)::INTEGER AS session_count,
          COALESCE(SUM(total_blinks), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(duration_seconds), 0)::INTEGER AS total_duration_seconds,
          CASE WHEN COUNT(*) > 0
            THEN COALESCE(SUM(total_blinks), 0)::DECIMAL / COUNT(*)
            ELSE 0
          END AS average_blinks_per_session,
          CASE WHEN COALESCE(SUM(duration_seconds), 0) > 0
            THEN COALESCE(SUM(total_blinks), 0)::DECIMAL
              / (SUM(duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS average_blinks_per_minute
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND started_at::date = $2::date
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          session_id,
          started_at AT TIME ZONE 'Asia/Bangkok' AS started_at,
          ended_at AT TIME ZONE 'Asia/Bangkok' AS ended_at,
          COALESCE(duration_seconds, 0)::INTEGER AS duration_seconds,
          COALESCE(total_blinks, 0)::INTEGER AS total_blinks,
          COALESCE(average_blinks_per_minute, 0)::DECIMAL AS average_blinks_per_minute
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND started_at::date = $2::date
        ORDER BY started_at DESC
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          EXTRACT(HOUR FROM date_trunc('hour', started_at))::INTEGER AS hour,
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
          AND started_at::date = $2::date
        GROUP BY date_trunc('hour', started_at)
        ORDER BY date_trunc('hour', started_at)
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
            AND ds.started_at::date = $2::date
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
          aus.started_at AT TIME ZONE 'Asia/Bangkok' AS started_at,
          aus.ended_at AT TIME ZONE 'Asia/Bangkok' AS ended_at,
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
          AND ds.started_at::date = $2::date
        GROUP BY aus.usage_id, aus.app_name, aus.started_at, aus.ended_at, aus.duration_seconds
        HAVING COUNT(br.id) > 0
          AND COUNT(br.id)::DECIMAL / (aus.duration_seconds::DECIMAL / 60) < $3
        ORDER BY blink_rate ASC, aus.duration_seconds DESC
        LIMIT 3
        `,
        [...params, NORMAL_BLINK_MIN],
      ),
    ]);

  const summary = summaryResult.rows[0];
  const toNumber = (value: unknown) => Number(value ?? 0);

  return {
    date: selectedDate,
    normal_range: { min: NORMAL_BLINK_MIN, max: NORMAL_BLINK_MAX },
    summary: {
      session_count: toNumber(summary.session_count),
      total_blinks: toNumber(summary.total_blinks),
      total_duration_seconds: toNumber(summary.total_duration_seconds),
      average_blinks_per_session: toNumber(summary.average_blinks_per_session),
      average_blinks_per_minute: toNumber(summary.average_blinks_per_minute),
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
