import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authenticateToken, getDashboard);

export default router;
