import { Pen } from '@meta2d/core';

export function event(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  const myh = height / 4;
  const myw = 0.5 * width;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x, y + myh);
  path.rect(x, y + myh, myw * 2, myh * 2);
  path.moveTo(x + myw, y + 3 * myh);
  path.lineTo(x + myw, y + 4 * myh);

  path.closePath();

  if (path instanceof Path2D) return path;
}
