import { pool } from "../config/database.js";
import { createAppBlinkSummary } from "./appBlinkSummaryService.js";

export const createDetectionSession = async (
  user_id: string,
  source: "WEBSITE" | "EXTENSION" = "WEBSITE",
) => {
  const result = await pool.query(
    `
    INSERT INTO detection_service.detection_session
    (
      user_id,
      started_at,
      detection_source,
      live_updated_at
    )
    VALUES ($1, CURRENT_TIMESTAMP, $2, CURRENT_TIMESTAMP)
    RETURNING *
    `,
    [user_id, source],
  );

  return result.rows[0];
};

type DetectionLiveState = {
  user_id: string;
  session_id: string;
  active_seconds: number;
  total_blinks: number;
  blinks_per_minute: number;
  person_present: boolean;
  lighting_level: "GOOD" | "DARK" | "UNKNOWN";
};

export const updateDetectionLiveState = async (data: DetectionLiveState) => {
  const result = await pool.query(
    `UPDATE detection_service.detection_session
     SET live_active_seconds = $1, live_total_blinks = $2,
         live_blinks_per_minute = $3, live_person_present = $4,
         live_lighting_level = $5, live_updated_at = CURRENT_TIMESTAMP
     WHERE session_id = $6 AND user_id = $7 AND ended_at IS NULL
     RETURNING session_id`,
    [data.active_seconds, data.total_blinks, data.blinks_per_minute,
      data.person_present, data.lighting_level, data.session_id, data.user_id],
  );
  return result.rows[0] ?? null;
};

export const getActiveDetectionSession = async (user_id: string) => {
  const result = await pool.query(
    `SELECT session_id, detection_source, started_at,
       live_active_seconds AS active_seconds, live_total_blinks AS total_blinks,
       live_blinks_per_minute AS blinks_per_minute,
       live_person_present AS person_present, live_lighting_level AS lighting_level,
       live_updated_at
     FROM detection_service.detection_session
     WHERE user_id = $1 AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [user_id],
  );
  return result.rows[0] ?? null;
};

// End Detection Session

type EndDetectionSessionData = {
  user_id: string;
  session_id: string;
  duration_seconds: number;
  total_blinks: number;
  average_blinks_per_minute: number;
  average_ear: number;
};

export const endDetectionSession = async (data: EndDetectionSessionData) => {
  const {
    user_id,
    session_id,
    duration_seconds,
    total_blinks,
    average_blinks_per_minute,
    average_ear,
  } = data;

  const result = await pool.query(
    `
    UPDATE detection_service.detection_session
    SET
      ended_at = CURRENT_TIMESTAMP,
      duration_seconds = $1,
      total_blinks = $2,
      average_blinks_per_minute = $3,
      average_ear = $4,
      live_active_seconds = $1,
      live_total_blinks = $2,
      live_blinks_per_minute = $3,
      live_updated_at = CURRENT_TIMESTAMP
    WHERE session_id = $5
      AND user_id = $6
    RETURNING *
    `,
    [
      duration_seconds,
      total_blinks,
      average_blinks_per_minute,
      average_ear,
      session_id,
      user_id,
    ],
  );

  if (result.rows.length === 0) {
    throw new Error("Detection session not found");
  }

  if (average_blinks_per_minute > 0 && average_blinks_per_minute < 12) {
    await pool.query(
      `
      INSERT INTO notification_service.notification_event
        (user_id, event_key, category, title, body, source, occurred_at)
      SELECT user_id, $1, 'LOW_BLINK', 'อัตราการกะพริบตาต่ำ',
        $2, 'DETECTION', ended_at AT TIME ZONE 'UTC'
      FROM detection_service.detection_session
      WHERE session_id = $3 AND user_id = $4
      ON CONFLICT (user_id, event_key) DO NOTHING
      `,
      [
        `session-low-blink-${session_id}`,
        `ขณะนี้ ${average_blinks_per_minute.toFixed(1)} ครั้ง/นาที ควรกะพริบอย่างน้อย 12 ครั้ง/นาที`,
        session_id,
        user_id,
      ],
    );
  }

  // ==========================================
  // สร้าง App Blink Summary
  // ==========================================

  await createAppBlinkSummary(session_id);

  return result.rows[0];
};
