import { Pen, Point } from '../../models';

export function diamond(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height / 2);
  ctx.lineTo(x + width / 2, y + height);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.closePath();
  ctx.stroke();
  
  if(pen.fillStyles && pen.fillStyles.length > 0) {
    for(const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
