import type { Request, Response } from "express";

import {
  createCurrentAppUsage,
  updateCurrentAppUsage,
  closeCurrentAppUsage,
  getCurrentAppUsageSession,
} from "../services/appUsageService.js";
import {
  getCurrentAppBlinkStats,
} from "../services/appBlinkSummaryService.js";


// =====================================================
// Create App Usage
// =====================================================

export const createAppUsage = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      session_id,
      app_name,
      started_at,
    } = req.body;

    if (
      !session_id ||
      !app_name ||
      !started_at
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const usage =
      await createCurrentAppUsage(
        session_id,
        app_name,
        started_at
      );

    return res.status(201).json({
      success: true,
      message: "App usage created",
      data: usage,
    });

  } catch (error) {

    console.error(
      "Create app usage error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create app usage",
    });
  }
};


// =====================================================
// Current Detection Session
// =====================================================

let currentSessionId: string | null = null;

let appTracking = false;


// =====================================================
// Set Current Session
// =====================================================

export const setCurrentSession = async (
  req: Request,
  res: Response
) => {

  try {

    const { session_id } = req.body;

    if (!session_id) {

      return res.status(400).json({
        success: false,
        message: "session_id is required",
      });

    }

    currentSessionId = session_id;

    appTracking = true;

    console.log(
      "Current detection session:",
      currentSessionId
    );

    console.log(
      "App tracking:",
      appTracking
    );

    return res.status(200).json({
      success: true,
      session_id: currentSessionId,
      tracking: appTracking,
    });

  } catch (error) {

    console.error(
      "Set current session error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to set current session",
    });

  }
};


// =====================================================
// Get Current Session
// =====================================================

export const getCurrentSession = async (
  req: Request,
  res: Response
) => {

  try {

    if (!currentSessionId) {

      return res.status(404).json({
        success: false,
        message: "No active detection session",
      });

    }

    return res.status(200).json({
      success: true,
      session_id: currentSessionId,
      tracking: appTracking,
    });

  } catch (error) {

    console.error(
      "Get current session error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get current session",
    });

  }
};


// =====================================================
// Get Current App Usage
// =====================================================

export const getCurrentAppUsage = async (
  req: Request,
  res: Response
) => {

  try {

    const { session_id } = req.query;

    if (!session_id) {

      return res.status(400).json({
        success: false,
        message: "session_id is required",
      });

    }

    const app =
      await getCurrentAppUsageSession(
        String(session_id)
      );

    if (!app) {

      return res.status(200).json({
        success: true,
        data: null,
      });

    }

    return res.status(200).json({
      success: true,
      data: app,
    });

  } catch (error) {

    console.error(
      "Get current app usage error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get current app usage",
    });

  }
};


// =====================================================
// Get Current App Blink Stats
// =====================================================

export const getCurrentAppBlinks = async (
  req: Request,
  res: Response
) => {

  try {

    const { session_id } = req.query;

    if (!session_id) {

      return res.status(400).json({
        success: false,
        message: "session_id is required",
      });

    }

    const stats =
      await getCurrentAppBlinkStats(
        String(session_id)
      );

    return res.status(200).json({
      success: true,
      data: stats,
    });

  } catch (error) {

    console.error(
      "Get current app blink stats error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get current app blink stats",
    });

  }
};


// =====================================================
// Update Current App
// =====================================================

export const updateCurrentApp = async (
  req: Request,
  res: Response
) => {

  try {

    const {
      session_id,
      ended_at,
    } = req.body;

    if (
      !session_id ||
      !ended_at
    ) {

      return res.status(400).json({
        success: false,
        message:
          "session_id and ended_at are required",
      });

    }

    const usage =
      await updateCurrentAppUsage(
        session_id,
        ended_at
      );

    if (!usage) {

      return res.status(404).json({
        success: false,
        message:
          "No active app usage session",
      });

    }

    return res.status(200).json({
      success: true,
      data: usage,
    });

  } catch (error) {

    console.error(
      "Update current app error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update current app",
    });

  }
};


// =====================================================
// Pause
// =====================================================

export const pauseAppUsage = async (
  req: Request,
  res: Response
) => {

  try {

    appTracking = false;

    if (currentSessionId) {

      await closeCurrentAppUsage(
        currentSessionId,
        new Date().toISOString()
      );

    }

    return res.status(200).json({
      success: true,
      message: "App usage tracking paused",
      tracking: false,
    });

  } catch (error) {

    console.error(
      "Pause app usage error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to pause app usage",
    });

  }
};


// =====================================================
// Resume
// =====================================================

export const resumeAppUsage = async (
  req: Request,
  res: Response
) => {

  try {

    appTracking = true;

    return res.status(200).json({
      success: true,
      message:
        "App usage tracking resumed",
      tracking: true,
    });

  } catch (error) {

    console.error(
      "Resume app usage error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to resume app usage",
    });

  }
};


// =====================================================
// End
// =====================================================

export const endAppUsage = async (
  req: Request,
  res: Response
) => {

  try {

    appTracking = false;

    if (currentSessionId) {

      await closeCurrentAppUsage(
        currentSessionId,
        new Date().toISOString()
      );

    }

    currentSessionId = null;

    return res.status(200).json({
      success: true,
      message:
        "App usage tracking ended",
      tracking: false,
    });

  } catch (error) {

    console.error(
      "End app usage error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to end app usage",
    });

  }
};
