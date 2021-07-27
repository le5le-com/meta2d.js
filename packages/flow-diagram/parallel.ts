import { TopologyPen } from '../core/src/pen';
export function flowParallel(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  
  return path;
}