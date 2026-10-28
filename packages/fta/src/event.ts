import { Pen } from '@meta2d/core';

export function event(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 4;
  const myw = 0.5 * width;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);

  ctx.moveTo(x, y + myh);
  ctx.rect(x, y + myh, myw * 2, myh * 2);

  ctx.moveTo(x + myw, y + 3 * myh);
  ctx.lineTo(x + myw, y + 4 * myh);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
