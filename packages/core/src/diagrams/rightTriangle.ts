import { Pen } from '../pen';

export function rightTriangle(
  pen: Pen,
  ctx?: CanvasRenderingContext2D,
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  path.moveTo(x, y + height);
  path.lineTo(x, y);
  path.lineTo(x + width, y + height);
  path.closePath();

  if (path instanceof Path2D) {
    return path;
  }
}

export function rightTriangleAnchors(pen: Pen) {
  pen.anchors = [
    { id: '0', penId: pen.id, x: 0, y: 0 },
    { id: '1', penId: pen.id, x: 0, y: 1 },
    { id: '2', penId: pen.id, x: 1, y: 1 },
  ];
}
