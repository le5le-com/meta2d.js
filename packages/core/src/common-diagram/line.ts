import { Direction } from '../data';
import { facePen, TopologyPen } from '../pen';
import { Point, rotatePoint } from '../point';
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
      const fromFace = facePen(pen.calculative.worldFrom, store.pens[pen.from.penId]);
      calcCurveCP(pen.calculative.worldFrom, fromFace, 30);
    }
    if (pen.calculative.worldTo && !pen.calculative.worldTo.next) {
      const toFace = facePen(pen.calculative.worldTo, store.pens[pen.to.penId]);
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

export function getPoints(from: Point, to: Point) {
  const pts: Point[] = [];
  if (!to) {
    return pts;
  }

  if (from.next) {
    if (to.prev) {
      for (let i = 0.02; i < 1; i += 0.02) {
        pts.push(getBezierPoint(i, from, from.next, to.prev, to));
      }
    } else {
      for (let i = 0.02; i < 1; i += 0.02) {
        pts.push(getQuadraticPoint(i, from, from.next, to));
      }
    }
  } else {
    if (to.prev) {
      for (let i = 0.02; i < 1; i += 0.02) {
        pts.push(getQuadraticPoint(i, from, to.prev, to));
      }
    } else {
      pts.push({ x: to.x, y: to.y });
    }
  }

  return pts;
}
