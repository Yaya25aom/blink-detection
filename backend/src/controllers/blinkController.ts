import type { Request, Response } from "express";
import { createBlinkRecord } from "../services/blinkService.js";

export const createBlink = async (
  req: Request,
  res: Response
) => {
  try {
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
      detection_id: detection_id,
      ear,
      duration_ms: duration_ms,
    });

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
