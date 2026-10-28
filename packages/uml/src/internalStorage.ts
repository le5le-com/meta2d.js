import { Pen } from '@meta2d/core';
export function flowInternalStorage(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, height, width, ex, ey } = pen;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, y);
  ctx.lineTo(ex, ey);
  ctx.lineTo(x, ey);
  ctx.closePath();

  const offsetY = height / 7;
  const offsetX = width / 7;

  ctx.moveTo(x, y + offsetY);
  ctx.lineTo(ex, y + offsetY);
  ctx.moveTo(x + offsetX, y);
  ctx.lineTo(x + offsetX, ey);
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
