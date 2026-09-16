import { Router } from "express";
import {
  getUserByEmailController,
  createUserController,
  updateUserController,
  deleteUserController
} from "../modules/users/user.controller.js";

const router = Router();
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