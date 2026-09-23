import { Router } from "express";

import {
  createBlink,
} from "../controllers/blinkController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.post(
  "/blink",
  authenticateToken,
  createBlink
);

export default router;
