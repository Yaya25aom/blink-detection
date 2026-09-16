import { Router } from "express";

import {
  setCurrentSession,
  getCurrentSession,
  createAppUsage,
  pauseAppUsage,
  resumeAppUsage,
  updateCurrentApp,
  endAppUsage,
  getCurrentAppUsage,
  getCurrentAppBlinks,
} from "../controllers/appUsageController.js";

const router = Router();

router.post("/", createAppUsage);
router.post("/app-usage", createAppUsage);

router.post(
  "/update",
  updateCurrentApp
);
router.post(
  "/app-usage/update",
  updateCurrentApp
);

router.post(
  "/session",
  setCurrentSession
);

router.get(
  "/session",
  getCurrentSession
);

router.get(
  "/current",
  getCurrentAppUsage
);

router.get(
  "/current/blinks",
  getCurrentAppBlinks
);

router.post(
  "/pause",
  pauseAppUsage
);

router.post(
  "/resume",
  resumeAppUsage
);

router.post(
  "/end",
  endAppUsage
);

export default router;
