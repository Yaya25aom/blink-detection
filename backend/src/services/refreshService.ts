import { pool } from "../config/database.js";
import { generateAccessToken } from "../utils/jwt.js";

export const refreshAccessToken = async (
  refresh_token: string
) => {
  // 1. ค้นหา Refresh Token
  const result = await pool.query(
    `
    SELECT
      user_id,
      expires_at
    FROM auth_service.refresh_token
    WHERE refresh_token = $1
    LIMIT 1
    `,
    [refresh_token]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid refresh token");
  }

  const token = result.rows[0];

  // 2. ตรวจวันหมดอายุ
  if (new Date(token.expires_at) <= new Date()) {
    throw new Error("Refresh token expired");
  }

  // 3. ดึง User
  const userResult = await pool.query(
    `
    SELECT
      user_id,
      role_user
    FROM user_service.users
    WHERE user_id = $1
    LIMIT 1
    `,
    [token.user_id]
  );

  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = userResult.rows[0];

  // 4. สร้าง Access Token ใหม่
  const accessToken = generateAccessToken(
    user.user_id.toString(),
    user.role_user
  );

  return accessToken;
};