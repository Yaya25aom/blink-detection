import "./LoginDetail.css";

import { useLocation, useNavigate } from "react-router-dom";

import { RiCloseLine } from "react-icons/ri";
import { FcGoogle } from "react-icons/fc";
import { FaEye } from "react-icons/fa";
import { API_URL } from "../services/apiClient";
import { useState } from "react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/";
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const handleClose = () => {
    navigate("/");
  };

  const handleSignIn = () => {
    navigate("/login", { replace: true, state: { returnTo } });
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setGoogleError("");
    try {
      const response = await fetch(`${API_URL}/auth/google/status`);
      const result = await response.json();
      if (!response.ok || !result.data?.configured) {
        throw new Error("ระบบเข้าสู่ระบบด้วย Google ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์");
      }
      sessionStorage.setItem("blinkcareAuthReturnTo", returnTo);
      window.location.assign(`${API_URL}/auth/google`);
    } catch (error) {
      setGoogleError(error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อ Google ได้");
      setGoogleLoading(false);
    }
  };

  const handleRegister = () => {
    navigate("/register", { state: { returnTo } });
  };

  return (
    <div className="login-page">

      {/* Header */}

      <header className="login-header">

        <h2>BlinkCare</h2>

        <button
          className="close-btn"
          onClick={handleClose}
        >
          <RiCloseLine size={26} />
        </button>

      </header>

      {/* Content */}

      <main className="login-body">

        <h1>
          Welcome to BlinkCare
        </h1>

        <p className="subtitle">
          Register or sign in 
        </p>

        <div className="eye-logo">
          <FaEye />
        </div>

        <p className="description">
          Monitor your blink rate in real time and
          receive healthy eye care reminders while
          using your computer.
        </p>

        {/* Sign in */}

        <button
          className="sign-btn"
          onClick={handleSignIn}
        >
          Sign in
        </button>

        {/* Divider */}

        <div className="divider">

          <div className="line"></div>

          <span>or</span>

          <div className="line"></div>

        </div>

        {/* Google */}

        <button
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
        >
          <FcGoogle size={24} />

          <span>
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </span>

        </button>

        {googleError && <p className="google-error" role="alert">{googleError}</p>}

        {/* Register */}

        <p className="register-text">

          Don't have an account?

          <button
            className="register-link"
            onClick={handleRegister}
          >
            Register
          </button>

        </p>

      </main>

    </div>
  );
}
