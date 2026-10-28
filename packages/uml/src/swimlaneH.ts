import { Pen } from '@meta2d/core';
export function swimlaneH(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height, ey } = pen;
  const lineLeft = (pen as any).lineLeft || 0.08;
  let r = pen.borderRadius || 0;
  if (r > 0 && r < 1) {
    r *= Math.min(width, height);
  }
  r = Math.min(r, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();

  //   40 肯定是不合理的，TODO: 该处用宽度的部分值
  // TODO: 算上圆角后，该线可能超出在范围外
  ctx.moveTo(x + lineLeft * width, y);
  ctx.lineTo(x + lineLeft * width, ey);

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }

  ctx.stroke();
}
