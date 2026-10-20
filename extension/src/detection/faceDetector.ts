import { createLandmarker } from "./createLandmarker";

let loading: ReturnType<typeof createLandmarker> | null = null;

export function createFaceDetector() {
  return loading ??= createLandmarker(
    chrome.runtime.getURL("mediapipe/wasm"),
    chrome.runtime.getURL("models/face_landmarker.task"),
  ).catch(error => { loading = null; throw error; });
}

export async function detectFace(video: HTMLVideoElement) {
  if (!loading || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const detector = await loading;
  return detector.detectForVideo(video, performance.now());
}
