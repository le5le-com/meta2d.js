import { Pen } from '../pen';

export function leftArrow(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  path.moveTo(x, y + height / 2);
  path.lineTo(x + height / 2, y);
  path.lineTo(x + height / 2, y + height / 3);
  path.lineTo(x + width, y + height / 3);
  path.lineTo(x + width, y + (height * 2) / 3);
  path.lineTo(x + height / 2, y + (height * 2) / 3);
  path.lineTo(x + height / 2, y + (height * 2) / 3);
  path.lineTo(x + height / 2, y + height);
  path.closePath();
  if (path instanceof Path2D) return path;
}

export function rightArrow(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  path.moveTo(x, y + height / 3);
  path.lineTo(x + (width - height / 2), y + height / 3);
  path.lineTo(x + (width - height / 2), y);
  path.lineTo(x + width, y + height / 2);
  path.lineTo(x + (width - height / 2), y + height);
  path.lineTo(x + (width - height / 2), y + (height * 2) / 3);
  path.lineTo(x, y + (height * 2) / 3);

  path.closePath();
  if (path instanceof Path2D) return path;
}

export function twowayArrow(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  path.moveTo(x, y + height / 2);
  path.lineTo(x + height / 2, y);
  path.lineTo(x + height / 2, y + height / 3);
  path.lineTo(x + (width - height / 2), y + height / 3);
  path.lineTo(x + (width - height / 2), y);
  path.lineTo(x + width, y + height / 2);
  path.lineTo(x + (width - height / 2), y + height);
  path.lineTo(x + (width - height / 2), y + (height * 2) / 3);
  path.lineTo(x + height / 2, y + (height * 2) / 3);
  path.lineTo(x + height / 2, y + height);
  path.closePath();
  if (path instanceof Path2D) return path;
}
