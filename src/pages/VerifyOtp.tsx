import { useEffect, useRef, useState } from "react";
import { LuArrowLeft, LuKeyRound, LuRefreshCw } from "react-icons/lu";
import { useLocation, useNavigate } from "react-router-dom";
import "./VerifyOtp.css";
import { publicApiFetch } from "../services/apiClient";
import { saveTokens } from "../utils/token";

interface LocationState {
  user_id: number;
  email: string;
  reference_code?: string;
  returnTo?: string;
}

const RESEND_SECONDS = 60;

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [referenceCode, setReferenceCode] = useState(state?.reference_code ?? "-");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const otp = digits.join("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const setDigit = (index: number, value: string) => {
    const number = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => current.map((digit, position) => position === index ? number : digit));
    setError("");
    if (number && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""));
    inputs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (!state?.user_id) throw new Error("ไม่พบข้อมูลผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่");
      const response = await publicApiFetch("/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: state.user_id, otp, reference_code: referenceCode === "-" ? undefined : referenceCode }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "รหัส OTP ไม่ถูกต้อง");
      if (!result.data?.accessToken || !result.data?.refreshToken) throw new Error("เซิร์ฟเวอร์ไม่ได้ส่ง Token กลับมา");
      saveTokens(result.data.accessToken, result.data.refreshToken);
      navigate(state.returnTo ?? "/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!state?.user_id || countdown > 0 || resending) return;
    setResending(true);
    setError("");
    setMessage("");
    try {
      const response = await publicApiFetch("/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: state.user_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถส่ง OTP ใหม่ได้");
      setReferenceCode(result.data?.reference_code ?? "-");
      setDigits(["", "", "", "", "", ""]);
      setCountdown(RESEND_SECONDS);
      setMessage("ส่งรหัส OTP ใหม่ไปยังอีเมลแล้ว");
      inputs.current[0]?.focus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถส่ง OTP ใหม่ได้");
    } finally {
      setResending(false);
    }
  };

  if (!state?.user_id || !state?.email) {
    return <div className="otp-page"><div className="otp-card"><h1>ไม่พบคำขอ</h1><p className="otp-subtitle">กรุณาเข้าสู่ระบบก่อนยืนยัน OTP</p><button className="otp-primary" onClick={() => navigate("/login", { replace: true })}>กลับไปเข้าสู่ระบบ</button></div></div>;
  }

  return (
    <div className="otp-page">
      <main className="otp-card">
        <div className="otp-icon"><LuKeyRound /></div>
        <h1>ยืนยันรหัส OTP</h1>
        <p className="otp-subtitle">กรอกรหัสยืนยัน 6 หลักที่ส่งไปยัง</p>
        <p className="email">{state.email}</p>
        <p className="otp-reference">Ref: <strong>{referenceCode}</strong></p>
        <form onSubmit={handleVerifyOtp}>
          <div className="otp-inputs" onPaste={handlePaste}>
            {digits.map((digit, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} aria-label={`OTP หลักที่ ${index + 1}`} autoComplete={index === 0 ? "one-time-code" : "off"} autoFocus={index === 0} inputMode="numeric" maxLength={1} value={digit} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => handleKeyDown(index, event)} />)}
          </div>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message">{message}</p>}
          <button className="otp-primary" type="submit" disabled={loading || otp.length !== 6}>{loading ? "กำลังตรวจสอบ..." : "ยืนยันรหัส OTP"}</button>
        </form>
        <div className="resend-row"><span>ยังไม่ได้รับรหัส?</span><button onClick={() => void resend()} disabled={countdown > 0 || resending}><LuRefreshCw className={resending ? "spin" : ""} />{resending ? "กำลังส่ง..." : countdown > 0 ? `ส่งใหม่ได้ใน ${countdown} วินาที` : "ส่ง OTP ใหม่"}</button></div>
        <button className="back-button" onClick={() => navigate("/login", { replace: true })}><LuArrowLeft /> กลับไปเข้าสู่ระบบ</button>
      </main>
    </div>
  );
}
