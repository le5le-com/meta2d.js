import { TopologyPen } from '../core/src/pen';

export function basicEvent(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  let vlineL = pen.calculative.worldRect.height - pen.calculative.worldRect.width;
  let radius = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + pen.calculative.worldRect.width / 2, y);
  path.lineTo(x + pen.calculative.worldRect.width / 2, y + vlineL);
  path.moveTo(x + pen.calculative.worldRect.width, y + radius + vlineL);
  path.arc(
    x + pen.calculative.worldRect.width / 2,
    y + radius + vlineL,
    radius,
    0,
    Math.PI * 2,
    false
  );
  
  path.closePath();

  return path;
}

