import {
    FaceLandmarker,
    FilesetResolver,
} from "@mediapipe/tasks-vision";

import type {
    FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

let faceLandmarker: FaceLandmarker | null = null;

/**
 * โหลดโมเดล MediaPipe
 */
export async function createFaceDetector() {

    if (faceLandmarker) return faceLandmarker;

    const vision = await FilesetResolver.forVisionTasks(

        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"

    );

    faceLandmarker = await FaceLandmarker.createFromOptions(
        vision,
        {

            baseOptions: {

                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",

            },

            runningMode: "VIDEO",

            numFaces: 5, // ตรวจหลายใบหน้า

        }
    );

    return faceLandmarker;
}

/**
 * ตรวจจับใบหน้า
 */

export async function detectFace(

    video: HTMLVideoElement

): Promise<FaceLandmarkerResult | null> {

    if (!faceLandmarker) return null;
    // ==========================
  // ตรวจสอบ Video
  // ==========================

    if (
        video.readyState < 2 ||
        video.videoWidth <= 0 ||
        video.videoHeight <= 0
    ) {
        return null;
    }


    return faceLandmarker.detectForVideo(

        video,

        performance.now()

    );

}