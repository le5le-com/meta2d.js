import { Pen } from '@meta2d/core';

export function orGate(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myw = width / 2;
  const myh = height / 10;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);

  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);

  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  ctx.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);

  ctx.moveTo(x + myw, y + (height * 3) / 4);
  ctx.lineTo(x + myw, y + height);

  ctx.moveTo(x + (myw * 2) / 5, y + (height * 201) / 250);
  ctx.lineTo(x + (myw * 2) / 5, y + height);

  ctx.moveTo(x + (myw * 8) / 5, y + (height * 201) / 250);
  ctx.lineTo(x + (myw * 8) / 5, y + height);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
