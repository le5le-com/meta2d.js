import { TopologyPen } from '../core/src/pen';

export function event(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  let myh = pen.calculative.worldRect.height / 4;
  let myw = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x, y + myh);
  path.rect(x, y + myh, myw * 2, myh * 2);
  path.moveTo(x + myw, y + 3 * myh);
  path.lineTo(x + myw, y + 4 * myh);
  
  path.closePath();

  return path;
}

