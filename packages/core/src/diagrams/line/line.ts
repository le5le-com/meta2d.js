import { deleteTempAnchor, Pen } from '../../pen';
import { hitPoint, Point } from '../../point';
import { getRectOfPoints } from '../../rect';
import { TopologyStore } from '../../store';
import { getBezierPoint, getQuadraticPoint } from './curve';

export function line(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  if (pen.calculative.worldAnchor &&pen.calculative.worldAnchors.length > 1) {
    let from: Point;
    pen.calculative.worldAnchors.forEach((pt: Point) => {
      if (from) {
        draw(path, from, pt);
      } else {
        pt.start = true;
      }
      from = pt;
    });
    if (pen.close) {
      draw(path, from, pen.calculative.worldAnchors[0]);
    }
  }
  return path;
}

export function lineSegment(store: TopologyStore, pen: Pen, mousedwon?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (pen.calculative.worldAnchors.length < 2) {
    return;
  }

  let from = pen.calculative.activeAnchor;
  let to = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
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
  if (from.next) {
    if (to.prev) {
      from.start && path.moveTo(from.x, from.y);
      path.bezierCurveTo(from.next.x, from.next.y, to.prev.x, to.prev.y, to.x, to.y);
    } else {
      from.start && path.moveTo(from.x, from.y);
      path.quadraticCurveTo(from.next.x, from.next.y, to.x, to.y);
    }
  } else {
    if (to.prev) {
      from.start && path.moveTo(from.x, from.y);
      path.quadraticCurveTo(to.prev.x, to.prev.y, to.x, to.y);
    } else {
      from.start && path.moveTo(from.x, from.y);
      path.lineTo(to.x, to.y);
    }
  }
}

export function getLineRect(pen: Pen) {
  getLineLength(pen);
  return getRectOfPoints(getLinePoints(pen));
}

export function getLinePoints(pen: Pen) {
  const pts: Point[] = [];
  let from: Point;
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

export function getPoints(from: Point, to: Point, pen?: Pen) {
  const pts: Point[] = [];
  if (!to) {
    return pts;
  }

  let step = 0.02;
  if (from.lineLength) {
    let r = 4;
    if (pen && pen.lineWidth) {
      r += pen.lineWidth / 2;
    }
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
  let r = 4;
  if (pen.lineWidth) {
    r += pen.lineWidth / 2;
  }

  let i = 0;
  let from: Point;
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
    if (!(pt.x >= minX - r && pt.x <= maxX + r && pt.y >= minY - r && pt.y <= maxY + r)) {
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
    return Math.sqrt(Math.pow(Math.abs(from.x - to.x), 2) + Math.pow(Math.abs(from.y - to.y), 2)) || 0;
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (cp1 && cp2) {
    path.setAttribute('d', `M${from.x} ${from.y} C${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${to.x} ${to.y}`);
  } else if (cp1) {
    path.setAttribute('d', `M${from.x} ${from.y} Q${cp1.x} ${cp1.y} ${to.x} ${to.y}`);
  } else {
    path.setAttribute('d', `M${from.x} ${from.y} Q${cp2.x} ${cp2.y} ${to.x} ${to.y}`);
  }
  return path.getTotalLength() || 0;
}

export function getLineLength(pen: Pen): number {
  if (pen.calculative.worldAnchors.length < 2) {
    return 0;
  }

  let len = 0;
  let from: Point;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    if (from) {
      from.lineLength = lineLen(from, from.next, pt.prev, pt);
      len += from.lineLength;
    }
    from = pt;
  });
  if (pen.close) {
    let to = pen.calculative.worldAnchors[0];
    from.lineLength = lineLen(from, from.next, to.prev, to);
    len += from.lineLength;
  }
  pen.length = len;
  return len;
}
