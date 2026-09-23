export const EyeState = {
  OPEN: "OPEN",
  PARTIAL_CLOSED: "PARTIAL_CLOSED",
  FULLY_CLOSED: "FULLY_CLOSED",
} as const;

export type EyeState =
  (typeof EyeState)[keyof typeof EyeState];

export class BlinkDetector {

  // ===========================
  // Calibration
  // ===========================

  private calibrationFrames: number[] = [];
  private readonly CALIBRATION_FRAME_COUNT = 90;

  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;

  private calibrated = false;

  // ===========================
  // Blink
  // ===========================

  private currentState: EyeState = EyeState.OPEN;

  private blinkCount = 0;

  // ใช้ป้องกันการนับซ้ำ
  private eyeWasClosed = false;
  private closedFrameCount = 0;
  private readonly MIN_CLOSED_FRAMES = 1;
  private readonly MAX_CLOSED_FRAMES = 12;

  public update(ear: number): EyeState {

    // ===========================
    // Calibration
    // ===========================

    if (!this.calibrated) {

      if (ear > 0.15) {
        this.calibrationFrames.push(ear);
      }

      if (
        this.calibrationFrames.length >=
        this.CALIBRATION_FRAME_COUNT
      ) {

        const sum =
          this.calibrationFrames.reduce(
            (a, b) => a + b,
            0
          );

        this.baselineEAR =
          sum / this.calibrationFrames.length;

        this.partialThreshold =
          Math.max(this.baselineEAR * 0.78, 0.2);

        this.fullThreshold =
          Math.max(this.baselineEAR * 0.55, 0.14);

        this.calibrated = true;

        console.log("Calibration Complete");
        console.log("Baseline:", this.baselineEAR);
      }

      return EyeState.OPEN;
    }

    // ===========================
    // Eye State
    // ===========================

    if (ear <= this.fullThreshold) {

      this.currentState = EyeState.FULLY_CLOSED;

    } else if (ear <= this.partialThreshold) {

      this.currentState = EyeState.PARTIAL_CLOSED;

    } else {

      this.currentState = EyeState.OPEN;

    }

    // ===========================
    // Blink Detection
    // ===========================

    if (
      this.currentState === EyeState.PARTIAL_CLOSED ||
      this.currentState === EyeState.FULLY_CLOSED
    ) {
      this.eyeWasClosed = true;
      this.closedFrameCount++;
    }

    if (
      this.currentState === EyeState.OPEN &&
      this.eyeWasClosed
    ) {

      if (
        this.closedFrameCount >= this.MIN_CLOSED_FRAMES &&
        this.closedFrameCount <= this.MAX_CLOSED_FRAMES
      ) {
        this.blinkCount++;

        console.log("Blink:", this.blinkCount);
      }

      this.eyeWasClosed = false;
      this.closedFrameCount = 0;

    }

    return this.currentState;

  }
  // ===========================
  // Getter
  // ===========================

  public getBlinkCount() {
    return this.blinkCount;
  }

  public getCurrentState() {
    return this.currentState;
  }

  public isCalibrated() {
    return this.calibrated;
  }

  public getBaselineEAR() {
    return this.baselineEAR;
  }

  public getPartialThreshold() {
    return this.partialThreshold;
  }

  public getFullThreshold() {
    return this.fullThreshold;
  }

}
