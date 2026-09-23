import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { pool } from "../config/database.js";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // =========================
    // 1. Get Authorization Header
    // =========================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Access token required",
      });
    }

    // =========================
    // 2. Check Bearer format
    // =========================
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Invalid authorization header",
      });
    }

    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        message: "Access token required",
      });
    }

    // =========================
    // 3. Check JWT Secret
    // =========================
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured",
      });
    }

    // =========================
    // 4. Verify JWT
    // =========================
    const decoded = jwt.verify(
      token,
      jwtSecret
    ) as jwt.JwtPayload;

    // =========================
    // 5. Check JTI
    // =========================
    if (!decoded.jti) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    // =========================
    // 6. Check Revoked Token
    // =========================
    const revokedToken = await pool.query(
      `
      SELECT 1
      FROM auth_service.revoked_tokens
      WHERE jti = $1
      `,
      [decoded.jti]
    );

    if (revokedToken.rowCount && revokedToken.rowCount > 0) {
      return res.status(401).json({
        message: "Token has been revoked",
      });
    }

    // =========================
    // 7. Attach user to request
    // =========================
    if (decoded.user_id === undefined || typeof decoded.role_user !== "string") {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.user = decoded as Express.User;

    next();

  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
