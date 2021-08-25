import { Direction } from '../../data';
import { facePen, TopologyPen } from '../../pen';
import { facePoint, Point, rotatePoint } from '../../point';
import { TopologyStore } from '../../store';
import { s8 } from '../../utils';

export function ployline(store: TopologyStore, pen: TopologyPen, mouse?: Point) {
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const from = pen.calculative.activeAnchor;
  const to = mouse || pen.calculative.worldTo;
  if (!from || !to) {
    return;
  }

  from.next = undefined;
  if (pen.from && from === pen.calculative.worldFrom) {
    pen.from.next = undefined;
  }

  const pts: Point[] = [];

  const fromFace = facePen(from, store.pens[from.connectTo]);
  const toFace = facePen(to, store.pens[to.connectTo]);

  if (fromFace !== Direction.None) {
    pts.push(getFacePoint(from, to, fromFace, 30));
  }
  switch (fromFace) {
    case Direction.Up:
      pts.push(...getNextPointByUp(from, to, fromFace, 30));
      break;
    case Direction.Right:
      pts.push(...getNextPointByRight(from, to, fromFace, 30));
      break;
    case Direction.Bottom:
      pts.push(...getNextPointByBottom(from, to, fromFace, 30));
      break;
    case Direction.Left:
      pts.push(...getNextPointByLeft(from, to, fromFace, 30));
      break;
  }
  if (toFace !== Direction.None) {
    pts.push(getFacePoint(to, from, toFace, 30));
  }

  pen.calculative.worldAnchors = pen.calculative.worldAnchors.filter((a: any) => !a.temp);
  pts.forEach((anchor: any) => {
    anchor.temp = true;
    pen.calculative.worldAnchors.push(anchor);
  });
}

function getFacePoint(pt: Point, to: Point, d: Direction, dis: number) {
  const point = { ...pt };
  switch (d) {
    case Direction.Up:
      if (to.y < pt.y) {
        point.y -= Math.round((pt.y - to.y) / 2);
      } else {
        point.y -= dis;
      }
      break;
    case Direction.Right:
      if (to.x > pt.x) {
        point.x += Math.round((to.x - pt.x) / 2);
      } else {
        point.x += dis;
      }
      break;
    case Direction.Bottom:
      if (to.y > pt.y) {
        point.y += Math.round((to.y - pt.y) / 2);
      } else {
        point.y += dis;
      }
      break;
    case Direction.Left:
      if (to.x < pt.x) {
        point.x -= Math.round((pt.x - to.x) / 2);
      } else {
        point.x -= dis;
      }
      break;
  }
  return point;
}

function getNextPointByUp(from: Point, to: Point, d: Direction, dis: number) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  if (from.y > to.y) {
    if (d === Direction.Up && from.y - to.y > 3 * dis) {
      if (from.x < to.x) {
        if (to.x - from.x < dis) {
          return [
            { x: from.x - 2 * dis, y: from.y },
            { x: from.x - 2 * dis, y: to.y },
          ];
        }
        return [{ x: from.x, y: to.y }];
      } else {
        if (from.x - to.x < dis) {
          return [
            { x: from.x + 2 * dis, y: from.y },
            { x: from.x + 2 * dis, y: to.y },
          ];
        }

        return [{ x: from.x, y: to.y }];
      }
    } else {
      // Left top
      if ((d === Direction.Left && from.x > to.x) || (d === Direction.Right && from.x < to.x)) {
        return [{ x: to.x, y: from.y }];
      }
      return [{ x: from.x, y: to.y }];
    }

    // The to point below the from point.
  } else {
    if (d === Direction.Bottom) {
      if (from.x < to.x) {
        return getHorizontalPoints(from, to);
      } else {
        const pts = getHorizontalPoints(to, from);
        return [pts[1], pts[0]];
      }
    } else {
      return [{ x: to.x, y: from.y }];
    }
  }
}

