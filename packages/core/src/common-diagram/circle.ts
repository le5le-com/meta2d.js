import { Pen } from '../pen';

export function circle(pen: Pen) {
  const path = new Path2D();
  path.ellipse(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2,
    pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.height / 2,
    0,
    0,
    Math.PI * 2
  );

  path.closePath();

  return path;
}
