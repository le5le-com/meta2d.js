import { Pen } from '@meta2d/core';
export function flowExternStorage(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ex, ey } = pen;
  const offsetX = width / 10;

  ctx.beginPath();
  ctx.moveTo(x + offsetX * 2, y);
  ctx.bezierCurveTo(x - (offsetX * 2) / 3, y, x - (offsetX * 2) / 3, ey, x + offsetX * 2, ey);
  ctx.lineTo(ex, ey);
  ctx.bezierCurveTo(ex - offsetX, ey, ex - offsetX, y, ex, y);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
