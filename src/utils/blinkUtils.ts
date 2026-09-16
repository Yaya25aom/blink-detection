// export type Point3D = {
//     x: number;
//     y: number;
//     z?: number;
//   };
  
//   function distance(a: Point3D, b: Point3D): number {
//     const dx = a.x - b.x;
//     const dy = a.y - b.y;
//     return Math.sqrt(dx * dx + dy * dy);
//   }
  
//   // EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
//   export function calculateEAR(
//     p1: Point3D,
//     p2: Point3D,
//     p3: Point3D,
//     p4: Point3D,
//     p5: Point3D,
//     p6: Point3D
//   ): number {
//     const vertical1 = distance(p2, p6);
//     const vertical2 = distance(p3, p5);
//     const horizontal = distance(p1, p4);
  
//     if (horizontal === 0) return 0;
//     return (vertical1 + vertical2) / (2 * horizontal);
//   }

export type Point3D = {
  x: number;
  y: number;
  z?: number;
};

function distance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateEAR(
  p1: Point3D,
  p2: Point3D,
  p3: Point3D,
  p4: Point3D,
  p5: Point3D,
  p6: Point3D
): number {
  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);

  if (horizontal === 0) return 0;

  return (vertical1 + vertical2) / (2 * horizontal);
}