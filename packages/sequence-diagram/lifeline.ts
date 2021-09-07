export function lifeline(pen: any) {
  const path = new Path2D();

  let height = 0;
  if (!pen.data.headHeight) {
    height = 50;
  } else {
    height = pen.data.headHeight;
  }
  if (!pen.borderRadius) {
    pen.borderRadius = 0;
  }
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
  path.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    r
  );
  path.closePath();
  return path;
}

export function lifelineDashByCtx(ctx: CanvasRenderingContext2D, pen: any) {
  let height = 0;
  if (!pen.data.headHeight) {
    height = 50;
  } else {
    height = pen.data.headHeight;
  }
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.setLineDash([7, 7]);
  const middle = pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  ctx.moveTo(middle, pen.calculative.worldRect.y + height + 1);
  ctx.lineTo(middle, pen.calculative.worldRect.ey);
  ctx.stroke();
  ctx.restore();
}
