ALTER TABLE otp_service.otp_verify
  ADD COLUMN IF NOT EXISTS reference_code VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_otp_verify_reference_code
  ON otp_service.otp_verify (reference_code)
  WHERE reference_code IS NOT NULL;
