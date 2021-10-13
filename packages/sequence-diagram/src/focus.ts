import { Pen } from '../../core/src/pen';
export function focus(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }

  path.rect(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.width,
    pen.calculative.worldRect.height
  );

  path.closePath();
  return path;
}
