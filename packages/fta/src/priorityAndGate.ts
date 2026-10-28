import { Pen } from '@meta2d/core';

export function priorityAndGate(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 6;
  const myw = width / 4;

  ctx.beginPath();
  ctx.moveTo(x + myw * 2, y + 0);
  ctx.lineTo(x + myw * 2, y + myh);

  ctx.moveTo(x, y + myh + myw * 2);
  ctx.arc(x + myw * 2, y + myh + myw * 2, myw * 2, Math.PI * 1, Math.PI * 2, false);
  ctx.lineTo(x + myw * 4, y + myh * 5);
  ctx.lineTo(x, y + myh * 5);
  ctx.lineTo(x, y + myh + myw * 2);

  ctx.moveTo(x, y + myh * 5 - myh / 3);
  ctx.lineTo(x + myw * 4, y + myh * 5 - myh / 3);

  ctx.moveTo(x + myw, y + myh * 5);
  ctx.lineTo(x + myw, y + myh * 6);

  ctx.moveTo(x + myw * 2, y + myh * 5);
  ctx.lineTo(x + myw * 2, y + myh * 6);

  ctx.moveTo(x + myw * 3, y + myh * 5);
  ctx.lineTo(x + myw * 3, y + myh * 6);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
