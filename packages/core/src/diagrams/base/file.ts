import { Pen, Point } from '../../models';

export function file(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ex, ey } = pen;
  const offsetX = Math.max(0,  Math.max(1, Math.min(width, height) * 0.4));

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex - offsetX, y);
  ctx.lineTo(ex, y + offsetX);
  ctx.lineTo(ex, ey);
  ctx.lineTo(x, ey);
  ctx.closePath();
  
  ctx.moveTo(ex - offsetX, y);
  ctx.lineTo(ex - offsetX, y + offsetX);
  ctx.lineTo(ex, y + offsetX);
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
