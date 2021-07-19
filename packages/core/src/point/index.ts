
export interface Point {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  background?: string;
  id?: number | string;
  penId?: string;
  custom?: boolean;
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

export function scalePoint(pt: Point, scale: number, center: Point) {
  pt.x = center.x - (center.x - pt.x) * scale;
  pt.y = center.y - (center.y - pt.y) * scale;
}

export function calcRotate(pt: Point, center: Point) {
  if (pt.x === center.x) {
    return pt.y <= center.y ? 0 : 180;
  }

  if (pt.y === center.y) {
    return pt.x < center.x ? 270 : 90;
  }

  const x = pt.x - center.x;
  const y = pt.y - center.y;
  let angle = (Math.atan(Math.abs(x / y)) / (2 * Math.PI)) * 360;
  if (x > 0 && y > 0) {
    angle = 180 - angle;
  } else if (x < 0 && y > 0) {
    angle += 180;
  } else if (x < 0 && y < 0) {
    angle = 360 - angle;
  }

  return angle;
}

export function calcDistance(pt1: Point, pt2: Point): number {
  return Math.sqrt(Math.pow(Math.abs(pt1.x - pt2.x), 2) + Math.pow(Math.abs(pt1.y - pt2.y), 2));
}
