import { Pen } from '../pen';

export function sector(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) / 2;
  const startAngle = (pen.calculative as any).startAngle ?? 45;
  const endAngle = (pen.calculative as any).endAngle ?? 135;
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  path.moveTo(cx, cy);
  path.arc(cx, cy, r, startRad, endRad);
  path.closePath();
  // 填充+描边
  if (path instanceof Path2D) {
    return path;
  }
}
