import { Pen } from '../core/src/pen';
export function waterpumpbody(pen: Pen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let myw = pen.calculative.worldRect.width;
  let myh = pen.calculative.worldRect.height;
  let basic = myw > myh ? myh / 7 : myw / 7;

  //   path.lineWidth = pen.data.lineWidth;
  //   path.fillStyle = pen.data.fillColor;
  //   path.strokeStyle = pen.data.strokeColor;
  //   path.beginPath();
  path.moveTo(x + myw / 2 - (basic * 7) / 2, y + myh / 2 - basic / 4);
  path.rect(x + myw / 2 - (basic * 7) / 2, y + myh / 2 - basic / 4, basic, basic / 2);
  path.moveTo(x + myw / 2 + (basic * 5) / 2, y + myh / 2 - basic / 4);

  path.rect(x + myw / 2 + (basic * 5) / 2, y + myh / 2 - basic / 4, basic, basic / 2);

  path.moveTo(x + myw / 2 - basic / 4, y + myh / 2 - (basic * 7) / 2);

  path.rect(x + myw / 2 - basic / 4, y + myh / 2 - (basic * 7) / 2, basic / 2, basic);
  path.moveTo(x + myw / 2 - basic / 4, y + myh / 2 + (basic * 5) / 2);

  path.rect(x + myw / 2 - basic / 4, y + myh / 2 + (basic * 5) / 2, basic / 2, basic);

  path.moveTo(x + myw / 2 + (basic * 5) / 2, y + myh / 2);

  path.arc(x + myw / 2, y + myh / 2, (basic * 5) / 2, 0, Math.PI * 2, false);
  path.moveTo(x + myw / 2 + (basic * 3) / 2, y + myh / 2);

  path.arc(x + myw / 2, y + myh / 2, (basic * 3) / 2, 0, Math.PI * 2, false);
  path.moveTo(x + myw / 2 + basic / 4, y + myh / 2);

  path.arc(x + myw / 2, y + myh / 2, basic / 4, 0, Math.PI * 2, false);

  path.closePath();
  return path;
}
