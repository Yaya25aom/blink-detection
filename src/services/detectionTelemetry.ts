export type DetectionTelemetry = {
  sessionId: string | null;
  monitoring: boolean;
  personPresent: boolean;
  deltaActiveSeconds: number;
  sessionActiveSeconds: number;
  continuousActiveSeconds: number;
  dailyActiveSeconds: number;
  totalBlinks: number;
  blinkRate: number;
  timestamp: number;
};

export const DETECTION_TELEMETRY_EVENT = "blinkcare:detection-telemetry";

const localDateKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export const addDailyActiveSecond = () => {
  const key = `blinkCareActiveSeconds:${localDateKey()}`;
  const nextValue = Number(localStorage.getItem(key) ?? 0) + 1;
  localStorage.setItem(key, String(nextValue));
  return nextValue;
};

export const publishDetectionTelemetry = (telemetry: DetectionTelemetry) => {
  window.dispatchEvent(new CustomEvent<DetectionTelemetry>(
    DETECTION_TELEMETRY_EVENT,
    { detail: telemetry },
  ));
};
