import { Pen } from '../pen';

export function diamond(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  path.moveTo(x + width / 2, y);
  path.lineTo(x + width, y + height / 2);
  path.lineTo(x + width / 2, y + height);
  path.lineTo(x, y + height / 2);
  path.lineTo(x + width / 2, y);
  path.closePath();

  if (path instanceof Path2D) return path;
}
