import { Pen, Point } from '../../models';

export function pentagon(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;

  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + (height * 2) / 5);
  ctx.lineTo(x + (width * 4) / 5, y + height);
  ctx.lineTo(x + width / 5, y + height);
  ctx.lineTo(x, y + (height * 2) / 5);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}

// 五边形锚点：5个顶点（使用相对坐标）
export function pentagonAnchors(pen: Pen) {
  const points = [
    { x: 0.5, y: 0 },   // 顶点
    { x: 1, y: 0.4 },   // 右上顶点
    { x: 0.8, y: 1 },   // 右下顶点
    { x: 0.2, y: 1 },   // 左下顶点
    { x: 0, y: 0.4 },   // 左上顶点
  ];
  return points.map((item, index) => ({
    id: index.toString(),
    x: item.x,
    y: item.y,
  }));
}
