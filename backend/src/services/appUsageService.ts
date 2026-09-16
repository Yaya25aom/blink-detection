import { pool } from "../config/database.js";

// =====================================================
// Create Current App Usage
// =====================================================

export const createCurrentAppUsage = async (
  session_id: string,
  app_name: string,
  started_at: string
) => {
  const result = await pool.query(
    `
    INSERT INTO detection_service.app_usage_session
    (
      session_id,
      user_id,
      app_name,
      started_at,
      ended_at,
      duration_seconds
    )
    SELECT
      ds.session_id,
      ds.user_id,
      $2,
      $3::timestamptz,
      NULL,
      0
    FROM detection_service.detection_session ds
    WHERE ds.session_id = $1
    RETURNING *
    `,
    [
      session_id,
      app_name,
      started_at,
    ]
  );

  if (result.rows.length === 0) {
    throw new Error("Detection session not found");
  }

  return result.rows[0];
};


// =====================================================
// Update Current App Duration
// =====================================================

export const updateCurrentAppUsage = async (
  session_id: string,
  ended_at: string
) => {
  const result = await pool.query(
    `
    UPDATE detection_service.app_usage_session
    SET
      ended_at = $2::timestamptz,
      duration_seconds =
        GREATEST(
          0,
          EXTRACT(
            EPOCH FROM (
              $2::timestamptz - started_at
            )
          )::INTEGER
        )
    WHERE usage_id = (
      SELECT usage_id
      FROM detection_service.app_usage_session
      WHERE session_id = $1
        AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    )
    RETURNING *
    `,
    [
      session_id,
      ended_at,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};


// =====================================================
// Close Current App Usage
// =====================================================

export const closeCurrentAppUsage = async (
  session_id: string,
  ended_at: string
) => {
  const result = await pool.query(
    `
    UPDATE detection_service.app_usage_session
    SET
      ended_at = $2::timestamptz,
      duration_seconds =
        GREATEST(
          0,
          EXTRACT(
            EPOCH FROM (
              $2::timestamptz - started_at
            )
          )::INTEGER
        )
    WHERE usage_id = (
      SELECT usage_id
      FROM detection_service.app_usage_session
      WHERE session_id = $1
        AND ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    )
    RETURNING *
    `,
    [
      session_id,
      ended_at,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};


// =====================================================
// Get Current App
// =====================================================

export const getCurrentAppUsageSession = async (
  session_id: string
) => {
  const result = await pool.query(
    `
    SELECT
      usage_id,
      session_id,
      user_id,
      app_name,
      started_at,
      ended_at,
      duration_seconds
    FROM detection_service.app_usage_session
    WHERE session_id = $1
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [session_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};
