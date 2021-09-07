import { Pen } from '../core/src/pen';

export function xorGate(pen: Pen) {
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 2;
  let myh = pen.calculative.worldRect.height / 10;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  path.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  path.moveTo(x, y + myh * 10);
  path.quadraticCurveTo(x + myw, y + myh * 7, x + myw * 2, y + myh * 10);
  path.moveTo(x + (myw * 2) / 5, y + (pen.calculative.worldRect.height * 201) / 250 + myh);
  path.lineTo(x + (myw * 2) / 5, y + pen.calculative.worldRect.height);
  path.moveTo(x + (myw * 8) / 5, y + (pen.calculative.worldRect.height * 201) / 250 + myh);
  path.lineTo(x + (myw * 8) / 5, y + pen.calculative.worldRect.height);
  path.closePath();

  return path;
}
