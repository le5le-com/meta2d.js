import { Pen } from '@meta2d/core';
export function flowComment(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ey } = pen;
  const offsetX = width / 4;

  ctx.beginPath();
  ctx.moveTo(x + offsetX, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, ey);
  ctx.lineTo(x + offsetX, ey);  
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
