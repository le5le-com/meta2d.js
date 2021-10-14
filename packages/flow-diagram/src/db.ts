import { Pen } from '../../core/src/pen';
export function db(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  const offsetY = pen.calculative.worldRect.height / 7;
  path.moveTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + offsetY
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.x,
    (pen.calculative.worldRect.y - offsetY / 2) | 0,
    pen.calculative.worldRect.ex,
    (pen.calculative.worldRect.y - offsetY / 2) | 0,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y + offsetY
  );
  path.lineTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey - offsetY
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.ex,
    (pen.calculative.worldRect.ey + offsetY / 2) | 0,
    pen.calculative.worldRect.x,
    (pen.calculative.worldRect.ey + offsetY / 2) | 0,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.ey - offsetY
  );
  path.closePath();
  path.moveTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.ey - offsetY
  );
  path.bezierCurveTo(
    pen.calculative.worldRect.x,
    (pen.calculative.worldRect.ey - offsetY * 2) | 0,
    pen.calculative.worldRect.ex,
    (pen.calculative.worldRect.ey - offsetY * 2) | 0,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey - offsetY
  );
  //   path.closePath();
  return path;
}
