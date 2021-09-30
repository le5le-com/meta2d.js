import { calcRotate, Point } from '../point';
import { TopologyStore } from '../store';
import { Pen } from './model';

const arrows: any = {};

export function renderFromArrow(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore
) {
  if (!arrows[pen.fromArrow]) {
    return;
  }
  const from = pen.calculative.worldAnchors[0];
  const { x, y } = from;
  const pt: Point = { x, y };
  pt.step = (pen.fromArrowSize || 10) * store.data.scale;
  if (from.next) {
    pt.rotate = calcRotate(from.next, from) + 90;
  } else {
    const p = pen.calculative.worldAnchors[1];
    if (p.prev) {
      pt.rotate = calcRotate(p.prev, from) + 90;
    } else {
      pt.rotate = calcRotate(p, from) + 90;
    }
  }
  ctx.beginPath();
  arrows[pen.fromArrow](ctx, pen, store, pt);
}

export function renderToArrow(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore
) {
  if (!arrows[pen.toArrow] || pen.calculative.worldAnchors.length < 2) {
    return;
  }
  const to = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
  const { x, y } = to;
  const pt: Point = { x, y };
  pt.step = (pen.toArrowSize || 10) * store.data.scale;
  if (to.prev) {
    pt.rotate = calcRotate(to.prev, to) + 90;
  } else {
    const p = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 2];
    if (p.next) {
      pt.rotate = calcRotate(p.next, to) + 90;
    } else {
      pt.rotate = calcRotate(p, to) + 90;
    }
  }
  ctx.beginPath();
  arrows[pen.toArrow](ctx, pen, store, pt);
}

arrows.triangleSolid = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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

arrows.triangle = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  store: TopologyStore,
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
