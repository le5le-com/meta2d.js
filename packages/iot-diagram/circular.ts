export function circular(pen: any) {
  const path = new Path2D();

  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  const R = h > w ? Math.floor((w - 2 * pen.lineWidth) / 2) : Math.floor((h - 2 * pen.lineWidth) / 2);

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;

  let value = pen.data.value;
  pen.text = (value * 100).toFixed(0) + '%';
  path.arc(x + w / 2, y + h / 2, R, 0, 2 * Math.PI);

  path.moveTo(x + w / 2, y + h / 2 - R);
  path.arc(x + w / 2, y + h / 2, R + 2, -0.5 * Math.PI, (Math.PI / 180) * (value * 360) - 0.5 * Math.PI);
  // path.closePath();
  return path;
}

export function circularNumberByCtx(ctx: CanvasRenderingContext2D, pen: any) {
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  ctx.fillStyle = pen.fontColor ?? '#000';
  ctx.textAlign = 'center';
  let fontSize = w > h ? h / 5 : w / 5;
  ctx.font = fontSize + 'px Arial';
  ctx.fillText(
    (pen.data.value * 100).toFixed(0) + '%',
    w / 2 + pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + h / 2
  );
  ctx.restore();
}
