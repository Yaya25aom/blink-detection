import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  user_id: string;
  role_user: string;
}

export function generateAccessToken(
  user_id: string,
  role_user: string
): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.sign(
    {
      user_id,
      role_user,
    },
    secret,
    {
      expiresIn: "15m",
      jwtid: randomUUID(),
    }
  );
}