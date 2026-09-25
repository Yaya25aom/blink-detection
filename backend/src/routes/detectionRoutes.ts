import { Router } from "express";

import {
  startDetection,
  endDetectionController,
  getActiveDetectionController,
  updateDetectionLiveController,
} from "../controllers/detectionController.js";

import {
  authenticateToken,
} from "../middleware/authMiddleware.js";


const router = Router();

router.post(
  "/start",
  authenticateToken,
  startDetection
);
router.post("/end", authenticateToken, endDetectionController);
router.get("/active", authenticateToken, getActiveDetectionController);
router.patch("/live", authenticateToken, updateDetectionLiveController);

export default router;
