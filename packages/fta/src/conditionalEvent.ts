import { Pen } from '@meta2d/core';

export function conditionalEvent(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 2;
  const myw = width / 5;

  ctx.beginPath();
  ctx.moveTo(x, y + myh);
  ctx.lineTo(x + myw, y + myh);
  ctx.moveTo(x + myw * 5, y + myh);
  ctx.ellipse(x + myw * 3, y + myh, 2 * myw, myh, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
