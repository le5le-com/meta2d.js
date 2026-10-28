import { Pen } from '@meta2d/core';
export function flowSubprocess(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ex, ey } = pen;
  const offsetX = width / 7;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(x, ey);
  ctx.closePath();

  ctx.moveTo(x + offsetX, y);
  ctx.lineTo(x + offsetX, ey);

  ctx.moveTo(ex - offsetX, y);
  ctx.lineTo(ex - offsetX, ey);

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  ctx.stroke();
}
