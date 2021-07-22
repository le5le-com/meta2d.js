import { TopologyPen } from '../pen';

export function hexagon(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  path.moveTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width / 4,pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width*3 / 4,pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width,pen.calculative.worldRect.y+pen.calculative.worldIconRect.height/2);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width*3 / 4,pen.calculative.worldRect.y+pen.calculative.worldRect.height);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width*1 / 4,pen.calculative.worldRect.y+pen.calculative.worldRect.height);
  path.lineTo(pen.calculative.worldRect.x,pen.calculative.worldRect.y+pen.calculative.worldRect.height/2);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldRect.width / 4,pen.calculative.worldRect.y);
 
  path.closePath();

  return path;
}
