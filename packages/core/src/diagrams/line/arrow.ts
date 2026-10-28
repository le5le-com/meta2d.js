import { calcRotate, Pen, Point } from '../../models';

const arrows: Record<string, (ctx: CanvasRenderingContext2D, point: Point, size?: number) => void> = {};

export function fromArrow(ctx: CanvasRenderingContext2D, pen: Pen) {
  if (!arrows[pen.fromArrow]) {
    return;
  }
  const from = pen.anchors[0];
  const { x, y } = from;
  const pt: Point = { x, y };
  if (from.cp1) {
    pt.rotate = calcRotate(from.cp1, from) + 90;
  } else {
    const p = pen.anchors[1];
    if (!p) {
      return;
    }
    if (p.cp2) {
      pt.rotate = calcRotate(p.cp2, from) + 90;
    } else {
      pt.rotate = calcRotate(p, from) + 90;
    }
  }
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  if (pen.fromArrowColor) {
    ctx.strokeStyle = pen.fromArrowColor;
  }
  if (pen.fromArrowFillColor) {
    ctx.fillStyle = pen.fromArrowFillColor;
  } else {
    ctx.fillStyle = ctx.strokeStyle;
  }
  arrows[pen.fromArrow](ctx, pt, pen.fromArrowSize);
  ctx.restore();
}

export function toArrow(ctx: CanvasRenderingContext2D, pen: Pen) {
  if (!arrows[pen.toArrow] || pen.anchors.length < 2) {
    return;
  }

  const to = pen.anchors[pen.anchors.length - 1];
  const { x, y } = to;
  const pt: Point = { x, y };
  if (to.cp2) {
    pt.rotate = calcRotate(to.cp2, to) + 90;
  } else {
    const p = pen.anchors[pen.anchors.length - 2];
    if (p.cp1) {
      pt.rotate = calcRotate(p.cp1, to) + 90;
    } else {
      pt.rotate = calcRotate(p, to) + 90;
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  if (pen.toArrowColor) {
    ctx.strokeStyle = pen.toArrowColor;
  }
  if (pen.toArrowFillColor) {
    ctx.fillStyle = pen.toArrowFillColor;
  } else {
    ctx.fillStyle = ctx.strokeStyle;
  }
  arrows[pen.toArrow](ctx, pt, pen.toArrowSize);
  ctx.restore();
}

arrows.triangle = (ctx: CanvasRenderingContext2D, point: Point, size = 10) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size;
  ctx.moveTo(fromX, point.y - size / 3);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX, point.y + size / 3);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
};

arrows.reverseTriangle = (ctx: CanvasRenderingContext2D, point: Point, size = 10) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size / 2;
  ctx.moveTo(point.x, point.y - size / 2);
  ctx.lineTo(fromX, point.y);
  ctx.lineTo(point.x, point.y + size / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
};

arrows.circle = (ctx: CanvasRenderingContext2D, point: Point, size = 8) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const r = size / 2;
  ctx.arc(point.x - r, point.y, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.fill();
};

arrows.diamond = (ctx: CanvasRenderingContext2D, point: Point, size = 12) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size;
  const r = size / 2;
  ctx.moveTo(fromX, point.y);
  ctx.lineTo(fromX + r, point.y - r / 2);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX + r, point.y + r / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
};

arrows.line = (ctx: CanvasRenderingContext2D, point: Point, size = 10) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size;
  ctx.moveTo(fromX, point.y - size / 3);
  ctx.lineTo(point.x, point.y);
  ctx.lineTo(fromX, point.y + size / 3);
  ctx.stroke();
};

arrows.lineUp = (ctx: CanvasRenderingContext2D, point: Point, size = 10) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size;
  ctx.moveTo(fromX, point.y - size / 2);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
};

arrows.lineDown = (ctx: CanvasRenderingContext2D, point: Point, size = 10) => {
  ctx.translate(point.x, point.y);
  ctx.rotate((point.rotate * Math.PI) / 180);
  ctx.translate(-point.x, -point.y);
  const fromX = point.x - size;
  ctx.moveTo(fromX, point.y + size / 2);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
};
