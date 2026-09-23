CREATE SCHEMA IF NOT EXISTS notification_service;

CREATE TABLE IF NOT EXISTS notification_service.notification_event (
  notification_event_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_service.users(user_id) ON DELETE CASCADE,
  event_key VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'WEB',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_notification_event_user_key UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_event_user_time
  ON notification_service.notification_event (user_id, occurred_at DESC);
