import { TopologyPen } from '../pen';

export function rectangle(pen: TopologyPen) {
  let wr = pen.borderRadius || 0;
  let hr = pen.borderRadius || 0;
  if (wr < 1) {
    wr = pen.width * wr;
    hr = pen.height * hr;
  }
  let r = wr < hr ? wr : hr;
  if (pen.width < 2 * r) {
    r = pen.width / 2;
  }
  if (pen.height < 2 * r) {
    r = pen.height / 2;
  }
  const path = new Path2D();
  path.moveTo(pen.x + r, pen.y);
  path.arcTo(
    pen.x + pen.width,
    pen.y,
    pen.x + pen.width,
    pen.y + pen.height,
    r
  );
  path.arcTo(
    pen.x + pen.width,
    pen.y + pen.height,
    pen.x,
    pen.y + pen.height,
    r
  );
  path.arcTo(pen.x, pen.y + pen.height, pen.x, pen.y, r);
  path.arcTo(pen.x, pen.y, pen.x + pen.width, pen.y, r);
  path.closePath();

  return path;
}
