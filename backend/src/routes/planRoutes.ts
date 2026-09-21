import { Router } from "express";
import {
  createPlanController,
  getActivePlanController,
} from "../controllers/planController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", authenticateToken, createPlanController);
router.get("/active", authenticateToken, getActivePlanController);

export default router;
