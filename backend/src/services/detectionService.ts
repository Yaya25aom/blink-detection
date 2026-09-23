import { pool } from "../config/database.js";
import { createAppBlinkSummary } from "./appBlinkSummaryService.js";

export const createDetectionSession = async (user_id: string) => {
  const result = await pool.query(
    `
    INSERT INTO detection_service.detection_session
    (
      user_id,
      started_at
    )
    VALUES ($1, CURRENT_TIMESTAMP)
    RETURNING *
    `,
    [user_id],
  );

  return result.rows[0];
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
      average_ear = $4
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

  // ==========================================
  // สร้าง App Blink Summary
  // ==========================================

  await createAppBlinkSummary(session_id);

  return result.rows[0];
};
