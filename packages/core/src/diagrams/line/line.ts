import { deleteTempAnchor, getFromAnchor, getToAnchor, Pen } from '../../pen';
import { hitPoint, Point } from '../../point';
import { getRectOfPoints, pointInSimpleRect, Rect } from '../../rect';
import { TopologyStore } from '../../store';
import { getBezierPoint, getQuadraticPoint } from './curve';

export function line(
  pen: Pen,
  ctx?: CanvasRenderingContext2D | Path2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const worldAnchors = pen.calculative.worldAnchors;
  if (worldAnchors.length > 1) {
    let from: Point; // 上一个点
    worldAnchors.forEach((pt: Point) => {
      if (from) {
        draw(path, from, pt);
      } else {
        pt.start = true;
      }
      from = pt;
    });
    if (pen.close) {
      draw(path, from, worldAnchors[0]);
    }
  }
  if (path instanceof Path2D) return path;
}

export function lineSegment(store: TopologyStore, pen: Pen, mousedwon?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (pen.calculative.worldAnchors.length < 2 || pen.anchors?.length > 1) {
    return;
  }

  const from = getFromAnchor(pen);
  const to = getToAnchor(pen);
  if (!from || !to || !to.id || from === to) {
    return;
  }
  from.next = undefined;
  deleteTempAnchor(pen);
  to.prev = undefined;
  pen.calculative.worldAnchors.push(to);
}

function draw(path: CanvasRenderingContext2D | Path2D, from: Point, to: Point) {
  if (!to || to.isTemp) {
    return;
  }
  from.start && path.moveTo(from.x, from.y);
  if (from.next) {
    if (to.prev) {
      path.bezierCurveTo(
        from.next.x,
        from.next.y,
        to.prev.x,
        to.prev.y,
        to.x,
        to.y
      );
    } else {
      path.quadraticCurveTo(from.next.x, from.next.y, to.x, to.y);
    }
  } else {
    if (to.prev) {
      path.quadraticCurveTo(to.prev.x, to.prev.y, to.x, to.y);
    } else {
      path.lineTo(to.x, to.y);
    }
  }
}

export function getLineRect(pen: Pen) {
  getLineLength(pen);
  return getRectOfPoints(getLinePoints(pen));
}

/**
 * 获取连线的 points ，并非 worldAnchors ，worldAnchors 之前的路径点也会记录
 */
export function getLinePoints(pen: Pen) {
  const pts: Point[] = [];
  let from: Point; // 上一个点
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    pts.push(pt);
    from && pts.push(...getPoints(from, pt, pen));
    from = pt;
  });
  if (pen.close && pen.calculative.worldAnchors.length > 1) {
    pts.push(...getPoints(from, pen.calculative.worldAnchors[0], pen));
  }
  return pts;
}

export function getLineR(pen: Pen) {
  return pen?.lineWidth ? pen.lineWidth / 2 + 4 : 4;
}

export function getPoints(from: Point, to: Point, pen?: Pen) {
  const pts: Point[] = [];
  if (!to) {
    return pts;
  }

  let step = 0.02;
  if (from.lineLength) {
    const r = getLineR(pen);
    step = r / from.lineLength;
  }
  if (from.next) {
    if (to.prev) {
      for (let i = step; i < 1; i += step) {
        pts.push(getBezierPoint(i, from, from.next, to.prev, to));
      }
    } else {
      for (let i = step; i < 1; i += step) {
        pts.push(getQuadraticPoint(i, from, from.next, to));
      }
    }
  } else {
    if (to.prev) {
      for (let i = step; i < 1; i += step) {
        pts.push(getQuadraticPoint(i, from, to.prev, to));
      }
    } else {
      pts.push({ x: to.x, y: to.y });
    }
  }
  if (pts.length > 1) {
    from.curvePoints = pts;
  }

  return pts;
}

