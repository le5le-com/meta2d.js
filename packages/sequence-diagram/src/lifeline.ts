import { Pen } from '@meta2d/core';

export function lifeline(ctx: CanvasRenderingContext2D, pen: Pen) {
  const headHeight = (pen as any).headHeight ?? 50;
  const { x, y, width, height, ey } = pen.calculative.worldRect;
  let wr = pen.calculative.borderRadius || 0,
    hr = wr;
  if (pen.calculative.borderRadius < 1) {
    wr *= width;
    hr *= height;
  }
  let r = wr < hr ? wr : hr;
  if (width < 2 * r) {
    r = width / 2;
  }
  if (headHeight < 2 * r) {
    r = headHeight / 2;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + headHeight, r);
  ctx.arcTo(x + width, y + headHeight, x, y + headHeight, r);
  ctx.arcTo(x, y + headHeight, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 7]);
  const middle = x + width / 2;
  ctx.moveTo(middle, y + headHeight + 1);
  ctx.lineTo(middle, ey);
  ctx.stroke();
  ctx.restore();
}