function getNextPointByBottom(from: Point, to: Point, d: Direction, dis: number) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  // The to point below the from point.
  if (from.y < to.y) {
    if (d === Direction.Bottom && to.y - from.y > 3 * dis) {
      if (from.x < to.x) {
        if (to.x - from.x < dis) {
          return [
            { x: from.x - 2 * dis, y: from.y },
            { x: from.x - 2 * dis, y: to.y },
          ];
        }
        return [{ x: from.x, y: to.y }];
      } else {
        if (from.x - to.x < dis) {
          return [
            { x: from.x + 2 * dis, y: from.y },
            { x: from.x + 2 * dis, y: to.y },
          ];
        }
        return [{ x: from.x, y: to.y }];
      }
    } else {
      if ((d === Direction.Left && from.x > to.x) || (d === Direction.Right && from.x < to.x)) {
        return [{ x: to.x, y: from.y }];
      }
      return [{ x: from.x, y: to.y }];
    }

    // The to point below the from point.
  } else {
    if (d === Direction.Up) {
      if (from.x < to.x) {
        return getHorizontalPoints(from, to);
      } else {
        const pts = getHorizontalPoints(to, from);
        return [pts[1], pts[0]];
      }
    } else {
      return [{ x: to.x, y: from.y }];
    }
  }
}

function getNextPointByLeft(from: Point, to: Point, d: Direction, dis: number) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  // The to point is on the left.
  if (from.x > to.x) {
    if (d === Direction.Left && from.x - to.x > 3 * dis) {
      if (from.y < to.y) {
        if (to.y - from.y < dis) {
          return [
            { x: from.x, y: from.y + 2 * dis },
            { x: to.x, y: from.y + 2 * dis },
          ];
        }
        return [{ x: to.x, y: from.y }];
      } else {
        if (from.y - to.y < dis) {
          return [
            { x: from.x, y: from.y - 2 * dis },
            { x: to.x, y: from.y - 2 * dis },
          ];
        }

        return [{ x: to.x, y: from.y }];
      }
    } else {
      if (d === Direction.Left || (d === Direction.Up && from.y < to.y) || (d === Direction.Bottom && from.y > to.y)) {
        return [{ x: to.x, y: from.y }];
      }
      return [{ x: from.x, y: to.y }];
    }

    // The to point is on the right.
  } else {
    if (d === Direction.Right) {
      if (from.y < to.y) {
        return getVerticalPoints(from, to);
      } else {
        const pts = getVerticalPoints(to, from);
        return [pts[1], pts[0]];
      }
    } else {
      return [{ x: from.x, y: to.y }];
    }
  }
}

function getNextPointByRight(from: Point, to: Point, d: Direction, dis: number) {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  // The to point is on the right.
  if (from.x < to.x) {
    if (d === Direction.Right && to.x - from.x > 3 * dis) {
      if (from.y < to.y) {
        if (to.y - from.y < dis) {
          return [
            { x: from.x, y: from.y - 2 * dis },
            { x: to.x, y: from.y - 2 * dis },
          ];
        }
        return [{ x: to.x, y: from.y }];
      } else {
        if (from.y - to.y < dis) {
          return [
            { x: from.x, y: from.y + 2 * dis },
            { x: to.x, y: from.y + 2 * dis },
          ];
        }

        return [{ x: to.x, y: from.y }];
      }
    } else {
      if (d === Direction.Right || (d === Direction.Up && from.y < to.y) || (d === Direction.Bottom && from.y > to.y)) {
        return [{ x: to.x, y: from.y }];
      }
      return [{ x: from.x, y: to.y }];
    }

    // The to point is on the left.
  } else {
    if (d === Direction.Left) {
      if (from.y < to.y) {
        return getVerticalPoints(from, to);
      } else {
        const pts = getVerticalPoints(to, from);
        return [pts[1], pts[0]];
      }
    } else {
      return [{ x: from.x, y: to.y }];
    }
  }
}

function getHorizontalPoints(left: Point, right: Point) {
  const x = left.x + (right.x - left.x) / 2;
  return [
    { x, y: left.y },
    { x, y: right.y },
  ];
}

function getVerticalPoints(up: Point, bottom: Point) {
  const y = up.y + (bottom.y - up.y) / 2;
  return [
    { x: up.x, y },
    { x: bottom.x, y },
  ];
}
