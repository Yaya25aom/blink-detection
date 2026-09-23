import { pool } from "../config/database.js";

type BlinkData = {
  user_id: number;
  detection_id: string;
  ear: number;
  duration_ms: number;
};

export const createBlinkRecord = async (data: BlinkData) => {
  const { user_id, detection_id, ear, duration_ms } = data;

  const result = await pool.query(
    `
    INSERT INTO detection_service.blink_record
    (
      detection_id,
      timestamp,
      ear,
      duration_ms
    )
    SELECT ds.session_id, CURRENT_TIMESTAMP, $2::NUMERIC, $3::INTEGER
    FROM detection_service.detection_session ds
    WHERE ds.session_id = $1::VARCHAR
      AND ds.user_id = $4::INTEGER
    RETURNING *
    `,
    [
      detection_id,
      ear,
      duration_ms,
      user_id,
    ]
  );

  return result.rows[0] ?? null;
};
