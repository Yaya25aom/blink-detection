import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export async function createLandmarker(wasmPath: string, modelAssetPath: string) {
  const vision = await FilesetResolver.forVisionTasks(wasmPath);
  const create = (delegate: "GPU" | "CPU") => FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  try {
    return await create("GPU");
  } catch (error) {
    console.warn("GPU detection unavailable; using CPU", error);
    return create("CPU");
  }
}
