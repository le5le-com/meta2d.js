import { Pen } from '../pen';
import { Point, rotatePoint, scalePoint } from '../point';

export interface Rect {
  x?: number;
  y?: number;
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
    rect.center = {} as Point;
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

export function getRect(pens: Pen[]): Rect {
  const points: Point[] = [];
  pens.forEach((pen) => {
    const rect = pen.calculative.worldRect;
    if (rect) {
      const pts = rectToPoints(rect);
      // rectToPoints 已经计算过 rotate 无需重复计算
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

export function getRectOfPoints(points: Point[]): Rect {
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

export function rectInRect(source: Rect, target: Rect, allIn?: boolean) {
  if (source.rotate) {
    // 根据 rotate 扩大 rect
    source = getRectOfPoints(rectToPoints(source)); // 更改 source 引用地址值，不影响原值
  }
  if (allIn) {
    return source.x > target.x && source.ex < target.ex && source.y > target.y && source.ey < target.ey;
  }
  return !(source.x > target.ex || source.ex < target.x || source.ey < target.y || source.y > target.ey);
}

export function translateRect(rect: Rect | Pen, x: number, y: number) {
  rect.x += x;
  rect.y += y;
  rect.ex += x;
  rect.ey += y;

  if (rect.center) {
    rect.center.x += x;
    rect.center.y += y;
  }
}


/**
 * 通过两条线段计算出相交的点
 * @param line1 线段1
 * @param line2 线段2
 */
function getIntersectPoint(line1: {from: Point, to: Point}, line2: {from: Point, to: Point}) : Point {
  const k1 = (line1.to.y - line1.from.y) / (line1.to.x - line1.from.x);
  const k2 = (line2.to.y - line2.from.y) / (line2.to.x - line2.from.x);
  return getIntersectPointByK(
    {
      k: k1,
      point: line1.from
    },
    {
      k: k2,
      point: line2.from
    }
  )
}

/**
 * 该方法作用同上，不过此方法需要传的是 斜率
 * @param line1 
 * @param line2 
 * @returns 
 */
function getIntersectPointByK(line1: {k: number, point: Point}, line2: {k: number, point: Point}): Point {
  const b1 = line1.point.y - (line1.k) * line1.point.x;
  const b2 = line2.point.y - (line2.k) * line2.point.x;
  const x = (b2 - b1) / (line1.k - line2.k);
  const y = line1.k * x + b1;
  
  return {
    x,
    y
  }
}

/**
 * 通过 4 个点和旋转角度，计算出原矩形（旋转前的矩形）
 * @param pts 4 个点
 * @param rotate 旋转角度
 */
function pointsToRect(pts: Point[], rotate: number): Rect {
  // 1. 计算 center，认为 0，2 ；1，3 的连线相交就是 center 点
  const center = getIntersectPoint(
    {
      from: pts[0],
      to: pts[2]
    },
    {
      from: pts[1],
      to: pts[3]
    });
  // 2. 把点反向转 rotate °
  for (const pt of pts) {
    rotatePoint(pt, -rotate, center);
  }
  // 3. 计算区域
  return getRectOfPoints(pts);
}

export function resizeRect(rect: Rect | Pen, offsetX: number, offsetY: number, resizeIndex: number) {
  if (rect.rotate) {
    // 计算出外边的四个点
    const pts = rectToPoints(rect);
    // 斜率不改变，提前计算
    const k1 = (pts[0].y - pts[1].y) / (pts[0].x - pts[1].x);
    const k2 = (pts[1].y - pts[2].y) / (pts[1].x - pts[2].x);
    // resize 的点
    pts[resizeIndex].x += offsetX;
    pts[resizeIndex].y += offsetY;
    // 不变的点
    const noChangePoint = pts[(resizeIndex + 2) % 4];
    // 由于斜率是不变的，我们只需要根据斜率 和 已知的两点求出相交的 另外两点
    pts[(resizeIndex + 1) % 4] = getIntersectPointByK({k: resizeIndex % 2 ? k2 : k1, point: pts[resizeIndex]}, {k: resizeIndex % 2 ? k1 : k2, point: noChangePoint});
    pts[(resizeIndex + 4 - 1) % 4] = getIntersectPointByK({k: resizeIndex % 2 ? k1 : k2, point: pts[resizeIndex]}, {k: resizeIndex % 2 ? k2 : k1, point: noChangePoint});
    if ((pts[0].x - pts[1].x) ** 2 + (pts[0].y - pts[1].y) ** 2 < 25
      || (pts[1].x - pts[2].x) ** 2 + (pts[1].y - pts[2].y) ** 2 < 25) {
        // 距离小于 5 不能继续 resize 了
        return;
    }
    const retRect = pointsToRect(pts, rect.rotate);
    calcCenter(retRect);
    Object.assign(rect, retRect);
    return;
  }
  switch (resizeIndex) {
    case 0:
      if (rect.width - offsetX < 5 || rect.height - offsetY < 5) {
        break;
      }
      rect.x += offsetX;
      rect.y += offsetY;
      rect.width -= offsetX;
      rect.height -= offsetY;
      break;
    case 1:
      if (rect.width + offsetX < 5 || rect.height - offsetY < 5) {
        break;
      }
      rect.ex += offsetX;
      rect.y += offsetY;
      rect.width += offsetX;
      rect.height -= offsetY;
      break;
    case 2:
      if (rect.width + offsetX < 5 || rect.height + offsetY < 5) {
        break;
      }
      rect.ex += offsetX;
      rect.ey += offsetY;
      rect.width += offsetX;
      rect.height += offsetY;
      break;
    case 3:
      if (rect.width - offsetX < 5 || rect.height + offsetY < 5) {
        break;
      }
      rect.x += offsetX;
      rect.ey += offsetY;
      rect.width -= offsetX;
      rect.height += offsetY;
      break;
    case 4:
      if (rect.height - offsetY < 5) {
        break;
      }
      rect.y += offsetY;
      rect.height -= offsetY;
      break;
    case 5:
      if (rect.width + offsetX < 5) {
        break;
      }
      rect.ex += offsetX;
      rect.width += offsetX;
      break;
    case 6:
      if (rect.height + offsetY < 5) {
        break;
      }
      rect.ey += offsetY;
      rect.height += offsetY;
      break;
    case 7:
      if (rect.width - offsetX < 5) {
        break;
      }
      rect.x += offsetX;
      rect.width -= offsetX;
      break;
  }
}

export function scaleRect(rect: Rect, scale: number, center: Point) {
  if (!rect) {
    return;
  }
  rect.width *= scale;
  rect.height *= scale;
  scalePoint(rect as Point, scale, center);

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
    x: worldRect.width ? (pt.x - worldRect.x) / worldRect.width : 0,
    y: worldRect.height ? (pt.y - worldRect.y) / worldRect.height : 0,
    anchorId: pt.anchorId,
    prevNextType: pt.prevNextType,
  };
  if (pt.prev) {
    point.prev = {
      penId: pt.penId,
      connectTo: pt.connectTo,
      x: worldRect.width ? (pt.prev.x - worldRect.x) / worldRect.width : 0,
      y: worldRect.height ? (pt.prev.y - worldRect.y) / worldRect.height : 0,
    };
  }
  if (pt.next) {
    point.next = {
      penId: pt.penId,
      connectTo: pt.connectTo,
      x: worldRect.width ? (pt.next.x - worldRect.x) / worldRect.width : 0,
      y: worldRect.height ? (pt.next.y - worldRect.y) / worldRect.height : 0,
    };
  }
  return point;
}
