import { Pen } from '@meta2d/core';
export function flowManually(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, height, ex, ey } = pen;
  const offsetY = height / 4;

  ctx.beginPath();
  ctx.moveTo(x, y + offsetY);
  ctx.lineTo(ex, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(x, ey);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
