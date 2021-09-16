import { Direction } from '../../data';
import { facePen, Pen } from '../../pen';
import { distance, Point, PrevNextType, rotatePoint } from '../../point';
import { TopologyStore } from '../../store';
import { s8 } from '../../utils';

export function curve(store: TopologyStore, pen: Pen, mousedwon?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (mousedwon) {
    if (pen.calculative.activeAnchor) {
      pen.calculative.activeAnchor.next = { penId: pen.id, x: mousedwon.x, y: mousedwon.y };
      if (distance(pen.calculative.activeAnchor.next, pen.calculative.activeAnchor) < 5) {
        pen.calculative.activeAnchor.next = undefined;
      } else {
        pen.calculative.activeAnchor.prev = { ...pen.calculative.activeAnchor.next };
        rotatePoint(pen.calculative.activeAnchor.prev, 180, pen.calculative.activeAnchor);
      }
    }
  } else {
    const from = pen.calculative.worldAnchors[0];
    if (!from.next) {
      const fromFace = facePen(from, store.pens[from.connectTo]);
      calcCurveCP(from, fromFace, 50);
    }

    const to = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
    if (to && to !== from && !to.prev) {
      const toFace = facePen(to, store.pens[to.connectTo]);
      calcCurveCP(to, toFace, -50);
    }
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

function lerp(pt1: Point, pt2: Point, t: number) {
  return {
    x: pt1.x + t * (pt2.x - pt1.x),
    y: pt1.y + t * (pt2.y - pt1.y),
  };
}

export function getSplitAnchor(pen: Pen, pt: Point, index: number) {
  let from = pen.calculative.worldAnchors[index];
  let to = pen.calculative.worldAnchors[index + 1];

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

  anchor.id = s8();
  anchor.prevNextType = PrevNextType.Bilateral;
  return anchor;
}

export function curveMind(store: TopologyStore, pen: Pen, mousedwon?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (pen.calculative.worldAnchors.length < 2) {
    return;
  }

  let from = pen.calculative.activeAnchor;
  let to = mousedwon || pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
  if (!from || !to) {
    return;
  }

  const dis = 20;

  const fromPen = store.pens[from.connectTo];
  let fromFace = facePen(from, fromPen);
  if (fromFace === Direction.None) {
    if (to.x > from.x) {
      fromFace = Direction.Right;
    } else {
      fromFace = Direction.Left;
    }
  }
  from.next = { id: s8(), penId: pen.id, x: from.x, y: from.y, prevNextType: 2 };
  to.prev = { id: s8(), penId: pen.id, x: to.x, y: to.y, prevNextType: 2 };
  switch (fromFace) {
    case Direction.Up:
      from.next.y -= dis;
      to.prev.y = from.y;
      break;
    case Direction.Bottom:
      from.next.y += dis;
      to.prev.y = from.y;
      break;
    case Direction.Left:
      from.next.x -= dis;
      to.prev.x = from.x;
      break;
    default:
      from.next.x += dis;
      to.prev.x = from.x;
      break;
  }
}
