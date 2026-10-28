import { Pen } from '@meta2d/core';

export function fork(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.beginPath();
  ctx.rect(pen.x, pen.y, pen.width, pen.height);
  ctx.closePath();

  if (pen.fillStyles?.length) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  } else {
    ctx.fillStyle = pen.background || pen.color || '#555';
    ctx.fill();
  }

  if (pen.lineWidth !== 0) {
    ctx.stroke();
  }
}
