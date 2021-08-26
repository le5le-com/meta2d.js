import { Pen } from '../pen';

export function file(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  const offsetX = pen.calculative.worldRect.width / 6;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + offsetX);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();
  path.moveTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.y + offsetX);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + offsetX);

  path.closePath();

  return path;
}
