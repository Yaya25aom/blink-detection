import { useCallback, useEffect, useRef, useState } from "react";

import "./Detection.css";
import { apiFetch } from "../services/apiClient";

import CameraView from "../components/CameraView";
import useCamera from "../hooks/useCamera";

import { createFaceDetector, detectFace } from "../services/faceDetector";

import { selectPrimaryFace } from "../services/faceSelector";

import { extractEyeLandmarks } from "../services/eyeExtractor";

import { calculateAverageEAR } from "../services/earCalculator";

import { BlinkDetector } from "../services/blinkDetector";
import {
  addDailyActiveSecond,
  publishDetectionTelemetry,
} from "../services/detectionTelemetry";
import { LuMonitor, LuChrome, LuCode, LuGlobe } from "react-icons/lu";

export default function Detection() {
  const { videoRef, cameraOn, startCamera, stopCamera } = useCamera();

  // =====================================================
  // Detection Data
  // =====================================================

  const [ear, setEar] = useState(0);

  const [blinkCount, setBlinkCount] = useState(0);

  // =====================================================
  // Current App Usage
  // =====================================================

  const [currentApp, setCurrentApp] = useState<string | null>(null);

  

  const [currentAppStartedAt, setCurrentAppStartedAt] = useState<number | null>(
    null,
  );

  const [currentAppDuration, setCurrentAppDuration] = useState(0);
  const [currentAppBlinkCount, setCurrentAppBlinkCount] = useState(0);
  const pendingCurrentAppBlinks = useRef(0);
  const currentAppRef = useRef<string | null>(null);

  // =====================================================
  // Average Blink Per Minute
  // =====================================================

  const [averageBlinkPerMinute, setAverageBlinkPerMinute] = useState(0);

  // =====================================================
  // Duration
  // =====================================================

  const [duration, setDuration] = useState(0);

  // เวลาเริ่มช่วงที่กำลังตรวจจับอยู่
  const sessionStartTime = useRef<number | null>(null);

  // เวลาที่สะสมจากช่วงก่อนหน้า
  //
  // ตัวอย่าง:
  //
  // ตรวจ 30 วิ
  // Pause
  // elapsedDuration = 30
  //
  // Resume
  // ตรวจต่ออีก 20 วิ
  // elapsedDuration = 30
  // currentElapsed = 20
  //
  // รวม = 50 วิ
  const elapsedDuration = useRef(0);

  // =====================================================
  // Blink Detector
  // =====================================================

  const blinkDetector = useRef(new BlinkDetector());

  // จำนวน blink ของ Session ปัจจุบัน
  const sessionBlinkCount = useRef(0);

  // จำนวน blink ล่าสุดที่บันทึกลง database แล้ว
  const lastSavedBlinkCount = useRef(0);
  const lastFaceSeenAt = useRef(0);
  const presenceActiveSeconds = useRef(0);
  const continuousPresenceSeconds = useRef(0);
  const recentBlinkTimestamps = useRef<number[]>([]);
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);

  // =====================================================
  // Detection Session ID
  // =====================================================

  const [detectionId, setDetectionId] = useState<string | null>(null);

  // =====================================================
  // Session State
  // =====================================================

  const [sessionActive, setSessionActive] = useState(false);

  const [paused, setPaused] = useState(false);

  // =====================================================
  // Initialize Face Detector
  // =====================================================

  useEffect(() => {
    const init = async () => {
      await createFaceDetector();
    };

    init();
  }, []);

  // Count only time where a face is actually present. Reminder rules consume
  // this stream instead of wall-clock time, so walking away pauses every plan.
  useEffect(() => {
    if (!cameraOn || !sessionActive) {
      publishDetectionTelemetry({
        sessionId: detectionId,
        monitoring: false,
        personPresent: false,
        deltaActiveSeconds: 0,
        sessionActiveSeconds: presenceActiveSeconds.current,
        continuousActiveSeconds: 0,
        dailyActiveSeconds: 0,
        totalBlinks: sessionBlinkCount.current,
        blinkRate: 0,
        lightingLevel: "UNKNOWN",
        timestamp: Date.now(),
      });
      return;
    }

    const presenceTimer = window.setInterval(() => {
      const personPresent = Date.now() - lastFaceSeenAt.current <= 3000;
      let lightingLevel: "GOOD" | "DARK" | "UNKNOWN" = "UNKNOWN";
      let dailyActiveSeconds = 0;

      const video = videoRef.current;
      if (video?.videoWidth && video.videoHeight) {
        const canvas = lightCanvas.current ?? document.createElement("canvas");
        lightCanvas.current = canvas;
        canvas.width = 48;
        canvas.height = 36;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let luminance = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            luminance += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
          }
          const average = luminance / (pixels.length / 4);
          lightingLevel = average < 42 ? "DARK" : "GOOD";
        }
      }

      if (personPresent) {
        presenceActiveSeconds.current += 1;
        continuousPresenceSeconds.current += 1;
        dailyActiveSeconds = addDailyActiveSecond();
      } else {
        continuousPresenceSeconds.current = 0;
      }

      const oneMinuteAgo = Date.now() - 60_000;
      recentBlinkTimestamps.current = recentBlinkTimestamps.current.filter(
        (timestamp) => timestamp >= oneMinuteAgo,
      );
      setDuration(presenceActiveSeconds.current);
      setAverageBlinkPerMinute(
        presenceActiveSeconds.current > 0
          ? sessionBlinkCount.current / (presenceActiveSeconds.current / 60)
          : 0,
      );
      publishDetectionTelemetry({
        sessionId: detectionId,
        monitoring: true,
        personPresent,
        deltaActiveSeconds: personPresent ? 1 : 0,
        sessionActiveSeconds: presenceActiveSeconds.current,
        continuousActiveSeconds: continuousPresenceSeconds.current,
        dailyActiveSeconds,
        totalBlinks: sessionBlinkCount.current,
        blinkRate: recentBlinkTimestamps.current.length,
        lightingLevel,
        timestamp: Date.now(),
      });
    }, 1000);

    return () => window.clearInterval(presenceTimer);
  }, [cameraOn, detectionId, sessionActive, videoRef]);

  // =====================================================
  // Format Duration
  // =====================================================

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);

    const secs = seconds % 60;

    return `${String(minutes).padStart(
      2,
      "0",
    )}:${String(secs).padStart(2, "0")}`;
  };

  // =====================================================
  // Calculate Blink Average
  // =====================================================

  const getBlinkAverage = useCallback((totalSeconds: number) => {
    if (totalSeconds <= 0) {
      return 0;
    }

    const totalBlinks = sessionBlinkCount.current;

    const totalMinutes = totalSeconds / 60;

    return totalBlinks / totalMinutes;
  }, []);

  const calculateBlinkAverage = useCallback((totalSeconds: number) => {
    const average = getBlinkAverage(totalSeconds);

    setAverageBlinkPerMinute(average);

    console.log("BLINK AVERAGE:", {
      totalBlinks: sessionBlinkCount.current,
      totalSeconds,
      average,
    });
  }, [getBlinkAverage]);

  // =====================================================
  // Start Detection Session
  // =====================================================

  const startDetectionSession = async () => {
    try {
      const token = localStorage.getItem("accessToken");

      if (!token) {
        console.error("No access token");

        return null;
      }

      const response = await apiFetch("/detection/start", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();

        console.error("Start detection failed:", error);

        return null;
      }

      const data = await response.json();

      console.log("Detection session created:", data);

      const newDetectionId = data.data.session_id;

      setDetectionId(newDetectionId);

      return newDetectionId;
    } catch (error) {
      console.error("Start detection error:", error);

      return null;
    }
  };

  // =====================================================
  // Set Current App Usage Session
  // =====================================================

  const setAppUsageSession = async (sessionId: string) => {
    try {
      const response = await apiFetch("/app-usage/session", {
        method: "POST",

        body: JSON.stringify({
          session_id: sessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();

        console.error("Set app usage session failed:", error);

        return false;
      }

      const data = await response.json();

      console.log("App usage session set:", data);

      return true;
    } catch (error) {
      console.error("Set app usage session error:", error);

      return false;
    }
  };

  // =====================================================
  // Get Current App Usage
  // =====================================================

  const fetchCurrentApp = useCallback(async () => {
    if (!detectionId) {
      return;
    }

    try {
      const [response, statsResponse] = await Promise.all([
        apiFetch(
          `/app-usage/current?session_id=${detectionId}`,
          {
            method: "GET",
          },
        ),
        apiFetch(
          `/app-usage/current/blinks?session_id=${detectionId}`,
          {
            method: "GET",
          },
        ),
      ]);

      if (!response.ok) {
        const errorText = await response.text();

        console.error("Failed to get current app:", errorText);

        return;
      }

      const data = await response.json();

      const app = data.data;

      if (!app) {
        setCurrentApp(null);
        currentAppRef.current = null;
        setCurrentAppStartedAt(null);
        setCurrentAppDuration(0);
        setCurrentAppBlinkCount(0);
        pendingCurrentAppBlinks.current = 0;

        return;
      }

      // ==========================================
      // Realtime Current App
      // ==========================================

      if (currentAppRef.current !== app.app_name) {
        pendingCurrentAppBlinks.current = 0;
      }

      currentAppRef.current = app.app_name;

      setCurrentApp(app.app_name);

      setCurrentAppStartedAt(new Date(app.started_at).getTime());

      if (!statsResponse.ok) {
        const errorText = await statsResponse.text();

        console.error("Failed to get current app blinks:", errorText);

        return;
      }

      const statsData = await statsResponse.json();

      setCurrentAppBlinkCount(
        Number(statsData.data?.blink_count ?? 0) +
          pendingCurrentAppBlinks.current,
      );
    } catch (error) {
      console.error("Get current app error:", error);
    }
  }, [detectionId]);
  // =====================================================
  // Get App Icon
  // =====================================================

  const getAppIcon = () => {
    if (!currentApp) {
      return <LuMonitor size={28} />;
    }

    const app = currentApp.toLowerCase();

    if (app.includes("chrome")) {
      return <LuChrome size={28} />;
    }

    if (
      app.includes("code") ||
      app.includes("visual studio") ||
      app.includes("vscode")
    ) {
      return <LuCode size={28} />;
    }

    if (
      app.includes("browser") ||
      app.includes("firefox") ||
      app.includes("edge")
    ) {
      return <LuGlobe size={28} />;
    }

    return <LuMonitor size={28} />;
  };

  // =====================================================
  // Current App Duration Timer
  // =====================================================

  useEffect(() => {
    if (!currentApp || currentAppStartedAt === null) {
      return;
    }

    const updateDuration = () => {
      const seconds = Math.floor((Date.now() - currentAppStartedAt) / 1000);

      setCurrentAppDuration(Math.max(seconds, 0));
    };

    updateDuration();

    const timer = setInterval(updateDuration, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [currentApp, currentAppStartedAt]);

  // =====================================================
  // Poll Current App
  // =====================================================

  useEffect(() => {
    if (!sessionActive || paused || !detectionId) {
      return;
    }

    const firstCall = setTimeout(() => {
      fetchCurrentApp();
    }, 0);

    const timer = setInterval(() => {
      fetchCurrentApp();
    }, 1000);

    return () => {
      clearTimeout(firstCall);
      clearInterval(timer);
    };
  }, [sessionActive, paused, detectionId, fetchCurrentApp]);
  // =====================================================
  // Pause Detection
  // =====================================================

  const handlePause = async () => {
    if (!sessionActive || !cameraOn) {
      return;
    }

    console.log("PAUSE DETECTION");

    // ===================================================
    // เก็บเวลาช่วงล่าสุดก่อน Pause
    // ===================================================

    if (sessionStartTime.current !== null) {
      elapsedDuration.current = presenceActiveSeconds.current;

      setDuration(presenceActiveSeconds.current);

      // =================================================
      // คำนวณ Average ตอน Pause
      // =================================================

      calculateBlinkAverage(presenceActiveSeconds.current);
    }

    // =========================================
    // หยุด Python App Tracker
    // =========================================

    const response = await apiFetch("/app-usage/pause", {
      method: "POST",
    });

    if (!response.ok) {
      console.error("Failed to pause app tracker");
    }
    // ===================================================
    // หยุดกล้อง
    // ===================================================

    stopCamera();

    // ===================================================
    // ล้างเวลาเริ่มช่วงปัจจุบัน
    // ===================================================

    sessionStartTime.current = null;

    // ===================================================
    // เปลี่ยนเป็น Paused
    // ===================================================

    setPaused(true);
  };

  // ===================================================
  // END DETECTION
  // ===================================================
  const endDetectionSession = async (
    finalDuration: number,
    totalBlinks: number,
    averageBlinkPerMinute: number,
    averageEar: number,
  ) => {
    if (!detectionId) {
      console.error("No detection session ID");
      return;
    }

    try {
      const response = await apiFetch("/detection/end", {
        method: "POST",

        body: JSON.stringify({
          session_id: detectionId,

          duration_seconds: finalDuration,

          total_blinks: totalBlinks,

          average_blinks_per_minute: averageBlinkPerMinute,

          average_ear: averageEar,
        }),
      });

      if (!response.ok) {
        const error = await response.json();

        console.error("End detection failed:", error);

        return;
      }

      const data = await response.json();

      console.log("Detection session ended:", data);
    } catch (error) {
      console.error("End detection error:", error);
    }
  };

  const endAppUsage = async () => {
    try {
      const response = await apiFetch("/app-usage/end", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();

        console.error("End app usage failed:", error);

        return false;
      }

      const data = await response.json();

      console.log("App usage ended:", data);

      return true;
    } catch (error) {
      console.error("End app usage error:", error);

      return false;
    }
  };
  // =====================================================
  // Save Blink Record
  // =====================================================

  const saveBlinkRecord = useCallback(
    async (ear: number, duration_ms: number) => {
      if (!detectionId) {
        console.error("No detection session");

        return false;
      }

      try {
        const response = await apiFetch(
          "/detection/blink",
          {
            method: "POST",

            body: JSON.stringify({
              detection_id: detectionId,

              ear,

              duration_ms,
            }),
          },
        );

        if (!response.ok) {
          const error = await response.json();

          console.error("Save blink failed:", error);

          return false;
        }

        const data = await response.json();

        console.log("Blink saved:", data);

        return true;
      } catch (error) {
        console.error("Save blink error:", error);

        return false;
      }
    },
    [detectionId],
  );

  // =====================================================
  // End Session
  // =====================================================

  const handleEndSession = async () => {
    if (!sessionActive || !detectionId) {
      return;
    }

    console.log("END SESSION");

    // ===================================================
    // หาค่าเวลาสุดท้าย
    // ===================================================

    const finalDuration = presenceActiveSeconds.current;

    // ===================================================
    // Update Duration
    // ===================================================

    setDuration(finalDuration);

    // ===================================================
    // Calculate Final Average
    // ===================================================

    const finalAverageBlinkPerMinute = getBlinkAverage(finalDuration);

    setAverageBlinkPerMinute(finalAverageBlinkPerMinute);
    // =========================================
    // หยุด Python App Tracker
    // =========================================

    await endAppUsage();

    // =========================================
    // จบ Detection Session
    // =========================================
    await endDetectionSession(
      finalDuration,
      sessionBlinkCount.current,
      finalAverageBlinkPerMinute,
      ear,
    );

    // ===================================================
    // Debug
    // ===================================================

    console.log("FINAL SESSION DATA:", {
      detectionId,

      duration: finalDuration,

      totalBlinks: sessionBlinkCount.current,

      averageBlinksPerMinute:
        finalDuration > 0
          ? sessionBlinkCount.current / (finalDuration / 60)
          : 0,
    });

    // ===================================================
    // Stop Camera
    // ===================================================

    stopCamera();

    // ===================================================
    // End Session
    // ===================================================

    setSessionActive(false);

    setPaused(false);

    // ===================================================
    // หยุด timer ปัจจุบัน
    // ===================================================

    sessionStartTime.current = null;

    // ===================================================
    // เก็บเวลาสุดท้าย
    // ===================================================

    elapsedDuration.current = finalDuration;
  };

  // =====================================================
  // Detection Loop
  // =====================================================

  useEffect(() => {
    if (!cameraOn) {
      return;
    }

    let animationId: number;

    let stopped = false;

    // ===================================================
    // Detect
    // ===================================================

    const detect = async () => {
      if (stopped) {
        return;
      }

      // =================================================
      // Check Video
      // =================================================

      if (
        !videoRef.current ||
        videoRef.current.readyState < 2 ||
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        animationId = requestAnimationFrame(detect);

        return;
      }

      // =================================================
      // Face Detection
      // =================================================

      const result = await detectFace(videoRef.current);

      if (stopped) {
        return;
      }

      // =================================================
      // มี Face
      // =================================================

      if (result && result.faceLandmarks.length > 0) {
        lastFaceSeenAt.current = Date.now();
        // ===============================================
        // Select Primary Face
        // ===============================================

        const face = selectPrimaryFace(result.faceLandmarks);

        if (face) {
          // =============================================
          // Extract Eyes
          // =============================================

          const eyes = extractEyeLandmarks(face);

          // =============================================
          // Calculate EAR
          // =============================================

          const averageEAR = calculateAverageEAR(eyes.leftEye, eyes.rightEye);

          setEar(averageEAR);

          // =============================================
          // Blink Detection
          // =============================================

          blinkDetector.current.update(averageEAR);

          const totalBlink = blinkDetector.current.getBlinkCount();

          // =============================================
          // ตรวจ Blink ใหม่
          // =============================================

          if (totalBlink > lastSavedBlinkCount.current) {
            // ===========================================
            // Save Blink To Database
            // ===========================================

            // ===========================================
            // เพิ่ม Blink ของ Session
            // ===========================================

            sessionBlinkCount.current += 1;
            recentBlinkTimestamps.current.push(Date.now());

            // ===========================================
            // Update Last Saved Blink
            // ===========================================

            lastSavedBlinkCount.current = totalBlink;

            // ===========================================
            // Update Blink UI
            // ===========================================

            setBlinkCount(sessionBlinkCount.current);

            const appAtBlinkTime = currentAppRef.current;

            if (appAtBlinkTime) {
              pendingCurrentAppBlinks.current += 1;

              setCurrentAppBlinkCount((count) => count + 1);
            }

            void saveBlinkRecord(averageEAR, 0).then((blinkSaved) => {
              if (appAtBlinkTime) {
                pendingCurrentAppBlinks.current = Math.max(
                  pendingCurrentAppBlinks.current - 1,
                  0,
                );
              }

              if (!blinkSaved) {
                console.error("Blink was counted locally but not saved");
              }
            });

            // ===========================================
            // คำนวณเวลาปัจจุบัน
            // ===========================================

            const currentSeconds = presenceActiveSeconds.current;

            // ===========================================
            // Update Average
            // ===========================================

            calculateBlinkAverage(currentSeconds);
          }
        }
      }

      // =================================================
      // Continue Detection
      // =================================================

      if (!stopped) {
        animationId = requestAnimationFrame(detect);
      }
    };

    detect();

    // ===================================================
    // Cleanup
    // ===================================================

    return () => {
      stopped = true;

      cancelAnimationFrame(animationId);
    };
  }, [cameraOn, videoRef, saveBlinkRecord, calculateBlinkAverage]);

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="detection-layout">
      {/* =================================================
          LEFT PANEL
      ================================================= */}

      <div className="left-panel">
        <CameraView
          cameraOn={cameraOn}
          sessionActive={sessionActive}
          paused={paused}
          // =================================================
          // Start / Resume
          // =================================================

          onStart={async () => {
            // ===============================================
            // RESUME SESSION
            // ===============================================

            if (sessionActive && paused) {
              console.log("RESUME DETECTION");

              // =========================================
              // ให้ Python App Tracker กลับมาทำงาน
              // =========================================

              const response = await apiFetch("/app-usage/resume", {
                method: "POST",
              });

              if (!response.ok) {
                console.error("Failed to resume app tracker");

                return;
              }

              // เริ่มนับเวลาช่วงใหม่
              sessionStartTime.current = Date.now();

              setPaused(false);

              startCamera();

              return;
            }

            // ===============================================
            // START NEW SESSION
            // ===============================================

            console.log("START NEW SESSION");

            const id = await startDetectionSession();

            console.log("RETURNED DETECTION ID:", id);

            if (id) {
              // =============================================
              // Reset Duration
              // =============================================\

              const appUsageSessionSet = await setAppUsageSession(id);

              if (!appUsageSessionSet) {
                console.error("Cannot set app usage session");

                return;
              }

              setDuration(0);

              elapsedDuration.current = 0;

              // =============================================
              // Reset Blink
              // =============================================

              setBlinkCount(0);

              sessionBlinkCount.current = 0;
              presenceActiveSeconds.current = 0;
              continuousPresenceSeconds.current = 0;
              lastFaceSeenAt.current = 0;
              recentBlinkTimestamps.current = [];
              pendingCurrentAppBlinks.current = 0;
              currentAppRef.current = null;

              // =============================================
              // Reset Average
              // =============================================

              setAverageBlinkPerMinute(0);

              // =============================================
              // Reset EAR
              // =============================================

              setEar(0);

              // =============================================
              // สร้าง BlinkDetector ใหม่
              // =============================================

              blinkDetector.current = new BlinkDetector();

              // =============================================
              // Reset Last Saved Blink
              // =============================================

              lastSavedBlinkCount.current = 0;

              // =============================================
              // Start Timer
              // =============================================

              sessionStartTime.current = Date.now();

              // =============================================
              // Session Active
              // =============================================

              setSessionActive(true);

              setPaused(false);

              // =============================================
              // Start Camera
              // =============================================

              startCamera();
            }
          }}
          // =================================================
          // Pause
          // =================================================

          onPause={handlePause}
          // =================================================
          // End Session
          // =================================================

          onEnd={handleEndSession}
        />
      </div>

      {/* =================================================
          RIGHT PANEL
      ================================================= */}

      <div className="right-panel">
        {/* =================================================
            Blink Rate
        ================================================= */}

        <div className="summary-card">
          <p>Blink Rate (Realtime)</p>

          {/* <h2>{averageBlinkPerMinute.toFixed(1)}</h2> */}
          <div className="stat-card blink-rate-card">
            <p>Avg. Blinks / Min</p>

            <div className="blink-gauge">
              <svg viewBox="0 0 220 120" className="blink-gauge-svg">
                {/* Background */}
                <path
                  d="M 20 100 A 90 90 0 0 1 200 100"
                  className="blink-gauge-background"
                />

                {/* Progress */}
                <path
                  d="M 20 100 A 90 90 0 0 1 200 100"
                  className="blink-gauge-progress"
                  style={{
                    stroke:
                      averageBlinkPerMinute < 8
                        ? "#ef4444"
                        : averageBlinkPerMinute < 17
                          ? "#f59e0b"
                          : "#22c55e",

                    strokeDasharray: 283,
                    strokeDashoffset:
                      283 - (Math.min(averageBlinkPerMinute, 30) / 30) * 283,
                  }}
                />
              </svg>

              <div className="blink-gauge-value">
                <strong>{averageBlinkPerMinute.toFixed(1)}</strong>
              </div>
              <div className="statusblink">
                <span
                  className={
                    averageBlinkPerMinute < 8
                      ? "blink-status low"
                      : averageBlinkPerMinute < 17
                        ? "blink-status moderate"
                        : "blink-status Healthy"
                  }
                >
                  {averageBlinkPerMinute < 8
                    ? "Blinking Too Low"
                    : averageBlinkPerMinute < 17
                      ? "Normal Blinking"
                      : "Healthy Blinking"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            Detection Status
        ================================================= */}

        <div
          className={cameraOn ? "detection-status active" : "detection-status"}
        >
          <div className="status-header">
            <span className={cameraOn ? "status-dot active" : "status-dot"} />

            <h3>
              {cameraOn
                ? "Detection Active"
                : paused
                  ? "Detection Paused"
                  : sessionActive
                    ? "Session Ready"
                    : "Detection Inactive"}
            </h3>
          </div>

          <p>
            {cameraOn
              ? "System is currently monitoring blink activity and eye movement."
              : paused
                ? "Detection is paused. Press Resume to continue the current session."
                : sessionActive
                  ? "Session is active. Press Start to resume detection."
                  : "Start the camera to begin detection."}
          </p>
        </div>
      </div>

      {/* =================================================
          STATISTICS
      ================================================= */}

      <div className="stats-grid">
        {/* =================================================
            EAR
        ================================================= */}

        <div className="stat-card">
          <p>EAR</p>

          <h2>{ear.toFixed(3)}</h2>
        </div>

        {/* =================================================
            Total Blinks
        ================================================= */}

        <div className="stat-card">
          <p>Total Blinks</p>

          <h2>{blinkCount}</h2>
        </div>

        {/* =================================================
            Duration
        ================================================= */}

        <div className="stat-card">
          <p>Duration</p>

          <h2>{formatDuration(duration)}</h2>
        </div>
      </div>
      {/* =================================================
    CURRENT APPLICATION
================================================= */}

      <div className="current-app-card">
        <div className="current-app-header">
          <div>
            <p>Current Application</p>

            <span>
              {currentApp ? "Currently using" : "No application detected"}
            </span>
          </div>

          <span
            className={
              currentApp ? "app-live-indicator" : "app-live-indicator offline"
            }
          >
            {currentApp ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        {currentApp ? (
          <div className="current-app-content">
            {/* LEFT */}

            <div className="current-app-info">
              <div className="app-icon">{getAppIcon()}</div>

              <div className="app-details">
                <h3>{currentApp}</h3>

                <div className="app-time">
                  <span>Time in app</span>

                  <strong>{formatDuration(currentAppDuration)}</strong>
                </div>
              </div>
            </div>

            {/* RIGHT */}

              <div className="current-app-stats">
              <div className="app-blink-count">
                <span>Blinks in app</span>

                <strong>{currentAppBlinkCount}</strong>
              </div>

              <div className="app-risk">
                <span>Risk Status</span>

                <div className="risk-status normal">
                  <span className="risk-dot" />
                  Normal
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-app-detected">
            <LuMonitor size={28} />

            <span>Waiting for application...</span>
          </div>
        )}
      </div>

      {/* =================================================
          Hidden Video
      ================================================= */}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          display: "none",
        }}
      />
    </div>
  );
}
