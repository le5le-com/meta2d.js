import { Pen } from '../pen';

export function message(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 8) / 16,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width / 4, pen.calculative.worldRect.ey);
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 5) / 16,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 3) / 4);

  path.closePath();

  return path;
}
