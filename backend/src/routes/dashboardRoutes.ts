import { Router } from "express";
import { getDashboard, getMultiDayDashboardController } from "../controllers/dashboardController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/multi-day", authenticateToken, getMultiDayDashboardController);
router.get("/", authenticateToken, getDashboard);

export default router;
