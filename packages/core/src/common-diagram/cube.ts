import { TopologyPen } from '../pen';

export function cube(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  const offset = pen.calculative.worldRect.width / 4;
  path.moveTo(pen.calculative.worldRect.x+offset, pen.calculative.worldRect.y);
  path.rect(pen.calculative.worldRect.x+offset, pen.calculative.worldRect.y,pen.calculative.worldRect.width-offset, pen.calculative.worldRect.height-offset)
  path.moveTo(pen.calculative.worldRect.x+offset, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y+offset);
  path.moveTo(pen.calculative.worldRect.x+pen.calculative.worldIconRect.width, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldIconRect.width - offset, pen.calculative.worldRect.y + offset);
  path.moveTo(pen.calculative.worldRect.x +pen.calculative.worldIconRect.width, pen.calculative.worldRect.y+pen.calculative.worldIconRect.height-offset);
  path.lineTo(pen.calculative.worldRect.x+pen.calculative.worldIconRect.width - offset, pen.calculative.worldRect.y +pen.calculative.worldIconRect.height);
  path.moveTo(pen.calculative.worldRect.x + offset, pen.calculative.worldRect.y+pen.calculative.worldIconRect.height-offset);
  path.lineTo(pen.calculative.worldRect.x , pen.calculative.worldRect.y + pen.calculative.worldIconRect.height);
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y+offset);
  path.rect(pen.calculative.worldRect.x, pen.calculative.worldRect.y+offset,pen.calculative.worldRect.width-offset, pen.calculative.worldRect.height-offset)
 
  path.closePath();

  return path;
}
