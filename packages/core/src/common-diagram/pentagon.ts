import { Pen } from '../pen';

export function pentagon(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  path.moveTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 5
  );
  path.lineTo(
    pen.calculative.worldRect.x + (pen.calculative.worldRect.width * 4) / 5,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 5,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 2) / 5);

  path.closePath();

  return path;
}