export function pointInLine(pt: Point, pen: Pen) {
  const r = getLineR(pen);

  let i = 0;
  let from: Point; // 上一个点
  let point: Point;
  for (const anchor of pen.calculative.worldAnchors) {
    if (from) {
      point = pointInLineSegment(pt, from, anchor, r);
      if (point) {
        return {
          i,
          point,
        };
      }
      ++i;
    }
    from = anchor;
  }
  if (
    pen.close &&
    pen.calculative.worldAnchors.length > 1 &&
    (point = pointInLineSegment(pt, from, pen.calculative.worldAnchors[0], r))
  ) {
    return {
      i,
      point,
    };
  }
}
export function pointInLineSegment(pt: Point, pt1: Point, pt2: Point, r = 4) {
  if (!pt1.next && !pt2.prev) {
    const { x: x1, y: y1 } = pt1;
    const { x: x2, y: y2 } = pt2;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    if (
      !(
        pt.x >= minX - r &&
        pt.x <= maxX + r &&
        pt.y >= minY - r &&
        pt.y <= maxY + r
      )
    ) {
      return;
    }
    return pointToLine(pt, pt1, pt2, r);
  } else if (pt1.curvePoints) {
    for (const point of pt1.curvePoints) {
      if (hitPoint(pt, point, r)) {
        return point;
      }
    }
  }
}

export function pointToLine(pt: Point, pt1: Point, pt2: Point, r = 4) {
  // 竖线
  if (pt1.x === pt2.x) {
    const len = Math.abs(pt.x - pt1.x);
    if (len <= r) {
      return {
        x: pt1.x,
        y: pt.y,
      };
    }
  } else {
    const A = (pt1.y - pt2.y) / (pt1.x - pt2.x);
    const B = pt1.y - A * pt1.x;
    const len = Math.abs((A * pt.x + B - pt.y) / Math.sqrt(A * A + 1));
    if (len <= r) {
      const m = pt.x + A * pt.y;
      const x = (m - A * B) / (A * A + 1);
      return {
        x,
        y: A * x + B,
      };
    }
  }
}

function lineLen(from: Point, cp1?: Point, cp2?: Point, to?: Point): number {
  if (!cp1 && !cp2) {
    return (
      Math.sqrt(
        Math.pow(Math.abs(from.x - to.x), 2) +
          Math.pow(Math.abs(from.y - to.y), 2)
      ) || 0
    );
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (cp1 && cp2) {
    path.setAttribute(
      'd',
      `M${from.x} ${from.y} C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`
    );
  } else if (cp1) {
    path.setAttribute(
      'd',
      `M${from.x} ${from.y} Q${cp1.x} ${cp1.y} ${to.x} ${to.y}`
    );
  } else {
    path.setAttribute(
      'd',
      `M${from.x} ${from.y} Q${cp2.x} ${cp2.y} ${to.x} ${to.y}`
    );
  }
  return path.getTotalLength() || 0;
}

export function getLineLength(pen: Pen): number {
  if (pen.calculative.worldAnchors.length < 2) {
    return 0;
  }

  let len = 0;
  let from: Point; // 上一个点
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    if (from) {
      from.lineLength = lineLen(from, from.next, pt.prev, pt);
      len += from.lineLength;
    }
    from = pt;
  });
  if (pen.close) {
    // pen.close ，下一个点即第一个点
    const to = getFromAnchor(pen);
    from.lineLength = lineLen(from, from.next, to.prev, to);
    len += from.lineLength;
  }
  pen.length = len;
  return len;
}

/**
 * 连线在 rect 内， 连线与 rect 相交
 */
