import { BlinkDetector } from "../detection/blinkDetector";
import { calculateAverageEAR } from "../detection/earCalculator";
import { extractEyeLandmarks } from "../detection/eyeExtractor";
import { createFaceDetector, detectFace } from "../detection/faceDetector";
import { selectPrimaryFace } from "../detection/faceSelector";

const video = document.querySelector<HTMLVideoElement>("#camera");
if (!video) throw new Error("Camera video element was not found");

let stream: MediaStream | null = null;
let detectionTimer: number | null = null;
let presenceTimer: number | null = null;
let monitoring = false;
let paused = false;
let detector = new BlinkDetector();
let lastBlinkCount = 0;
let lastFaceSeenAt = 0;
let monitoringStartedAt = 0;
let activeStartedAt = 0;
let blinkTimestamps: number[] = [];
let activeSeconds = 0;
let lightingLevel: "GOOD" | "DARK" | "UNKNOWN" = "UNKNOWN";
let currentEar = 0;
let lastRealtimePublishAt = 0;
let darkStartedAt = 0;
const alertCooldowns = new Map<string, number>();
const lightCanvas = document.createElement("canvas");
const lightContext = lightCanvas.getContext("2d", { willReadFrequently: true });

const errorMessage = (error: unknown) => {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const playNotificationSound = async () => {
  const context = new AudioContext();
  try {
    if (context.state === "suspended") await context.resume();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
    gain.connect(context.destination);
    [740, 988].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.14);
      oscillator.stop(context.currentTime + 0.26 + index * 0.14);
    });
    window.setTimeout(() => void context.close(), 650);
  } catch {
    await context.close();
  }
};

const sendAlert = (key: string, title: string, message: string) => {
  const now = Date.now();
  if (now - (alertCooldowns.get(key) ?? 0) < 5 * 60_000) return;
  alertCooldowns.set(key, now);
  const categories: Record<string, string> = {
    "low-blink": "LOW_BLINK",
    "face-missing": "FACE_MISSING",
    "poor-lighting": "POOR_LIGHTING",
  };
  void chrome.runtime.sendMessage({
    type: "BLINKCARE_ALERT",
    title,
    message,
    category: categories[key],
  });
};

const publishDetectionUpdate = (countActiveSecond = false) => {
  const now = Date.now();
  const personPresent = !paused && lastFaceSeenAt > 0 && now - lastFaceSeenAt <= 1_500;
  blinkTimestamps = blinkTimestamps.filter(
    (timestamp) => timestamp >= now - 60_000,
  );

  if (countActiveSecond && personPresent) activeSeconds += 1;

  void chrome.runtime.sendMessage({
    type: "BLINKCARE_DETECTION_UPDATE",
    blinkCount: detector.getBlinkCount(),
    blinksPerMinute: blinkTimestamps.length,
    activeSeconds,
    personPresent,
    lightingLevel,
    paused,
    currentEar,
    baselineEar: detector.getBaselineEAR(),
    closeThreshold: detector.getFullThreshold(),
    calibrated: detector.isCalibrated(),
  });
};

const detectionLoop = async () => {
  if (!monitoring) return;

  if (!paused && video.readyState >= 2) {
    const result = await detectFace(video);
    const face = result ? selectPrimaryFace(result.faceLandmarks) : null;
    const now = Date.now();

    if (face) {
      lastFaceSeenAt = now;
      if (activeStartedAt === 0) activeStartedAt = now;
      const eyes = extractEyeLandmarks(face);
      const averageEar = calculateAverageEAR(eyes.leftEye, eyes.rightEye);
      currentEar = averageEar;
      detector.update(averageEar);
      const total = detector.getBlinkCount();
      if (total > lastBlinkCount) {
        blinkTimestamps.push(now);
        lastBlinkCount = total;
        void chrome.runtime.sendMessage({
          type: "BLINKCARE_BLINK_DETECTED",
          ear: averageEar,
          durationMs: 0,
        });
        lastRealtimePublishAt = now;
        publishDetectionUpdate(false);
      }
      if (now - lastRealtimePublishAt >= 100) {
        lastRealtimePublishAt = now;
        publishDetectionUpdate(false);
      }
      blinkTimestamps = blinkTimestamps.filter(
        (timestamp) => timestamp >= now - 60_000,
      );
      if (lightContext) {
        lightCanvas.width = 32;
        lightCanvas.height = 24;
        lightContext.drawImage(video, 0, 0, 32, 24);
        const pixels = lightContext.getImageData(0, 0, 32, 24).data;
        let brightness = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        }
        lightingLevel = brightness / (pixels.length / 4) < 42 ? "DARK" : "GOOD";
        darkStartedAt = lightingLevel === "DARK" ? (darkStartedAt || now) : 0;
        if (darkStartedAt > 0 && now - darkStartedAt >= 10_000) {
          sendAlert(
            "poor-lighting",
            "แสงไม่เพียงพอสำหรับการตรวจจับ",
            "บริเวณใบหน้ามืดเกินไป กรุณาเพิ่มแสงเพื่อให้ตรวจจับได้ชัดเจน",
          );
        }
      }
      if (now - activeStartedAt >= 60_000 && blinkTimestamps.length < 12) {
        sendAlert(
          "low-blink",
          "อัตราการกะพริบตาต่ำ",
          `ขณะนี้ ${blinkTimestamps.length} ครั้ง/นาที ควรกะพริบอย่างน้อย 12 ครั้ง/นาที`,
        );
      }
    } else if (now - (lastFaceSeenAt || monitoringStartedAt) >= 30_000) {
      activeStartedAt = 0;
      lightingLevel = "UNKNOWN";
      darkStartedAt = 0;
      sendAlert("face-missing", "ไม่พบใบหน้า", "ระบบหยุดนับเวลาใช้งานชั่วคราว");
    }

  }

  detectionTimer = window.setTimeout(() => void detectionLoop(), 16);
};

