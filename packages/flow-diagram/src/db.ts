import { Pen } from '@meta2d/core/src/pen';
export function flowDb(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, height, ex, ey } = pen.calculative.worldRect;
  const offsetY = height / 7;
  path.moveTo(x, y + offsetY);
  path.bezierCurveTo(
    x,
    (y - offsetY / 2) | 0,
    ex,
    (y - offsetY / 2) | 0,
    ex,
    y + offsetY
  );
  path.lineTo(ex, ey - offsetY);
  path.bezierCurveTo(
    ex,
    (ey + offsetY / 2) | 0,
    x,
    (ey + offsetY / 2) | 0,
    x,
    ey - offsetY
  );
  path.closePath();
  path.moveTo(x, ey - offsetY);
  path.bezierCurveTo(
    x,
    (ey - offsetY * 2) | 0,
    ex,
    (ey - offsetY * 2) | 0,
    ex,
    ey - offsetY
  );
  //   path.closePath();
  if (path instanceof Path2D) return path;
}
