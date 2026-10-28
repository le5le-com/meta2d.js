import { Pen } from '@meta2d/core';

export function flowDb(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, height, ex, ey } = pen;
  const ellipseHeight = height / 7;

  const topCenterY = y + ellipseHeight / 2;
  const bottomCenterY = ey - ellipseHeight / 2;

  ctx.beginPath();
  ctx.moveTo(x, topCenterY);
  ctx.bezierCurveTo(x, y, ex, y, ex, topCenterY);
  ctx.lineTo(ex, bottomCenterY);
  ctx.bezierCurveTo(ex, ey, x, ey, x, bottomCenterY);
  ctx.closePath();

  ctx.moveTo(x, bottomCenterY);
  ctx.bezierCurveTo(x, bottomCenterY - ellipseHeight / 2, ex, bottomCenterY - ellipseHeight / 2, ex, bottomCenterY);

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  ctx.stroke();
}
