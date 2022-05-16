import { Pen, Point } from '@topology/core';

export function forbiddenGate(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  const myh = height / 8;
  const myw = 0.25 * width;
  path.moveTo(x + myw * 2, y);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.lineTo(x + myw * 3, y + myh * 3);
  path.lineTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 1, y + myh * 5);
  path.lineTo(x + myw * 1, y + myh * 3);
  path.lineTo(x + myw * 2, y + myh * 2);
  path.moveTo(x + myw * 3, y + myh * 4);
  path.lineTo(x + myw * 4, y + myh * 4);
  path.moveTo(x + myw * 2, y + myh * 6);
  path.lineTo(x + myw * 2, y + myh * 8);

  path.closePath();
  if (path instanceof Path2D) return path;
}

export function forbiddenGateAnchors(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.5,
    y: 0,
  });

  anchors.push({
    id: '1',
    penId: pen.id,
    x: 1,
    y: 0.5,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 1,
  });

  pen.anchors = anchors;
}
