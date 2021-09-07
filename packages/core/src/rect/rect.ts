import { Pen } from '../pen';
import { Point, rotatePoint, scalePoint } from '../point';

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

export function pointInSimpleRect(pt: Point, rect: Rect, r = 0) {
  const { x, y, ex, ey } = rect;
  return pt.x >= x - r && pt.x <= ex + r && pt.y >= y - r && pt.y <= ey + r;
}

export function calcCenter(rect: Rect) {
  if (!rect.center) {
    rect.center = {} as Rect;
  }
  rect.center.x = rect.x + rect.width / 2;
  rect.center.y = rect.y + rect.height / 2;
}

export function pointInVertices(point: { x: number; y: number }, vertices: Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  let isIn = false;
  let last = vertices[vertices.length - 1];
  for (const item of vertices) {
    if (last.y > point.y !== item.y > point.y) {
      if (item.x + ((point.y - item.y) * (last.x - item.x)) / (last.y - item.y) > point.x) {
        isIn = !isIn;
      }
    }

    last = item;
  }

  return isIn;
}

export function getRect(pens: Pen[]) {
  const points: Point[] = [];
  pens.forEach((pen) => {
    const rect = pen.calculative.worldRect;
    if (rect) {
      const pts = rectToPoints(rect);
      pts.forEach((pt) => {
        rotatePoint(pt, pen.rotate, rect.center);
      });

      points.push(...pts);
    }
  });

  const rect = getRectOfPoints(points);
  calcCenter(rect);
  return rect;
}

export function rectToPoints(rect: Rect) {
  const pts = [
    { x: rect.x, y: rect.y },
    { x: rect.ex, y: rect.y },
    { x: rect.ex, y: rect.ey },
    { x: rect.x, y: rect.ey },
  ];

  if (rect.rotate) {
    if (!rect.center) {
      calcCenter(rect);
    }
    pts.forEach((pt) => {
      rotatePoint(pt, rect.rotate, rect.center);
    });
  }
  return pts;
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
  return !(source.x > target.ex || source.ex < target.x || source.ey < target.y || source.y > target.ey);
}

export function translateRect(rect: Rect, x: number, y: number) {
  rect.x += x;
  rect.y += y;
  rect.ex += x;
  rect.ey += y;

  if (rect.center) {
    rect.center.x += x;
    rect.center.y += y;
  }
}

export function scaleRect(rect: Rect, scale: number, center: Point) {
  if (!rect) {
    return;
  }
  rect.width *= scale;
  rect.height *= scale;
  scalePoint(rect, scale, center);

  rect.ex = rect.x + rect.width;
  rect.ey = rect.y + rect.height;
  rect.center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function calcRelativeRect(rect: Rect, worldRect: Rect) {
  const relRect: Rect = {
    x: (rect.x - worldRect.x) / worldRect.width,
    y: (rect.y - worldRect.y) / worldRect.height,
    width: rect.width / worldRect.width,
    height: rect.height / worldRect.height,
  };
  relRect.ex = relRect.x + relRect.width;
  relRect.ey = relRect.y + relRect.height;

  return relRect;
}

export function calcRelativePoint(pt: Point, worldRect: Rect) {
  const point: Point = {
    id: pt.id,
    penId: pt.penId,
    connectTo: pt.connectTo,
    x: (pt.x - worldRect.x) / worldRect.width,
    y: (pt.y - worldRect.y) / worldRect.height,
  };
  if (pt.prev) {
    point.prev = {
      penId: pt.penId,
      connectTo: pt.connectTo,
      x: (pt.prev.x - worldRect.x) / worldRect.width,
      y: (pt.prev.y - worldRect.y) / worldRect.height,
    };
  }
  if (pt.next) {
    point.next = {
      penId: pt.penId,
      connectTo: pt.connectTo,
      x: (pt.next.x - worldRect.x) / worldRect.width,
      y: (pt.next.y - worldRect.y) / worldRect.height,
    };
  }
  return point;
}
