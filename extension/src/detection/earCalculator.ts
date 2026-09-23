import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

/**
 * คำนวณค่า EAR ของดวงตา 1 ข้าง
 * จุดเรียงตาม:
 * p1 p2 p3 p4 p5 p6
 */
export function calculateEAR(
  eye: NormalizedLandmark[]
): number {

  const A = distance(eye[1], eye[5]);
  const B = distance(eye[2], eye[4]);
  const C = distance(eye[0], eye[3]);

  return (A + B) / (2 * C);
}

/**
 * EAR เฉลี่ยของสองตา
 */
export function calculateAverageEAR(
  leftEye: NormalizedLandmark[],
  rightEye: NormalizedLandmark[]
): number {

  const leftEAR = calculateEAR(leftEye);
  const rightEAR = calculateEAR(rightEye);

  return (leftEAR + rightEAR) / 2;
}