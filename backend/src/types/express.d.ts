import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface User extends JwtPayload {
      user_id: string | number;
      role_user: string;
      email?: string;
      user_name?: string;
    }
  }
}

export {};