export function lineInRect(line: Pen, rect: Rect) {
  // 判断是直线还是贝塞尔
  const worldAnchors = line.calculative.worldAnchors;
  for (let index = 0; index < worldAnchors.length - 1; index++) {
    const current = worldAnchors[index];
    const next = worldAnchors[index + 1];
    if (!current.next && !next.prev) {
      // 线段
      if (isLineIntersectRectangle(current, next, rect)) {
        return true;
      }
    } else {
      // 贝塞尔
      if (isBezierIntersectRectangle(current, next, rect)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 线段与矩形是否相交
 * @param rect 矩形
 */
export function isLineIntersectRectangle(pt1: Point, pt2: Point, rect: Rect) {
  if (pointInSimpleRect(pt1, rect) || pointInSimpleRect(pt2, rect)) {
    // 存在一个点在矩形内部
    return true;
  }
  const linePointX1 = pt1.x;
  const linePointY1 = pt1.y;
  const linePointX2 = pt2.x;
  const linePointY2 = pt2.y;

  let rectangleLeftTopX = rect.x;
  let rectangleLeftTopY = rect.y;
  let rectangleRightBottomX = rect.ex;
  let rectangleRightBottomY = rect.ey;

  const lineHeight = linePointY1 - linePointY2;
  const lineWidth = linePointX2 - linePointX1; // 计算叉乘
  const c = linePointX1 * linePointY2 - linePointX2 * linePointY1;
  if (
    (lineHeight * rectangleLeftTopX + lineWidth * rectangleLeftTopY + c >= 0 &&
      lineHeight * rectangleRightBottomX +
        lineWidth * rectangleRightBottomY +
        c <=
        0) ||
    (lineHeight * rectangleLeftTopX + lineWidth * rectangleLeftTopY + c <= 0 &&
      lineHeight * rectangleRightBottomX +
        lineWidth * rectangleRightBottomY +
        c >=
        0) ||
    (lineHeight * rectangleLeftTopX + lineWidth * rectangleRightBottomY + c >=
      0 &&
      lineHeight * rectangleRightBottomX + lineWidth * rectangleLeftTopY + c <=
        0) ||
    (lineHeight * rectangleLeftTopX + lineWidth * rectangleRightBottomY + c <=
      0 &&
      lineHeight * rectangleRightBottomX + lineWidth * rectangleLeftTopY + c >=
        0)
  ) {
    if (rectangleLeftTopX > rectangleRightBottomX) {
      const temp = rectangleLeftTopX;
      rectangleLeftTopX = rectangleRightBottomX;
      rectangleRightBottomX = temp;
    }
    if (rectangleLeftTopY < rectangleRightBottomY) {
      const temp1 = rectangleLeftTopY;
      rectangleLeftTopY = rectangleRightBottomY;
      rectangleRightBottomY = temp1;
    }
    if (
      (linePointX1 < rectangleLeftTopX && linePointX2 < rectangleLeftTopX) ||
      (linePointX1 > rectangleRightBottomX &&
        linePointX2 > rectangleRightBottomX) ||
      (linePointY1 > rectangleLeftTopY && linePointY2 > rectangleLeftTopY) ||
      (linePointY1 < rectangleRightBottomY &&
        linePointY2 < rectangleRightBottomY)
    ) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

/**
 * 贝塞尔曲线与矩形是否相交
 * @param from 前点
 * @param to 后点
 * @param rect 矩形
 */
export function isBezierIntersectRectangle(from: Point, to: Point, rect: Rect) {
  const step = 0.02;
  if (!from.next && !to.prev) {
    // 直线
    return isLineIntersectRectangle(from, to, rect);
  } else if (from.next && to.prev) {
    for (let i = step; i < 1; i += step) {
      const point = getBezierPoint(i, from, from.next, to.prev, to);
      if (pointInSimpleRect(point, rect)) {
        return true;
      }
    }
  } else if (from.next || to.prev) {
    for (let i = step; i < 1; i += step) {
      const point = getQuadraticPoint(i, from, from.next || to.prev, to);
      if (pointInSimpleRect(point, rect)) {
        return true;
      }
    }
  }

  return false;
}

// 检测两条线段是否相交，并返回结果
export function checkLineIntersection(line1StartX:number, line1StartY:number, line1EndX:number, line1EndY:number, line2StartX:number, line2StartY:number, line2EndX, line2EndY:number) {
  // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
  let denominator, a, b, numerator1, numerator2, result = {
      x: null,
      y: null,
      onLine1: false,
      onLine2: false
  };
  denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
  if (denominator == 0) {
      return result;
  }
  a = line1StartY - line2StartY;
  b = line1StartX - line2StartX;
  numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
  numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  // if we cast these lines infinitely in both directions, they intersect here:
  result.x = line1StartX + (a * (line1EndX - line1StartX));
  result.y = line1StartY + (a * (line1EndY - line1StartY));
/*
      // it is worth noting that this should be the same as:
      x = line2StartX + (b * (line2EndX - line2StartX));
      y = line2StartX + (b * (line2EndY - line2StartY));
      */
  // if line1 is a segment and line2 is infinite, they intersect if:
  if (a > 0 && a < 1) {
      result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (b > 0 && b < 1) {
      result.onLine2 = true;
  }
  // if line1 and line2 are segments, they intersect if both of the above are true
  return result;
}
