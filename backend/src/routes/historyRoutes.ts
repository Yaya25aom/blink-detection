import { Router } from "express";
import { getHistoryController } from "../controllers/historyController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();
router.get("/", authenticateToken, getHistoryController);
export default router;
