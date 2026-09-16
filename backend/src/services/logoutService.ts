import { pool } from "../config/database.js";

export const logoutService = async ({
  jti,
  user_id,
  expires_at,
  refresh_token,
}: {
  jti: string;
  user_id: number;
  expires_at: Date;
  refresh_token: string;
}) => {
  // 1. Revoke Access Token
  const revokeResult = await pool.query(
    `
    INSERT INTO auth_service.revoked_tokens
    (
      jti,
      user_id,
      expires_at
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (jti) DO NOTHING
    RETURNING *
    `,
    [
      jti,
      user_id,
      expires_at,
    ],
  );

  console.log("REVOKE RESULT:", revokeResult.rows);

  // 2. Delete Refresh Token
  const deleteResult = await pool.query(
    `
    DELETE FROM auth_service.refresh_token
    WHERE refresh_token = $1
    RETURNING *
    `,
    [refresh_token],
  );

  console.log("DELETE REFRESH RESULT:", deleteResult.rows);
};