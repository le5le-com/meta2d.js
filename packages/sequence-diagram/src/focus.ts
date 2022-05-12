import { Pen } from '../../core/src/pen';
export function focus(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  path.rect(x, y, width, height);

  path.closePath();
  if (path instanceof Path2D) return path;
}
