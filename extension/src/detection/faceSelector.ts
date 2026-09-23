import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

/**
 * กำหนดน้ำหนัก
 * Area สำคัญกว่า Center
 */
const AREA_WEIGHT = 0.7;
const CENTER_WEIGHT = 0.3;

/**
 * เลือกใบหน้าหลัก
 *
 * หลักการ
 * 1. ใบหน้าที่ใหญ่กว่า = อยู่ใกล้กล้องกว่า
 * 2. ใบหน้าที่อยู่กึ่งกลางจอ = ได้คะแนนเพิ่ม
 */
export function selectPrimaryFace(
  faces: NormalizedLandmark[][]
): NormalizedLandmark[] | null {

  if (faces.length === 0) {
    return null;
  }

  let bestFace: NormalizedLandmark[] | null = null;
  let bestScore = -Infinity;

  for (const face of faces) {

    // -----------------------------
    // หา Bounding Box ของใบหน้า
    // -----------------------------
    const xs = face.map(point => point.x);
    const ys = face.map(point => point.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // -----------------------------
    // คำนวณขนาดใบหน้า
    // -----------------------------
    const width = maxX - minX;
    const height = maxY - minY;

    const area = width * height;

    // -----------------------------
    // คำนวณตำแหน่งกึ่งกลางใบหน้า
    // -----------------------------
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // -----------------------------
    // ระยะห่างจากกึ่งกลางจอ
    // (ค่าจะอยู่ประมาณ 0 - 0.7)
    // -----------------------------
    const distance = Math.sqrt(
      Math.pow(centerX - 0.5, 2) +
      Math.pow(centerY - 0.5, 2)
    );

    // -----------------------------
    // แปลงให้ยิ่งอยู่กลางจอ
    // ยิ่งได้คะแนนมาก
    // -----------------------------
    const centerScore = 1 - distance;

    // -----------------------------
    // คะแนนรวม
    // -----------------------------
    const score =
      (area * AREA_WEIGHT) +
      (centerScore * CENTER_WEIGHT);

    if (score > bestScore) {
      bestScore = score;
      bestFace = face;
    }
  }

  return bestFace;
}