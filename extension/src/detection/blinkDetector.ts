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
  private readonly MAX_CLOSURE_MS = 1_500;

  public update(ear: number, now = performance.now()): EyeState {
    if (!Number.isFinite(ear) || ear <= 0.04 || ear >= 0.65) return this.currentState;

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

    if (!this.eyeWasClosed && ear <= this.fullThreshold) {
      this.eyeWasClosed = true;
      this.closedAt = now;
      this.currentState = EyeState.FULLY_CLOSED;
      return this.currentState;
    }

    if (this.eyeWasClosed) {
      if (ear >= this.reopenThreshold) {
        if (now - this.closedAt <= this.MAX_CLOSURE_MS) this.blinkCount++;
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