const startMonitoring = async () => {
  if (monitoring) return;

  console.log("[BlinkCare] 1. Creating FaceLandmarker...");

  await createFaceDetector();

  console.log("[BlinkCare] 2. FaceLandmarker ready");

  console.log("[BlinkCare] 3. Requesting camera...");

  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  console.log("[BlinkCare] 4. Camera stream acquired");

  video.srcObject = stream;

  console.log("[BlinkCare] 5. Playing video...");

  await video.play();

  console.log("[BlinkCare] 6. Video playing");

  detector = new BlinkDetector();
  lastBlinkCount = 0;
  lastFaceSeenAt = 0;
  monitoringStartedAt = Date.now();
  activeStartedAt = 0;
  blinkTimestamps = [];
  activeSeconds = 0;
  lightingLevel = "UNKNOWN";
  currentEar = 0;
  lastRealtimePublishAt = 0;
  darkStartedAt = 0;

  monitoring = true;
  paused = false;

  void chrome.runtime.sendMessage({
    type: "BLINKCARE_STATUS",
    monitoring: true,
  });

  console.log("[BlinkCare] 7. Detection started");

  publishDetectionUpdate();
  presenceTimer = window.setInterval(() => publishDetectionUpdate(true), 1000);
  void detectionLoop();
};

const stopMonitoring = () => {
  monitoring = false;
  paused = false;
  if (detectionTimer !== null) window.clearTimeout(detectionTimer);
  detectionTimer = null;
  if (presenceTimer !== null) window.clearInterval(presenceTimer);
  presenceTimer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  lastFaceSeenAt = 0;
  void chrome.runtime.sendMessage({
    type: "BLINKCARE_DETECTION_UPDATE",
    blinkCount: detector.getBlinkCount(),
    blinksPerMinute: blinkTimestamps.length,
    activeSeconds,
    personPresent: false,
    lightingLevel: "UNKNOWN",
    paused: false,
    currentEar,
    baselineEar: detector.getBaselineEAR(),
    closeThreshold: detector.getFullThreshold(),
    calibrated: detector.isCalibrated(),
  });
  void chrome.runtime.sendMessage({
    type: "BLINKCARE_STATUS",
    monitoring: false,
  });
};

const pauseMonitoring = () => {
  if (!monitoring || paused) return;
  paused = true;
  lastFaceSeenAt = 0;
  void chrome.runtime.sendMessage({ type: "BLINKCARE_STATUS", monitoring: true, paused: true });
  publishDetectionUpdate();
};

const resumeMonitoring = () => {
  if (!monitoring || !paused) return;
  paused = false;
  lastFaceSeenAt = 0;
  activeStartedAt = 0;
  void chrome.runtime.sendMessage({ type: "BLINKCARE_STATUS", monitoring: true, paused: false });
};

chrome.runtime.onMessage.addListener(
  (message: { target?: string; type?: string }) => {
    if (message.target !== "offscreen") return;
    if (message.type === "BLINKCARE_START") {
      void startMonitoring().catch((error: unknown) => {
        if (error instanceof DOMException) {
          console.error("BlinkCare DOMException:", {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack,
          });
        } else if (error instanceof Error) {
          console.error("BlinkCare Error:", {
            name: error.name,
            message: error.message,
            stack: error.stack,
          });
        } else {
          console.error("BlinkCare Unknown Error:", error);
        }

        stopMonitoring();

        void chrome.runtime.sendMessage({
          type: "BLINKCARE_ERROR",
          message: errorMessage(error),
        });

        sendAlert(
          "camera-error",
          "ไม่สามารถเริ่มระบบตรวจจับได้",
          `${errorMessage(error)} กรุณาตรวจสอบสิทธิ์กล้องแล้วลองอีกครั้ง`,
        );
      });
    }
    if (message.type === "BLINKCARE_STOP") stopMonitoring();
    if (message.type === "BLINKCARE_PAUSE") pauseMonitoring();
    if (message.type === "BLINKCARE_RESUME") resumeMonitoring();
    if (message.type === "BLINKCARE_PLAY_NOTIFICATION_SOUND") void playNotificationSound();
  },
);
