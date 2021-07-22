import { TopologyPen } from '../pen';
export function progress(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
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

  let value =pen.data.value;
  path.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);

  path.arcTo(
    pen.calculative.worldRect.x +
      pen.calculative.worldRect.width * (value ? value : 0),
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x +
      pen.calculative.worldRect.width * (value ? value : 0),
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x +
      pen.calculative.worldRect.width * (value ? value : 0),
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
  path.closePath();
  return path;
}
