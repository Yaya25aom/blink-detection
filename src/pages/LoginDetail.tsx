import "./LoginDetail.css";

import { useNavigate } from "react-router-dom";

import { RiCloseLine } from "react-icons/ri";
import { FcGoogle } from "react-icons/fc";
import { FaEye } from "react-icons/fa";

export default function Login() {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate("/");
  };

  const handleSignIn = () => {
    navigate("/auth");
  };

  const handleGoogleLogin = () => {
    console.log("Google Login");
  };

  const handleRegister = () => {
    navigate("/register");
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
        >
          <FcGoogle size={24} />

          <span>
            Continue with Google
          </span>

        </button>

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