import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import { sendPasswordResetEmail } from "../services/otpService.js";

const recentRequests = new Map<string, number>();
const reply = { message: "หากอีเมลนี้มีบัญชีในระบบ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้" };

export async function requestPasswordReset(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "กรุณากรอกอีเมลให้ถูกต้อง" });
  const now = Date.now();
  if ((recentRequests.get(email) ?? 0) > now - 60_000) return res.json(reply);
  recentRequests.set(email, now);
  if (recentRequests.size > 5_000) recentRequests.clear();

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.email, a.password_hash
       FROM user_service.users u JOIN auth_service.user_auth a ON a.user_id = u.user_id
       WHERE LOWER(u.email) = $1 AND u.delete_flag = 0 AND u.status_active = 'ACTIVE'
         AND a.login_provider = 'LOCAL' AND a.password_hash IS NOT NULL LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (user) {
      if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
      const secret = `${process.env.JWT_SECRET}:${user.password_hash}`;
      const token = jwt.sign({ purpose: "password-reset" }, secret, { subject: String(user.user_id), expiresIn: "15m", jwtid: randomUUID() });
      const frontend = (process.env.FRONTEND_URL ?? "https://blink-detection-two.vercel.app").replace(/\/$/, "");
      await sendPasswordResetEmail(user.email, `${frontend}/reset-password#token=${encodeURIComponent(token)}`);
    }
    return res.json(reply);
  } catch (error) {
    recentRequests.delete(email);
    console.error("Password reset request error:", error);
    return res.status(503).json({ message: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const token = String(req.body?.token ?? "");
  const password = String(req.body?.password ?? "");
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "รหัสผ่านต้องมี 8–128 ตัวอักษร" });
  try {
    const decoded = jwt.decode(token);
    const userId = Number(typeof decoded === "object" ? decoded?.sub : null);
    if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("INVALID_TOKEN");
    const result = await pool.query(
      `SELECT a.password_hash FROM auth_service.user_auth a
       JOIN user_service.users u ON u.user_id = a.user_id
       WHERE a.user_id = $1 AND a.login_provider = 'LOCAL'
         AND u.delete_flag = 0 AND u.status_active = 'ACTIVE' LIMIT 1`,
      [userId],
    );
    const oldHash = result.rows[0]?.password_hash;
    if (!oldHash || !process.env.JWT_SECRET) throw new Error("INVALID_TOKEN");
    const verified = jwt.verify(token, `${process.env.JWT_SECRET}:${oldHash}`) as jwt.JwtPayload;
    if (verified.purpose !== "password-reset" || verified.sub !== String(userId)) throw new Error("INVALID_TOKEN");
    const newHash = await bcrypt.hash(password, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE auth_service.user_auth SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2 AND login_provider = 'LOCAL' AND password_hash = $3 RETURNING auth_id`,
        [newHash, userId, oldHash],
      );
      if (!updated.rowCount) throw new Error("INVALID_TOKEN");
      await client.query(`DELETE FROM auth_service.refresh_token WHERE user_id = $1`, [userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
    return res.json({ message: "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ" });
  } catch {
    return res.status(400).json({ message: "ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว" });
  }
}
