ALTER TABLE detection_service.detection_session
  ADD COLUMN IF NOT EXISTS detection_source VARCHAR(20) NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN IF NOT EXISTS live_active_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_total_blinks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_blinks_per_minute NUMERIC(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_person_present BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_lighting_level VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS live_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_detection_session_user_active
  ON detection_service.detection_session (user_id, started_at DESC)
  WHERE ended_at IS NULL;
