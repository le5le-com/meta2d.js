import { Pen } from '../core/src/pen';
export function data(pen: Pen) {
  const path = new Path2D();
  const offsetX = pen.calculative.worldRect.width / 7;
  path.moveTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width - offsetX, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();
  return path;
}
