import { Pen } from '@meta2d/core';
export function flowData(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ex, ey } = pen;
  const penOffsetX: number = (pen as any).offsetX;
  let offsetX = width / 7;
  if (penOffsetX > 1) {
    offsetX = penOffsetX;
  } else if (penOffsetX > 0) {
    offsetX = width * penOffsetX;
  }

  ctx.beginPath();
  ctx.moveTo(x + offsetX, y);
  ctx.lineTo(ex, y);
  ctx.lineTo(x + width - offsetX, ey);
  ctx.lineTo(x, ey);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
