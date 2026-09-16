import { pool } from "../../config/database.js";

//GET
export async function findUserByEmail(email: string) {
  const result = await pool.query(
    `
    SELECT
      user_id,
      user_name,
      email,
      created_at,
      updated_at,
      updated_by,
      role_user,
      delete_flag,
      status_active,
      email_verified
    FROM user_service.users
    WHERE email = $1
      AND delete_flag = 0
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

//POST
export async function createUser(
    user_name: string,
    email: string,
) {
    const result = await pool.query(
        `
        INSERT INTO user_service.users (
            user_name,
            email
        ) VALUES ($1, $2)
        RETURNING *
        `,
        [user_name, email]
    );
    return result.rows[0].user_id;
}

//PUT
export async function updateUser(
    user_id: number,
    user_name: string,
    email: string,
) {
    const result = await pool.query(
        `
        UPDATE user_service.users
        SET user_name = $1,
            email = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
            AND delete_flag = 0
        RETURNING *
        `,
        [user_name, email, user_id]
    );
    return result.rows[0] ?? null;
}

//DELETE
export async function softDeleteUser(user_id: number) {
  const result = await pool.query(
    `
    UPDATE user_service.users
    SET
      delete_flag = 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND delete_flag = 0
    RETURNING *
    `,
    [user_id]
  );

  return result.rows[0] ?? null;
}