import { Pen } from '@meta2d/core';

export function basicEvent(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const vlineL = height - width;
  const radius = 0.5 * width;

  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width / 2, y + vlineL);
  
  ctx.moveTo(x + width, y + radius + vlineL);
  ctx.arc(x + width / 2, y + radius + vlineL, radius, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
