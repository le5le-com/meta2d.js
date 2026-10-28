import { Pen } from '../../models';

export function message(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ey } = pen;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + (height * 3) / 4);
  ctx.lineTo(x + (width * 8) / 16, y + (height * 3) / 4);
  ctx.lineTo(x + width / 4, ey);
  ctx.lineTo(x + (width * 5) / 16, y + (height * 3) / 4);
  ctx.lineTo(x, y + (height * 3) / 4);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
