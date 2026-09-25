import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuApple,
  LuCheck,
  LuChrome,
  LuCircleAlert,
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuLaptop,
  LuRefreshCw,
  LuShieldCheck,
} from "react-icons/lu";
import { useLocation } from "react-router-dom";
import {
  emptyDeviceStatus,
  requestDeviceStatus,
  type DeviceStatus,
} from "../services/deviceStatus";
import "./Downloads.css";

const WINDOWS_URL = import.meta.env.VITE_HELPER_WINDOWS_URL as string | undefined;
const MACOS_URL = (import.meta.env.VITE_HELPER_MACOS_URL as string | undefined)
  ?? "/downloads/blink-helper-macos-arm64.dmg";
const EXTENSION_URL = "/downloads/blinkcare-extension-dev.zip";

export default function Downloads() {
  const location = useLocation();
  const [status, setStatus] = useState<DeviceStatus>(emptyDeviceStatus);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);
  const missing = useMemo(() => new URLSearchParams(location.search).get("missing")?.split(",") ?? [], [location.search]);
  const platform = /Mac|iPhone|iPad/i.test(navigator.userAgent) ? "macOS" : /Windows/i.test(navigator.userAgent) ? "Windows" : "Other";

  const refresh = useCallback(async () => {
    setChecking(true);
    setStatus(await requestDeviceStatus());
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyExtensionsUrl = async () => {
    await navigator.clipboard.writeText("chrome://extensions");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <section className="downloads-page">
      <header className="downloads-heading">
        <div><span>BLINKCARE SETUP</span><h1>ดาวน์โหลดและติดตั้ง</h1><p>ติดตั้ง Blink Helper และ Chrome Extension ให้ครบก่อนเริ่มตรวจจับ</p></div>
        <button onClick={() => void refresh()} disabled={checking}><LuRefreshCw className={checking ? "spin" : ""} /> ตรวจสอบอีกครั้ง</button>
      </header>

      {missing.length > 0 && (
        <div className="install-warning" role="alert"><LuCircleAlert /><div><strong>ยังเริ่มตรวจจับไม่ได้</strong><p>ระบบยังไม่พบ {missing.includes("extension") ? "Chrome Extension" : ""}{missing.length > 1 ? " และ " : ""}{missing.includes("helper") ? "Blink Helper" : ""} กรุณาติดตั้งและเปิดใช้งานก่อน</p></div></div>
      )}

      <div className="setup-status">
        <div className={status.installed && status.connected ? "ready" : "missing"}><LuChrome /><span><strong>Chrome Extension</strong><small>{status.installed && status.connected ? `เชื่อมต่อแล้ว${status.version ? ` · v${status.version}` : ""}` : "ยังไม่พบ Extension"}</small></span><i>{status.installed && status.connected ? <LuCheck /> : "1"}</i></div>
        <div className={status.helperConnected ? "ready" : "missing"}><LuLaptop /><span><strong>Blink Helper</strong><small>{status.helperConnected ? "เปิดใช้งานและเชื่อมต่อแล้ว" : "ยังไม่พบแอปในเครื่อง"}</small></span><i>{status.helperConnected ? <LuCheck /> : "2"}</i></div>
      </div>

      <section className="download-section">
        <div className="download-section-title"><span><LuLaptop /></span><div><small>ขั้นตอนที่ 1</small><h2>ติดตั้ง Blink Helper</h2><p>ใช้ตรวจสอบแอปที่กำลังใช้งาน โดยไม่บันทึกภาพจากกล้อง</p></div></div>
        <div className="platform-list">
          <article className={platform === "Windows" ? "recommended" : ""}><LuLaptop /><div><h3>Windows</h3><p>สำหรับ Windows 10 และ Windows 11</p>{platform === "Windows" && <small>แนะนำสำหรับเครื่องนี้</small>}</div>{WINDOWS_URL ? <a href={WINDOWS_URL}><LuDownload /> ดาวน์โหลด</a> : <button disabled>รอไฟล์ติดตั้ง</button>}</article>
          <article className={platform === "macOS" ? "recommended" : ""}><LuApple /><div><h3>macOS</h3><p>สำหรับ Mac รุ่น Apple Silicon</p>{platform === "macOS" && <small>แนะนำสำหรับเครื่องนี้</small>}</div>{MACOS_URL ? <a href={MACOS_URL}><LuDownload /> ดาวน์โหลด</a> : <button disabled>รอไฟล์ติดตั้ง</button>}</article>
        </div>
        <p className="mobile-note"><LuCircleAlert /> Blink Helper ไม่รองรับ iPhone/iPad เนื่องจาก iOS ไม่อนุญาตให้เว็บติดตามแอปอื่นที่กำลังใช้งาน</p>
      </section>

      <section className="download-section extension-install">
        <div className="download-section-title"><span><LuChrome /></span><div><small>ขั้นตอนที่ 2</small><h2>ติดตั้ง Chrome Extension แบบ Developer Mode</h2><p>Extension ทำหน้าที่ตรวจจับการกะพริบตาและส่งสถานะสดมายังเว็บไซต์</p></div><a className="primary-download" href={EXTENSION_URL} download><LuDownload /> ดาวน์โหลด Extension</a></div>
        <ol className="install-steps">
          <li><b>1</b><div><strong>ดาวน์โหลดและแตกไฟล์ ZIP</strong><p>เก็บโฟลเดอร์ที่แตกไฟล์ไว้ในตำแหน่งถาวร และอย่าย้ายระหว่างใช้งาน</p></div></li>
          <li><b>2</b><div><strong>เปิดหน้าจัดการ Extension</strong><p>วาง <code>chrome://extensions</code> ในแถบที่อยู่ของ Chrome</p></div><button onClick={() => void copyExtensionsUrl()} title="คัดลอกที่อยู่"><LuCopy /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}</button></li>
          <li><b>3</b><div><strong>เปิด Developer mode</strong><p>เปิดสวิตช์ Developer mode ที่มุมขวาบน</p></div></li>
          <li><b>4</b><div><strong>เลือก Load unpacked</strong><p>เลือกโฟลเดอร์ที่แตกไฟล์ ซึ่งต้องเห็นไฟล์ <code>manifest.json</code> อยู่ภายใน</p></div></li>
          <li><b>5</b><div><strong>อนุญาต Site access</strong><p>ตั้งค่าให้ Extension เข้าถึง <code>blink-detection-two.vercel.app</code> แล้ว Refresh หน้าเว็บ</p></div></li>
        </ol>
      </section>

      <div className="setup-footer"><LuShieldCheck /><div><strong>ติดตั้งครบแล้ว</strong><p>เปิด Blink Helper ทิ้งไว้ จากนั้น Reload Extension และ Refresh เว็บไซต์ก่อนเริ่มตรวจจับ</p></div><a href="/devices">ดูสถานะอุปกรณ์ <LuExternalLink /></a></div>
    </section>
  );
}
