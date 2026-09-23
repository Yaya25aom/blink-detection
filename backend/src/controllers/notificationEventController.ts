import type { Request, Response } from "express";
import { createNotificationEvent, getNotificationEvents } from "../services/notificationEventService.js";

const allowedCategories = new Set([
  "PLAN_REMINDER", "LOW_BLINK", "FACE_MISSING", "POOR_LIGHTING", "PLAN_COMPLETED", "LONG_SESSION",
]);

export const postNotificationEvent = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    const { event_key, category, title, body, source, occurred_at } = req.body ?? {};
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (typeof event_key !== "string" || !event_key || event_key.length > 120 || !allowedCategories.has(category)) {
      return res.status(400).json({ success: false, message: "Invalid notification event" });
    }
    if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
      return res.status(400).json({ success: false, message: "title and body are required" });
    }
    const event = await createNotificationEvent(userId, {
      eventKey: event_key, category, title: title.trim(), body: body.trim(), source, occurredAt: occurred_at,
    });
    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error("Create notification event error:", error);
    return res.status(500).json({ success: false, message: "Failed to save notification event" });
  }
};

export const listNotificationEvents = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, message: "Unauthorized" });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    return res.json({ success: true, data: await getNotificationEvents(userId, limit) });
  } catch (error) {
    console.error("List notification events error:", error);
    return res.status(500).json({ success: false, message: "Failed to load notification events" });
  }
};
