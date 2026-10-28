import { Pen } from '@meta2d/core';
export function flowDisplay(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ex, ey } = pen;
  const offsetX = width / 8;
  
  ctx.beginPath();
  ctx.moveTo(x + offsetX, y);
  ctx.lineTo(ex - offsetX, y);
  ctx.bezierCurveTo(ex + offsetX / 3, y, ex + offsetX / 3, ey, ex - offsetX, ey);
  ctx.lineTo(x + offsetX, ey);
  ctx.lineTo(x, y + height / 2);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
