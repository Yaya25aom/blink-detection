import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LuArrowLeft, LuEye, LuEyeOff, LuShieldCheck, LuUserPlus } from "react-icons/lu";
import { publicApiFetch } from "../services/apiClient";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? "/";
  const [form, setForm] = useState({ user_name: "", email: "", password: "", confirm_password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (form.password !== form.confirm_password) return setError("รหัสผ่านยืนยันไม่ตรงกัน");
    setLoading(true);
    try {
      const response = await publicApiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถสร้างบัญชีได้");
      navigate("/login", { replace: true, state: { returnTo, registered: true } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ไม่สามารถสร้างบัญชีได้");
    } finally {
      setLoading(false);
    }
  };

  return <main className="register-page">
    <section className="register-card">
      <button className="register-back" onClick={() => navigate("/auth", { replace: true, state: { returnTo } })} title="ย้อนกลับ"><LuArrowLeft /></button>
      <div className="register-brand"><span><LuShieldCheck /></span>BlinkCare</div>
      <div className="register-title"><span><LuUserPlus /></span><div><h1>สร้างบัญชีใหม่</h1><p>เริ่มติดตามและดูแลสุขภาพดวงตาของคุณ</p></div></div>
      <form onSubmit={submit}>
        <label><span>ชื่อผู้ใช้</span><input value={form.user_name} onChange={(event) => update("user_name", event.target.value)} minLength={2} maxLength={100} autoComplete="name" placeholder="ชื่อที่ต้องการให้แสดง" required /></label>
        <label><span>อีเมล</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" placeholder="name@example.com" required /></label>
        <div className="register-password-grid">
          <label><span>รหัสผ่าน</span><div><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} minLength={8} autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" required /><button type="button" onClick={() => setShowPassword((value) => !value)} title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{showPassword ? <LuEyeOff /> : <LuEye />}</button></div></label>
          <label><span>ยืนยันรหัสผ่าน</span><div><input type={showPassword ? "text" : "password"} value={form.confirm_password} onChange={(event) => update("confirm_password", event.target.value)} minLength={8} autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" required /></div></label>
        </div>
        {error && <div className="register-error">{error}</div>}
        <button className="register-submit" disabled={loading}>{loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชี"}</button>
      </form>
      <p className="register-signin">มีบัญชีอยู่แล้ว? <button onClick={() => navigate("/login", { replace: true, state: { returnTo } })}>เข้าสู่ระบบ</button></p>
      <small className="register-privacy"><LuShieldCheck /> รหัสผ่านจะถูกเข้ารหัสก่อนบันทึก และ BlinkCare ไม่จัดเก็บภาพจากกล้อง</small>
    </section>
  </main>;
}
