export function lifeline(ctx: CanvasRenderingContext2D, pen: any) {
  let height = 0;
  if (!pen.headHeight) {
    height = 50;
  } else {
    height = pen.headHeight;
  }
  if (!pen.calculative.borderRadius) {
    pen.calculative.borderRadius = 0;
  }
  let wr = pen.calculative.borderRadius;
  let hr = pen.calculative.borderRadius;
  if (pen.calculative.borderRadius < 1) {
    wr = pen.calculative.worldRect.width * pen.calculative.borderRadius;
    hr = pen.calculative.worldRect.height * pen.calculative.borderRadius;
  }
  let r = wr < hr ? wr : hr;
  if (pen.calculative.worldRect.width < 2 * r) {
    r = pen.calculative.worldRect.width / 2;
  }
  if (height < 2 * r) {
    r = height / 2;
  }
  ctx.beginPath();
  ctx.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);
  ctx.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + height,
    r
  );
  ctx.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + height,
    r
  );
  ctx.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    r
  );
  ctx.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    r
  );
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 7]);
  const middle =
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  ctx.moveTo(middle, pen.calculative.worldRect.y + height + 1);
  ctx.lineTo(middle, pen.calculative.worldRect.ey);
  ctx.stroke();
  ctx.restore();
  ctx.closePath();
  return false;
}
