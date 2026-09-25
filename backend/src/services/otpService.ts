import { randomBytes, randomInt } from "crypto";
import {pool} from "../config/database.js";
import nodemailer from "nodemailer";

export async function createOtp(userId: number, email: string) {
  const fixedOtp =
    process.env.NODE_ENV !== "production"
      ? process.env.DEV_FIXED_OTP
      : undefined;

  if (fixedOtp && !/^\d{6}$/.test(fixedOtp)) {
    throw new Error("DEV_FIXED_OTP must contain exactly 6 digits");
  }

  // Use a predictable code only in development; production always stays random.
  const otp = fixedOtp ?? randomInt(100000, 1000000).toString();
  const referenceCode = `BC-${randomBytes(3).toString("hex").toUpperCase()}`;

  // เก็บ OTP ลง Database
  await pool.query(
    `
    INSERT INTO otp_service.otp_verify
    (
      user_id,
      otp_code,
      reference_code,
      otp_type_id,
      status,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3,
      'O0003',
      'PENDING',
      CURRENT_TIMESTAMP + INTERVAL '5 minutes'
    )
    `,
    [userId, otp, referenceCode]
  );

  if (!fixedOtp) {
    await sendOtpEmail(email, otp, referenceCode);
  }

  return { referenceCode, expiresInSeconds: 300 };
}

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendOtpEmail(
  email: string,
  otp: string,
  referenceCode: string,
) {

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Login OTP",

    text: `Your OTP is ${otp}. Reference: ${referenceCode}. This OTP will expire in 5 minutes.`,
  });
}

export async function verifyOtp(
  userId: number,
  otp: string,
  referenceCode?: string,
) {

  const result = await pool.query(
    `
    SELECT
      otp_id,
      otp_code,
      reference_code,
      expires_at
    FROM otp_service.otp_verify
    WHERE user_id = $1
      AND otp_type_id = 'O0003'
      AND verified_at IS NULL
      AND status = 'PENDING'
      AND status_current IS NULL
      AND ($2::text IS NULL OR reference_code = $2)
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId, referenceCode ?? null]
  );

  if (result.rows.length === 0) {
    throw new Error("OTP not found");
  }

  const otpRecord = result.rows[0];

  // ตรวจว่า OTP หมดอายุหรือยัง
  if (new Date(otpRecord.expires_at) < new Date()) {
    throw new Error("OTP expired");
  }

  // ตรวจ OTP
  if (otpRecord.otp_code !== otp) {
    throw new Error("Invalid OTP");
  }

  // OTP ถูกต้อง
  await pool.query(
    `
    UPDATE otp_service.otp_verify
    SET verified_at = CURRENT_TIMESTAMP,
        status_current = 'VERIFIED'
    WHERE otp_id = $1
    `,
    [otpRecord.otp_id]
  );

  return true;
}

export async function resendOtp(userId: number) {
  const userResult = await pool.query(
    `SELECT email FROM user_service.users
     WHERE user_id = $1 AND delete_flag = 0 AND status_active = 'ACTIVE'
     LIMIT 1`,
    [userId],
  );
  const user = userResult.rows[0];
  if (!user) throw new Error("User not found");

  const recentResult = await pool.query(
    `SELECT created_at FROM otp_service.otp_verify
     WHERE user_id = $1 AND otp_type_id = 'O0003'
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  const createdAt = recentResult.rows[0]?.created_at;
  if (createdAt && Date.now() - new Date(createdAt).getTime() < 60_000) {
    throw new Error("กรุณารอ 60 วินาทีก่อนส่ง OTP ใหม่");
  }

  return createOtp(userId, user.email);
}
