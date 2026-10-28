import { Pen } from '@meta2d/core';

export function transferSymbol(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 4;
  const myw = width / 2;

  ctx.beginPath();
  ctx.moveTo(x + myw, y);
  ctx.lineTo(x + myw, y + myh);
  ctx.lineTo(x + myw * 2, y + myh * 4);
  ctx.lineTo(x, y + myh * 4);
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
