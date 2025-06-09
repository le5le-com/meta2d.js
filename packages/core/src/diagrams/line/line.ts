import { deleteTempAnchor, getFromAnchor, getGradientAnimatePath, getToAnchor, Pen } from '../../pen';
import { hitPoint, Point } from '../../point';
import { getRectOfPoints, pointInSimpleRect, Rect } from '../../rect';
import { Meta2dStore } from '../../store';
import { getBezierPoint, getQuadraticPoint } from './curve';

export function line(
  pen: Pen,
  ctx?: CanvasRenderingContext2D | Path2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  if (pen.lineName === 'line' || pen.lineName === 'polyline') {
    if (pen.calculative.lineSmooth) {
      let _path = getGradientAnimatePath(pen);
      if (path instanceof Path2D) path.addPath(_path);
      if (path instanceof Path2D) return path;
    }
  }
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
      if(pen.lineName === 'curve') {
        draw(path, from, worldAnchors[0]);
      } else {
        path.closePath();
      }
    }
  }
  if (path instanceof Path2D) return path;
}

export function lineSegment(store: Meta2dStore, pen: Pen, mousedwon?: Point) {
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
  if (from.lineLength && !pen.parentId) {
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
  if (pen.calculative.animatePos) {
    pen.calculative.animatePos =
      (len / pen.length) * pen.calculative.animatePos;
  }
  pen.length = len;
  return len;
}

export function createLineSvgPath(line:Pen) {
  let path:SVGGeometryElement
  let from:Point = null
  line.calculative.worldAnchors.forEach(pt=>{
    if (from) {
      path = createSvgPath(path,from,from.next,pt.prev,pt)
    }
    from = pt;
  })
  if(line.close){
    let pt = line.calculative.worldAnchors[0]
    path = createSvgPath(path,from,from.next,pt.prev,pt)
  }
  return path
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

export function createSvgPath(path:SVGGeometryElement,from: Point, cp1: Point, cp2?: Point, to?: Point,) {
  let d = ''
  if(!path){
    d += `M${from.x} ${from.y} `
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',d)
  }
  d = path.getAttribute('d') || ''

  if (cp1 && cp2) {
    d += `C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`
  } else if (cp1) {
    d += `Q${cp1.x} ${cp1.y} ${to.x} ${to.y}`
  } else {
    d += `Q${cp2?.x || from.x} ${cp2?.y || from.y} ${to.x} ${to.y}`
  }
  path.setAttribute('d',d)
  return path
}
// 获取线段的某个点的导数和位置
export function getLinePointPosAndAngle (path:SVGGeometryElement,distance: number){
  const totalLength = path.getTotalLength()
  if(distance<0 || distance>totalLength) return null
  const delta = 0.01
  const point1 = path.getPointAtLength(distance)

  const point2 = path.getPointAtLength(distance - delta)
  const determinant = Math.atan2(point1.y - point2.y, point1.x - point2.x)
  return {
    x:point1.x,
    y:point1.y,
    rotate:determinant / Math.PI * 180,
    progress: distance / totalLength
  }
}


