export function switchEvent(
  pen: any,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  let myh = pen.calculative.worldRect.height / 4;
  let myw = 0.5 * pen.calculative.worldRect.width;
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.lineTo(x + myw * 2, y + myh * 4);
  path.lineTo(x, y + myh * 4);
  path.lineTo(x, y + myh * 2);
  path.lineTo(x + myw, y + myh);
  path.closePath();

  return path;
}
