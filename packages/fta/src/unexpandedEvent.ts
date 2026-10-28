import { Pen } from '@meta2d/core';

export function unexpandedEvent(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 3;
  const myw = 0.5 * width;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);
  ctx.lineTo(x + width, y + 2 * myh);
  ctx.lineTo(x + myw, y + height);
  ctx.lineTo(x, y + 2 * myh);
  ctx.lineTo(x + myw, y + myh);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
