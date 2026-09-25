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
  private readonly CALIBRATION_FRAME_COUNT = 45;
  private smoothedEar = 0;
  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;
  private reopenThreshold = 0;
  private calibrated = false;
  private currentState: EyeState = EyeState.OPEN;
  private blinkCount = 0;
  private closeCandidateFrames = 0;
  private reopenCandidateFrames = 0;
  private closureStartedAt = 0;
  private closureConfirmed = false;
  private readonly MIN_CLOSED_MS = 45;
  private readonly MAX_CLOSED_MS = 1_200;

  public update(ear: number, now = performance.now()): EyeState {
    if (!Number.isFinite(ear) || ear <= 0.04 || ear >= 0.65) return this.currentState;

    // A responsive EMA removes single-frame landmark noise without swallowing
    // a normal 100-150 ms blink like a wide median window can.
    this.smoothedEar = this.smoothedEar === 0
      ? ear
      : this.smoothedEar * 0.25 + ear * 0.75;

    if (!this.calibrated) {
      this.calibrationFrames.push(this.smoothedEar);
      if (this.calibrationFrames.length >= this.CALIBRATION_FRAME_COUNT) {
        this.baselineEAR = percentile(this.calibrationFrames, 0.85);
        this.partialThreshold = this.baselineEAR * 0.84;
        this.fullThreshold = this.baselineEAR * 0.76;
        this.reopenThreshold = this.baselineEAR * 0.89;
        this.calibrated = true;
      }
      return EyeState.OPEN;
    }

    if (!this.closureConfirmed) {
      if (this.smoothedEar <= this.fullThreshold) {
        if (this.closeCandidateFrames === 0) this.closureStartedAt = now;
        this.closeCandidateFrames++;
        if (this.closeCandidateFrames >= 2 || now - this.closureStartedAt >= this.MIN_CLOSED_MS) {
          this.closureConfirmed = true;
          this.currentState = EyeState.FULLY_CLOSED;
          this.reopenCandidateFrames = 0;
        }
      } else {
        this.closeCandidateFrames = 0;
        this.closureStartedAt = 0;
        this.currentState = this.smoothedEar <= this.partialThreshold
          ? EyeState.PARTIAL_CLOSED
          : EyeState.OPEN;
      }
      return this.currentState;
    }

    const closedDuration = now - this.closureStartedAt;
    if (this.smoothedEar >= this.reopenThreshold) {
      this.reopenCandidateFrames++;
      if (this.reopenCandidateFrames >= 2) {
        if (closedDuration >= this.MIN_CLOSED_MS && closedDuration <= this.MAX_CLOSED_MS) {
          this.blinkCount++;
        }
        this.currentState = EyeState.OPEN;
        this.closureConfirmed = false;
        this.closeCandidateFrames = 0;
        this.reopenCandidateFrames = 0;
        this.closureStartedAt = 0;
      }
    } else {
      this.reopenCandidateFrames = 0;
      this.currentState = this.smoothedEar <= this.fullThreshold
        ? EyeState.FULLY_CLOSED
        : EyeState.PARTIAL_CLOSED;
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
