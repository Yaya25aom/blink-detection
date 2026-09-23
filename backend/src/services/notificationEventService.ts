import { pool } from "../config/database.js";

export type NotificationEventInput = {
  eventKey: string;
  category: string;
  title: string;
  body: string;
  source?: string;
  occurredAt?: string;
};

export const createNotificationEvent = async (userId: number, input: NotificationEventInput) => {
  const result = await pool.query(
    `
    INSERT INTO notification_service.notification_event
      (user_id, event_key, category, title, body, source, occurred_at)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, CURRENT_TIMESTAMP))
    ON CONFLICT (user_id, event_key) DO UPDATE SET
      category = EXCLUDED.category, title = EXCLUDED.title, body = EXCLUDED.body
    RETURNING notification_event_id, event_key, category, title, body, source, occurred_at
    `,
    [userId, input.eventKey, input.category, input.title, input.body, input.source ?? "WEB", input.occurredAt ?? null],
  );
  return result.rows[0];
};

export const getNotificationEvents = async (userId: number, limit: number) => {
  const result = await pool.query(
    `SELECT notification_event_id, event_key, category, title, body, source, occurred_at
     FROM notification_service.notification_event
     WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
};
