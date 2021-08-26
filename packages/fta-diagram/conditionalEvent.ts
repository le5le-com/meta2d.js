import { Pen } from '../core/src/pen';

export function conditionalEvent(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let myh = pen.calculative.worldRect.height / 2;
  let myw = pen.calculative.worldRect.width / 5;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x, y + myh);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw * 5, y + myh);
  path.ellipse(x + myw * 3, y + myh, 2 * myw, myh, 0, 0, Math.PI * 2);

  path.closePath();

  return path;
}
