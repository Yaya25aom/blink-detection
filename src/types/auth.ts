export interface LoginResponse {
  success: boolean;
  message: string;

  data?: {
    requiresOtp: boolean;
    user_id: number;
  };
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;

  data?: {
    accessToken: string;
    refreshToken: string;

    user: {
      user_id: number;
      email: string;
      user_name: string;
      role_user: string;
    };
  };
}