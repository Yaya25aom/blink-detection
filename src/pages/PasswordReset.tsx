import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { publicApiFetch } from "../services/apiClient";
import "./Login.css";

export default function PasswordReset() {
  const reset = useLocation().pathname === "/reset-password";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reset && password !== confirm) { setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await publicApiFetch(reset ? "/auth/reset-password" : "/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(reset ? { email, code, password } : { email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "ดำเนินการไม่สำเร็จ");
      setMessage(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  return <main className="login-page"><section className="login-card">
    <h1>{reset ? "ตั้งรหัสผ่านใหม่" : "ลืมรหัสผ่าน"}</h1>
    <p className="login-subtitle">{reset ? "กรอกอีเมล รหัส 6 หลักจากเมล และรหัสผ่านใหม่" : "กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัสตั้งรหัสผ่านใหม่ให้"}</p>
    {!message && <form onSubmit={submit}>
      {reset ? <>
        <div className="form-group"><label htmlFor="reset-account-email">อีเมล</label><input id="reset-account-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="form-group"><label htmlFor="reset-code">รหัสยืนยัน 6 หลัก</label><input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
        <div className="form-group"><label htmlFor="new-password">รหัสผ่านใหม่</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="form-group"><label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div>
      </> : <div className="form-group"><label htmlFor="reset-email">อีเมล</label><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <button type="submit" disabled={loading}>{loading ? "กำลังดำเนินการ..." : reset ? "บันทึกรหัสผ่านใหม่" : "ส่งลิงก์ทางอีเมล"}</button>
    </form>}
    {message && <p className="reset-message" role="status">{message}</p>}
    <Link className="reset-back" to="/login">กลับไปเข้าสู่ระบบ</Link>
  </section></main>;
}
