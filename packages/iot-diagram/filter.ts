import { TopologyPen } from '../core/src/pen';
export function filter(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let myw = pen.calculative.worldRect.width / 4;
  let myh = pen.calculative.worldRect.height / 6;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  path.rect(
    x,
    y,
    pen.calculative.worldRect.width,
    pen.calculative.worldRect.height
  );

  for (let i = 1; i < 6; i++) {
    path.moveTo(x, y + myh * i);
    path.lineTo(x + pen.calculative.worldRect.width, y + myh * i);
  }
  for (let i = 1; i < 4; i++) {
    path.moveTo(x + myw * i, y);
    path.lineTo(x + myw * i, y + pen.calculative.worldRect.height);
  }

  path.closePath();
  return path;
}
