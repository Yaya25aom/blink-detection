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
          AND (started_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          session_id,
          started_at,
          ended_at,
          COALESCE(duration_seconds, 0)::INTEGER AS duration_seconds,
          COALESCE(total_blinks, 0)::INTEGER AS total_blinks,
          COALESCE(average_blinks_per_minute, 0)::DECIMAL AS average_blinks_per_minute
        FROM detection_service.detection_session
        WHERE user_id = $1
          AND ended_at IS NOT NULL
          AND (started_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        ORDER BY started_at DESC
        `,
        params,
      ),
      pool.query(
        `
        WITH selected_sessions AS (
          SELECT session_id, started_at, ended_at
          FROM detection_service.detection_session
          WHERE user_id = $1
            AND ended_at IS NOT NULL
            AND (started_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        ),
        hourly_duration AS (
          SELECT
            hour_start,
            SUM(
              EXTRACT(EPOCH FROM (
                LEAST(ss.ended_at, hour_start + INTERVAL '1 hour')
                - GREATEST(ss.started_at, hour_start)
              ))
            ) AS duration_seconds
          FROM selected_sessions ss
          CROSS JOIN LATERAL generate_series(
            date_trunc('hour', ss.started_at),
            date_trunc('hour', ss.ended_at),
            INTERVAL '1 hour'
          ) AS hour_start
          WHERE LEAST(ss.ended_at, hour_start + INTERVAL '1 hour')
            > GREATEST(ss.started_at, hour_start)
          GROUP BY hour_start
        ),
        hourly_blinks AS (
          SELECT date_trunc('hour', br.timestamp) AS hour_start, COUNT(*)::INTEGER AS total_blinks
          FROM detection_service.blink_record br
          JOIN selected_sessions ss ON ss.session_id = br.detection_id
          GROUP BY date_trunc('hour', br.timestamp)
        )
        SELECT
          EXTRACT(HOUR FROM hd.hour_start AT TIME ZONE 'Asia/Bangkok')::INTEGER AS hour,
          COALESCE(hb.total_blinks, 0)::INTEGER AS total_blinks,
          hd.duration_seconds::INTEGER AS duration_seconds,
          CASE WHEN hd.duration_seconds > 0
            THEN COALESCE(hb.total_blinks, 0)::DECIMAL / (hd.duration_seconds / 60)
            ELSE 0
          END AS blink_rate
        FROM hourly_duration hd
        LEFT JOIN hourly_blinks hb ON hb.hour_start = hd.hour_start
        ORDER BY hd.hour_start
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          abs.app_name,
          COALESCE(SUM(abs.blink_count), 0)::INTEGER AS total_blinks,
          COALESCE(SUM(aus.duration_seconds), 0)::INTEGER AS duration_seconds,
          CASE WHEN COALESCE(SUM(aus.duration_seconds), 0) > 0
            THEN COALESCE(SUM(abs.blink_count), 0)::DECIMAL
              / (SUM(aus.duration_seconds)::DECIMAL / 60)
            ELSE 0
          END AS blink_rate
        FROM detection_service.app_blink_summary abs
        JOIN detection_service.app_usage_session aus ON aus.usage_id = abs.usage_id
        JOIN detection_service.detection_session ds ON ds.session_id = abs.session_id
        WHERE ds.user_id = $1
          AND ds.ended_at IS NOT NULL
          AND (ds.started_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        GROUP BY abs.app_name
        ORDER BY duration_seconds DESC, abs.app_name
        `,
        params,
      ),
      pool.query(
        `
        SELECT
          abs.app_name,
          aus.started_at,
          aus.ended_at,
          COALESCE(aus.duration_seconds, 0)::INTEGER AS duration_seconds,
          COALESCE(abs.blink_count, 0)::INTEGER AS blink_count,
          COALESCE(abs.average_blink_per_minute, 0)::DECIMAL AS blink_rate
        FROM detection_service.app_blink_summary abs
        JOIN detection_service.app_usage_session aus ON aus.usage_id = abs.usage_id
        JOIN detection_service.detection_session ds ON ds.session_id = abs.session_id
        WHERE ds.user_id = $1
          AND ds.ended_at IS NOT NULL
          AND aus.duration_seconds > 0
          AND COALESCE(abs.average_blink_per_minute, 0) < $3
          AND (ds.started_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date
        ORDER BY abs.average_blink_per_minute ASC, aus.duration_seconds DESC
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
