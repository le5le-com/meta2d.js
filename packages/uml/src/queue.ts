import { Pen } from '@meta2d/core';
export function flowQueue(ctx: CanvasRenderingContext2D, pen: Pen) {
  console.log('flowQueue', pen);
  const { x, y, width, height, ex, ey } = pen;

  ctx.beginPath();
  ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);

  ctx.moveTo(x + width / 2, ey);
  ctx.lineTo(ex, ey);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
