import { calcRotate, Point } from '../point';
import { Meta2dStore } from '../store';
import { Pen } from './model';
import { getFromAnchor, getToAnchor } from './render';

const arrows: Record<
  string,
  (
    ctx: CanvasRenderingContext2D,
    pen: Pen,
    store: Meta2dStore,
    point: Point
  ) => void
> = {};

export function renderFromArrow(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) {
  if (!arrows[pen.fromArrow]) {
    return;
  }
  const from = getFromAnchor(pen);
  const { x, y } = from;
  const pt: Point = { x, y };
  pt.step = (pen.fromArrowSize || 10) * store.data.scale;
  if (from.next) {
    pt.rotate = calcRotate(from.next, from) + 90;
  } else {
    const p = pen.calculative.worldAnchors[1];
    if (!p) {
      return;
    }
    if (p.prev) {
      pt.rotate = calcRotate(p.prev, from) + 90;
    } else {
      pt.rotate = calcRotate(p, from) + 90;
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([]);
  const fromArrowColor = pen.fromArrowColor || pen.calculative.color;
  fromArrowColor && (ctx.strokeStyle = fromArrowColor);
  arrows[pen.fromArrow](ctx, pen, store, pt);
  ctx.restore();
}

export function renderToArrow(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) {
  if (!arrows[pen.toArrow] || pen.calculative.worldAnchors.length < 2) {
    return;
  }
  ctx.save();
  const to = getToAnchor(pen);
  const { x, y } = to;
  const pt: Point = { x, y };
  pt.step = (pen.toArrowSize || 10) * store.data.scale;
  if (to.prev) {
    pt.rotate = calcRotate(to.prev, to) + 90;
  } else {
    const p =
      pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 2];
    if (p.next) {
      pt.rotate = calcRotate(p.next, to) + 90;
    } else {
      pt.rotate = calcRotate(p, to) + 90;
    }
  }
  ctx.beginPath();
  ctx.setLineDash([]);
  const toArrowColor = pen.toArrowColor || pen.calculative.color;
  toArrowColor && (ctx.strokeStyle = toArrowColor);
  arrows[pen.toArrow](ctx, pen, store, pt);
  ctx.restore();
}

arrows.triangleSolid = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  ctx.moveTo(fromX, point.y - point.step / 4);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX, point.y + point.step / 4);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
};

arrows.reTriangleSolid = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step/2;
  ctx.moveTo(point.x, point.y - point.step/2);
  ctx.lineTo(fromX, point.y);
  ctx.lineTo(point.x, point.y + point.step/2);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
};

arrows.triangle = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  if (ctx.lineWidth < 2) {
    ctx.lineWidth = 2;
  }
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  ctx.moveTo(fromX, point.y - point.step / 4);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX, point.y + point.step / 4);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = store.data.background || '#ffffff';
  ctx.fill();
  ctx.restore();
};

arrows.circleSolid = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const r = point.step / 2;
  ctx.arc(point.x - r, point.y, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
};

arrows.circle = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const r = point.step / 2;
  ctx.arc(point.x - r, point.y, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = store.data.background || '#ffffff';
  ctx.fill();
  ctx.restore();
};

arrows.diamondSolid = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  const r = point.step / 2;
  ctx.moveTo(fromX, point.y);
  ctx.lineTo(fromX + r, point.y - r / 2);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX + r, point.y + r / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.restore();
};

arrows.diamond = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  const r = point.step / 2;
  ctx.moveTo(fromX, point.y);
  ctx.lineTo(fromX + r, point.y - r / 2);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX + r, point.y + r / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = store.data.background || '#ffffff';
  ctx.fill();
  ctx.restore();
};

arrows.line = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  ctx.moveTo(fromX, point.y - point.step / 3);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX, point.y + point.step / 3);
  ctx.stroke();
  ctx.restore();
};

arrows.lineUp = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  ctx.moveTo(fromX, point.y - point.step / 3);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
};

arrows.lineDown = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore,
  point: Point
) => {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - point.step;
  ctx.moveTo(fromX, point.y + point.step / 3);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
};
