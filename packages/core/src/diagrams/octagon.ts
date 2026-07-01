import { Pen } from '../pen';

export function octagon(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  // 中心点
  const cx = x + width / 2;
  const cy = y + height / 2;

  // 半径（自动适配矩形，不会超出）
  const radius = Math.min(width, height) / 2;

  // 八角形 = 8 边，每段 45°
  const sides = 8;
  const step = (Math.PI * 2) / sides;

  // 从顶部开始绘制（0°朝上，符合组态仪表习惯）
  let angle = -Math.PI / 2;

  path.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));

  // 绘制 8 条边
  for (let i = 1; i <= sides; i++) {
    angle += step;
    path.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }

  path.closePath();

  if (path instanceof Path2D) {
    return path;
  }
}
