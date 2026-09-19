import type { Request, Response } from "express";
import { getDashboardSummary } from "../services/dashboardService.js";

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id as string | undefined;
    const date = typeof req.query.date === "string" ? req.query.date : undefined;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "date must use YYYY-MM-DD format",
      });
    }

    const data = await getDashboardSummary(userId, date);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};
