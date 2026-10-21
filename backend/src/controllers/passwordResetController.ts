import type { Request, Response } from "express";
import { createHmac, randomInt } from "crypto";
import bcrypt from "bcrypt";
import { pool } from "../config/database.js";
import { sendPasswordResetEmail } from "../services/otpService.js";

const reply = { message: "หากอีเมลนี้มีบัญชีในระบบ เราจะส่งรหัสตั้งรหัสผ่านใหม่ให้" };
const codeHash = (userId: number, code: string) =>
  createHmac("sha256", process.env.JWT_SECRET!).update(`${userId}:${code}`).digest("hex");
const attempts = new Map<string, { count: number; until: number }>();

export async function requestPasswordReset(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "กรุณากรอกอีเมลให้ถูกต้อง" });
  try {
    const result = await pool.query(
      `SELECT u.user_id, u.email FROM user_service.users u
       JOIN auth_service.user_auth a ON a.user_id = u.user_id
       WHERE LOWER(u.email) = $1 AND u.delete_flag = 0 AND u.status_active = 'ACTIVE'
         AND a.login_provider = 'LOCAL' AND a.password_hash IS NOT NULL LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user) return res.json(reply);
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
    const code = String(randomInt(100_000, 1_000_000));
    const saved = await pool.query(
      `INSERT INTO auth_service.password_reset_request (user_id, code_hash, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
         requested_at = CURRENT_TIMESTAMP, expires_at = EXCLUDED.expires_at, attempts = 0
       WHERE password_reset_request.requested_at < CURRENT_TIMESTAMP - INTERVAL '60 seconds'
       RETURNING user_id`,
      [user.user_id, codeHash(user.user_id, code)],
    );
    if (saved.rowCount) {
      const frontend = (process.env.FRONTEND_URL ?? "https://blink-detection-two.vercel.app").replace(/\/$/, "");
      try {
        await sendPasswordResetEmail(user.email, `${frontend}/reset-password#u=${user.user_id}`, code);
      } catch (error) {
        await pool.query(`DELETE FROM auth_service.password_reset_request WHERE user_id = $1 AND code_hash = $2`, [user.user_id, codeHash(user.user_id, code)]);
        throw error;
      }
    }
    return res.json(reply);
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(503).json({ message: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง" });
  }
}

export async function resetPassword(req: Request, res: Response) {
  const userId = Number(req.body?.user_id);
  const code = String(req.body?.code ?? "");
  const password = String(req.body?.password ?? "");
  if (!Number.isSafeInteger(userId) || userId <= 0 || !/^\d{6}$/.test(code) || password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: "กรุณากรอกรหัส 6 หลักและรหัสผ่านใหม่ 8–128 ตัวอักษร" });
  }
  const ip = req.ip ?? "unknown";
  const limit = attempts.get(ip);
  if (limit && limit.until > Date.now() && limit.count >= 10) return res.status(429).json({ message: "ลองรหัสหลายครั้งเกินไป กรุณารอ 15 นาที" });
  attempts.set(ip, { count: limit && limit.until > Date.now() ? limit.count + 1 : 1, until: Date.now() + 15 * 60_000 });
  if (attempts.size > 10_000) attempts.clear();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT r.user_id, r.code_hash, r.attempts FROM auth_service.password_reset_request r
       JOIN user_service.users u ON u.user_id = r.user_id
       WHERE r.user_id = $1 AND u.delete_flag = 0 AND u.status_active = 'ACTIVE'
         AND r.expires_at > CURRENT_TIMESTAMP FOR UPDATE OF r`,
      [userId],
    );
    const request = result.rows[0];
    if (!request || request.attempts >= 5) throw new Error("INVALID_CODE");
    if (request.code_hash !== codeHash(userId, code)) {
      await client.query(`UPDATE auth_service.password_reset_request SET attempts = attempts + 1 WHERE user_id = $1`, [userId]);
      await client.query("COMMIT");
      return res.status(400).json({ message: "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่" });
    }
    await client.query(
      `UPDATE auth_service.user_auth SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND login_provider = 'LOCAL'`,
      [await bcrypt.hash(password, 12), request.user_id],
    );
    await client.query(`DELETE FROM auth_service.refresh_token WHERE user_id = $1`, [request.user_id]);
    await client.query(`DELETE FROM auth_service.password_reset_request WHERE user_id = $1`, [request.user_id]);
    await client.query("COMMIT");
    return res.json({ message: "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ" });
  } catch (error) {
    await client.query("ROLLBACK");
    if (!(error instanceof Error && error.message === "INVALID_CODE")) console.error("Password reset error:", error);
    return res.status(400).json({ message: "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่" });
  } finally { client.release(); }
}
