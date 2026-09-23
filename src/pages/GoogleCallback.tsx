import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveTokens } from "../utils/token";
import "./Register.css";

export default function GoogleCallback() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("accessToken");
  const refreshToken = params.get("refreshToken");
  const error = !accessToken || !refreshToken ? "ไม่สามารถเข้าสู่ระบบด้วย Google ได้" : "";

  useEffect(() => {
    window.history.replaceState(null, "", "/auth/google/callback");

    if (!accessToken || !refreshToken) return;
    saveTokens(accessToken, refreshToken);
    navigate("/", { replace: true });
  }, [accessToken, navigate, refreshToken]);

  return <main className="register-page"><section className="register-card google-callback"><div className="register-brand">BlinkCare</div><h1>{error ? "เข้าสู่ระบบไม่สำเร็จ" : "กำลังเชื่อมต่อ Google"}</h1><p>{error || "กรุณารอสักครู่ ระบบกำลังเตรียมบัญชีของคุณ"}</p>{error && <button onClick={() => navigate("/auth", { replace: true })}>กลับไปหน้าเข้าสู่ระบบ</button>}</section></main>;
}
