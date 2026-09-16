import { Router } from "express";
import { loginController, logout, refresh, verifyOtpController } from "../controllers/authController.js";

const router = Router();

router.post("/refresh", refresh);
router.post("/login", loginController);
router.post("/logout", logout);
router.post(
  "/verify-otp",
  verifyOtpController
);

export default router;