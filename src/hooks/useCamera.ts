import { useRef, useState } from "react";
import { CAMERA_CONFIG } from "../utils/constants";
// file เปิดและจัดการกล้องทุกอย่าง
export default function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameraOn, setCameraOn] = useState(false);
  
  // กดปุ่มเริ่มการตรวจจับคือเปิดกล้อง
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { //กำหนดคุณภาพ ต้องการภาพขนาด 640x480 ที่ 30 FPS
            width: { ideal: CAMERA_CONFIG.width },
            height: { ideal: CAMERA_CONFIG.height },
            frameRate: { ideal: CAMERA_CONFIG.frameRate },
            facingMode: "user",
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];

      console.log("Camera Settings");
      console.log(track.getSettings());

      console.log("Camera Capabilities");
      console.log(track.getCapabilities());
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraOn(true);
    } catch (error) {
      console.error("Cannot open camera", error);
      setCameraOn(false);
    }
  };
  //หยุดกล้องปิดการตรวจจับ
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;

      stream.getTracks().forEach((track) => track.stop());

      videoRef.current.srcObject = null;
    }

    setCameraOn(false);
  };

  return {
    videoRef,
    cameraOn,
    startCamera,
    stopCamera
  };
}