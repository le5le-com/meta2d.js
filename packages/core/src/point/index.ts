
export interface Point {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  background?: string;
  id?: number | string;
  penId?: string;
}

export function rotatePoint(pt: Point, angle: number, center: Point) {
  if (!angle || angle % 360 === 0) {
    return;
  }

  angle *= Math.PI / 180;
  const x = (pt.x - center.x) * Math.cos(angle) - (pt.y - center.y) * Math.sin(angle) + center.x;
  const y = (pt.x - center.x) * Math.sin(angle) + (pt.y - center.y) * Math.cos(angle) + center.y;
  pt.x = x;
  pt.y = y;
}

export function hitPoint(pt: Point, target: Point, radius = 5) {
  return pt.x > target.x - radius && pt.x < target.x + radius && pt.y > target.y - radius && pt.y < target.y + radius;
}
