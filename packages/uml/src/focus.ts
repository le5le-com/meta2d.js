import { Pen } from '@meta2d/core';

export function focus(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.beginPath();
  ctx.rect(pen.x, pen.y, pen.width, pen.height);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles?.length) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
