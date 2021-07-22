import { TopologyPen } from '../pen';

export function circular(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  //   const R =  Math.floor((w - 2 * pen.lineWidth) / 2);

  const R =
    h > w
      ? Math.floor((w - 2 * pen.lineWidth) / 2)
      : Math.floor((h - 2 * pen.lineWidth) / 2);

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  let value = pen.data.value;
  //   pen.text = (value * 100).toFixed(0) + '%';\
  path.arc(x + R + pen.lineWidth, y + R + pen.lineWidth, R, 0, 2 * Math.PI);

  let lineWidth = pen.lineWidth;
  pen.lineWith *=1.5;
  //   path.lineCap = 'round';
  path.moveTo( x + R + lineWidth,
    y + R +lineWidth);
  path.arcTo(
    x + R + lineWidth,
    y + R +lineWidth,
    R,
    -0.5 * Math.PI,
    (Math.PI / 180) * (value * 360) - 0.5 * Math.PI
  );

//   path.closePath();

  return path;
}
