import { Router } from "express";

import {
  startDetection,
  endDetectionController
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

export default router;
