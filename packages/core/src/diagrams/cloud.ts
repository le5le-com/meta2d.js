import { Pen } from '../pen';

export function cloud(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  path.moveTo(x + width / 5, y + (height * 13) / 16);
  path.bezierCurveTo(
    x - width / 15,
    y + (height * 13) / 16,
    x - width / 15,
    y + (height * 7) / 16,
    x + width / 5,
    y + (height * 7) / 16
  );
  path.bezierCurveTo(
    x + width / 5,
    y,
    x + (width * 4) / 5,
    y,
    x + (width * 4) / 5,
    y + (height * 7) / 16
  );
  path.bezierCurveTo(
    x + (width * 16) / 15,
    y + (height * 7) / 16,
    x + (width * 16) / 15,
    y + (height * 13) / 16,
    x + (width * 4) / 5,
    y + (height * 13) / 16
  );
  path.closePath();
  if (path instanceof Path2D) return path;
}
