export function saveTokens(
  accessToken: string,
  refreshToken: string
) {
  localStorage.setItem(
    "accessToken",
    accessToken
  );

  localStorage.setItem(
    "refreshToken",
    refreshToken
  );
}

type AccessTokenPayload = {
  user_id?: string | number;
};

export function getCurrentUserId(): string | null {
  const token = localStorage.getItem("accessToken");
  if (!token) return null;

  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as AccessTokenPayload;
    return payload.user_id === undefined ? null : String(payload.user_id);
  } catch {
    return null;
  }
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}
