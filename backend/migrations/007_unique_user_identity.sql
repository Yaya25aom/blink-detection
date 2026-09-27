CREATE UNIQUE INDEX IF NOT EXISTS uq_users_active_username_ci
  ON user_service.users (LOWER(user_name))
  WHERE delete_flag = 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_active_email_ci
  ON user_service.users (LOWER(email))
  WHERE delete_flag = 0;
