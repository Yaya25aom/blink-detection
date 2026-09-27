import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { logoutService } from "../services/logoutService.js";
import {
  createLoginSession,
  login,
  registerLocalUser,
  resendLoginOtp,
  verifyOtpLogin,
} from "../services/authService.js";
import type { LoginUser } from "../services/authService.js";
import { refreshAccessToken } from "../services/refreshService.js";
import { pool } from "../config/database.js";
import bcrypt from "bcrypt";
import { resendOtp, verifyOtp } from "../services/otpService.js";

const profileAvatar = (data: Buffer | null, mimeType: string | null) =>
  data && mimeType ? `data:${mimeType};base64,${data.toString("base64")}` : null;

export async function currentUserController(req: Request, res: Response) {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const result = await pool.query(
      `SELECT u.user_id, u.user_name, u.email, u.created_at,
              u.avatar_data, u.avatar_mime_type,
              EXISTS (
                SELECT 1 FROM auth_service.user_auth a
                WHERE a.user_id = u.user_id AND a.login_provider = 'LOCAL'
                  AND a.password_hash IS NOT NULL
              ) AS has_password
       FROM user_service.users u
       WHERE user_id = $1 AND delete_flag = 0 AND status_active = 'ACTIVE'
       LIMIT 1`,
      [userId],
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "User not found" });
    const user = result.rows[0];
    return res.json({
      success: true,
      data: {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        created_at: user.created_at,
        has_password: user.has_password,
        avatar: profileAvatar(user.avatar_data, user.avatar_mime_type),
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({ success: false, message: "Failed to load user" });
  }
}

export async function updateCurrentUserController(req: Request, res: Response) {
  try {
    const userId = Number(req.user?.user_id);
    const userName = String(req.body?.user_name ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const avatar = req.body?.avatar;
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (userName.length < 2 || userName.length > 100) return res.status(400).json({ success: false, message: "ชื่อผู้ใช้ต้องมี 2-100 ตัวอักษร" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });

    const duplicate = await pool.query(
      `SELECT user_name, email FROM user_service.users
       WHERE (LOWER(email) = $1 OR LOWER(user_name) = LOWER($2))
         AND user_id <> $3 AND delete_flag = 0`,
      [email, userName, userId],
    );
    if (duplicate.rows.some((row) => row.email.toLowerCase() === email)) return res.status(409).json({ success: false, message: "อีเมลนี้ถูกใช้งานแล้ว" });
    if (duplicate.rows.some((row) => row.user_name.toLowerCase() === userName.toLowerCase())) return res.status(409).json({ success: false, message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" });

    let avatarData: Buffer | null | undefined;
    let avatarMimeType: string | null | undefined;
    if (avatar === null) {
      avatarData = null;
      avatarMimeType = null;
    } else if (typeof avatar === "string") {
      const match = avatar.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return res.status(400).json({ success: false, message: "รูปโปรไฟล์ไม่ถูกต้อง" });
      avatarData = Buffer.from(match[2]!, "base64");
      avatarMimeType = match[1]!;
      if (avatarData.length > 1_500_000) return res.status(413).json({ success: false, message: "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 1.5 MB" });
    }

    const result = avatarData !== undefined
      ? await pool.query(
        `UPDATE user_service.users SET user_name = $1, email = $2, avatar_data = $3,
          avatar_mime_type = $4, updated_at = CURRENT_TIMESTAMP WHERE user_id = $5
          RETURNING user_id, user_name, email, created_at, avatar_data, avatar_mime_type`,
        [userName, email, avatarData, avatarMimeType, userId],
      )
      : await pool.query(
        `UPDATE user_service.users SET user_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 RETURNING user_id, user_name, email, created_at, avatar_data, avatar_mime_type`,
        [userName, email, userId],
      );
    const user = result.rows[0];
    return res.json({ success: true, message: "บันทึกโปรไฟล์แล้ว", data: { ...user, avatar_data: undefined, avatar_mime_type: undefined, avatar: profileAvatar(user.avatar_data, user.avatar_mime_type) } });
  } catch (error) {
    console.error("Update profile error:", error);
    if ((error as { code?: string }).code === "23505") return res.status(409).json({ success: false, message: "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว" });
    return res.status(500).json({ success: false, message: "ไม่สามารถบันทึกโปรไฟล์ได้" });
  }
}

export async function requestPasswordChangeOtpController(req: Request, res: Response) {
  try {
    const userId = Number(req.user?.user_id);
    const otp = await resendOtp(userId);
    return res.json({ success: true, message: "ส่ง OTP แล้ว", data: { reference_code: otp.referenceCode, expires_in_seconds: otp.expiresInSeconds } });
  } catch (error) {
    console.error("Password OTP error:", error);
    return res.status(500).json({ success: false, message: "ไม่สามารถส่ง OTP ได้" });
  }
}

export async function changePasswordController(req: Request, res: Response) {
  try {
    const userId = Number(req.user?.user_id);
    const otp = String(req.body?.otp ?? "");
    const referenceCode = String(req.body?.reference_code ?? "");
    const newPassword = String(req.body?.new_password ?? "");
    if (!/^\d{6}$/.test(otp) || !referenceCode) return res.status(400).json({ success: false, message: "กรุณากรอก OTP และ Ref ให้ครบ" });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    const currentAuth = await pool.query(
      `SELECT password_hash FROM auth_service.user_auth
       WHERE user_id = $1 AND login_provider = 'LOCAL' AND password_hash IS NOT NULL LIMIT 1`,
      [userId],
    );
    if (!currentAuth.rows[0]) return res.status(400).json({ success: false, message: "บัญชี Google ยังไม่มีรหัสผ่านภายในระบบ" });
    if (await bcrypt.compare(newPassword, currentAuth.rows[0].password_hash)) {
      return res.status(400).json({ success: false, message: "รหัสผ่านใหม่นี้เป็นรหัสผ่านเดิม กรุณาตั้งรหัสผ่านใหม่" });
    }
    await verifyOtp(userId, otp, referenceCode);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      `UPDATE auth_service.user_auth SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND login_provider = 'LOCAL' RETURNING auth_id`,
      [passwordHash, userId],
    );
    if (!result.rows[0]) return res.status(400).json({ success: false, message: "บัญชี Google ยังไม่มีรหัสผ่านภายในระบบ" });
    return res.json({ success: true, message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
  } catch (error) {
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้" });
  }
}

export async function registerController(req: Request, res: Response) {
  try {
    const { user_name, email, password, confirm_password } = req.body;
    if (!user_name || !email || !password || !confirm_password) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลให้ครบ" });
    }
    if (String(user_name).trim().length < 2 || String(user_name).trim().length > 100) {
      return res.status(400).json({ success: false, message: "ชื่อผู้ใช้ต้องมี 2-100 ตัวอักษร" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ success: false, message: "รหัสผ่านยืนยันไม่ตรงกัน" });
    }
    const user = await registerLocalUser(user_name, email, password);
    return res.status(201).json({ success: true, message: "สร้างบัญชีสำเร็จ", data: user });
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return res.status(409).json({ success: false, message: "อีเมลนี้ถูกใช้งานแล้ว" });
    }
    if (error instanceof Error && error.message === "USERNAME_ALREADY_EXISTS") {
      return res.status(409).json({ success: false, message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" });
    }
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ success: false, message: "ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว" });
    }
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: "ไม่สามารถสร้างบัญชีได้" });
  }
}

