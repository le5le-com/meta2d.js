import { TopologyPen } from '../core/src/pen';
export function comment(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
  
  const offsetX = pen.calculative.worldRect.width / 4;
  path.moveTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.ey);
  
  return path;
}