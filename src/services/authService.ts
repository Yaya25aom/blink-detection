import { publicApiFetch } from "./apiClient";

export async function login(
  email: string,
  password: string
) {

  const response = await publicApiFetch(
    "/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    }
  );

  return response.json();
}

export async function verifyOtp(
  user_id: number,
  otp: string
) {

  const response = await publicApiFetch(
    "/auth/verify-otp",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id,
        otp
      })
    }
  );

  return response.json();
}
