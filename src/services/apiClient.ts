export const API_URL = import.meta.env.VITE_API_URL ??
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "https://api.blinkcare.website/api");

export const publicApiFetch = (endpoint: string, options: RequestInit = {}) =>
  fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
) => {
  let accessToken = localStorage.getItem("accessToken");

  let response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // Access Token หมดอายุ
  if (response.status === 401) {

    const refreshToken =
      localStorage.getItem("refreshToken");

    if (!refreshToken) {
      return response;
    }

    // ขอ Access Token ใหม่
    const refreshResponse = await fetch(
      `${API_URL}/auth/refresh`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      }
    );

    if (!refreshResponse.ok) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      window.location.href = "/";

      return response;
    }

    const data = await refreshResponse.json();

    // เก็บ Access Token ใหม่
    localStorage.setItem(
      "accessToken",
      data.accessToken
    );

    accessToken = data.accessToken;

    // ยิง API เดิมอีกครั้ง
    response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  }

  return response;
};
