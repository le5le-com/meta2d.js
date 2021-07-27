import { TopologyPen } from '../core/src/pen';
export function focus(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
  path.rect(pen.calculative.worldRect.x, pen.calculative.worldRect.y, pen.calculative.worldRect.width, pen.calculative.worldRect.height);
  
  path.closePath();
  return path;
}