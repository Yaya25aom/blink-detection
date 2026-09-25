import type { Request, Response } from "express";

import {
  createDetectionSession,
  endDetectionSession,
  getActiveDetectionSession,
  updateDetectionLiveState,
  ActiveDetectionSessionError,
} from "../services/detectionService.js";

export const startDetection = async (
  req: Request,
  res: Response
) => {
  try {

    // =========================
    // Get user_id from JWT
    // =========================

    const user = req.user as {
      user_id: string;
      role_user: string;
    };

    const user_id = user.user_id;

    if (!user_id) {
      return res.status(401).json({
        message: "User ID not found in token",
      });
    }

    // =========================
    // Create Detection Session
    // =========================

    const detection =
      await createDetectionSession(
        user_id,
        req.body?.source === "EXTENSION" ? "EXTENSION" : "WEBSITE",
      );

    return res.status(201).json({
      message:
        "Detection session started successfully",

      data: detection,
    });

  } catch (error) {

    if (error instanceof ActiveDetectionSessionError) {
      return res.status(409).json({
        message: "บัญชีนี้กำลังมีการตรวจจับอยู่ กรุณาสิ้นสุด Session ปัจจุบันก่อน",
        code: "ACTIVE_DETECTION_SESSION",
        session_id: error.sessionId,
      });
    }

    console.error(
      "Start detection error:",
      error
    );

    return res.status(500).json({
      message:
        "Internal server error",
    });
  }
};

export const getActiveDetectionController = async (req: Request, res: Response) => {
  const user = req.user as { user_id?: string };
  if (!user?.user_id) return res.status(401).json({ message: "Unauthorized" });
  try {
    return res.json({ data: await getActiveDetectionSession(user.user_id) });
  } catch (error) {
    console.error("Get active detection error:", error);
    return res.status(500).json({ message: "Failed to get active detection session" });
  }
};

export const updateDetectionLiveController = async (req: Request, res: Response) => {
  const user = req.user as { user_id?: string };
  if (!user?.user_id) return res.status(401).json({ message: "Unauthorized" });
  const { session_id, active_seconds, total_blinks, blinks_per_minute, person_present, lighting_level } = req.body;
  if (!session_id) return res.status(400).json({ message: "session_id is required" });
  try {
    const result = await updateDetectionLiveState({
      user_id: user.user_id,
      session_id: String(session_id),
      active_seconds: Math.max(0, Number(active_seconds) || 0),
      total_blinks: Math.max(0, Number(total_blinks) || 0),
      blinks_per_minute: Math.max(0, Number(blinks_per_minute) || 0),
      person_present: person_present === true,
      lighting_level: ["GOOD", "DARK"].includes(lighting_level) ? lighting_level : "UNKNOWN",
    });
    if (!result) return res.status(404).json({ message: "Active detection session not found" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Update detection live state error:", error);
    return res.status(500).json({ message: "Failed to update detection state" });
  }
};
// =========================
// End Detection Session Controller
// =========================
export const endDetectionController = async (
  req: Request,
  res: Response
) => {
  try {
    const user = req.user as { user_id?: string };
    if (!user?.user_id) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const {
      session_id,
      duration_seconds,
      total_blinks,
      average_blinks_per_minute,
      average_ear,
    } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "session_id is required",
      });
    }

    const result = await endDetectionSession({
      user_id: user.user_id,
      session_id,
      duration_seconds,
      total_blinks,
      average_blinks_per_minute,
      average_ear,
    });

    return res.status(200).json({
      success: true,
      message: "Detection session ended successfully",
      data: result,
    });

  } catch (error) {
    console.error("End detection session error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to end detection session",
    });
  }
};
