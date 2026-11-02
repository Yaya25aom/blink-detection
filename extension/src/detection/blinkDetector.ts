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
  private restingBlink = 0;
  private baselineEAR = 0;
  private partialThreshold = 0;
  private fullThreshold = 0;
  private calibrated = false;
  private lastOpenGaze: number | null = null;
  private openCandidateEAR = 0;
  private openCandidateAt = 0;
  private currentState: EyeState = EyeState.OPEN;
  private blinkCount = 0;
  private eyeWasClosed = false;
  private closedAt = 0;
  private lastFrameAt = 0;
  private closedFrames = 0;
  private closureCounted = false;
  private armed = false;
  private poseAnchor: number[] | null = null;
  private poseAnchorAt = 0;
  private settleUntil = 0;

  // Keep the total, but never join a blink across missing/invalid frames.
  public interrupt(): EyeState {
    this.eyeWasClosed = false;
    this.armed = false;
    this.closedFrames = 0;
    this.closureCounted = false;
    this.openCandidateAt = 0;
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
    // Reject movement artifacts, not a fixed head angle. A settled downward or
    // sideways view is usable when both eyes are still visible.
    if (moving) this.settleUntil = now + 100;
    return now >= this.settleUntil;
  }

  private eyesVisible(result: FaceLandmarkerResult, index: number): boolean {
    const face = result.faceLandmarks[index];
    const eyes = [[33, 160, 158, 133, 153, 144], [362, 385, 387, 263, 373, 380]];
    if (!face || eyes.flat().some(i => !face[i] ||
      !Number.isFinite(face[i].x) || !Number.isFinite(face[i].y) ||
      face[i].x < 0 || face[i].x > 1 || face[i].y < 0 || face[i].y > 1)) return false;
    const widths = eyes.map(([a, , , b]) => Math.hypot(face[a].x - face[b].x, face[a].y - face[b].y));
    return Math.min(...widths) >= 0.008 && Math.min(...widths) / Math.max(...widths) >= 0.2;
  }

  public update(ear: number, now: number, result: FaceLandmarkerResult, faceIndex = 0): EyeState {
    if (now - this.lastFrameAt > 200) this.interrupt();
    this.lastFrameAt = now;
    const categories = result.faceBlendshapes[faceIndex]?.categories ?? [];
    const score = (name: string) => {
      const value = categories.find(c => c.categoryName === name)?.score;
      return Number.isFinite(value) ? value! : 0;
    };
    const left = score("eyeBlinkLeft"), right = score("eyeBlinkRight");
    const downLeft = score("eyeLookDownLeft"), downRight = score("eyeLookDownRight");
    const poseValid = this.stablePose(result.facialTransformationMatrixes[faceIndex]?.data, now);
    const validEyes = this.eyesVisible(result, faceIndex);
    const validEar = Number.isFinite(ear) && ear >= 0 && ear < 0.65;
    // Deep closure is direct eye geometry evidence. Auxiliary model scores and
    // head/gaze filters must not veto it (e.g. baseline .390, EAR .020).
    const deepClosure = this.calibrated && ear <= this.baselineEAR * 0.45;

    // Collect across interruptions; small movements must not restart calibration.
    if (!this.calibrated) {
      if (validEar && ear > 0.04 && validEyes) {
        this.calibrationStartedAt ??= now;
        this.calibrationFrames.push(ear);
        this.calibrationBlinks.push(Math.max(left!, right!));
      }
      const elapsed = now - (this.calibrationStartedAt ?? now);
      if (this.calibrationFrames.length &&
          ((elapsed >= 900 && this.calibrationFrames.length >= 20) || elapsed >= 2800)) {
        this.baselineEAR = percentile(this.calibrationFrames, 0.8);
        this.restingBlink = Math.min(0.35, percentile(this.calibrationBlinks, 0.3));
        this.partialThreshold = this.baselineEAR * 0.84;
        this.fullThreshold = this.baselineEAR * 0.78;
        this.calibrated = true;
        this.calibrationFrames = this.calibrationBlinks = [];
      }
      return this.interrupt();
    }
    if (!validEar || !validEyes) return this.interrupt();
    // A pose rejection is not an eye reopening. Preserve the latch so the
    // next clearly closed frame can count, without counting a held closure twice.
    if (!poseValid && !deepClosure) return this.currentState;

    const blink = Math.min(left!, right!);
    const closed = deepClosure || blink >= 0.65 ||
      (ear <= this.fullThreshold && blink >= this.restingBlink + 0.2);
    const fullyOpen = !closed && (
      Math.max(left!, right!) <= this.restingBlink + 0.15 ||
      (ear >= this.baselineEAR * 0.88 && blink < this.restingBlink + 0.2));

    const open = fullyOpen || (this.eyeWasClosed && !closed &&
      ear >= this.baselineEAR * 0.88 && Math.max(left!, right!) <= this.restingBlink + 0.35);

    const gaze = Math.max(downLeft!, downRight!);
  
    if (closed && !deepClosure && this.lastOpenGaze !== null && Math.abs(gaze - this.lastOpenGaze) > 0.25) {
      return this.interrupt();
    }
    if (fullyOpen) {
      this.lastOpenGaze = gaze;

      if (ear >= this.baselineEAR * 0.95) {
        this.baselineEAR += (ear - this.baselineEAR) * 0.1;
        this.openCandidateAt = 0;
      } else if (!this.openCandidateAt || Math.abs(ear - this.openCandidateEAR) > this.baselineEAR * 0.05) {
        this.openCandidateEAR = ear;
        this.openCandidateAt = now;
      } else if (now - this.openCandidateAt >= 200) {
        this.baselineEAR = ear;
        this.openCandidateAt = 0;
      }
      this.partialThreshold = this.baselineEAR * 0.84;
      this.fullThreshold = this.baselineEAR * 0.78;
    }

    // 1
    // One confirmed open frame arms detection; no extra delay between blinks.
    if (!this.armed) { //ยังไม่พร้อมตรวจการปิดตา armed = พร้อมรับการปิดตาครั้งใหม่หรือยัง เลยดูเฟรมนี้ว่าตาเปิดมั้ย
      this.armed = open; // ถ้าเฟรมนี้ตาเปิด armed = true พร้อมรับการปิดตาครั้งใหม่
      return this.currentState;
    }

    // 2
    if (closed) this.openCandidateAt = 0;
    // เริ่มติดตามการปิดตา
    if (!this.eyeWasClosed && closed) {
      this.eyeWasClosed = true; // เริ่มติดตามการปิดตา
      this.closedAt = now; //จำเวลาที่เริ่มปิด
      this.closedFrames = 0; // นับจำนวนเฟรมที่ปิด
      this.closureCounted = false; // รีเซ็ตการนับการปิดตา
    }
    // 3
    if (this.eyeWasClosed) {
      // นับจำนวนเฟรมที่ตาปิด จากนั้นไปตรวจเงื่อนไขก่อนนับปิดจริงๆ โค้ดข้างล่าง
      if (closed) {
        this.closedFrames++;
      }
      const strong = blink >= 0.65 || (closed && ear <= this.baselineEAR * 0.65);

      // 3.1
      // ตรวจเงื่อนไขก่อนนับตาปิดจริงๆ //closed บอกว่าเฟรมนี้ตาปิด //closureCounted การปิดรอบนี้ยังไม่เคยนับ
      if (closed && !this.closureCounted && (strong || this.closedFrames >= 2) && //หลักฐานการปิดตาชัดมา หรือว่าเห็นตาปิดอย่างน้อย 2 เฟรม
          now - this.closedAt <= 500) { // ยังอยู่ในภายใน 500มิลลิวินาทีนับจากเริ่มปิด
        this.blinkCount++; //ถ้าผ่านทั้งหมด มันจะนับ blinkcount = 1 และ closureCounted = true เพื่อไม่ให้นับซ้ำ
        this.closureCounted = true;
      }
    // 4
      if (open) { // เฟรมถัดมาพบว่าลืมตาแล้ว จะรีเซ็ต eyeWasClosed = false เพื่อเริ่มนับใหม่
        this.armed = true; 
        this.eyeWasClosed = false; // ตาลืมแล้วระบบเปลี่ยนเป็น false
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
