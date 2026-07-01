import { Pen } from '../pen';

export function parallelogram(
  pen: Pen,
  ctx?: CanvasRenderingContext2D,
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const skew = (pen.calculative as any).skewRatio || 0.2;
  const offset = width * skew;

  path.moveTo(x + offset, y);
  path.lineTo(x + width, y);
  path.lineTo(x + width - offset, y + height);
  path.lineTo(x, y + height);
  path.closePath();

  if (path instanceof Path2D) {
    return path;
  }
}

export function parallelogramAnchors(pen: Pen) {
  const skew = (pen.calculative as any).skewRatio || 0.2;
  pen.anchors = [
    { id: '0', penId: pen.id, x: skew, y: 0 },
    { id: '1', penId: pen.id, x: 1, y: 0 },
    { id: '2', penId: pen.id, x: 0, y: 1 },
    { id: '3', penId: pen.id, x: 1 - skew, y: 1 },
  ];
}
