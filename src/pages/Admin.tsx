import { useEffect, useState } from "react";
import { apiFetch } from "../services/apiClient";
import "./Admin.css";

type User = {
  user_id: number;
  user_name: string;
  email: string;
  role_user: string;
  status_active: string;
  last_seen_at: string;
  inactive_3_months: boolean;
};
type Overview = {
  users: User[];
  stats: { tracked_users: number; sessions: number; total_blinks: string; duration_seconds: string; blink_rate: number };
};

const date = (value: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const number = (value: number) => new Intl.NumberFormat("th-TH").format(value);

export default function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try {
      const response = await apiFetch("/admin/overview");
      if (!response.ok) throw new Error(response.status === 403 ? "หน้านี้สำหรับผู้ดูแลระบบเท่านั้น" : "โหลดข้อมูลไม่สำเร็จ");
      setData(await response.json());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  };

  useEffect(() => { void load(); }, []);

  const manage = async (user: User, action: "suspend" | "activate" | "delete") => {
    const message = action === "delete"
      ? `ลบบัญชี ${user.user_name} จากรายการผู้ใช้? ข้อมูลสถิติเดิมยังถูกเก็บไว้ในระบบ`
      : `${action === "suspend" ? "ระงับ" : "เปิดใช้งาน"}บัญชี ${user.user_name}?`;
    if (!window.confirm(message)) return;
    setBusy(user.user_id);
    try {
      const response = await apiFetch(`/admin/users/${user.user_id}`, {
        method: "PATCH", body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error((await response.json()).message ?? "จัดการบัญชีไม่สำเร็จ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "จัดการบัญชีไม่สำเร็จ");
    } finally { setBusy(null); }
  };

  const users = data?.users.filter((user) =>
    (!onlyInactive || user.inactive_3_months) &&
    `${user.user_name} ${user.email}`.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];
  const inactiveCount = data?.users.filter((user) => user.inactive_3_months).length ?? 0;

  return <div className="admin-page">
    <div className="admin-heading"><div><p>ADMIN PANEL</p><h1>จัดการผู้ใช้</h1><span>ติดตามบัญชีที่ไม่ได้เข้าใช้งานและภาพรวมการกระพริบตา</span></div></div>
    {error && <div className="admin-error" role="alert">{error}</div>}
    {data && <>
      <div className="admin-stats">
        <div><span>ผู้ใช้ทั้งหมด</span><strong>{number(data.users.length)}</strong></div>
        <div><span>ไม่เข้าใช้งานเกิน 3 เดือน</span><strong>{number(inactiveCount)}</strong></div>
        <div><span>อัตรากระพริบตารวม</span><strong>{data.stats.blink_rate.toFixed(1)} <small>ครั้ง/นาที</small></strong></div>
        <div><span>กระพริบตาที่บันทึก</span><strong>{number(Number(data.stats.total_blinks))}</strong></div>
      </div>
      <p className="admin-note">อัตรารวมคำนวณจากจำนวนกระพริบตา ÷ เวลาตรวจจับรวม ({number(Number(data.stats.tracked_users))} ผู้ใช้, {number(Number(data.stats.sessions))} เซสชัน)</p>
      <section className="admin-panel">
        <div className="admin-toolbar"><div><h2>รายชื่อผู้ใช้</h2><p>บัญชีที่ไม่ได้เข้าสู่ระบบเกิน 3 เดือนจะแสดงคำเตือน</p></div><div className="admin-filters"><input aria-label="ค้นหาผู้ใช้" placeholder="ค้นหาชื่อหรืออีเมล" value={search} onChange={(event) => setSearch(event.target.value)} /><label><input type="checkbox" checked={onlyInactive} onChange={(event) => setOnlyInactive(event.target.checked)} /> เฉพาะเกิน 3 เดือน</label></div></div>
        <div className="admin-table-wrap"><table><thead><tr><th>ผู้ใช้</th><th>เข้าใช้ล่าสุด</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
          {users.map((user) => <tr key={user.user_id}><td><strong>{user.user_name}</strong><small>{user.email}</small></td><td>{date(user.last_seen_at)}{user.inactive_3_months && <span className="admin-warning">เกิน 3 เดือน</span>}</td><td><span className={user.status_active === "ACTIVE" ? "admin-badge active" : "admin-badge"}>{user.status_active === "ACTIVE" ? "ใช้งาน" : "ระงับ"}</span></td><td>{String(user.role_user).toUpperCase() === "ADMIN" ? <span>ผู้ดูแลระบบ</span> : <div className="admin-actions"><button disabled={busy === user.user_id} onClick={() => void manage(user, user.status_active === "ACTIVE" ? "suspend" : "activate")}>{user.status_active === "ACTIVE" ? "ระงับ" : "เปิดใช้"}</button><button className="danger" disabled={busy === user.user_id} onClick={() => void manage(user, "delete")}>ลบ</button></div>}</td></tr>)}
          {users.length === 0 && <tr><td colSpan={4} className="admin-empty">ไม่พบผู้ใช้</td></tr>}
        </tbody></table></div>
      </section>
    </>}
  </div>;
}
