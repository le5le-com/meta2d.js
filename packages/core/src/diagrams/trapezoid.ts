import { Pen } from '../pen';
export function trapezoid(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const topRatio = (pen.calculative as any).topRatio || 0.5;
  const topW = width * topRatio;
  const left = x + (width - topW) / 2;
  const right = left + topW;

  path.moveTo(left, y);
  path.lineTo(right, y);
  path.lineTo(x + width, y + height);
  path.lineTo(x, y + height);
  path.closePath();

  if (path instanceof Path2D) {
    return path;
  }
}

export function trapezoidAnchors(pen: Pen) {
  const topRatio = (pen.calculative as any).topRatio || 0.5;
  pen.anchors = [
    { id: '0', penId: pen.id, x: 0 + (1 - topRatio) / 2, y: 0 },
    { id: '1', penId: pen.id, x: 1 - (1 - topRatio) / 2, y: 0 },
    { id: '2', penId: pen.id, x: 0, y: 1 },
    { id: '3', penId: pen.id, x: 1, y: 1 },
  ];
}
