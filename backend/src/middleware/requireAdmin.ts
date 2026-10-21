import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (String(req.user?.role_user).toUpperCase() !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
