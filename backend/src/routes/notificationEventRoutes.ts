import { Router } from "express";
import { listNotificationEvents, postNotificationEvent } from "../controllers/notificationEventController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = Router();
router.get("/", authenticateToken, listNotificationEvents);
router.post("/", authenticateToken, postNotificationEvent);
export default router;
