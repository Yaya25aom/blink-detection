import type { Request, Response } from "express";

import {
  createDetectionSession,
  endDetectionSession,
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
        user_id
      );

    return res.status(201).json({
      message:
        "Detection session started successfully",

      data: detection,
    });

  } catch (error) {

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
