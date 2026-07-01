import { Pen } from '../pen';

export function chord(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const startAngle = (pen.calculative as any).startAngle ?? 0;
  const endAngle = (pen.calculative as any).endAngle ?? 180;
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  path.ellipse(cx, cy, rx, ry, 0, startRad, endRad);
  // path.closePath();

  if (path instanceof Path2D) {
    return path;
  }
}
