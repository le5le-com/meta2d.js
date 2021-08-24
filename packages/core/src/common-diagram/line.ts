import { Direction } from '../data';
import { facePen, TopologyPen } from '../pen';
import { hitPoint, Point, rotatePoint } from '../point';
import { getRectOfPoints, pointInSimpleRect } from '../rect';
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
  if (pen.close) {
    draw(path, pen.calculative.worldTo, pen.calculative.worldFrom);
  }

  return path;
}

function draw(path: Path2D, from: Point, to: Point) {
  if (!to) {
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

export function curve(store: TopologyStore, pen: TopologyPen, mouse?: Point) {
  if (mouse) {
    if (pen.calculative.activeAnchor) {
      pen.calculative.activeAnchor.next = { id: s8(), penId: pen.id, x: mouse.x, y: mouse.y };
      pen.calculative.activeAnchor.prev = { ...pen.calculative.activeAnchor.next };
      rotatePoint(pen.calculative.activeAnchor.prev, 180, pen.calculative.activeAnchor);
    }
  } else {
    if (!pen.calculative.worldFrom.next) {
      const fromFace = facePen(pen.calculative.worldFrom, store.pens[pen.calculative.worldFrom.connectTo]);
      calcCurveCP(pen.calculative.worldFrom, fromFace, 30);
    }
    if (pen.calculative.worldTo && !pen.calculative.worldTo.prev) {
      const toFace = facePen(pen.calculative.worldTo, store.pens[pen.calculative.worldTo.connectTo]);
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
        y: pt.y + dis,
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y - dis,
      };
      break;
    case Direction.Right:
      pt.prev = {
        penId: pt.penId,
        x: pt.x - dis,
        y: pt.y,
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x + dis,
        y: pt.y,
      };
      break;
    case Direction.Bottom:
      pt.prev = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y - dis,
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x,
        y: pt.y + dis,
      };
      break;
    case Direction.Left:
      pt.prev = {
        penId: pt.penId,
        x: pt.x + dis,
        y: pt.y,
      };
      pt.next = {
        penId: pt.penId,
        x: pt.x - dis,
        y: pt.y,
      };
      break;
  }
}

// Get a point in quadratic.
// pos - The position of point in quadratic. It is expressed as a percentage(0 - 1).
export function getQuadraticPoint(step: number, from: Point, cp: Point, to: Point) {
  const pos = 1 - step;
  const x = pos * pos * from.x + 2 * pos * step * cp.x + step * step * to.x;
  const y = pos * pos * from.y + 2 * pos * step * cp.y + step * step * to.y;
  return { x, y, step };
}

// Get a point in bezier.
// pos - The position of point in bezier. It is expressed as a percentage(0 - 1).
export function getBezierPoint(step: number, from: Point, cp1: Point, cp2: Point, to: Point) {
  const { x: x1, y: y1 } = from;
  const { x: x2, y: y2 } = to;
  const { x: cx1, y: cy1 } = cp1;
  const { x: cx2, y: cy2 } = cp2;

  const pos = 1 - step;
  const x = x1 * pos * pos * pos + 3 * cx1 * step * pos * pos + 3 * cx2 * step * step * pos + x2 * step * step * step;
  const y = y1 * pos * pos * pos + 3 * cy1 * step * pos * pos + 3 * cy2 * step * step * pos + y2 * step * step * step;
  return { x, y, step };
}

export function getLineRect(pen: TopologyPen) {
  getLineLength(pen);
  return getRectOfPoints(getLinePoints(pen));
}

export function getLinePoints(pen: TopologyPen) {
  const pts: Point[] = [pen.calculative.worldFrom];
  let from = pen.calculative.worldFrom;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    pts.push(...getPoints(from, pt, pen));
    from = pt;
  });
  pts.push(...getPoints(from, pen.calculative.worldTo, pen));
  if (pen.close) {
    pts.push(...getPoints(pen.calculative.worldTo, pen.calculative.worldFrom, pen));
  }
  return pts;
}

export function getPoints(from: Point, to: Point, pen?: TopologyPen) {
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

export function pointInLine(pt: Point, pen: TopologyPen) {
  let r = 4;
  if (pen.lineWidth) {
    r += pen.lineWidth / 2;
  }
  if (!pointInSimpleRect(pt, pen.calculative.worldRect, r)) {
    return;
  }

  let i = 0;
  let from = pen.calculative.worldFrom;
  let point: Point;
  for (const anchor of pen.calculative.worldAnchors) {
    point = pointInLineSegment(pt, from, anchor, r);
    if (point) {
      return {
        i,
        point,
      };
    }
    ++i;
    from = anchor;
  }
  if (pen.calculative.worldTo) {
    point = pointInLineSegment(pt, from, pen.calculative.worldTo, r);
    if (point) {
      return {
        i,
        point,
      };
    }
    ++i;
    if (pen.close && (point = pointInLineSegment(pt, pen.calculative.worldTo, pen.calculative.worldFrom, r))) {
      return {
        i,
        point,
      };
    }
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

export function getLineLength(pen: TopologyPen): number {
  let len = 0;
  let from = pen.calculative.worldFrom;
  pen.calculative.worldAnchors.forEach((pt: Point) => {
    from.lineLength = lineLen(from, from.next, pt.prev, pt);
    len += from.lineLength;
    from = pt;
  });
  if (pen.calculative.worldTo) {
    from.lineLength = lineLen(from, from.next, pen.calculative.worldTo.prev, pen.calculative.worldTo);
    len += from.lineLength;
  }
  if (pen.close) {
    from = pen.calculative.worldTo;
    from.lineLength = lineLen(from, from.next, pen.calculative.worldFrom.prev, pen.calculative.worldFrom);
    len += from.lineLength;
  }
  pen.length = len;
  return len;
}

function lerp(pt1: Point, pt2: Point, t: number) {
  return {
    x: pt1.x + t * (pt2.x - pt1.x),
    y: pt1.y + t * (pt2.y - pt1.y),
  };
}

export function getSplitAnchor(pen: TopologyPen, pt: Point, index: number) {
  let from: Point;
  let to: Point;
  if (index === 0) {
    from = pen.calculative.worldFrom;
  } else {
    from = pen.calculative.worldAnchors[index - 1];
  }

  if (pen.calculative.worldAnchors && index < pen.calculative.worldAnchors.length) {
    to = pen.calculative.worldAnchors[index];
  } else {
    to = pen.calculative.worldTo;
  }

  const t = pt.step;
  let anchor: Point;
  if (from.next && to.prev) {
    const p0 = from;
    const p1 = from.next;
    const p2 = to.prev;
    const p3 = to;
    const p4 = lerp(p0, p1, t);
    const p5 = lerp(p1, p2, t);
    const p6 = lerp(p2, p3, t);
    const p7: Point = lerp(p4, p5, t);
    const p8: Point = lerp(p5, p6, t);
    anchor = lerp(p7, p8, t);
    anchor.penId = pen.id;
    p7.penId = pen.id;
    anchor.prev = p7;
    p8.penId = pen.id;
    anchor.next = p8;
    from.next.x = p4.x;
    from.next.y = p4.y;
    to.prev.x = p6.x;
    to.prev.y = p6.y;
  } else {
    const p0 = from;
    const p1 = from.next;
    const p2 = to;
    const p3: Point = lerp(p0, p1, t);
    const p4: Point = lerp(p1, p2, t);
    anchor = pt;
    anchor.penId = pen.id;
    p3.penId = pen.id;
    p4.penId = pen.id;
    anchor.prev = p3;
    anchor.next = p4;
    from.next = undefined;
    to.prev = undefined;
  }

  return anchor;
}
