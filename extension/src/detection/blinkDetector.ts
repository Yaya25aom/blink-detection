import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export const EyeState = {
  OPEN: "OPEN",
  PARTIAL_CLOSED: "PARTIAL_CLOSED",
  FULLY_CLOSED: "FULLY_CLOSED",
} as const;

export type EyeState = (typeof EyeState)[keyof typeof EyeState];

const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
};

export class BlinkDetector {
  private calibrationFrames: number[] = [];
  private readonly CALIBRATION_FRAME_COUNT = 30;
  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;
  private reopenThreshold = 0;
  private calibrated = false;
  private currentState: EyeState = EyeState.OPEN;
  private blinkCount = 0;
  private eyeWasClosed = false;
  private closedAt = 0;
  private lastFrameAt = 0;
  private lastBlinkAt = -Infinity;
  private openSince = 0;
  private armed = false;
  private neutralTilt: number | null = null;

  // Keep the total, but never join a blink across missing/invalid frames.
  public interrupt(): EyeState {
    this.eyeWasClosed = false;
    this.armed = false;
    this.openSince = 0;
    this.currentState = EyeState.OPEN;
    if (!this.calibrated) {
      this.calibrationFrames = [];
      this.neutralTilt = null;
    }
    return this.currentState;
  }

  private facingCamera(face: NormalizedLandmark[]): boolean {
    const top = face[10], chin = face[152], left = face[33], right = face[263];
    if (!top || !chin || !left || !right) return false;
    const tilt = (chin.z - top.z) / Math.hypot(chin.x - top.x, chin.y - top.y);
    const turn = Math.abs(right.z - left.z) / Math.hypot(right.x - left.x, right.y - left.y);
    if (!Number.isFinite(tilt) || !Number.isFinite(turn) || turn > 0.6) return false;
    this.neutralTilt ??= tilt;
    return Math.abs(tilt - this.neutralTilt) < 0.2;
  }

  public update(ear: number, now = performance.now(), face?: NormalizedLandmark[]): EyeState {
    if (now - this.lastFrameAt > 200) this.interrupt();
    this.lastFrameAt = now;
    if (!Number.isFinite(ear) || ear <= 0.04 || ear >= 0.65 ||
        (face && !this.facingCamera(face))) return this.interrupt();

    if (!this.calibrated) {
      this.calibrationFrames.push(ear);
      if (this.calibrationFrames.length >= this.CALIBRATION_FRAME_COUNT) {
        this.baselineEAR = percentile(this.calibrationFrames, 0.8);
        // Relative thresholds support naturally small eyes without a fixed floor.
        this.partialThreshold = this.baselineEAR * 0.84;
        this.fullThreshold = this.baselineEAR * 0.78;
        this.reopenThreshold = this.baselineEAR * 0.88;
        this.calibrated = true;
      }
      return EyeState.OPEN;
    }

    // Require stable open eyes before accepting another closure.
    if (!this.armed) {
      this.openSince = ear >= this.reopenThreshold ? (this.openSince || now) : 0;
      if (this.openSince && now - this.openSince >= 100) this.armed = true;
      return this.currentState;
    }

    if (!this.eyeWasClosed && ear <= this.fullThreshold) {
      this.eyeWasClosed = true;
      this.closedAt = now;
      this.currentState = EyeState.FULLY_CLOSED;
      return this.currentState;
    }

    if (this.eyeWasClosed) {
      if (ear >= this.reopenThreshold) {
        const duration = now - this.closedAt;
        if (duration >= 40 && duration <= 500 && now - this.lastBlinkAt >= 180) {
          this.blinkCount++;
          this.lastBlinkAt = now;
        }
        this.armed = false;
        this.openSince = now;
        this.eyeWasClosed = false;
        this.closedAt = 0;
        this.currentState = EyeState.OPEN;
      } else {
        this.currentState = ear <= this.fullThreshold
          ? EyeState.FULLY_CLOSED
          : EyeState.PARTIAL_CLOSED;
      }
      return this.currentState;
    }

    this.currentState = ear <= this.partialThreshold
      ? EyeState.PARTIAL_CLOSED
      : EyeState.OPEN;
    return this.currentState;
  }

  public getBlinkCount() { return this.blinkCount; }
  public getCurrentState() { return this.currentState; }
  public isCalibrated() { return this.calibrated; }
  public getBaselineEAR() { return this.baselineEAR; }
  public getPartialThreshold() { return this.partialThreshold; }
  public getFullThreshold() { return this.fullThreshold; }
}
