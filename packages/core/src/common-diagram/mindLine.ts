import { TopologyPen } from '../pen';

export function mindLine(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  const y = pen.calculative.worldRect.y + pen.calculative.worldRect.height;
  path.moveTo(pen.calculative.worldRect.x, y);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width, y);
  path.closePath();

  return path;
}
