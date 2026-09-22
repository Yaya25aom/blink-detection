import type { Request, Response } from "express";
import {
  createPlan,
  createReminderEvent,
  getActivePlan,
  getUserPlans,
  respondToReminderEvent,
  type PlanMeasureInput,
} from "../services/planService.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createPlanController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    const { goal_code, plan_name, start_date, end_date, measures } = req.body as {
      goal_code?: string;
      plan_name?: string;
      start_date?: string;
      end_date?: string;
      measures?: PlanMeasureInput[];
    };

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (
      !goal_code || !plan_name?.trim() || plan_name.trim().length > 100 ||
      !start_date || !end_date || !datePattern.test(start_date) || !datePattern.test(end_date) ||
      end_date < start_date || !Array.isArray(measures) || measures.length === 0
    ) {
      return res.status(400).json({ success: false, message: "Invalid plan data" });
    }

    const invalidMeasure = measures.some((measure) =>
      !measure.measure_code ||
      !["FLEXIBLE", "SCHEDULED"].includes(measure.reminder_mode) ||
      (measure.interval_minutes !== null && (!Number.isInteger(measure.interval_minutes) || measure.interval_minutes <= 0)) ||
      (measure.target_value !== null && (!Number.isFinite(measure.target_value) || measure.target_value <= 0)),
    );

    if (invalidMeasure) {
      return res.status(400).json({ success: false, message: "Invalid plan measure" });
    }

    const plan = await createPlan({
      user_id: userId,
      goal_code,
      plan_name: plan_name.trim(),
      start_date,
      end_date,
      measures,
    });

    return res.status(201).json({ success: true, message: "Plan saved successfully", data: plan });
  } catch (error) {
    console.error("Create plan error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to save plan",
    });
  }
};

export const createReminderEventController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    const planId = Number(req.body?.plan_id);
    const planMeasureId = Number(req.body?.plan_measure_id);
    if (![userId, planId, planMeasureId].every((value) => Number.isInteger(value) && value > 0)) {
      return res.status(400).json({ success: false, message: "Invalid reminder data" });
    }
    const event = await createReminderEvent(userId, planId, planMeasureId);
    if (!event) return res.status(404).json({ success: false, message: "Plan measure not found" });
    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error("Create reminder event error:", error);
    return res.status(500).json({ success: false, message: "Failed to record reminder" });
  }
};

export const respondToReminderEventController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    const reminderEventId = Number(req.params.reminderEventId);
    const status = req.body?.status as "COMPLETED" | "SKIPPED";
    if (!Number.isInteger(userId) || !Number.isInteger(reminderEventId) || !["COMPLETED", "SKIPPED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid reminder response" });
    }
    const event = await respondToReminderEvent(userId, reminderEventId, status);
    if (!event) return res.status(404).json({ success: false, message: "Pending reminder not found" });
    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    console.error("Respond reminder event error:", error);
    return res.status(500).json({ success: false, message: "Failed to update reminder" });
  }
};

export const getPlansController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const plans = await getUserPlans(userId);
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error("Get plans error:", error);
    return res.status(500).json({ success: false, message: "Failed to load plans" });
  }
};

export const getActivePlanController = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const plan = await getActivePlan(userId);
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error("Get active plan error:", error);
    return res.status(500).json({ success: false, message: "Failed to load active plan" });
  }
};