export async function googleCallbackController(req: Request, res: Response) {
  try {
    const session = await createLoginSession(req.user as LoginUser);
    const frontendUrl = process.env.FRONTEND_URL ?? "https://blink-detection-two.vercel.app";
    const fragment = new URLSearchParams({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    return res.redirect(`${frontendUrl}/auth/google/callback#${fragment.toString()}`);
  } catch (error) {
    console.error("Google callback error:", error);
    const frontendUrl = process.env.FRONTEND_URL ?? "https://blink-detection-two.vercel.app";
    return res.redirect(`${frontendUrl}/auth?google_error=1`);
  }
}

export async function loginController(req: Request, res: Response) {
  try {
    const identifier = req.body?.identifier ?? req.body?.email;
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required",
      });
    }

    const result = await login(String(identifier).trim(), password);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
}

export async function verifyOtpController(req: Request, res: Response) {
  try {
    const { user_id, otp, reference_code } = req.body;

    const result = await verifyOtpLogin(user_id, otp, reference_code);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "OTP verification failed",
    });
  }
}

export async function resendOtpController(req: Request, res: Response) {
  try {
    const userId = Number(req.body?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid user" });
    }
    const result = await resendLoginOtp(userId);
    return res.json({
      success: true,
      message: "ส่ง OTP ใหม่แล้ว",
      data: {
        reference_code: result.referenceCode,
        expires_in_seconds: result.expiresInSeconds,
      },
    });
  } catch (error) {
    return res.status(429).json({
      success: false,
      message: error instanceof Error ? error.message : "ไม่สามารถส่ง OTP ใหม่ได้",
    });
  }
}

export const logout = async (
  req: Request,
  res: Response,
) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("===== LOGOUT =====");
    console.log("Authorization:", authHeader);

    if (!authHeader) {
      return res.status(401).json({
        message: "Access token is required",
      });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid authorization header",
      });
    }

    const accessToken = parts[1];

    if (!accessToken) {
      return res.status(401).json({
        message: "Access token is required",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured",
      });
    }

    console.log("JWT SECRET exists:", !!jwtSecret);
    console.log("TOKEN:", accessToken);

    const decoded = jwt.verify(
      accessToken,
      jwtSecret,
    ) as jwt.JwtPayload;

    console.log("DECODED:", decoded);
    console.log("JTI:", decoded.jti);
    console.log("USER ID:", decoded.user_id);
    console.log("EXP:", decoded.exp);

    if (
      !decoded.jti ||
      !decoded.user_id ||
      !decoded.exp
    ) {
      return res.status(401).json({
        message: "Invalid access token payload",
      });
    }

    const refresh_token = req.body.refreshToken;

    console.log("REFRESH TOKEN:", refresh_token);

    if (!refresh_token) {
      return res.status(400).json({
        message: "Refresh token is required",
      });
    }

    await logoutService({
      jti: decoded.jti,
      user_id: Number(decoded.user_id),
      expires_at: new Date(decoded.exp * 1000),
      refresh_token,
    });

    return res.status(200).json({
      message: "Logout successful",
    });

  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    return res.status(401).json({
      message: "Invalid access token",
    });
  }
};

export const refresh = async (
  req: Request,
  res: Response
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token required",
      });
    }

    const accessToken = await refreshAccessToken(
      refreshToken
    );

    return res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken,
    });

  } catch (error) {
    console.error("Refresh error:", error);

    return res.status(401).json({
      message: "Invalid or expired refresh token",
    });
  }
};
