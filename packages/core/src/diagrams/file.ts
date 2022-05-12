import { Pen } from '../pen';

export function file(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ex, ey } = pen.calculative.worldRect;
  const offsetX = width / 6;
  path.moveTo(x, y);
  path.lineTo(ex - offsetX, y);
  path.lineTo(ex, y + offsetX);
  path.lineTo(ex, ey);
  path.lineTo(x, ey);
  path.closePath();
  path.moveTo(ex - offsetX, y);
  path.lineTo(ex - offsetX, y + offsetX);
  path.lineTo(ex, y + offsetX);

  path.closePath();
  if (path instanceof Path2D) return path;
}
