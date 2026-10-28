import { Pen } from '../../models';

export function cloud(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;

  ctx.beginPath();
  ctx.moveTo(x + width / 5, y + (height * 13) / 16);
  ctx.bezierCurveTo(
    x - width / 15,
    y + (height * 13) / 16,
    x - width / 15,
    y + (height * 7) / 16,
    x + width / 5,
    y + (height * 7) / 16
  );
  ctx.bezierCurveTo(x + width / 5, y, x + (width * 4) / 5, y, x + (width * 4) / 5, y + (height * 7) / 16);
  ctx.bezierCurveTo(
    x + (width * 16) / 15,
    y + (height * 7) / 16,
    x + (width * 16) / 15,
    y + (height * 13) / 16,
    x + (width * 4) / 5,
    y + (height * 13) / 16
  );
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
