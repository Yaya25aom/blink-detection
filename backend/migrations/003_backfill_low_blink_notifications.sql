INSERT INTO notification_service.notification_event
  (user_id, event_key, category, title, body, source, occurred_at)
SELECT
  ds.user_id,
  'session-low-blink-' || ds.session_id,
  'LOW_BLINK',
  'อัตราการกะพริบตาต่ำ',
  'ขณะนี้ ' || ROUND(ds.average_blinks_per_minute::numeric, 1) ||
    ' ครั้ง/นาที ควรกะพริบอย่างน้อย 12 ครั้ง/นาที',
  'DETECTION_BACKFILL',
  ds.ended_at AT TIME ZONE 'UTC'
FROM detection_service.detection_session ds
WHERE ds.ended_at IS NOT NULL
  AND ds.average_blinks_per_minute > 0
  AND ds.average_blinks_per_minute < 12
ON CONFLICT (user_id, event_key) DO NOTHING;
