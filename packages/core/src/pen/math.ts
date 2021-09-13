import { Point } from '../point';
import { Rect } from '../rect';
import { TopologyStore } from '../store';
import { Pen } from './pen';

export function calcAnchorDock(e: Point, anchor: Point, pen: Pen, store: TopologyStore) {
  let xDock: Point;
  let yDock: Point;
  let x = Infinity;
  let y = Infinity;
  const size = 8;
  pen.calculative.worldAnchors.forEach((pt) => {
    if (pt === anchor) {
      return;
    }

    const disX = Math.abs(pt.x - e.x);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(pt.x) + 0.5,
        y: Math.round(pt.y) + 0.5,
        prev: { x: Math.round(anchor.x) + 0.5, y: Math.round(anchor.y) + 0.5 },
      };
      x = disX;
    }
    const disY = Math.abs(pt.y - e.y);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(pt.x) + 0.5,
        y: Math.round(pt.y) + 0.5,
        prev: { x: Math.round(anchor.x) + 0.5, y: Math.round(anchor.y) + 0.5 },
      };
      y = disY;
    }
  });

  return {
    xDock,
    yDock,
  };
}

export function calcRectDock(rect: Rect, store: TopologyStore) {
  let xDock: Point;
  let yDock: Point;
  let x = Infinity;
  let y = Infinity;
  const size = 8;
  store.data.pens.forEach((pen) => {
    if (pen.calculative.active || pen.calculative._visible === false) {
      return;
    }

    const r = pen.calculative.worldRect;
    let step = r.x - rect.x;
    let disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.ex - rect.x;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.ex) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    if (!r.center) {
      r.center = {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
      };
    }

    step = r.center.x - rect.x;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.center.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.x - rect.center.x;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.center.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.ex - rect.center.x;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.ex) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.center.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.center.x - rect.center.x;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.center.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.center.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.x - rect.ex;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.ex) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.ex - rect.ex;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.ex) + 0.5,
        y: Math.round(r.y) + 0.5,
        step: r.ex - rect.ex,
        prev: { x: Math.round(rect.ex) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.center.x - rect.ex;
    disX = Math.abs(step);
    if (disX < size && disX < x) {
      xDock = {
        x: Math.round(r.center.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step: r.center.x - rect.ex,
        prev: { x: Math.round(rect.ex) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      x = disX;
    }

    step = r.y - rect.y;
    let disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      y = disY;
    }

    step = r.ey - rect.y;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.ey) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      y = disY;
    }

    step = r.center.y - rect.y;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.center.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.y) + 0.5 },
      };
      y = disY;
    }

    step = r.y - rect.center.y;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.center.y) + 0.5 },
      };
      y = disY;
    }

    step = r.ey - rect.center.y;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.ey) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.center.y) + 0.5 },
      };
      y = disY;
    }

    step = r.center.y - rect.center.y;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.center.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.center.y) + 0.5 },
      };
      y = disY;
    }

    step = r.y - rect.ey;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.ey) + 0.5 },
      };
      y = disY;
    }

    step = r.ey - rect.ey;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.ey) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.ey) + 0.5 },
      };
      y = disY;
    }

    step = r.center.y - rect.ey;
    disY = Math.abs(step);
    if (disY < size && disY < y) {
      yDock = {
        x: Math.round(r.x) + 0.5,
        y: Math.round(r.center.y) + 0.5,
        step,
        prev: { x: Math.round(rect.x) + 0.5, y: Math.round(rect.ey) + 0.5 },
      };
      y = disY;
    }
  });

  return {
    xDock,
    yDock,
  };
}
