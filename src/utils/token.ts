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

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}