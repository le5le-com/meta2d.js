import { Direction } from '../../data';
import { facePen, Pen } from '../../pen';
import { facePoint, Point, rotatePoint } from '../../point';
import { TopologyStore } from '../../store';
import { s8 } from '../../utils';

export function curve(store: TopologyStore, pen: Pen, mouse?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

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

  anchor.id = s8();
  return anchor;
}

export function curveMind(store: TopologyStore, pen: Pen, mouse?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  let from = pen.calculative.activeAnchor;
  let to = mouse || pen.calculative.worldTo;
  if (!from || !to || !to.temp) {
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
