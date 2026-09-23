import { Router } from "express";
import { googleCallbackController, loginController, logout, refresh, registerController, verifyOtpController } from "../controllers/authController.js";
import passport, { googleAuthConfigured } from "../config/passport.js";

const router = Router();

router.post("/refresh", refresh);
router.post("/login", loginController);
router.post("/register", registerController);
router.post("/logout", logout);
router.post(
  "/verify-otp",
  verifyOtpController
);

router.get("/google", (req, res, next) => {
  if (!googleAuthConfigured) {
    return res.status(503).json({ success: false, message: "Google Login is not configured" });
  }
  return passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => passport.authenticate("google", { session: false, failureRedirect: "/api/auth/google/failed" })(req, res, next),
  googleCallbackController,
);

router.get("/google/failed", (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL ?? "https://blink-detection-two.vercel.app";
  res.redirect(`${frontendUrl}/auth?google_error=1`);
});

export default router;
