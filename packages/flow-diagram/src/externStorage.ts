import { Pen } from '../../core/src/pen';
export function flowExternStorage(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ex, ey } = pen.calculative.worldRect;
  const offsetX = width / 10;
  path.moveTo(x + offsetX * 2, y);
  path.bezierCurveTo(
    x - (offsetX * 2) / 3,
    y,
    x - (offsetX * 2) / 3,
    ey,
    x + offsetX * 2,
    ey
  );
  path.lineTo(ex, ey);
  path.bezierCurveTo(ex - offsetX, ey, ex - offsetX, y, ex, y);
  path.closePath();
  if (path instanceof Path2D) return path;
}
