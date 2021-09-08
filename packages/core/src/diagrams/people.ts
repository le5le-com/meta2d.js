import { Pen } from '../pen';

export function people(pen: Pen) {
  const path = new Path2D();

  const r = pen.calculative.worldRect.width / 4;
  const middle = pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  path.arc(middle, pen.calculative.worldRect.y + r, r, 0, Math.PI * 2);

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + r * 3);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + r * 3);

  path.moveTo(middle, pen.calculative.worldRect.y + r * 2);
  path.lineTo(middle, pen.calculative.worldRect.y + r * 4);

  path.moveTo(middle, pen.calculative.worldRect.y + r * 4);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);

  path.moveTo(middle, pen.calculative.worldRect.y + r * 4);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.closePath();

  return path;
}
