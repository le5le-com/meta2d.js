import { Pen } from '../pen';

export function rectangle(pen: Pen, path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  let wr = pen.borderRadius || 0;
  let hr = pen.borderRadius || 0;
  if (wr < 1) {
    wr = pen.calculative.worldRect.width * wr;
    hr = pen.calculative.worldRect.height * hr;
  }
  let r = wr < hr ? wr : hr;
  if (pen.calculative.worldRect.width < 2 * r) {
    r = pen.calculative.worldRect.width / 2;
  }
  if (pen.calculative.worldRect.height < 2 * r) {
    r = pen.calculative.worldRect.height / 2;
  }

  path.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);
  path.arcTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.ey,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.ey,
    r
  );
  path.arcTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey, pen.x, pen.y, r);
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y,
    r
  );
  return path;
}
