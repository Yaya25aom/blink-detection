CREATE TABLE IF NOT EXISTS plan_service.plan_reminder_event (
  reminder_event_id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_service.users(user_id),
  plan_id BIGINT NOT NULL REFERENCES plan_service.improvement_plan(plan_id) ON DELETE CASCADE,
  plan_measure_id BIGINT NOT NULL REFERENCES plan_service.plan_measure(plan_measure_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  CONSTRAINT chk_plan_reminder_event_status
    CHECK (status IN ('PENDING', 'COMPLETED', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_plan_reminder_event_plan
  ON plan_service.plan_reminder_event(plan_id, triggered_at);

