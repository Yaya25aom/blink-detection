import { pool } from "../config/database.js";

export const getCurrentAppBlinkStats = async (
  session_id: string
) => {
  const result = await pool.query(
    `
    SELECT
      aus.usage_id,
      aus.app_name,
      aus.started_at,
      COALESCE(aus.ended_at, CURRENT_TIMESTAMP) AS ended_at,
      COUNT(br.id)::INTEGER AS blink_count,
      COALESCE(AVG(br.ear), 0) AS average_ear
    FROM detection_service.app_usage_session aus
    LEFT JOIN detection_service.blink_record br
      ON br.detection_id = aus.session_id
      AND br.timestamp >= aus.started_at
      AND br.timestamp < COALESCE(aus.ended_at, CURRENT_TIMESTAMP)
    WHERE aus.session_id = $1
      AND aus.ended_at IS NULL
    GROUP BY
      aus.usage_id,
      aus.app_name,
      aus.started_at,
      aus.ended_at
    ORDER BY aus.started_at DESC
    LIMIT 1
    `,
    [session_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const durationSeconds =
    (
      new Date(row.ended_at).getTime() -
      new Date(row.started_at).getTime()
    ) / 1000;
  const blinkCount = Number(row.blink_count);

  return {
    usage_id: row.usage_id,
    app_name: row.app_name,
    started_at: row.started_at,
    ended_at: row.ended_at,
    blink_count: blinkCount,
    average_blink_per_minute:
      durationSeconds > 0
        ? blinkCount / (durationSeconds / 60)
        : 0,
    average_ear: Number(row.average_ear),
  };
};

export const createAppBlinkSummary = async (
  session_id: string
) => {
  // ==========================================
  // หา App Usage ของ Session นี้
  // และหา Blink ที่เกิดขึ้นในช่วงเวลาของแต่ละ App
  // ==========================================

  const result = await pool.query(
    `
    SELECT
      aus.usage_id,
      aus.app_name,
      aus.started_at,
      aus.ended_at,

      COUNT(br.id)::INTEGER AS blink_count,

      COALESCE(
        AVG(br.ear),
        0
      ) AS average_ear

    FROM detection_service.app_usage_session aus

    LEFT JOIN detection_service.blink_record br
      ON br.detection_id = aus.session_id
      AND br.timestamp >= aus.started_at
      AND br.timestamp < COALESCE(aus.ended_at, CURRENT_TIMESTAMP)

    WHERE aus.session_id = $1

    GROUP BY
      aus.usage_id,
      aus.app_name,
      aus.started_at,
      aus.ended_at

    ORDER BY aus.started_at
    `,
    [session_id]
  );

  // ==========================================
  // INSERT ผลลัพธ์ลง app_blink_summary
  // ==========================================

  await pool.query(
    `
    DELETE FROM detection_service.app_blink_summary
    WHERE session_id = $1
    `,
    [session_id]
  );

  for (const row of result.rows) {
    // ==========================================
    // คำนวณระยะเวลาของ App Usage
    // ==========================================

    const durationSeconds =
      (
        new Date(row.ended_at ?? Date.now()).getTime() -
        new Date(row.started_at).getTime()
      ) / 1000;

    const totalBlinks = Number(row.blink_count);

    // ==========================================
    // คำนวณ Average Blink Per Minute
    // ==========================================

    const averageBlinkPerMinute =
      durationSeconds > 0
        ? totalBlinks / (durationSeconds / 60)
        : 0;

    // ==========================================
    // INSERT ลง app_blink_summary
    // ==========================================

    await pool.query(
      `
      INSERT INTO detection_service.app_blink_summary
      (
        session_id,
        usage_id,
        app_name,
        blink_count,
        average_blink_per_minute,
        average_ear
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      `,
      [
        session_id,
        row.usage_id,
        row.app_name,
        totalBlinks,
        averageBlinkPerMinute,
        Number(row.average_ear),
      ]
    );
  }

  return result.rows;
};
