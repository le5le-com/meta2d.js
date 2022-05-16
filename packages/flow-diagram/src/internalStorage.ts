import { Pen } from '../../core/src/pen';
export function flowInternalStorage(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ex, ey } = pen.calculative.worldRect;
  path.moveTo(x, y);
  path.lineTo(ex, y);
  path.lineTo(ex, ey);
  path.lineTo(x, ey);
  path.closePath();

  const offset = width / 7;
  path.moveTo(x, y + offset);
  path.lineTo(ex, y + offset);

  path.moveTo(x + offset, y);
  path.lineTo(x + offset, ey);

  if (path instanceof Path2D) return path;
}
