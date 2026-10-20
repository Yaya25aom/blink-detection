import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

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
  private calibrationStartedAt: number | null = null;
  private calibrationBlinks: number[] = [];
  private calibrationGaze: number[] = [];
  private restingBlink = 0;
  private restingGaze = 0;
  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;
  private calibrated = false;
  private currentState: EyeState = EyeState.OPEN;
  private blinkCount = 0;
  private eyeWasClosed = false;
  private closedAt = 0;
  private lastFrameAt = 0;
  private lastBlinkAt = -Infinity;
  private openSince = 0;
  private armed = false;
  private poseAnchor: number[] | null = null;
  private poseAnchorAt = 0;
  private settleUntil = 0;

  // Keep the total, but never join a blink across missing/invalid frames.
  public interrupt(): EyeState {
    this.eyeWasClosed = false;
    this.armed = false;
    this.openSince = 0;
    this.currentState = EyeState.OPEN;
    return this.currentState;
  }

  private stablePose(matrix: number[] | undefined, now: number): boolean {
    if (!matrix || matrix.length !== 16 || !matrix.every(Number.isFinite)) return false;
    // Compare rotation only: translation/face size must not look like a nod.
    const rotation = [0, 1, 2, 4, 5, 6, 8, 9, 10].map(i => matrix[i]);
    for (let column = 0; column < 3; column++) {
      const start = column * 3;
      const length = Math.hypot(...rotation.slice(start, start + 3));
      if (length < 0.001) return false;
      for (let i = start; i < start + 3; i++) rotation[i] /= length;
    }
    const moving = this.poseAnchor?.some((v, i) => Math.abs(v - rotation[i]) > 0.07);
    if (!this.poseAnchor || moving || now - this.poseAnchorAt >= 150) {
      this.poseAnchor = rotation;
      this.poseAnchorAt = now;
    }
    // About 35 degrees off camera: the far eye is no longer reliable.
    if (moving || rotation[8] < 0.82) this.settleUntil = now + 150;
    return now >= this.settleUntil;
  }

  public update(ear: number, now: number, result: FaceLandmarkerResult, faceIndex = 0): EyeState {
    if (now - this.lastFrameAt > 200) this.interrupt();
    this.lastFrameAt = now;
    const categories = result.faceBlendshapes[faceIndex]?.categories ?? [];
    const score = (name: string) => categories.find(c => c.categoryName === name)?.score;
    const left = score("eyeBlinkLeft"), right = score("eyeBlinkRight");
    const downLeft = score("eyeLookDownLeft"), downRight = score("eyeLookDownRight");
    const poseValid = this.stablePose(result.facialTransformationMatrixes[faceIndex]?.data, now);
    const validEyes = [left, right, downLeft, downRight]
      .every(v => v !== undefined && Number.isFinite(v));
    const validEar = Number.isFinite(ear) && ear > 0 && ear < 0.65;

    // Collect across interruptions; small movements must not restart calibration.
    if (!this.calibrated) {
      if (validEar && validEyes) {
        this.calibrationStartedAt ??= now;
        this.calibrationFrames.push(ear);
        this.calibrationBlinks.push(Math.max(left!, right!));
        this.calibrationGaze.push(Math.max(downLeft!, downRight!));
      }
      const elapsed = now - (this.calibrationStartedAt ?? now);
      if (this.calibrationFrames.length &&
          ((elapsed >= 900 && this.calibrationFrames.length >= 20) || elapsed >= 2800)) {
        this.baselineEAR = percentile(this.calibrationFrames, 0.8);
        this.restingBlink = Math.min(0.35, percentile(this.calibrationBlinks, 0.3));
        this.restingGaze = Math.min(0.5, percentile(this.calibrationGaze, 0.5));
        this.partialThreshold = this.baselineEAR * 0.84;
        this.fullThreshold = this.baselineEAR * 0.78;
        this.calibrated = true;
        this.calibrationFrames = this.calibrationBlinks = this.calibrationGaze = [];
      }
      return this.interrupt();
    }
    if (!poseValid || !validEar || !validEyes) return this.interrupt();

    // Gaze scores can rise during a real blink: reject clear downward gaze,
    // not every small change. Require an EAR drop plus BOTH blink scores.
    if (Math.max(downLeft!, downRight!) > Math.max(0.65, this.restingGaze + 0.25)) {
      return this.interrupt();
    }
    const closed = ear <= this.fullThreshold &&
      Math.min(left!, right!) >= this.restingBlink + 0.2;
    const open = ear >= this.baselineEAR * 0.88 &&
      Math.max(left!, right!) <= this.restingBlink + 0.15;

    // Require stable open eyes before accepting another closure.
    if (!this.armed) {
      this.openSince = open ? (this.openSince || now) : 0;
      if (this.openSince && now - this.openSince >= 100) this.armed = true;
      return this.currentState;
    }

    if (!this.eyeWasClosed && closed) {
      this.eyeWasClosed = true;
      this.closedAt = now;
      this.currentState = EyeState.FULLY_CLOSED;
      return this.currentState;
    }

    if (this.eyeWasClosed) {
      if (open) {
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
        this.currentState = closed
          ? EyeState.FULLY_CLOSED
          : EyeState.PARTIAL_CLOSED;
      }
      return this.currentState;
    }

    this.currentState = !open
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
