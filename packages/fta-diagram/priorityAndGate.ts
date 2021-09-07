import { Pen } from '../core/src/pen';

export function priorityAndGate(pen: Pen) {
  const path = new Path2D();

  let myh = pen.calculative.worldRect.height / 6;
  let myw = pen.calculative.worldRect.width / 4;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw * 2, y + 0);
  path.lineTo(x + myw * 2, y + myh);
  path.moveTo(x, y + myh + myw * 2);
  path.arc(x + myw * 2, y + myh + myw * 2, myw * 2, Math.PI * 1, Math.PI * 2, false);
  path.lineTo(x + myw * 4, y + myh * 5);
  path.lineTo(x, y + myh * 5);
  path.lineTo(x, y + myh + myw * 2);
  path.moveTo(x, y + myh * 5 - myh / 3);
  path.lineTo(x + myw * 4, y + myh * 5 - myh / 3);
  path.moveTo(x + myw, y + myh * 5);
  path.lineTo(x + myw, y + myh * 6);
  path.moveTo(x + myw * 2, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.moveTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 3, y + myh * 6);

  path.closePath();

  return path;
}
