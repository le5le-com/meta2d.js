import { Pen } from '../core/src/pen';
export function flowExternStorage(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  const offsetX = pen.calculative.worldRect.width / 10;
  path.moveTo(pen.calculative.worldRect.x + offsetX * 2, pen.calculative.worldRect.y);
  path.bezierCurveTo(
    pen.calculative.worldRect.x - (offsetX * 2) / 3,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x - (offsetX * 2) / 3,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.x + offsetX * 2,
    pen.calculative.worldRect.ey
  );
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.bezierCurveTo(
    pen.calculative.worldRect.ex - offsetX,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.ex - offsetX,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y
  );
  path.closePath();
  return path;
}
