import { TopologyPen } from '../core/src/pen';

export function unexpandedEvent(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  
  let myh = pen.calculative.worldRect.height / 3;
  let myw = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + pen.calculative.worldRect.width, y + 2 * myh);
  path.lineTo(x + myw, y + pen.calculative.worldRect.height);
  path.lineTo(x, y + 2 * myh);
  path.lineTo(x + myw, y + myh);

  path.closePath();

  return path;
}