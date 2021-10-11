import { Pen } from '../core/src/pen';
export function fork(pen: Pen): Path2D {
  const path = new Path2D();

  if (!pen.borderRadius) {
    pen.borderRadius = 0;
  }
  const worldRect = pen.calculative.worldRect;

  let wr = pen.borderRadius;
  let hr = pen.borderRadius;
  if (pen.borderRadius < 1) {
    wr = worldRect.width * pen.borderRadius;
    hr = worldRect.height * pen.borderRadius;
  }
  let r = wr < hr ? wr : hr;
  if (worldRect.width < 2 * r) {
    r = worldRect.width / 2;
  }
  if (worldRect.height < 2 * r) {
    r = worldRect.height / 2;
  }

  path.moveTo(worldRect.x + r, worldRect.y);
  path.arcTo(
    worldRect.x + worldRect.width,
    worldRect.y,
    worldRect.x + worldRect.width,
    worldRect.y + worldRect.height,
    r
  );
  path.arcTo(
    worldRect.x + worldRect.width,
    worldRect.y + worldRect.height,
    worldRect.x,
    worldRect.y + worldRect.height,
    r
  );
  path.arcTo(worldRect.x, worldRect.y + worldRect.height, worldRect.x, worldRect.y, r);
  path.arcTo(worldRect.x, worldRect.y, worldRect.x + worldRect.width, worldRect.y, r);
  path.closePath();

  return path;
}
