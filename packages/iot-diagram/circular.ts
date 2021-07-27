export function circular(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();

  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  const R =
    h > w
      ? Math.floor((w - 2 * pen.lineWidth) / 2)
      : Math.floor((h - 2 * pen.lineWidth) / 2);

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  let value = pen.data.value;
  //   pen.text = (value * 100).toFixed(0) + '%';
  path.arc(x + w/2, y +h/2, R, 0, 2 * Math.PI);
  // let lineWidth = pen.lineWidth;
  const path1 = new Path2D();
  // pen.lineWith =4*lineWidth;
  //   path.lineCap = 'round';
  path1.moveTo( x + w/2, y +h/2);
  path1.arcTo(
    x + w/2, y +h/2,
    R,
    -0.5 * Math.PI,
    (Math.PI / 180) * (value * 360) - 0.5 * Math.PI
  );
  path.addPath(path1);
  path.closePath();
  return path;
}
