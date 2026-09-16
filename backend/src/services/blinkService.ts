import { pool } from "../config/database.js";

type BlinkData = {
  detection_id: string;
  ear: number;
  duration_ms: number;
};

export const createBlinkRecord = async (data: BlinkData) => {
  const { detection_id, ear, duration_ms } = data;

  const result = await pool.query(
    `
    INSERT INTO detection_service.blink_record
    (
      detection_id,
      timestamp,
      ear,
      duration_ms
    )
    VALUES ($1, CURRENT_TIMESTAMP, $2, $3)
    RETURNING *
    `,
    [
      detection_id,
      ear,
      duration_ms,
    ]
  );

  return result.rows[0];
};
