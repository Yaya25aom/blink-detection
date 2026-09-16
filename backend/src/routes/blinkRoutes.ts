import { Router } from "express";

import {
  createBlink,
} from "../controllers/blinkController.js";

const router = Router();

router.post(
  "/blink",
  createBlink
);

export default router;