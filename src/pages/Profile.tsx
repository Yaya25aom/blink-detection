import { useEffect, useRef, useState } from "react";
import { LuCamera, LuCheck, LuKeyRound, LuMail, LuSave, LuShieldCheck, LuTrash2, LuUserRound } from "react-icons/lu";
import { apiFetch } from "../services/apiClient";
import "./Profile.css";

type ProfileData = {
  user_name: string;
  email: string;
  avatar: string | null;
  created_at: string;
  has_password: boolean;
};

const resizeAvatar = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) return reject(new Error("รองรับเฉพาะไฟล์ PNG, JPEG และ WebP"));
  if (file.size > 8_000_000) return reject(new Error("ไฟล์ต้นฉบับต้องมีขนาดไม่เกิน 8 MB"));
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const left = (image.naturalWidth - size) / 2;
    const top = (image.naturalHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    canvas.getContext("2d")?.drawImage(image, left, top, size, size, 0, 0, 512, 512);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL("image/jpeg", .86));
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้")); };
  image.src = url;
});

export default function Profile() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ user_name: "", email: "" });
  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordStep, setPasswordStep] = useState<"idle" | "verify">("idle");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [otp, setOtp] = useState("");
  const [passwords, setPasswords] = useState({ password: "", confirm: "" });

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetch("/auth/me");
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "ไม่สามารถโหลดโปรไฟล์ได้");
        setProfile(result.data);
        setForm({ user_name: result.data.user_name, email: result.data.email });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "ไม่สามารถโหลดโปรไฟล์ได้");
      } finally { setLoading(false); }
    })();
  }, []);

  const chooseAvatar = async (file?: File) => {
    if (!file) return;
    setError("");
    try { setAvatar(await resizeAvatar(file)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถอ่านรูปได้"); }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ ...form, ...(avatar !== undefined ? { avatar } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถบันทึกโปรไฟล์ได้");
      setProfile((current) => current ? { ...current, ...result.data } : current);
      setAvatar(undefined);
      setMessage("บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว");
      window.dispatchEvent(new Event("blinkcare:auth-updated"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกโปรไฟล์ได้"); }
    finally { setSaving(false); }
  };

  const requestPasswordOtp = async () => {
    setPasswordLoading(true); setError(""); setMessage("");
    try {
      const response = await apiFetch("/auth/me/password/request-otp", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถส่ง OTP ได้");
      setReferenceCode(result.data.reference_code);
      setPasswordStep("verify");
      setMessage("ส่ง OTP ไปยังอีเมลของคุณแล้ว");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถส่ง OTP ได้"); }
    finally { setPasswordLoading(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwords.password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (passwords.password !== passwords.confirm) return setError("รหัสผ่านยืนยันไม่ตรงกัน");
    setPasswordLoading(true); setError(""); setMessage("");
    try {
      const response = await apiFetch("/auth/me/password/change", { method: "POST", body: JSON.stringify({ otp, reference_code: referenceCode, new_password: passwords.password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
      setPasswordStep("idle"); setOtp(""); setPasswords({ password: "", confirm: "" });
      setMessage("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "ไม่สามารถเปลี่ยนรหัสผ่านได้"); }
    finally { setPasswordLoading(false); }
  };

  if (loading) return <section className="profile-page"><div className="profile-loading">กำลังโหลดโปรไฟล์...</div></section>;

  const shownAvatar = avatar !== undefined ? avatar : profile?.avatar;
  return <section className="profile-page">
    <header className="profile-heading"><span>ACCOUNT SETTINGS</span><h1>โปรไฟล์ของฉัน</h1><p>จัดการข้อมูลบัญชี รูปโปรไฟล์ และความปลอดภัย</p></header>
    <div className="profile-layout">
      <form className="profile-panel" onSubmit={saveProfile}>
        <div className="profile-panel-title"><span><LuUserRound /></span><div><h2>ข้อมูลส่วนตัว</h2><p>ข้อมูลนี้ใช้แสดงภายในระบบ BlinkCare</p></div></div>
        <div className="avatar-editor">
          <div className="profile-avatar-large">{shownAvatar ? <img src={shownAvatar} alt="รูปโปรไฟล์" /> : (form.user_name[0] || "U").toLocaleUpperCase("th-TH")}</div>
          <div><strong>รูปโปรไฟล์</strong><p>ระบบจะครอปเป็นสี่เหลี่ยมและย่อรูปให้อัตโนมัติ</p><div className="avatar-actions"><button type="button" onClick={() => fileInput.current?.click()}><LuCamera /> เลือกรูป</button>{shownAvatar && <button type="button" className="remove-avatar" onClick={() => setAvatar(null)}><LuTrash2 /> ลบรูป</button>}</div><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void chooseAvatar(event.target.files?.[0])} /></div>
        </div>
        <div className="profile-fields">
          <label><span>ชื่อผู้ใช้</span><div><LuUserRound /><input value={form.user_name} minLength={2} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, user_name: event.target.value }))} required /></div></label>
          <label><span>อีเมล</span><div><LuMail /><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></div></label>
        </div>
        <div className="profile-meta"><LuShieldCheck /><span>สมาชิกตั้งแต่ {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-"}</span></div>
        {error && <div className="profile-message error">{error}</div>}{message && <div className="profile-message success"><LuCheck /> {message}</div>}
        <button className="profile-save" disabled={saving}><LuSave /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
      </form>

      <section className="profile-panel password-panel">
        <div className="profile-panel-title"><span><LuKeyRound /></span><div><h2>เปลี่ยนรหัสผ่าน</h2><p>ต้องยืนยันตัวตนด้วย OTP ก่อนทุกครั้ง</p></div></div>
        {!profile?.has_password ? <div className="password-note">บัญชีนี้เข้าสู่ระบบด้วย Google และยังไม่มีรหัสผ่านแบบ Local</div> : passwordStep === "idle" ? <div className="password-start"><LuShieldCheck /><p>เราจะส่งรหัส OTP พร้อม Ref ไปยัง <strong>{profile.email}</strong></p><button onClick={() => void requestPasswordOtp()} disabled={passwordLoading}>{passwordLoading ? "กำลังส่ง..." : "ส่ง OTP เพื่อเปลี่ยนรหัสผ่าน"}</button></div> : <form onSubmit={changePassword} className="password-form"><div className="password-ref">Ref: <strong>{referenceCode}</strong></div><label><span>รหัส OTP 6 หลัก</span><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="000000" required /></label><label><span>รหัสผ่านใหม่</span><input type="password" minLength={8} value={passwords.password} onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))} required /></label><label><span>ยืนยันรหัสผ่านใหม่</span><input type="password" minLength={8} value={passwords.confirm} onChange={(event) => setPasswords((current) => ({ ...current, confirm: event.target.value }))} required /></label><div className="password-buttons"><button type="button" onClick={() => setPasswordStep("idle")}>ยกเลิก</button><button disabled={passwordLoading || otp.length !== 6}>{passwordLoading ? "กำลังเปลี่ยน..." : "ยืนยันและเปลี่ยนรหัสผ่าน"}</button></div></form>}
      </section>
    </div>
  </section>;
}
