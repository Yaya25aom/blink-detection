import type { Request, Response } from "express";
import { 
    getUserByEmail,
    createUser, 
    updateUser,
    softDeleteUser
} from "./user.service.js";
//GET
export async function getUserByEmailController(
  req: Request,
  res: Response
) {
  try {
    const { email } = req.params;

    if (!email || Array.isArray(email)) {
      return res.status(400).json({
        message: "Invalid email",
      });
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      data: user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

//POST
export async function createUserController(
  req: Request,
  res: Response
) {
  try {
    const { user_name, email } = req.body;

    if (!user_name || !email) {
      return res.status(400).json({
        message: "Username and email are required",
      });
    }

    const user = await createUser(user_name, email);

    return res.status(201).json({
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message === "EMAIL_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

//PUT
export async function updateUserController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;
    const { username, email } = req.body;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    if (!username || !email) {
      return res.status(400).json({
        message: "Username and email are required",
      });
    }

    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        message: "User ID must be a number",
      });
    }

    const user = await updateUser(
      userId,
      username,
      email
    );

    return res.status(200).json({
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}

//DELETE
export async function deleteUserController(
  req: Request,
  res: Response
) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const userId = Number(id);

    if (Number.isNaN(userId)) {
      return res.status(400).json({
        message: "User ID must be a number",
      });
    }

    await softDeleteUser(userId);

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error(error);

    if (
      error instanceof Error &&
      error.message === "USER_NOT_FOUND"
    ) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
}