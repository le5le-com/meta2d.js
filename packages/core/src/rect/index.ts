import { TopologyPen } from '../pen';
import { Point, rotatePoint } from '../point';

export interface Rect {
  x: number;
  y: number;
  ex?: number;
  ey?: number;
  width?: number;
  height?: number;
  rotate?: number;
  center?: Point;
}

export function pointInRect(pt: Point, rect: Rect) {
  if (!rect) {
    return;
  }
  if (rect.ex == null) {
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;
  }

  if (!rect.rotate || rect.width < 20 || rect.height < 20 || rect.rotate % 360 === 0) {
    return pt.x > rect.x && pt.x < rect.ex && pt.y > rect.y && pt.y < rect.ey;
  }

  if (!rect.center) {
    calcCenter(rect);
  }

  const pts: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.ex, y: rect.y },
    { x: rect.ex, y: rect.ey },
    { x: rect.x, y: rect.ey },
  ];
  pts.forEach((item: Point) => {
    rotatePoint(item, rect.rotate, rect.center);
  });

  return pointInVertices(pt, pts);
}

export function calcCenter(rect: Rect) {
  if (!rect.center) {
    rect.center = {} as Rect;
  }
  rect.center.x = rect.x + rect.width / 2;
  rect.center.y = rect.y + rect.height / 2;
}

export function pointInVertices(point: { x: number; y: number; }, vertices: Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  let isIn = false;
  let last = vertices[vertices.length - 1];
  for (const item of vertices) {
    if (((last.y > point.y) !== (item.y > point.y))) {
      if (item.x + ((point.y - item.y) * (last.x - item.x)) / (last.y - item.y) > point.x) {
        isIn = !isIn;
      }
    }

    last = item;
  }

  return isIn;
}

export function getRect(pens: TopologyPen[] | Map<TopologyPen, number>) {
  const points: Point[] = [];
  pens.forEach((pen, pen2) => {
    if (pen2.calculative) {
      pen = pen2;
    }
    const rect = pen.calculative.worldRect;
    if (rect) {
      const pts = rectToPoints(rect);
      pts.forEach((pt) => {
        rotatePoint(pt, pen.calculative.worldRotate, rect.center);
      });

      points.push(...pts);
    }
  });

  const rect = getRectOfPoints(points);
  calcCenter(rect);
  return rect;
}

export function rectToPoints(rect: Rect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.ex, y: rect.y },
    { x: rect.ex, y: rect.ey },
    { x: rect.x, y: rect.ey },
  ];
}

export function getRectOfPoints(points: Point[]) {
  let x = Infinity;
  let y = Infinity;
  let ex = -Infinity;
  let ey = -Infinity;

  points.forEach((item) => {
    x = Math.min(x, item.x);
    y = Math.min(y, item.y);
    ex = Math.max(ex, item.x);
    ey = Math.max(ey, item.y);
  });
  return { x, y, ex, ey, width: ex - x, height: ey - y };
}

export function rectInRect(source: Rect, target: Rect) {
  return (
    (source.x > target.x && source.x < target.ex && source.y > target.y && source.y < target.ey) ||
    (source.ex > target.x && source.ex < target.ex && source.y > target.y && source.y < target.ey) ||
    (source.ex > target.x && source.ex < target.ex && source.ey > target.y && source.ey < target.ey) ||
    (source.x > target.x && source.x < target.ex && source.ey > target.y && source.ey < target.ey)
  );
}
