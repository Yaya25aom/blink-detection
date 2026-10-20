import { createLandmarker } from "../../extension/src/detection/createLandmarker";

let loading: ReturnType<typeof createLandmarker> | null = null;

export function createFaceDetector() {
  return loading ??= createLandmarker(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
  ).catch(error => { loading = null; throw error; });
}

export async function detectFace(video: HTMLVideoElement | VideoFrame) {
  if (!loading) return null;
  if ("readyState" in video && (video.readyState < 2 || !video.videoWidth || !video.videoHeight)) return null;
  const detector = await loading;
  return detector.detectForVideo(video, performance.now());
}
