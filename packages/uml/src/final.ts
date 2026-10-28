import { Pen } from '@meta2d/core';
export function final(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.ellipse(x + width / 2, y + height / 2, width / 4, height / 4, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
