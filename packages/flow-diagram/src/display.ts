import { Pen } from '../../core/src/pen';
export function flowDisplay(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height, ex, ey } = pen.calculative.worldRect;
  const offsetX = width / 8;
  path.moveTo(x + offsetX, y);
  path.lineTo(ex - offsetX, y);
  path.bezierCurveTo(
    ex + offsetX / 3,
    y,
    ex + offsetX / 3,
    ey,
    ex - offsetX,
    ey
  );
  path.lineTo(x + offsetX, ey);
  path.lineTo(x, y + height / 2);
  path.closePath();
  if (path instanceof Path2D) return path;
}
