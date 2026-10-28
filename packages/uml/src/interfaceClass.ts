import { Pen } from '@meta2d/core';
export function interfaceClass(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ex } = pen;
  let r = pen.borderRadius || 0;
  if (r > 0 && r < 1) {
    r *= Math.min(width, height);
  }
  r = Math.min(r, width / 2, height / 2);
  
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  const topHeight = 0.2 * height;
  ctx.moveTo(x, y + topHeight);
  ctx.lineTo(ex, y + topHeight);

  const secondHeight = y + topHeight + (height - topHeight) / 2;
  ctx.moveTo(x, secondHeight);
  ctx.lineTo(ex, secondHeight);
  ctx.closePath();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  ctx.stroke();
}
