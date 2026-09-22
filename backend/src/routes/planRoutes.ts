import { Router } from "express";
import {
  createPlanController,
  createReminderEventController,
  getActivePlanController,
  getPlansController,
  respondToReminderEventController,
} from "../controllers/planController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", authenticateToken, createPlanController);
router.get("/", authenticateToken, getPlansController);
router.get("/active", authenticateToken, getActivePlanController);
router.post("/reminders", authenticateToken, createReminderEventController);
router.patch("/reminders/:reminderEventId", authenticateToken, respondToReminderEventController);

export default router;
