export async function login(
  email: string,
  password: string
) {

  const response = await fetch(
    "https://api.blinkcare.website/api/auth/login",
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

  const response = await fetch(
    "https://api.blinkcare.website/api/auth/verify-otp",
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