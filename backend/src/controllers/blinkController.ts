import type { Request, Response } from "express";
import { createBlinkRecord } from "../services/blinkService.js";

export const createBlink = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      detection_id,
      ear,
      duration_ms,
    } = req.body;

    // ตรวจข้อมูลที่จำเป็น
    if (
      !detection_id ||
      ear === undefined ||
      duration_ms === undefined
    ) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    const blink = await createBlinkRecord({
      user_id: userId,
      detection_id: detection_id,
      ear,
      duration_ms: duration_ms,
    });

    if (!blink) {
      return res.status(404).json({ message: "Detection session not found for this user" });
    }

    return res.status(201).json({
      message: "Blink record created successfully",
      data: blink,
    });

  } catch (error) {

    console.error("Create blink error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
