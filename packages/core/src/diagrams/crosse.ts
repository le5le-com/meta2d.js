import { Pen } from '../pen';

export function crosse(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const ratio = (pen.calculative as any).barRatio || 0.3;
  const barW = width * ratio;
  const barH = height * ratio;
  const cx = x + width / 2;
  const cy = y + height / 2;

  path.rect(cx - barW / 2, y, barW, height);
  path.rect(x, cy - barH / 2, width, barH);

  if (path instanceof Path2D) {
    return path;
  }
}
