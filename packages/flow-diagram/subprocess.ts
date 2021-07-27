import { TopologyPen } from '../core/src/pen';
export function flowSubprocess(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
  const offsetX = pen.calculative.worldRect.width / 7;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();

  path.moveTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.ey);

  path.moveTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.ey);
  return path;
}