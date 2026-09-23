import type { Request, Response } from "express";
import { getDashboardSummary, getMultiDayDashboard } from "../services/dashboardService.js";

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

export const getMultiDayDashboardController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    if (days < 1 || days > 90) return res.status(400).json({ success: false, message: "Date range must be 1-90 days" });
    return res.json({ success: true, data: await getMultiDayDashboard(String(userId), from, to) });
  } catch (error) {
    console.error("Get multi-day dashboard error:", error);
    return res.status(500).json({ success: false, message: "Failed to load multi-day dashboard" });
  }
};
