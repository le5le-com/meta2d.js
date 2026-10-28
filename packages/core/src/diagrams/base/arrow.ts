import { Pen } from '../../models';

export function leftArrow(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const cy = y + height / 2;
  const headLen = Math.min(width * 0.4, height);
  const shaftHalf = Math.max(1, height * 0.25);
  const baseX = x + headLen;

  ctx.beginPath();
  ctx.moveTo(baseX, y);
  ctx.lineTo(x, cy);
  ctx.lineTo(baseX, y + height);
  ctx.lineTo(baseX, cy + shaftHalf);
  ctx.lineTo(x + width, cy + shaftHalf);
  ctx.lineTo(x + width, cy - shaftHalf);
  ctx.lineTo(baseX, cy - shaftHalf);
  ctx.closePath();
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}

export function rightArrow(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const cy = y + height / 2;
  const headLen = Math.min(width * 0.4, height);
  const shaftHalf = Math.max(1, height * 0.25);
  const baseX = x + Math.max(0, width - headLen);

  ctx.beginPath();
  ctx.moveTo(x, cy - shaftHalf);
  ctx.lineTo(baseX, cy - shaftHalf);
  ctx.lineTo(baseX, y);
  ctx.lineTo(x + width, cy);
  ctx.lineTo(baseX, y + height);
  ctx.lineTo(baseX, cy + shaftHalf);
  ctx.lineTo(x, cy + shaftHalf);
  ctx.closePath();
  ctx.stroke();
  
  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}

export function twowayArrow(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, height } = pen;
  const cy = y + height / 2;
  const headLen = Math.min(width * 0.4, height);
  const shaftHalf = Math.max(1, height * 0.25);
  const leftBaseX = x + headLen;  
  const rightBaseX = x + width - headLen; 

  ctx.beginPath();
  ctx.moveTo(leftBaseX, cy - shaftHalf);
  ctx.lineTo(rightBaseX, cy - shaftHalf);
  ctx.lineTo(rightBaseX, y);
  ctx.lineTo(x + width, cy);
  ctx.lineTo(rightBaseX, y + height);
  ctx.lineTo(rightBaseX, cy + shaftHalf);
  ctx.lineTo(leftBaseX, cy + shaftHalf);
  ctx.lineTo(leftBaseX, y + height);
  ctx.lineTo(x, cy); 
  ctx.lineTo(leftBaseX, y);
  ctx.stroke();

  if (pen.fillStyles && pen.fillStyles.length > 0) {
    for (const fillStyle of pen.fillStyles) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  }
}
