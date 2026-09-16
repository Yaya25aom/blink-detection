import {
  findUserByEmail,
  createUser as createUserRepository,
  updateUser as updateUserRepository,
  softDeleteUser as softDeleteUserRepository
} from "./user.repository.js";

//GET
export async function getUserByEmail(email: string) {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  return user;
}

//POST
export async function createUser(
  username: string,
  email: string
) {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  return await createUserRepository(username, email);
}

//PUT
export async function updateUser(
  user_id: number,
  user_name: string,
  email: string
) {
  const existingUser = await updateUserRepository(
    user_id, 
    user_name, 
    email);

    if (!existingUser) {
        throw new Error("USER_NOT_FOUND");
  }

  return await existingUser;
}

export async function softDeleteUser(user_id: number) {
  const user = await softDeleteUserRepository(user_id);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return user;
}