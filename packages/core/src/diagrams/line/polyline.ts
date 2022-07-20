import { Direction } from '../../data';
import { deleteTempAnchor, facePen, getToAnchor, Pen } from '../../pen';
import { Point } from '../../point';
import { TopologyStore } from '../../store';
import { s8 } from '../../utils';

const faceSpace = 30;
export function polyline(store: TopologyStore, pen: Pen, mousedwon?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (pen.calculative.worldAnchors.length < 2) {
    return;
  }

  let from = pen.calculative.activeAnchor;
  let to = getToAnchor(pen);
  if (!from || !to || !to.id || from === to) {
    return;
  }
  from.next = undefined;
  deleteTempAnchor(pen);

  if (from.x === to.x || from.y === to.y) {
    pen.calculative.worldAnchors.push(to);
    return;
  }

  const pts: Point[] = [];

  const fromPen = store.pens[from.connectTo];
  const toPen = store.pens[to.connectTo];

  const fromFace = facePen(from, fromPen);
  const toFace = facePen(to, toPen);

  let a = getFacePoint(from, fromFace, faceSpace);
  if (a) {
    from = a;
    pts.push(a);
  }
  a = getFacePoint(to, toFace, faceSpace);
  if (a) {
    to = a;
  }

  switch (fromFace) {
    case Direction.Up:
      pts.push(...getNextPointsOfUp(from, to, toFace));
      break;
    case Direction.Right:
      pts.push(...getNextPointsOfRight(from, to, toFace));
      break;
    case Direction.Bottom:
      pts.push(...getNextPointsOfBottom(from, to, toFace));
      break;
    case Direction.Left:
      pts.push(...getNextPointsOfLeft(from, to, toFace));
      break;
    default:
      pts.push(...getNextPoints(pen, from, to));
      a = undefined;
      break;
  }

  pts.forEach((anchor: Point) => {
    anchor.id = s8();
    anchor.penId = pen.id;
    pen.calculative.worldAnchors.push(anchor);
  });
  pen.calculative.worldAnchors.push(to);
}

function getFacePoint(pt: Point, d: Direction, dis: number) {
  const point = { x: pt.x, y: pt.y, id: s8() };
  switch (d) {
    case Direction.Up:
      point.y -= dis;
      break;
    case Direction.Right:
      point.x += dis;
      break;
    case Direction.Bottom:
      point.y += dis;
      break;
    case Direction.Left:
      point.x -= dis;
      break;
    default: {
      return;
    }
  }
  return point;
}

function getNextPointsOfUp(from: Point, to: Point, toFace: Direction) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  const pts: Point[] = [];
  let x: number;
  let y: number;
  switch (toFace) {
    case Direction.Bottom:
      x = to.x;
      y = from.y;
      if (to.y > from.y) {
        x = from.x + (to.x - from.x) / 2;
        pts.push({ x, y: from.y }, { x, y: to.y });
      } else {
        const centerY = (from.y + to.y) / 2;
        pts.push({ x: from.x, y: centerY }, { x: to.x, y: centerY });
      }

      break;
    case Direction.Right:
      x = to.x;
      y = from.y;
      if (to.x < from.x && to.y < from.y) {
        x = from.x;
        y = to.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Left:
      x = to.x;
      y = from.y;
      if (to.x > from.x && to.y < from.y) {
        x = from.x;
        y = to.y;
      }
      pts.push({ x, y });
      break;
    default:
      if (to.y > from.y - faceSpace) {
        x = from.x + (to.x - from.x) / 2;
        pts.push({ x, y: from.y }, { x, y: to.y });
      } else {
        const centerY = (from.y + to.y + faceSpace) / 2;
        pts.push({ x: from.x, y: centerY }, { x: to.x, y: centerY });
      }
      break;
  }

  return pts;
}

