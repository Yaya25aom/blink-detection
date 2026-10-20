type FrameHandler = (frame: VideoFrame | HTMLVideoElement, time: number) => Promise<void>;
type TrackProcessor = new (options: { track: MediaStreamTrack; maxBufferSize: number }) => {
  readable: ReadableStream<VideoFrame>;
};

// Read the camera directly: a hidden offscreen document must not rely on paint
// callbacks or throttled timers. Keep only the newest frame when inference is slow.
export function startCameraFrames(video: HTMLVideoElement, onFrame: FrameHandler, onError: (error: unknown) => void) {
  const Processor = (globalThis as typeof globalThis & { MediaStreamTrackProcessor?: TrackProcessor }).MediaStreamTrackProcessor;
  const source = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
  let stopped = false;
  let reader: ReadableStreamDefaultReader<VideoFrame> | undefined;
  let track: MediaStreamTrack | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastVideoTime = -1;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    void reader?.cancel().catch(() => {});
    track?.stop();
  };
  if (Processor && source) {
    try {
      track = source.clone();
      reader = new Processor({ track, maxBufferSize: 1 }).readable.getReader();
    } catch (error) {
      track?.stop();
      console.warn("Direct camera frames unavailable; using video fallback", error);
    }
  }
  const run = async () => {
    try {
      if (reader) {
        while (!stopped) {
          const { value: frame, done } = await reader.read();
          if (done) break;
          try {
            if (!stopped) await onFrame(frame, performance.now());
          } finally {
            frame.close();
          }
        }
        reader.releaseLock();
        track?.stop();
      } else if (!stopped) {
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          await onFrame(video, performance.now());
        }
        if (!stopped) timer = setTimeout(() => void run(), 8);
      }
    } catch (error) {
      const report = !stopped;
      stop();
      if (report) onError(error);
    }
  };
  void run();
  return stop;
}
