import { Pen } from '../pen';

export function cube(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  const offset = pen.calculative.worldRect.width / 4;
  path.moveTo(pen.calculative.worldRect.x + offset, pen.calculative.worldRect.y);
  path.rect(
    pen.calculative.worldRect.x + offset,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.width - offset,
    pen.calculative.worldRect.height - offset
  );
  path.moveTo(pen.calculative.worldRect.x + offset, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + offset);
  path.moveTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width - offset,
    pen.calculative.worldRect.y + offset
  );
  path.moveTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - offset
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width - offset,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.moveTo(
    pen.calculative.worldRect.x + offset,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - offset
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height);
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + offset);
  path.rect(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + offset,
    pen.calculative.worldRect.width - offset,
    pen.calculative.worldRect.height - offset
  );

  path.closePath();

  return path;
}