function getNextPointsOfRight(from: Point, to: Point, toFace: Direction) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  const pts: Point[] = [];
  let x: number;
  let y: number;
  switch (toFace) {
    case Direction.Up:
      x = from.x;
      y = to.y;
      if (to.x > from.x && to.y > from.y) {
        x = to.x;
        y = from.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Bottom:
      x = from.x;
      y = to.y;
      if (to.x > from.x && to.y < from.y) {
        x = to.x;
        y = from.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Left:
      x = to.x;
      y = from.y;
      if (to.x < from.x) {
        y = from.y + (to.y - from.y) / 2;
        pts.push({ x: from.x, y }, { x: to.x, y });
      } else {
        const centerX = (from.x + to.x) / 2;
        pts.push({ x: centerX, y }, { x: centerX, y: to.y });
      }
      break;
    case Direction.Right:
      if (to.x < from.x) {
        pts.push({ x: from.x, y: to.y });
      } else {
        pts.push({ x: to.x, y: from.y });
      }
      break;
    default:
      x = to.x;
      y = to.y;
      if (to.x < from.x + faceSpace) {
        pts.push({ x: from.x, y });
      } else {
        const centerX = (from.x + to.x - faceSpace) / 2;
        pts.push({ x: centerX, y: from.y }, { x: centerX, y });
      }
      break;
  }

  return pts;
}

function getNextPointsOfBottom(from: Point, to: Point, toFace: Direction) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  const pts: Point[] = [];
  let x: number;
  let y: number;
  switch (toFace) {
    case Direction.Up:
      x = from.x;
      y = to.y;
      if (to.y < from.y) {
        x = from.x + (to.x - from.x) / 2;
        pts.push({ x, y: from.y }, { x, y: to.y });
      } else {
        const centerY = (from.y + to.y) / 2;
        pts.push({ x, y: centerY }, { x: to.x, y: centerY });
      }
      break;
    case Direction.Right:
      x = to.x;
      y = from.y;
      if (to.x < from.x && to.y > from.y) {
        x = from.x;
        y = to.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Left:
      x = to.x;
      y = from.y;
      if (to.x > from.x && to.y > from.y) {
        x = from.x;
        y = to.y;
      }
      pts.push({ x, y });
      break;
    default:
      x = from.x;
      if (to.y < from.y + faceSpace) {
        x = from.x + (to.x - from.x) / 2;
        pts.push({ x, y: from.y }, { x, y: to.y });
      } else {
        const centerY = (from.y + to.y - faceSpace) / 2;
        pts.push({ x, y: centerY }, { x: to.x, y: centerY });
      }
      break;
  }

  return pts;
}

function getNextPointsOfLeft(from: Point, to: Point, toFace: Direction) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  const pts: Point[] = [];
  let x: number;
  let y: number;
  switch (toFace) {
    case Direction.Up:
      x = from.x;
      y = to.y;
      if (to.x < from.x && to.y > from.y) {
        x = to.x;
        y = from.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Bottom:
      x = from.x;
      y = to.y;
      if (to.x < from.x && to.y < from.y) {
        x = to.x;
        y = from.y;
      }
      pts.push({ x, y });
      break;
    case Direction.Right:
      x = from.x;
      y = to.y;
      if (to.x > from.x) {
        x = to.x;
        y = from.y + (to.y - from.y) / 2;
        pts.push({ x: from.x, y }, { x: to.x, y });
      } else {
        const centerX = (from.x + to.x) / 2;
        pts.push({ x: centerX, y: from.y }, { x: centerX, y: to.y });
      }
      break;
    default:
      x = from.x;
      y = to.y;
      if (to.x < from.x - faceSpace) {
        const centerX = (from.x + to.x + faceSpace) / 2;
        pts.push({ x: centerX, y: from.y }, { x: centerX, y });
      } else {
        pts.push({ x: from.x, y });
      }
      break;
  }

  return pts;
}

function getNextPoints(pen: Pen, from: Point, to: Point) {
  const pts: Point[] = [];

  if (pen.calculative.drawlineH == null) {
    pen.calculative.drawlineH = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  }

  if (pen.calculative.worldAnchors.length) {
    to.isTemp = undefined;
    if (pen.calculative.drawlineH) {
      pts.push({ x: to.x, y: from.y });
      if (Math.abs(to.y - from.y) < faceSpace) {
        to.isTemp = true;
      }
    } else {
      pts.push({ x: from.x, y: to.y });
      if (Math.abs(to.x - from.x) < faceSpace) {
        to.isTemp = true;
      }
    }
  }

  return pts;
}
