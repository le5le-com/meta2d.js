import { Pen, Point } from '../../models';

export function pentagram(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { width, height, x, y } = pen;

  const radius = Math.min(width, height) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // 外圈半径和内圈半径
  const outerRadius = radius;
  const innerRadius = radius / 2.5;

  // 预计算所有顶点（5个外顶点 + 5个内顶点，共10个点）
  const points: Point[] = [];
  const angleStep = (Math.PI * 2) / 5;
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < 5; i++) {
    const outerAngle = startAngle + angleStep * i;
    points.push({
      x: centerX + outerRadius * Math.cos(outerAngle),
      y: centerY + outerRadius * Math.sin(outerAngle),
    });

    const innerAngle = outerAngle + angleStep / 2;
    points.push({
      x: centerX + innerRadius * Math.cos(innerAngle),
      y: centerY + innerRadius * Math.sin(innerAngle),
    });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
