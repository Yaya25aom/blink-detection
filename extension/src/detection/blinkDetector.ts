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
  private readonly CALIBRATION_FRAME_COUNT = 60;
  private recentEar: number[] = [];
  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;
  private reopenThreshold = 0;
  private calibrated = false;
  private currentState: EyeState = EyeState.OPEN;
  private blinkCount = 0;
  private closedFrameCount = 0;
  private reopenFrameCount = 0;
  private sawFullClosure = false;
  private openStableFrames = 4;
  private readonly MIN_CLOSED_FRAMES = 2;
  private readonly MAX_CLOSED_FRAMES = 14;
  private readonly REQUIRED_REOPEN_FRAMES = 2;

  public update(ear: number): EyeState {
    if (!Number.isFinite(ear) || ear <= 0.06 || ear >= 0.6) return this.currentState;

    this.recentEar.push(ear);
    if (this.recentEar.length > 3) this.recentEar.shift();
    const smoothedEar = percentile(this.recentEar, 0.5);

    if (!this.calibrated) {
      this.calibrationFrames.push(smoothedEar);
      if (this.calibrationFrames.length >= this.CALIBRATION_FRAME_COUNT) {
        // The upper percentile estimates this user's naturally open eye.
        this.baselineEAR = percentile(this.calibrationFrames, 0.8);
        this.partialThreshold = this.baselineEAR * 0.80;
        this.fullThreshold = this.baselineEAR * 0.72;
        this.reopenThreshold = this.baselineEAR * 0.86;
        this.calibrated = true;
      }
      return EyeState.OPEN;
    }

    if (smoothedEar <= this.fullThreshold) {
      this.currentState = EyeState.FULLY_CLOSED;
    } else if (smoothedEar < this.reopenThreshold) {
      this.currentState = EyeState.PARTIAL_CLOSED;
    } else {
      this.currentState = EyeState.OPEN;
    }

    if (this.currentState !== EyeState.OPEN) {
      this.reopenFrameCount = 0;
      if (this.openStableFrames >= 3) {
        if (this.currentState === EyeState.FULLY_CLOSED) this.sawFullClosure = true;
        this.closedFrameCount++;
      }
      return this.currentState;
    }

    this.openStableFrames++;
    if (this.closedFrameCount > 0) {
      this.reopenFrameCount++;
      if (this.reopenFrameCount >= this.REQUIRED_REOPEN_FRAMES) {
        if (
          this.closedFrameCount >= this.MIN_CLOSED_FRAMES &&
          this.closedFrameCount <= this.MAX_CLOSED_FRAMES &&
          this.sawFullClosure
        ) {
          this.blinkCount++;
        }
        // A held closure is discarded and resets once only after a real reopen.
        this.closedFrameCount = 0;
        this.reopenFrameCount = 0;
        this.sawFullClosure = false;
        this.openStableFrames = 0;
      }
    }

    return this.currentState;
  }

  public getBlinkCount() { return this.blinkCount; }
  public getCurrentState() { return this.currentState; }
  public isCalibrated() { return this.calibrated; }
  public getBaselineEAR() { return this.baselineEAR; }
  public getPartialThreshold() { return this.partialThreshold; }
  public getFullThreshold() { return this.fullThreshold; }
}
