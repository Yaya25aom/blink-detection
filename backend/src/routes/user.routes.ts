import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getUserByEmailController,
  createUserController,
  updateUserController,
  deleteUserController
} from "../modules/users/user.controller.js";

const router = Router();
router.use(authenticateToken, requireAdmin);
//GET
router.get(
  "/users/email/:email",
  getUserByEmailController
);
//POST
router.post(
  "/users",
  createUserController
);
//PUT
router.put(
  "/users/:id",
  updateUserController
);
//DELETE
router.delete(
  "/users/:id",
  deleteUserController
);
export default router;
