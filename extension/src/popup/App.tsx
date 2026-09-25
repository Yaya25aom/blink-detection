import { useEffect, useState } from "react";

type MonitorState =
  | "idle"
  | "starting"
  | "monitoring"
  | "paused"
  | "stopping"
  | "error";

const stateCopy: Record<MonitorState, string> = {
  idle: "ระบบยังไม่ได้เริ่มตรวจจับ",
  starting: "กำลังเปิดกล้องและเตรียมระบบ...",
  monitoring: "กำลังตรวจจับการกะพริบตา",
  paused: "หยุดตรวจจับชั่วคราว",
  stopping: "กำลังหยุดระบบ...",
  error: "ไม่สามารถเริ่ม BlinkCare ได้",
};

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function App() {
  // ================================
  // State
  // ================================
  const [state, setState] =
    useState<MonitorState>("idle");

  const [error, setError] =
    useState("");

  const [blinkCount, setBlinkCount] =
    useState(0);

  const [blinksPerMinute, setBlinksPerMinute] =
    useState(0);

  const [activeSeconds, setActiveSeconds] =
    useState(0);

  const [personPresent, setPersonPresent] =
    useState(false);

  const [authenticatedUserId, setAuthenticatedUserId] =
    useState<string | null>(null);

  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [helperConnected, setHelperConnected] = useState(false);
  const [currentEar, setCurrentEar] = useState(0);
  const [baselineEar, setBaselineEar] = useState(0);
  const [closeThreshold, setCloseThreshold] = useState(0);
  const [calibrated, setCalibrated] = useState(false);

  // ================================
  // Load data from Chrome Storage
  // ================================
  useEffect(() => {
    const loadData = async () => {
      const stored = await chrome.storage.local.get([
        "blinkcareMonitoring",
        "blinkcarePaused",
        "blinkcareLastError",
        "blinkCount",
        "blinksPerMinute",
        "activeSeconds",
        "personPresent",
        "blinkcareAuthenticatedUserId",
        "blinkcareActiveApp",
        "blinkcareHelperConnected",
        "currentEar",
        "baselineEar",
        "closeThreshold",
        "blinkcareCalibrated",
      ]);

      setState(
        stored.blinkcareMonitoring === true
          ? stored.blinkcarePaused === true ? "paused" : "monitoring"
          : "idle"
      );

      setError(
        typeof stored.blinkcareLastError === "string"
          ? stored.blinkcareLastError
          : ""
      );

      setBlinkCount(
        typeof stored.blinkCount === "number"
          ? stored.blinkCount
          : 0
      );

      setBlinksPerMinute(
        typeof stored.blinksPerMinute === "number"
          ? stored.blinksPerMinute
          : 0
      );

      setActiveSeconds(
        typeof stored.activeSeconds === "number" ? stored.activeSeconds : 0
      );
      setPersonPresent(stored.personPresent === true);
      setAuthenticatedUserId(
        stored.blinkcareAuthenticatedUserId === undefined
          ? null
          : String(stored.blinkcareAuthenticatedUserId)
      );
      setActiveApp(typeof stored.blinkcareActiveApp === "string" ? stored.blinkcareActiveApp : null);
      setHelperConnected(stored.blinkcareHelperConnected === true);
      setCurrentEar(Number(stored.currentEar ?? 0));
      setBaselineEar(Number(stored.baselineEar ?? 0));
      setCloseThreshold(Number(stored.closeThreshold ?? 0));
      setCalibrated(stored.blinkcareCalibrated === true);
    };

    void loadData();

    // ================================
    // Listen for storage changes
    // ================================
    const handleStorageChange = (
      changes: Record<
        string,
        chrome.storage.StorageChange
      >,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      // Monitoring status
      if (changes.blinkcareMonitoring) {
        setState(
          changes.blinkcareMonitoring.newValue === true
            ? "monitoring"
            : "idle"
        );
      }

      if (changes.blinkcarePaused) {
        setState(changes.blinkcarePaused.newValue === true ? "paused" : "monitoring");
      }

      // Error
      if (changes.blinkcareLastError) {
        const message =
          changes.blinkcareLastError.newValue;

        setError(
          typeof message === "string"
            ? message
            : ""
        );

        if (message) {
          setState("error");
        }
      }

      // Blink count
      if (changes.blinkCount) {
        const value =
          changes.blinkCount.newValue;

        setBlinkCount(
          typeof value === "number"
            ? value
            : 0
        );
      }

      // Blinks per minute
      if (changes.blinksPerMinute) {
        const value =
          changes.blinksPerMinute.newValue;

        setBlinksPerMinute(
          typeof value === "number"
            ? value
            : 0
        );
      }

      if (changes.activeSeconds) {
        const value = changes.activeSeconds.newValue;
        setActiveSeconds(typeof value === "number" ? value : 0);
      }

      if (changes.personPresent) {
        setPersonPresent(changes.personPresent.newValue === true);
      }

      if (changes.blinkcareAuthenticatedUserId) {
        const value = changes.blinkcareAuthenticatedUserId.newValue;
        setAuthenticatedUserId(value === undefined ? null : String(value));
      }

      if (changes.blinkcareActiveApp) {
        const value = changes.blinkcareActiveApp.newValue;
        setActiveApp(typeof value === "string" ? value : null);
      }

      if (changes.blinkcareHelperConnected) {
        setHelperConnected(changes.blinkcareHelperConnected.newValue === true);
      }

      if (changes.currentEar) setCurrentEar(Number(changes.currentEar.newValue ?? 0));
      if (changes.baselineEar) setBaselineEar(Number(changes.baselineEar.newValue ?? 0));
      if (changes.closeThreshold) setCloseThreshold(Number(changes.closeThreshold.newValue ?? 0));
      if (changes.blinkcareCalibrated) setCalibrated(changes.blinkcareCalibrated.newValue === true);
    };

    chrome.storage.onChanged.addListener(
      handleStorageChange
    );

    return () => {
      chrome.storage.onChanged.removeListener(
        handleStorageChange
      );
    };
  }, []);

  // ================================
  // Start Monitoring
  // ================================
  const start = async () => {
    if (!authenticatedUserId) {
      setError("กรุณาเข้าสู่ระบบ BlinkCare ก่อนเริ่มตรวจจับ");
      await chrome.runtime.sendMessage({ type: "BLINKCARE_OPEN_LOGIN" });
      return;
    }

    setState("starting");
    setError("");

    // reset ตัวเลขก่อนเริ่ม session ใหม่
    setBlinkCount(0);
    setBlinksPerMinute(0);
    setActiveSeconds(0);
    setPersonPresent(false);

    await chrome.storage.local.set({
      blinkCount: 0,
      blinksPerMinute: 0,
      activeSeconds: 0,
      personPresent: false,
      blinkcareLastError: "",
    });

    try {
      // ขอ permission กล้องจาก Popup
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

      // Popup ไม่ต้องใช้กล้องต่อ
      // Offscreen จะเป็นตัวเปิดกล้องจริง
      stream
        .getTracks()
        .forEach((track) => track.stop());

      const response =
        await chrome.runtime.sendMessage({
          type: "BLINKCARE_POPUP_START",
        });

      if (!response?.ok) {
        if (response?.error === "AUTH_REQUIRED") {
          await chrome.runtime.sendMessage({ type: "BLINKCARE_OPEN_LOGIN" });
          throw new Error("เซสชันเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง");
        }
        throw new Error(
          response?.error ||
            "Background could not start monitoring"
        );
      }
    } catch (caught) {
      let message =
        "ไม่สามารถเริ่มระบบได้";

      if (caught instanceof DOMException) {
        if (caught.name === "NotAllowedError") {
          message =
            "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera ใน Chrome";
        } else if (
          caught.name === "NotFoundError"
        ) {
          message =
            "ไม่พบกล้องบนอุปกรณ์นี้";
        } else if (
          caught.name === "NotReadableError"
        ) {
          message =
            "ไม่สามารถใช้งานกล้องได้ อาจมีโปรแกรมอื่นกำลังใช้งานอยู่";
        } else {
          message = caught.message;
        }
      } else if (caught instanceof Error) {
        message = caught.message;
      }

      setError(message);
      setState("error");
    }
  };

  // ================================
  // Stop Monitoring
  // ================================
  const stop = async () => {
    setState("stopping");

    try {
      const response =
        await chrome.runtime.sendMessage({
          type: "BLINKCARE_POPUP_STOP",
        });

      if (!response?.ok) {
        throw new Error(
          response?.error ||
            "ไม่สามารถหยุดระบบได้"
        );
      }
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "ไม่สามารถหยุดระบบได้";

      setError(message);
      setState("error");
    }
  };

  const setPaused = async (pause: boolean) => {
    setError("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: pause ? "BLINKCARE_POPUP_PAUSE" : "BLINKCARE_POPUP_RESUME",
      });
      if (!response?.ok) throw new Error(response?.error || "ไม่สามารถเปลี่ยนสถานะได้");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  // ================================
  // UI State
  // ================================
  const busy =
    state === "starting" ||
    state === "stopping";

  const monitoring =
    state === "monitoring";
  const paused = state === "paused";
  const active = monitoring || paused;

  // ================================
  // UI
  // ================================
  return (
    <main className="popup-shell">

      {/* Header */}
      <header className="popup-brand">
        <img
          src="/icons/icon-48.png"
          alt=""
        />

        <div>
          <strong>BlinkCare</strong>
          <span>Eye Health Monitor</span>
        </div>
      </header>

      {/* Status */}
      <section
        className={`monitor-card ${
          active ? "active" : ""
        }`}
      >
        <span className="status-light" />

        <div>
          <small>
            สถานะการตรวจจับ
          </small>

          <strong>
            {stateCopy[state]}
          </strong>
        </div>
      </section>

      <p className="account-status">
        {authenticatedUserId
          ? "เชื่อมต่อบัญชีแล้ว"
          : "ยังไม่ได้เข้าสู่ระบบ BlinkCare"}
      </p>

      {/* ================================
          Blink Statistics
      ================================= */}
      {active && (
        <>
        <section className="detection-time">
          <span>เวลาตรวจจับจริง</span>
          <strong>{formatDuration(activeSeconds)}</strong>
          <small className={personPresent ? "face-present" : "face-missing"}>
            {personPresent ? "พบใบหน้า · กำลังนับเวลา" : "ไม่พบใบหน้า · หยุดนับเวลา"}
          </small>
        </section>
        <section className="active-app-status">
          <span>แอปที่กำลังใช้งาน</span>
          <strong>{activeApp ?? (helperConnected ? "Helper พร้อม · รอเริ่มติดตามแอป" : "ไม่พบ Blink Helper")}</strong>
        </section>
        <section className="blink-stats">

          <div className="blink-stat">
            <span className="stat-label">
              กระพริบแล้ว
            </span>

            <strong className="stat-value">
              {blinkCount}
            </strong>

            <span className="stat-unit">
              ครั้ง
            </span>
          </div>

          <div className="blink-stat">
            <span className="stat-label">
              อัตราปัจจุบัน
            </span>

            <strong className="stat-value">
              {blinksPerMinute}
            </strong>

            <span className="stat-unit">
              ครั้ง/นาที
            </span>
          </div>

        </section>
        <section className="ear-status">
          <div><span>EAR ปัจจุบัน</span><strong>{currentEar.toFixed(3)}</strong></div>
          <div><span>Baseline ตอนลืมตา</span><strong>{baselineEar > 0 ? baselineEar.toFixed(3) : "-"}</strong></div>
          <div><span>เกณฑ์ปิดตา</span><strong>{closeThreshold > 0 ? closeThreshold.toFixed(3) : "-"}</strong></div>
          <small>{calibrated ? "ปรับเทียบตามดวงตาของคุณแล้ว" : "กำลังปรับเทียบ กรุณามองกล้องและลืมตาตามปกติ"}</small>
        </section>
        </>
      )}

      {/* Privacy */}
      <div className="privacy-note">
        <strong>
          ประมวลผลบนอุปกรณ์
        </strong>

        <p>
          ใช้กล้องตรวจจับใบหน้าและการกระพริบตา
          โดยไม่บันทึกภาพหรือวิดีโอ
        </p>
      </div>

      {/* Error */}
      {error && (
        <p
          className="popup-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* Start / Stop */}
      {active ? (
        <div className="monitor-actions">
          <button className="pause-button" disabled={busy} onClick={() => void setPaused(!paused)}>
            {paused ? "ตรวจจับต่อ" : "หยุดชั่วคราว"}
          </button>
          <button className="stop-button" disabled={busy} onClick={() => void stop()}>
            หยุดตรวจจับ
          </button>
        </div>
      ) : (
        <button className="start-button" disabled={busy} onClick={() => void start()}>
          {busy ? stateCopy[state] : authenticatedUserId ? "เริ่มตรวจจับ" : "เข้าสู่ระบบเพื่อเริ่ม"}
        </button>
      )}

      {/* Hint */}
      <p className="popup-hint">
        ปิดหน้าต่างนี้ได้หลังเริ่ม
        ระบบจะทำงานต่อเบื้องหลัง
      </p>

    </main>
  );
}
