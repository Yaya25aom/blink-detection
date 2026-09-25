import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../config/database.js";
import { generateAccessToken } from "../utils/jwt.js";
import { createOtp, resendOtp, verifyOtp } from "./otpService.js";

const REVIEW_ACCOUNT_EMAIL = "blinkcare.review.test@gmail.com";

const shouldBypassOtp = (email: string) => {
  const configuredEmails = (process.env.OTP_BYPASS_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return email.trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL ||
    configuredEmails.includes(email.trim().toLowerCase());
};

export type LoginUser = {
  user_id: number;
  email: string;
  user_name: string;
  role_user: string;
};

export const resendLoginOtp = (userId: number) => resendOtp(userId);

export const createLoginSession = async (user: LoginUser) => {
  const accessToken = generateAccessToken(String(user.user_id), user.role_user);
  const refreshToken = crypto.randomBytes(64).toString("hex");

  await pool.query(
    `
    INSERT INTO auth_service.refresh_token (user_id, refresh_token, expires_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '7 days')
    `,
    [user.user_id, refreshToken],
  );

  await pool.query(
    `
    UPDATE auth_service.user_auth
    SET last_login_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1 AND login_provider = 'LOCAL'
    `,
    [user.user_id],
  );

  return {
    accessToken,
    refreshToken,
    user: {
      user_id: user.user_id,
      email: user.email,
      user_name: user.user_name,
      role_user: user.role_user,
    },
  };
};

export async function registerLocalUser(userName: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT user_id FROM user_service.users WHERE LOWER(email) = $1 AND delete_flag = 0 LIMIT 1`,
      [normalizedEmail],
    );
    if (existing.rows.length > 0) throw new Error("EMAIL_ALREADY_EXISTS");

    const userResult = await client.query<LoginUser>(
      `
      INSERT INTO user_service.users (user_name, email)
      VALUES ($1, $2)
      RETURNING user_id, email, user_name, role_user
      `,
      [userName.trim(), normalizedEmail],
    );
    const user = userResult.rows[0];
    if (!user) throw new Error("REGISTER_FAILED");

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `
      INSERT INTO auth_service.user_auth (user_id, login_provider, password_hash)
      VALUES ($1, 'LOCAL', $2)
      `,
      [user.user_id, passwordHash],
    );
    await client.query("COMMIT");
    return { user_id: user.user_id, email: user.email, user_name: user.user_name };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findOrCreateGoogleUser(profile: {
  providerUserId: string;
  email: string;
  displayName: string;
}) {
  const normalizedEmail = profile.email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const providerResult = await client.query<LoginUser>(
      `
      SELECT u.user_id, u.email, u.user_name, u.role_user
      FROM auth_service.user_auth a
      JOIN user_service.users u ON u.user_id = a.user_id
      WHERE a.login_provider = 'GOOGLE' AND a.provider_user_id = $1
        AND u.delete_flag = 0 AND u.status_active = 'ACTIVE'
      LIMIT 1
      `,
      [profile.providerUserId],
    );
    if (providerResult.rows[0]) {
      await client.query("COMMIT");
      return providerResult.rows[0];
    }

    const emailResult = await client.query<LoginUser>(
      `
      SELECT user_id, email, user_name, role_user
      FROM user_service.users
      WHERE LOWER(email) = $1 AND delete_flag = 0
      LIMIT 1
      `,
      [normalizedEmail],
    );
    let user = emailResult.rows[0];

    if (!user) {
      const created = await client.query<LoginUser>(
        `
        INSERT INTO user_service.users (user_name, email, email_verified)
        VALUES ($1, $2, TRUE)
        RETURNING user_id, email, user_name, role_user
        `,
        [profile.displayName || normalizedEmail.split("@")[0], normalizedEmail],
      );
      user = created.rows[0];
    } else {
      await client.query(
        `UPDATE user_service.users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [user.user_id],
      );
    }

    if (!user) throw new Error("GOOGLE_LOGIN_FAILED");
    await client.query(
      `
      INSERT INTO auth_service.user_auth (user_id, login_provider, provider_user_id)
      VALUES ($1, 'GOOGLE', $2)
      `,
      [user.user_id, profile.providerUserId],
    );
    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function login(email: string, password: string) {
  // 1. หา User
  const userResult = await pool.query(
    `
    SELECT
      user_id,
      email,
      user_name,
      role_user,
      status_active
    FROM user_service.users
    WHERE email = $1
    LIMIT 1
    `,
    [email],
  );

  if (userResult.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = userResult.rows[0];

  // 2. ตรวจสอบ Status
  if (user.status_active !== "ACTIVE") {
    throw new Error("User account is not active");
  }

  // 3. หา Authentication
  const authResult = await pool.query(
    `
    SELECT
      auth_id,
      password_hash,
      login_provider
    FROM auth_service.user_auth
    WHERE user_id = $1
      AND login_provider = 'LOCAL'
    LIMIT 1
    `,
    [user.user_id],
  );

  if (authResult.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const auth = authResult.rows[0];

  // 4. ตรวจ Password
  if (!auth.password_hash) {
    throw new Error("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, auth.password_hash);

  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  if (shouldBypassOtp(user.email)) {
    return {
      requiresOtp: false,
      ...(await createLoginSession(user)),
    };
  }

  const otpResult = await createOtp(user.user_id, user.email);

  return {
    requiresOtp: true,
    user_id: user.user_id,
    reference_code: otpResult.referenceCode,
    expires_in_seconds: otpResult.expiresInSeconds,
  };

  //   // 5. สร้าง JWT
  //   const accessToken = generateAccessToken(
  //     String(user.user_id),
  //     user.role
  //   );

  //   // 6. อัปเดตเวลา Login
  //   await pool.query(
  //     `
  //     UPDATE auth_service.user_auth
  //     SET last_login_at = CURRENT_TIMESTAMP,
  //         updated_at = CURRENT_TIMESTAMP
  //     WHERE auth_id = $1
  //     `,
  //     [auth.auth_id]
  //   );

  //   // 7. ส่งผลลัพธ์
  //   return {
  //     accessToken,
  //     user: {
  //       user_id: user.user_id,
  //       email: user.email,
  //       user_name: user.user_name,
  //       role_user: user.role_user,
  //     },
  //   };
}

export async function verifyOtpLogin(userId: number, otp: string, referenceCode?: string) {
  // ตรวจ OTP
  await verifyOtp(userId, otp, referenceCode);

  // ดึงข้อมูล User
  const result = await pool.query(
    `
    SELECT
      u.user_id,
      u.email,
      u.user_name,
      u.role_user
    FROM user_service.users u
    WHERE u.user_id = $1
    `,
    [userId],
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = result.rows[0];

  return createLoginSession(user);
}
