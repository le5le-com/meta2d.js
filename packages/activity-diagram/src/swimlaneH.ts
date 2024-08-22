import { Pen } from '@meta2d/core/src/pen';
export function swimlaneH(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height, ey } = pen.calculative.worldRect;
  const lineLeft = (pen.calculative as any).lineLeft || 0.08;
  let wr = pen.calculative.borderRadius || 0,
    hr = wr;
  if (wr < 1) {
    wr = width * wr;
    hr = height * wr;
  }
  let r = wr < hr ? wr : hr;
  if (width < 2 * r) {
    r = width / 2;
  }
  if (height < 2 * r) {
    r = height / 2;
  }

  path.moveTo(x + r, y);
  path.arcTo(x + width, y, x + width, y + height, r);
  path.arcTo(x + width, y + height, x, y + height, r);
  path.arcTo(x, y + height, x, y, r);
  path.arcTo(x, y, x + width, y, r);
  path.closePath();

  //   40 肯定是不合理的，TODO: 该处用宽度的部分值
  // TODO: 算上圆角后，该线可能超出在范围外
  path.moveTo(x + lineLeft * width, y);
  path.lineTo(x + lineLeft * width, ey);

  if (path instanceof Path2D) return path;
}
