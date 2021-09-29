import { Pen } from '../core/src/pen';
export function flowQueue(
  pen: Pen,
  path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }
  path.ellipse(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.height / 2,
    0,
    0,
    Math.PI * 2
  );

  path.moveTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.ey
  );
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);
  path.closePath();
  return path;
}
