import { TopologyPen } from '../core/src/pen';
export function lifeline(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
     return;
  }
  const path = new Path2D();
 
  const height = 50;
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
  if (height < 2 * r) {
    r = height / 2;
  }

  path.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);
  path.arcTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y, pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y + height, r);
  path.arcTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y + height, pen.calculative.worldRect.x, pen.calculative.worldRect.y + height, r);
  path.arcTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + height, pen.calculative.worldRect.x, pen.calculative.worldRect.y, r);
  path.arcTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y, pen.calculative.worldRect.x + pen.calculative.worldRect.width, pen.calculative.worldRect.y, r);


  pen.lineWidth = 1;
  path.setLineDash([7, 7]);
  const middle = pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  path.moveTo(middle, pen.calculative.worldRect.y + height + 1);
  path.lineTo(middle, pen.calculative.worldRect.ey);
  path.stroke();
  path.restore();

  path.closePath();
  return path;
}