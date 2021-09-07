import { Pen } from '../core/src/pen';
export function display(pen: Pen) {
  const path = new Path2D();
  const offsetX = pen.calculative.worldRect.width / 8;
  path.moveTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex - offsetX, pen.calculative.worldRect.y);
  path.bezierCurveTo(
    pen.calculative.worldRect.ex + offsetX / 3,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex + offsetX / 3,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.ex - offsetX,
    pen.calculative.worldRect.ey
  );
  path.lineTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2);
  path.closePath();
  return path;
}
