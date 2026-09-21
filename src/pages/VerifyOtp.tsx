import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./VerifyOtp.css";
import { publicApiFetch } from "../services/apiClient";
import { saveTokens } from "../utils/token";

interface LocationState {
  user_id: number;
  email: string;
}

function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LocationState | null;

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerifyOtp = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (!state?.user_id) {
        throw new Error("User information not found");
      }

      const response = await publicApiFetch(
        "/auth/verify-otp",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            user_id: state.user_id,
            otp: otp,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "OTP verification failed"
        );
      }

      console.log("OTP verification:", result);

      /*
       * Backend ควรตอบประมาณ:
       *
       * {
       *   success: true,
       *   message: "OTP verified successfully",
       *   data: {
       *      accessToken: "...",
       *      refreshToken: "..."
       *   }
       * }
       */

      const accessToken =
        result.data?.accessToken;

      const refreshToken =
        result.data?.refreshToken;

      if (!accessToken || !refreshToken) {
        throw new Error(
          "Token was not returned from server"
        );
      }

      saveTokens(accessToken, refreshToken);

      // ไปหน้า Dashboard
      navigate("/");

    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  // ถ้าเข้าหน้า /verify-otp โดยไม่ได้ Login มาก่อน
  if (!state?.user_id || !state?.email) {
    return (
      <div className="otp-page">
        <div className="otp-card">

          <h1>Invalid Request</h1>

          <p>
            Please login first.
          </p>

          <button
            onClick={() => navigate("/login")}
          >
            Back to Login
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="otp-page">
      <div className="otp-card">

        <h1>Verify OTP</h1>

        <p className="otp-subtitle">
          We sent a verification code to
        </p>

        <p className="email">
          {state.email}
        </p>

        <form onSubmit={handleVerifyOtp}>

          <div className="form-group">

            <label>OTP</label>

            <input
              type="text"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value)
              }
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              inputMode="numeric"
              required
            />

          </div>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              otp.length !== 6
            }
          >
            {loading
              ? "Verifying..."
              : "Verify OTP"}
          </button>

        </form>

        <button
          className="back-button"
          onClick={() => navigate("/login")}
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}

export default VerifyOtp;
