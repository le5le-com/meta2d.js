import { Pen } from '../core/src/pen';

export function forbiddenGate(pen: Pen) {
  const path = new Path2D();
  let myh = pen.calculative.worldRect.height / 8;
  let myw = 0.25 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw * 2, y);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.lineTo(x + myw * 3, y + myh * 3);
  path.lineTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 1, y + myh * 5);
  path.lineTo(x + myw * 1, y + myh * 3);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.moveTo(x + myw * 3, y + myh * 4);
  path.lineTo(x + myw * 4, y + myh * 4);
  path.moveTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 2, y + myh * 8);

  path.closePath();

  return path;
}
