import { Pen } from '../../core/src/pen';
export function interfaceClass(pen: Pen) {
  const path = new Path2D();

  let wr = pen.borderRadius;
  let hr = pen.borderRadius;
  if (pen.borderRadius < 1) {
    wr = pen.calculative.worldRect.width * pen.borderRadius;
    hr = pen.calculative.worldRect.height * pen.borderRadius;
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
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    r
  );
  const topHeight = 0.2 * pen.calculative.worldRect.height;
  path.moveTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + topHeight
  );
  path.lineTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y + topHeight
  );

  const height =
    pen.calculative.worldRect.y +
    topHeight +
    (pen.calculative.worldRect.height - topHeight) / 2;
  path.moveTo(pen.calculative.worldRect.x, height);
  path.lineTo(pen.calculative.worldRect.ex, height);

  path.closePath();
  return path;
}
