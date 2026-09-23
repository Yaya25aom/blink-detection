import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * Landmark Index สำหรับคำนวณ EAR
 * (MediaPipe Face Mesh)
 */

// ตาซ้าย
const LEFT_EYE_INDEX = [
  33,
  160,
  158,
  133,
  153,
  144,
];

// ตาขวา
const RIGHT_EYE_INDEX = [
  362,
  385,
  387,
  263,
  373,
  380,
];

export interface EyeLandmarks {
  leftEye: NormalizedLandmark[];
  rightEye: NormalizedLandmark[];
}

/**
 * ดึง Landmark ของดวงตา
 */
export function extractEyeLandmarks(
  face: NormalizedLandmark[]
): EyeLandmarks {

  const leftEye = LEFT_EYE_INDEX.map(index => face[index]);

  const rightEye = RIGHT_EYE_INDEX.map(index => face[index]);

  return {
    leftEye,
    rightEye,
  };
}