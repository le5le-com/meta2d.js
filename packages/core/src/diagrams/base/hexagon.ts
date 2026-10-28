import { Pen, Point } from '../../models';

export function hexagon(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;

  ctx.beginPath();
  ctx.moveTo(x + width / 4, y);
  ctx.lineTo(x + (width * 3) / 4, y);
  ctx.lineTo(x + width, y + height / 2);
  ctx.lineTo(x + (width * 3) / 4, y + height);
  ctx.lineTo(x + (width * 1) / 4, y + height);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x + width / 4, y);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
