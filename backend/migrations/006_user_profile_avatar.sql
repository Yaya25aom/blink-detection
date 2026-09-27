ALTER TABLE user_service.users
  ADD COLUMN IF NOT EXISTS avatar_data BYTEA,
  ADD COLUMN IF NOT EXISTS avatar_mime_type VARCHAR(30);
