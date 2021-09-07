import { Pen } from '../core/src/pen';
export function flowManually(pen: Pen) {
  const path = new Path2D();
  const offsetY = pen.calculative.worldRect.height / 4;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + offsetY);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();
  return path;
}
