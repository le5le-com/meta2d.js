import { Pen, Point } from '../../models';

export function rectangle(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ex, ey } = pen;
  let r = pen.borderRadius || 0;
  if (r > 0 && r < 1) {
    r *= Math.min(width, height);
  }
  r = Math.min(r, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(ex, y, ex, ey, r);
  ctx.arcTo(ex, ey, x, ey, r);
  ctx.arcTo(x, ey, x, y, r);
  ctx.arcTo(x, y, ex, y, r);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}

export const square = rectangle;

// 判断点是否在边上
export function rectangleEdge(pen: Pen, px: number, py: number) {
  let wr = pen.borderRadius || 0,
    hr = wr;
  const { x, y, width, height, ex, ey } = pen;
  if (wr < 1) {
    wr = (width * wr) | 0;
    hr = (height * hr) | 0;
  }
  let r = wr < hr ? wr : hr;
  r = Math.min(r, width / 2, height / 2);

  // 是否在直线上
  const leftX = x + r,
    rightX = ex - r;
  const topY = y + r,
    bottomY = ey - r;
  // 1. 上边
  if (px >= leftX && px <= rightX && py >= y - 5 && py <= y + 5) {
    return { x: px, y };
  }
  // 2. 下边
  if (py >= ey - 5 && py <= ey + 5 && px >= leftX && px <= rightX) {
    return { x: px, y: ey };
  }
  // 3. 左边
  if (px >= x - 5 && px <= x + 5 && py >= topY && py <= bottomY) {
    return { x, y: py };
  }
  // 4. 右边
  if (px >= ex - 5 && px <= ex + 5 && py >= topY && py <= bottomY) {
    return { x: ex, y: py };
  }

  // 左上角
  if (px <= leftX && py <= topY) {
    const pt = onCorner(px, py, x + r, y + r, r, Math.PI, 1.5 * Math.PI);
    if (pt) return pt;
  }
  // 右上角
  if (px >= rightX && py <= topY) {
    const pt = onCorner(px, py, ex - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
    if (pt) return pt;
  }
  // 左下角
  if (px <= leftX && py >= bottomY) {
    const pt = onCorner(px, py, x + r, ey - r, r, 0.5 * Math.PI, Math.PI);
    if (pt) return pt;
  }
  // 右下角
  if (px >= rightX && py >= bottomY) {
    const pt = onCorner(px, py, ex - r, ey - r, r, 0, 0.5 * Math.PI);
    if (pt) return pt;
  }
}

function onCorner(px: number, py: number, cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  // 距圆心距离
  const dx = px - cx,
    dy = py - cy;
  const dist = Math.hypot(dx, dy);
  // 距理想圆线的距离
  const dToCircle = Math.abs(dist - r);
  // 点的极角
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  // 判断是否在有效的圆弧范围
  const inAngle =
    (startAngle < endAngle && angle >= startAngle && angle <= endAngle) ||
    (startAngle > endAngle && (angle >= startAngle || angle <= endAngle));
  if (dToCircle <= 5 && inAngle) {
    // 投影到圆弧上中点
    // const projAngle = Math.max(startAngle, Math.min(angle, endAngle));
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    return { x: px, y: py };
  }
}
