import { Pen, Point } from '../../models';

export function triangle(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;

  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + width / 2, y);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}

// 三角形锚点：顶点+三边中点（使用相对坐标）
export function triangleAnchors(pen: Pen) {
  const points = [
    { x: 0.5, y: 0 },    // 顶点
    { x: 0.75, y: 0.5 }, // 右边中点
    { x: 0.5, y: 1 },    // 底边中点
    { x: 0.25, y: 0.5 }, // 左边中点
  ];
  return points.map((item, index) => ({
    id: index.toString(),
    x: item.x,
    y: item.y,
  }));
}
