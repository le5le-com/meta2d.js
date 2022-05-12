import { Pen } from '../../core/src/pen';
export function flowSubprocess(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ex, ey } = pen.calculative.worldRect;

  const offsetX = width / 7;
  path.moveTo(x, y);
  path.lineTo(ex, y);
  path.lineTo(ex, ey);
  path.lineTo(x, ey);
  path.closePath();

  path.moveTo(x + offsetX, y);
  path.lineTo(x + offsetX, ey);

  path.moveTo(ex - offsetX, y);
  path.lineTo(ex - offsetX, ey);
  if (path instanceof Path2D) return path;
}
