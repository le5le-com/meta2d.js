import { Pen } from '../../models';

export function people(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ex, ey } = pen;
  const w = Math.max(1, width);
  const h = Math.max(1, ey - y);
  const middle = x + w / 2;

  // 比例布局，确保不越界
  const headRadius = Math.max(0.5, Math.min(w, h) * 0.2);
  const headCy = y + headRadius;
  const shoulderY =  y + h * 0.5;
  const torsoTopY = headCy + headRadius;
  const torsoBottomY = y + h * 0.8;

  // 头部：单独路径，可填充
  ctx.beginPath();
  ctx.arc(middle, headCy, headRadius, 0, Math.PI * 2);

  // 肩膀
  ctx.moveTo(x, shoulderY);
  ctx.lineTo(ex, shoulderY);
  // 躯干
  ctx.moveTo(middle, torsoTopY);
  ctx.lineTo(middle, torsoBottomY);
  // 双腿
  ctx.moveTo(middle, torsoBottomY);
  ctx.lineTo(x, ey);
  ctx.moveTo(middle, torsoBottomY);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
