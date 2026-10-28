import { Pen } from '@meta2d/core';

export function xorGate(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  let myw = width / 2;
  let myh = height / 10;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);

  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);

  ctx.moveTo(x + myw, y + myh);
  ctx.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  ctx.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  
  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  ctx.moveTo(x, y + myh * 10);
  ctx.quadraticCurveTo(x + myw, y + myh * 7, x + myw * 2, y + myh * 10);

  ctx.moveTo(x + (myw * 2) / 5, y + (height * 201) / 250 + myh);
  ctx.lineTo(x + (myw * 2) / 5, y + height);

  ctx.moveTo(x + (myw * 8) / 5, y + (height * 201) / 250 + myh);
  ctx.lineTo(x + (myw * 8) / 5, y + height);
  ctx.closePath();
  ctx.stroke();
}
