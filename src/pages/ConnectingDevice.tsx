import { useCallback, useEffect, useState } from "react";
import {
  LuCamera,
  LuCheck,
  LuChevronRight,
  LuCircleHelp,
  LuCircleX,
  LuCpu,
  LuLaptop,
  LuLightbulb,
  LuMonitorCheck,
  LuPuzzle,
  LuRefreshCw,
  LuShieldCheck,
  LuWifi,
} from "react-icons/lu";
import { API_URL } from "../services/apiClient";
import "./ConnectingDevice.css";

type ExtensionStatus = {
  installed: boolean;
  connected: boolean;
  helperConnected: boolean;
  monitoring: boolean;
  activeApp: string | null;
  version: string | null;
};

const emptyExtensionStatus: ExtensionStatus = {
  installed: false,
  connected: false,
  helperConnected: false,
  monitoring: false,
  activeApp: null,
  version: null,
};

const waitForExtensionStatus = () => new Promise<ExtensionStatus>((resolve) => {
  const timeout = window.setTimeout(() => {
    window.removeEventListener("blinkcare:device-status-response", receive as EventListener);
    resolve(emptyExtensionStatus);
  }, 800);

  const receive = (event: CustomEvent) => {
    window.clearTimeout(timeout);
    window.removeEventListener("blinkcare:device-status-response", receive as EventListener);
    const detail = event.detail ?? {};
    resolve({
      installed: detail.installed === true,
      connected: detail.connected === true,
      helperConnected: detail.helperConnected === true,
      monitoring: detail.monitoring === true,
      activeApp: typeof detail.activeApp === "string" ? detail.activeApp : null,
      version: typeof detail.version === "string" ? detail.version : null,
    });
  };

  window.addEventListener("blinkcare:device-status-response", receive as EventListener);
  window.dispatchEvent(new Event("blinkcare:device-status-request"));
});

