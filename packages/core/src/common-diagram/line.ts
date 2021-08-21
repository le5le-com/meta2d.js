import { Direction } from '../data';
import { facePen, TopologyPen } from '../pen';
import { hitPoint, Point, rotatePoint } from '../point';
import { getRectOfPoints } from '../rect';
import { TopologyStore } from '../store';
import { s8 } from '../utils';

export function line(pen: TopologyPen) {
  const path = new Path2D();
  let from = pen.calculative.worldFrom;
  from.start = true;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    draw(path, from, pt);
    from = pt;
  });
  draw(path, from, pen.calculative.worldTo);
  pen.close && path.closePath();

  return path;
}

function draw(path: Path2D, from: Point, to: Point) {
  if (!to) {
    return;
  }
  if (from.next) {
    if (to.prev) {
      from.start && path.moveTo(from.x, from.y);
      path.bezierCurveTo(
        from.next.x,
        from.next.y,
        to.prev.x,
        to.prev.y,
        to.x,
        to.y
      );
    } else {
      from.start && path.moveTo(from.x, from.y);
      path.quadraticCurveTo(
        from.next.x,
        from.next.y,
        to.x,
        to.y
      );
    }
  } else {
    if (to.prev) {
      from.start && path.moveTo(from.x, from.y);
      path.quadraticCurveTo(
        to.prev.x,
        to.prev.y,
        to.x,
        to.y
      );
    } else {
      from.start && path.moveTo(from.x, from.y);
      path.lineTo(
        to.x,
        to.y
      );
    }
  }
}

export function curve(store: TopologyStore, pen: TopologyPen, mouse?: Point) {
  if (mouse) {
    if (pen.calculative.activeAnchor) {
      pen.calculative.activeAnchor.next = { id: s8(), penId: pen.id, x: mouse.x, y: mouse.y };
      pen.calculative.activeAnchor.prev = { ...pen.calculative.activeAnchor.next };
      rotatePoint(pen.calculative.activeAnchor.prev, 180, pen.calculative.activeAnchor);
    }
  } else {
    if (!pen.calculative.worldFrom.next) {
      const fromFace = facePen(pen.calculative.worldFrom, store.pens[pen.from.connectTo]);
      calcCurveCP(pen.calculative.worldFrom, fromFace, 30);
    }
    if (pen.calculative.worldTo && !pen.calculative.worldTo.prev) {
      const toFace = facePen(pen.calculative.worldTo, store.pens[pen.to.connectTo]);
      calcCurveCP(pen.calculative.worldTo, toFace, -30);
    }
  }

  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }
}

function calcCurveCP(pt: Point, d: Direction, dis: number) {
  switch (d) {
    case Direction.Up:
      pt.prev = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y + dis
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y - dis
      };
      break;
    case Direction.Right:
      pt.prev = {
        penId: pt.penId,
        x: pt.x - dis,
        y: pt.y
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x + dis,
        y: pt.y
      };
      break;
    case Direction.Bottom:
      pt.prev = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y - dis
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y + dis
      };
      break;
    case Direction.Left:
      pt.prev = {
        penId: pt.penId,
        x: pt.x + dis,
        y: pt.y
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x - dis,
        y: pt.y
      };
      break;
  }
}

// Get a point in quadratic.
// pos - The position of point in quadratic. It is expressed as a percentage(0 - 1).
export function getQuadraticPoint(pos: number, from: Point, cp: Point, to: Point) {
  const pos2 = 1 - pos;
  const x = pos2 * pos2 * from.x + 2 * pos2 * pos * cp.x + pos * pos * to.x;
  const y = pos2 * pos2 * from.y + 2 * pos2 * pos * cp.y + pos * pos * to.y;
  return { x, y };
}

// Get a point in bezier.
// pos - The position of point in bezier. It is expressed as a percentage(0 - 1).
export function getBezierPoint(pos: number, from: Point, cp1: Point, cp2: Point, to: Point) {
  const { x: x1, y: y1 } = from;
  const { x: x2, y: y2 } = to;
  const { x: cx1, y: cy1 } = cp1;
  const { x: cx2, y: cy2 } = cp2;

  const pos2 = 1 - pos;
  const x =
    x1 * pos2 * pos2 * pos2 +
    3 * cx1 * pos * pos2 * pos2 +
    3 * cx2 * pos * pos * pos2 +
    x2 * pos * pos * pos;
  const y =
    y1 * pos2 * pos2 * pos2 +
    3 * cy1 * pos * pos2 * pos2 +
    3 * cy2 * pos * pos * pos2 +
    y2 * pos * pos * pos;
  return { x, y };
}

export function getLineRect(pen: TopologyPen) {
  getLineLength(pen);
  return getRectOfPoints(getLinePoints(pen));
}

export function getLinePoints(pen: TopologyPen) {
  const pts: Point[] = [pen.calculative.worldFrom];
  let from = pen.calculative.worldFrom;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    pts.push(...getPoints(from, pt));
    from = pt;
  });
  pts.push(...getPoints(from, pen.calculative.worldTo));
  return pts;
}

export function getPoints(from: Point, to: Point, pen?: TopologyPen) {
  const pts: Point[] = [];
  if (!to) {
    return pts;
  }

  let step = 0.02;
  if (from.lineLength) {
    // 曲线切成大小为4 + lineWidht /2 的等份
    let r = 4;
    if (pen && pen.lineWidth) {
      r += pen.lineWidth / 2;
    }
    step = from.lineLength / 100 / r;
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

export function pointInLine(pt: Point, pen: TopologyPen) {
  let r = 4;
  if (pen.lineWidth) {
    r += pen.lineWidth / 2;
  }

  let from = pen.calculative.worldFrom;
  for (const point of pen.calculative.worldAnchors) {
    if (pointInLineSegment(pt, from, point, r)) {
      return from;
    }
    from = point;
  }
  if (pointInLineSegment(pt, from, pen.calculative.worldTo, r)) {
    return from;
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
      return false;
    }
    return pointToLine(pt, pt1, pt2) < r;
  } else if (pt1.curvePoints) {
    for (const point of pt1.curvePoints) {
      if (hitPoint(pt, point, r)) {
        return true;
      }
    }
  }
  return false;
}

export function pointToLine(pt: Point, pt1: Point, pt2: Point) {
  const A = Math.abs(Math.sqrt(Math.pow((pt.x - pt1.x), 2) + Math.pow((pt.y - pt1.y), 2)));
  const B = Math.abs(Math.sqrt(Math.pow((pt.x - pt2.x), 2) + Math.pow((pt.y - pt2.y), 2)));
  const C = Math.abs(Math.sqrt(Math.pow((pt1.x - pt2.x), 2) + Math.pow((pt1.y - pt2.y), 2)));
  const P = (A + B + C) / 2;
  const allArea = Math.abs(Math.sqrt(P * (P - A) * (P - B) * (P - C)));
  const dis = (2 * allArea) / C;
  return dis;
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

export function getLineLength(pen: TopologyPen): number {
  if (!pen.calculative.worldTo) {
    return 0;
  }
  let len = 0;
  let from = pen.calculative.worldFrom;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    from.lineLength = lineLen(from, from.next, pt.prev, pt);
    len += from.lineLength;
    from = pt;
  });
  from.lineLength = lineLen(from, from.next, pen.calculative.worldTo.prev, pen.calculative.worldTo);
  len += from.lineLength;
  pen.length = len;
  return len;
}
