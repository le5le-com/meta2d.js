import { TopologyPen } from '../core/src/pen';
export function elevatordoor(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let halfWidth = pen.calculative.worldRect.width / 2;

  path.rect(
    x,
    y,
    pen.calculative.worldRect.width,
    pen.calculative.worldRect.height
  );

  pen.lineWidth = 5;
  path.moveTo(x + halfWidth, y);
  path.lineTo(x + halfWidth, y + pen.calculative.worldRect.height);

  path.closePath();
  return path;
}