export default function ConnectingDevice() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(localStorage.getItem("blinkcareCameraId") ?? "");
  const [cameraPermission, setCameraPermission] = useState<PermissionState | "unknown">("unknown");
  const [extension, setExtension] = useState<ExtensionStatus>(emptyExtensionStatus);
  const [apiConnected, setApiConnected] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    const [devices, extensionStatus, apiStatus] = await Promise.all([
      navigator.mediaDevices?.enumerateDevices().catch(() => []) ?? Promise.resolve([]),
      waitForExtensionStatus(),
      fetch(`${new URL(API_URL).origin}/health`).then((response) => response.ok).catch(() => false),
    ]);
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    setCameras(videoDevices);
    setSelectedCamera((current) => current || videoDevices[0]?.deviceId || "");
    setExtension(extensionStatus);
    setApiConnected(apiStatus);
    try {
      const permission = await navigator.permissions.query({ name: "camera" as PermissionName });
      setCameraPermission(permission.state);
    } catch {
      setCameraPermission("unknown");
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void refresh(), 0);
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => {
      window.clearTimeout(initialCheck);
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    };
  }, [refresh]);

  const chooseCamera = (deviceId: string) => {
    setSelectedCamera(deviceId);
    localStorage.setItem("blinkcareCameraId", deviceId);
  };

  const cameraReady = cameras.length > 0 && cameraPermission !== "denied";
  const healthyCount = [cameraReady, extension.connected, extension.helperConnected, apiConnected]
    .filter(Boolean).length;

  return (
    <section className="device-page">
      <header className="device-heading">
        <div><span>DEVICE CENTER</span><h1>อุปกรณ์ที่เชื่อมต่อ</h1><p>จัดการอุปกรณ์และตรวจสอบสถานะการทำงานของ BlinkCare</p></div>
        <a href="/support"><LuCircleHelp /> ช่วยเหลือ</a>
      </header>

      <div className="device-layout">
        <div className="device-main-column">
          <section className="device-panel camera-panel">
            <div className="device-panel-heading"><span><LuCamera /></span><div><h2>กล้อง</h2><p>เลือกกล้องสำหรับตรวจจับ โดยระบบจะไม่แสดงหรือบันทึกภาพบนหน้านี้</p></div></div>
            <div className="privacy-camera-state">
              <span><LuShieldCheck /></span>
              <div><strong>Camera privacy protected</strong><p>กล้องจะทำงานเมื่อคุณกดเริ่มตรวจจับเท่านั้น ภาพประมวลผลภายในอุปกรณ์และไม่ถูกอัปโหลด</p></div>
            </div>
            <div className="camera-list">
              {cameras.map((camera, index) => {
                const active = camera.deviceId === selectedCamera;
                return <button key={camera.deviceId || index} className={active ? "camera-row active" : "camera-row"} onClick={() => chooseCamera(camera.deviceId)}><span><LuCamera /></span><div><strong>{camera.label || `Camera ${index + 1}`}</strong><small>{active ? "กล้องที่เลือกใช้งาน" : "พร้อมให้เลือกใช้งาน"}</small></div>{active ? <LuCheck /> : <span className="select-camera">เลือก</span>}</button>;
              })}
              {cameras.length === 0 && <div className="device-empty"><LuCamera /><div><strong>ยังไม่พบกล้อง</strong><p>เชื่อมต่อกล้องและตรวจสอบสิทธิ์ Camera ในเบราว์เซอร์</p></div></div>}
            </div>
          </section>

          <section className="device-panel extension-panel">
            <div className="device-panel-heading"><span><LuPuzzle /></span><div><h2>Chrome Extension</h2><p>สถานะส่วนขยายที่ใช้ตรวจจับและส่งการแจ้งเตือนนอกหน้าเว็บ</p></div></div>
            <div className="extension-summary">
              <div className="chrome-mark"><LuPuzzle /></div>
              <div className="extension-copy"><div><strong>BlinkCare Monitor</strong><span className={extension.connected ? "connected" : "disconnected"}>{extension.connected ? "เชื่อมต่อแล้ว" : "ไม่พบ Extension"}</span></div><dl><div><dt>เวอร์ชัน</dt><dd>{extension.version ?? "-"}</dd></div><div><dt>สถานะ</dt><dd>{extension.connected ? "เชื่อมต่อกับเว็บไซต์แล้ว" : "ยังไม่เชื่อมต่อ"}</dd></div><div><dt>การตรวจจับ</dt><dd>{extension.monitoring ? "กำลังทำงาน" : "ยังไม่เริ่ม"}</dd></div></dl></div>
            </div>
          </section>

          <div className="device-tip"><LuLightbulb /><div><strong>เคล็ดลับ</strong><p>วางกล้องในระดับสายตาและให้ใบหน้าได้รับแสงเพียงพอ ระบบจะตรวจจับได้แม่นยำขึ้นโดยไม่จำเป็นต้องแสดงภาพตัวอย่าง</p></div></div>
        </div>

        <aside className="device-side-column">
          <section className="device-panel system-panel">
            <div className="device-panel-heading"><span><LuMonitorCheck /></span><div><h2>สถานะระบบ</h2><p>{healthyCount}/4 รายการพร้อมใช้งาน</p></div></div>
            <StatusRow icon={LuCamera} label="กล้อง" detail={cameraPermission === "denied" ? "ไม่ได้รับอนุญาต" : cameras.length ? `${cameras.length} อุปกรณ์` : "ไม่พบอุปกรณ์"} ok={cameraReady} />
            <StatusRow icon={LuPuzzle} label="Chrome Extension" detail={extension.version ? `เชื่อมต่อแล้ว · เวอร์ชัน ${extension.version}` : "ยังไม่เชื่อมต่อกับเว็บไซต์"} ok={extension.connected} />
            <StatusRow icon={LuLaptop} label="Blink Helper" detail={extension.helperConnected ? (extension.activeApp ?? "เปิดอยู่ · พร้อมเริ่มติดตาม") : "ติดต่อ Helper ที่เปิดอยู่ไม่ได้"} ok={extension.helperConnected} />
            <StatusRow icon={LuWifi} label="อินเทอร์เน็ต" detail={apiConnected ? "ออนไลน์ · เชื่อมต่อระบบได้" : "ออฟไลน์หรือเชื่อมต่อไม่ได้"} ok={apiConnected} />
            <button className="refresh-devices" onClick={() => void refresh()} disabled={checking}><LuRefreshCw className={checking ? "spin" : ""} />{checking ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้ง"}</button>
          </section>

          <section className="device-panel guide-panel">
            <h2>คำแนะนำการใช้งาน</h2>
            {["อนุญาตกล้องให้ Chrome", "ติดตั้งและ Reload Extension", "เปิด Blink Helper ครั้งแรก", "เข้าสู่ระบบด้วยบัญชีเดียวกัน"].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong><LuChevronRight /></div>)}
          </section>

          <section className="device-privacy"><LuCpu /><div><strong>ประมวลผลบนอุปกรณ์</strong><p>BlinkCare ไม่ส่งภาพจากกล้องไปยัง server</p></div></section>
        </aside>
      </div>
    </section>
  );
}

function StatusRow({ icon: Icon, label, detail, ok }: { icon: typeof LuCamera; label: string; detail: string; ok: boolean }) {
  return <div className="system-row"><span><Icon /></span><div><strong>{label}</strong><small>{detail}</small></div><i className={ok ? "ok" : "bad"}>{ok ? <LuCheck /> : <LuCircleX />}</i></div>;
}
