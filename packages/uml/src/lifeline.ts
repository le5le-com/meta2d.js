import { Pen } from '@meta2d/core';

export function lifeline(ctx: CanvasRenderingContext2D, pen: Pen) {
  const headHeight = (pen as any).headHeight ?? 50;
  const { x, y, width, height, ey } = pen;
  let r = pen.borderRadius || 0;
  if (r < 1) {
    r *= Math.min(width, height);
  }
  r = Math.min(r, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + headHeight, r);
  ctx.arcTo(x + width, y + headHeight, x, y + headHeight, r);
  ctx.arcTo(x, y + headHeight, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  const middle = x + width / 2;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([7, 7]);
  ctx.moveTo(middle, y + headHeight + 1);
  ctx.lineTo(middle, ey);
  ctx.stroke();
  ctx.restore();
}
