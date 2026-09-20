import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("https://blank-wav-handbags-received.trycloudflare.com/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json();

      console.log("========== LOGIN DEBUG ==========");
      console.log("Status:", response.status);
      console.log("Request:", {
        email: email.trim(),
        password,
      });
      console.log("Response:", result);
      console.log("=================================");

      if (!response.ok) {
        throw new Error(result.message || "Login failed");
      }

      console.log("Login response:", result);

      /*
       * Backend ควรตอบประมาณ:
       *
       * {
       *   success: true,
       *   message: "OTP sent",
       *   data: {
       *      requiresOtp: true,
       *      userId: 1
       *   }
       * }
       */

      if (result.data?.requiresOtp) {
        navigate("/verify-otp", {
          state: {
            user_id: result.data.user_id,
            email: email,
          },
        });
      }
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

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Login</h1>

        <p className="login-subtitle">Sign in to your account</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
