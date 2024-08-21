import { Pen } from '../../core';

export function switchEvent(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;

  const { x, y, width, height } = pen.calculative.worldRect;
  const myh = height / 4;
  const myw = 0.5 * width;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.lineTo(x + myw * 2, y + myh * 4);
  path.lineTo(x, y + myh * 4);
  path.lineTo(x, y + myh * 2);
  path.lineTo(x + myw, y + myh);
  path.closePath();

  if (path instanceof Path2D) return path;
}
