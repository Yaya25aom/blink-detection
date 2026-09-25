import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

let faceLandmarker: FaceLandmarker | null = null;

/**
 * โหลดโมเดล MediaPipe
 */
export async function createFaceDetector() {
    if (faceLandmarker) return faceLandmarker;

    console.log("[MediaPipe] 1. Preparing WASM");

    const wasmPath = chrome.runtime.getURL("mediapipe/wasm");

    console.log("[MediaPipe] 2. WASM path:", wasmPath);

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    console.log("[MediaPipe] 3. WASM loaded");

    const modelPath = chrome.runtime.getURL(
        "models/face_landmarker.task"
    );

    console.log("[MediaPipe] 4. Model path:", modelPath);
    console.log("[MediaPipe] 5. Creating FaceLandmarker with CPU...");

    faceLandmarker = await FaceLandmarker.createFromOptions(
        vision,
        {
            baseOptions: {
                modelAssetPath: modelPath,
                delegate: "CPU",
            },

            runningMode: "VIDEO",
            numFaces: 1,
        }
    );

    console.log("[MediaPipe] 6. FaceLandmarker created successfully");

    return faceLandmarker;
}

/**
 * ตรวจจับใบหน้า
 */

export async function detectFace(
  video: HTMLVideoElement,
): Promise<FaceLandmarkerResult | null> {
  if (!faceLandmarker) return null;
  // ==========================
  // ตรวจสอบ Video
  // ==========================

  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }

  return faceLandmarker.detectForVideo(
    video,

    performance.now(),
  );
}
