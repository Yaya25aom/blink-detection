import { useEffect, useState } from "react";
import {
  LuBell,
  LuBellOff,
  LuCheck,
  LuEye,
  LuLightbulb,
  LuScanFace,
  LuSparkles,
} from "react-icons/lu";
import { requestNotificationPermission } from "../services/planNotification";
import {
  readNotificationHistory,
  readNotificationSettings,
  saveNotificationSettings,
  syncNotificationHistory,
  type NotificationHistoryItem,
  type NotificationSettings as Settings,
} from "../services/notificationSettings";
import "./NotificationSettings.css";

type SettingKey = keyof Settings;

const settingRows: Array<{
  key: SettingKey;
  title: string;
  description: string;
  detail?: string;
  tone: string;
  icon: typeof LuEye;
}> = [
  {
    key: "lowBlinkRate",
    title: "แจ้งเตือนเมื่อ Blink Rate ต่ำ",
    description: "แจ้งเมื่ออัตราการกะพริบตาต่ำกว่าค่ามาตรฐานต่อเนื่องระหว่างตรวจจับ",
    detail: "มาตรฐาน 12 ครั้ง/นาที",
    tone: "green",
    icon: LuEye,
  },
  {
    key: "faceMissing",
    title: "แจ้งเตือนเมื่อไม่พบใบหน้า",
    description: "แจ้งเมื่อไม่พบใบหน้าต่อเนื่อง 30 วินาที และระบบหยุดนับเวลาใช้งาน",
    tone: "blue",
    icon: LuScanFace,
  },
  {
    key: "poorLighting",
    title: "แจ้งเตือนเมื่อแสงไม่เหมาะสม",
    description: "แจ้งเมื่อภาพมืดมากจนระบบมองเห็นใบหน้าและดวงตาไม่ชัด",
    tone: "orange",
    icon: LuLightbulb,
  },
  {
    key: "planCompleted",
    title: "แจ้งเตือนเมื่อทำตามแผนสำเร็จ",
    description: "แจ้งยืนยันเมื่อบันทึกว่าทำตามมาตรการในแผนเรียบร้อยแล้ว",
    tone: "violet",
    icon: LuSparkles,
  },
  {
    key: "muted",
    title: "ปิดเสียงการแจ้งเตือน",
    description: "ปิดเฉพาะเสียง การแจ้งเตือนบนหน้าจอและระบบยังทำงานตามปกติ",
    tone: "gray",
    icon: LuBellOff,
  },
];

const historyIcon = (item: NotificationHistoryItem) => {
  if (item.category === "LOW_BLINK") return LuEye;
  if (item.category === "FACE_MISSING") return LuScanFace;
  if (item.category === "POOR_LIGHTING") return LuLightbulb;
  return LuSparkles;
};

export default function NotificationSettings() {
  const [settings, setSettings] = useState(readNotificationSettings);
  const [history, setHistory] = useState(readNotificationHistory);
  const [saved, setSaved] = useState(false);
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    const refresh = () => setHistory(readNotificationHistory());
    const refreshRemote = () => void syncNotificationHistory().then(setHistory).catch(refresh);
    window.addEventListener("blinkcare:notification-history-updated", refresh);
    window.addEventListener("focus", refreshRemote);
    const refreshTimer = window.setInterval(refreshRemote, 15_000);
    refreshRemote();
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("blinkcare:notification-history-updated", refresh);
      window.removeEventListener("focus", refreshRemote);
    };
  }, []);

  const toggle = (key: SettingKey) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  const save = async () => {
    saveNotificationSettings(settings);
    if (permission !== "granted") {
      setPermission(await requestNotificationPermission());
    }
    setSaved(true);
  };

  return (
    <section className="notification-page">
      <header className="notification-heading">
        <div>
          <span>NOTIFICATION SETTINGS</span>
          <h1>การตั้งค่าการแจ้งเตือน</h1>
          <p>เลือกเหตุการณ์ที่ต้องการให้ BlinkCare แจ้งระหว่างตรวจจับและทำตามแผน</p>
        </div>
        <div className={`permission-status ${permission === "granted" ? "ready" : "waiting"}`}>
          <LuBell />
          <div><small>สิทธิ์แจ้งเตือนของอุปกรณ์</small><strong>{permission === "granted" ? "พร้อมใช้งาน" : "รออนุญาต"}</strong></div>
        </div>
      </header>

      <div className="notification-layout">
        <div className="notification-panel">
          <div className="notification-panel-title">
            <div><h2>ตั้งค่าการแจ้งเตือน</h2><p>การตั้งค่านี้มีผลกับอุปกรณ์และเบราว์เซอร์เครื่องนี้</p></div>
          </div>

          <div className="notification-setting-list">
            {settingRows.map((row) => {
              const Icon = row.icon;
              return (
                <div className="notification-setting-row" key={row.key}>
                  <span className={`notification-setting-icon ${row.tone}`}><Icon /></span>
                  <div className="notification-setting-copy">
                    <strong>{row.title}</strong>
                    <p>{row.description}</p>
                  </div>
                  {row.detail && <span className="notification-standard">{row.detail}</span>}
                  <button
                    type="button"
                    className={`notification-switch ${settings[row.key] ? "on" : ""}`}
                    onClick={() => toggle(row.key)}
                    role="switch"
                    aria-checked={settings[row.key]}
                    aria-label={row.title}
                  ><span /></button>
                </div>
              );
            })}
          </div>

          <button className="notification-save" type="button" onClick={() => void save()}>
            <LuCheck /> บันทึกการตั้งค่า
          </button>
          {saved && <p className="notification-saved"><LuCheck /> บันทึกการตั้งค่าเรียบร้อยแล้ว</p>}
        </div>

        <aside className="notification-side">
          <section className="notification-preview">
            <h2>ตัวอย่างการแจ้งเตือน</h2>
            <div className="preview-notice green"><LuEye /><div><strong>Blink Rate ต่ำ</strong><p>ขณะนี้ 8 ครั้ง/นาที ควรกะพริบอย่างน้อย 12 ครั้ง/นาที</p></div><small>ตอนนี้</small></div>
            <div className="preview-notice blue"><LuScanFace /><div><strong>ไม่พบใบหน้า</strong><p>ระบบหยุดนับเวลาใช้งานชั่วคราว</p></div><small>10:30 น.</small></div>
            <div className="preview-notice orange"><LuLightbulb /><div><strong>แสงไม่เพียงพอ</strong><p>กรุณาเพิ่มแสงเพื่อให้ตรวจจับได้ชัดเจน</p></div><small>14:20 น.</small></div>
            <div className="preview-notice violet"><LuSparkles /><div><strong>ทำตามแผนสำเร็จ</strong><p>บันทึกการทำตามมาตรการเรียบร้อยแล้ว</p></div><small>18:30 น.</small></div>
          </section>

          <section className="notification-history">
            <div className="history-heading"><h2>การแจ้งเตือนล่าสุด</h2><span>{history.length} รายการ</span></div>
            {history.slice(0, 5).map((item) => {
              const Icon = historyIcon(item);
              return <div className="history-notice" key={item.id}><Icon /><div><strong>{item.title}</strong><p>{new Date(item.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div></div>;
            })}
            {history.length === 0 && <div className="history-empty"><LuBell /><p>ยังไม่มีประวัติการแจ้งเตือน</p></div>}
          </section>
        </aside>
      </div>
    </section>
  );
}
