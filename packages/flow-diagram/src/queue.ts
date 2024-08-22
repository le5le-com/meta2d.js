import { Pen } from '@meta2d/core/src/pen';
export function flowQueue(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height, ex, ey } = pen.calculative.worldRect;
  path.ellipse(
    x + width / 2,
    y + height / 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2
  );

  path.moveTo(x + width / 2, ey);
  path.lineTo(ex, ey);
  path.closePath();
  if (path instanceof Path2D) return path;
}
