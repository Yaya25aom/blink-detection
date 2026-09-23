import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { logoutService } from "../services/logoutService.js";
import {
  createLoginSession,
  login,
  registerLocalUser,
  verifyOtpLogin,
} from "../services/authService.js";
import type { LoginUser } from "../services/authService.js";
import { refreshAccessToken } from "../services/refreshService.js";

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await login(email, password);

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
    const { user_id, otp } = req.body;

    const result = await verifyOtpLogin(user_id, otp);

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
