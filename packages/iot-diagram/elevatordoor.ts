import { Pen } from '../core/src/pen';
export function elevatordoor(pen: Pen) {
  const path = new Path2D();
  pen.lineWidth = 2;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let halfWidth = pen.calculative.worldRect.width / 2;

  path.rect(x, y, pen.calculative.worldRect.width, pen.calculative.worldRect.height);

  path.closePath();

  const path1 = new Path2D();

  // pen.lineWidth = 5;
  path1.moveTo(x + halfWidth, y);
  path1.lineTo(x + halfWidth, y + pen.calculative.worldRect.height);

  path1.closePath();
  path.addPath(path1);
  return path;
}
