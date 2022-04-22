import { Pen } from '../../core/src/pen';
export function flowData(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  let offsetX = pen.calculative.worldRect.width / 7;
  if ((pen as any).offsetX > 1) {
    offsetX = (pen as any).offsetX;
  } else if ((pen as any).offsetX > 0) {
    offsetX = pen.calculative.worldRect.width * (pen as any).offsetX;
  }
  path.moveTo(pen.calculative.worldRect.x + offsetX, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width - offsetX, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.closePath();
  return path;
}
