import { Pen } from '@meta2d/core';
export function flowDocument(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ex } = pen;
  const centerX = (x + ex) / 2;
  const rightBottomY = y + (height * 6) / 7;
  const offsetY = height / 6;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, y);
  ctx.lineTo(ex, rightBottomY);
  ctx.bezierCurveTo(
    ex - 20,
    rightBottomY - offsetY,
    centerX + width / 5,
    rightBottomY - offsetY,
    centerX,
    rightBottomY
  );
  ctx.bezierCurveTo(centerX - width / 5, rightBottomY + offsetY, x, rightBottomY + offsetY, x, rightBottomY);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
