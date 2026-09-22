import type { Request, Response } from "express";
import { getHistory } from "../services/historyService.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const getHistoryController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!datePattern.test(from) || !datePattern.test(to) || from > to) {
      return res.status(400).json({ success: false, message: "Invalid date range" });
    }
    return res.status(200).json({ success: true, data: await getHistory(userId, from, to) });
  } catch (error) {
    console.error("Get history error:", error);
    return res.status(500).json({ success: false, message: "Failed to load history" });
  }
};
