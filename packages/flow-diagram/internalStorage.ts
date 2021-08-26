import { Pen } from '../core/src/pen';
export function flowInternalStorage(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();

  const offset = pen.calculative.worldRect.width / 7;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + offset);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + offset);

  path.moveTo(pen.calculative.worldRect.x + offset, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x + offset, pen.calculative.worldRect.ey);

  return path;
}
