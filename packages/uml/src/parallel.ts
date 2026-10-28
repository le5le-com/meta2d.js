import { Pen } from '@meta2d/core';
export function flowParallel(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, ex, ey } = pen;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, y);
  
  ctx.moveTo(x, ey);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
