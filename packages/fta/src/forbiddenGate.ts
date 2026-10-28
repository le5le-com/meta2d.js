import { Pen } from '@meta2d/core';
export function forbiddenGate(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const myh = height / 8;
  const myw = 0.25 * width;
  
  ctx.beginPath();
  ctx.moveTo(x + myw * 2, y);
  ctx.lineTo(x + myw * 2, y + myh * 2);
  ctx.lineTo(x + myw * 3, y + myh * 3);
  ctx.lineTo(x + myw * 3, y + myh * 5);
  ctx.lineTo(x + myw * 2, y + myh * 6);
  ctx.lineTo(x + myw * 1, y + myh * 5);
  ctx.lineTo(x + myw * 1, y + myh * 3);
  ctx.lineTo(x + myw * 2, y + myh * 2);

  ctx.moveTo(x + myw * 3, y + myh * 4);
  ctx.lineTo(x + myw * 4, y + myh * 4);

  ctx.moveTo(x + myw * 2, y + myh * 6);
  ctx.lineTo(x + myw * 2, y + myh * 8);

  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
