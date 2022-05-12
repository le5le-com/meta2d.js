import { Pen, Point } from '@topology/core';

export function conditionalEvent(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  const myh = height / 2;
  const myw = width / 5;
  path.moveTo(x, y + myh);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw * 5, y + myh);
  path.ellipse(x + myw * 3, y + myh, 2 * myw, myh, 0, 0, Math.PI * 2);

  path.closePath();
  if (path instanceof Path2D) return path;
}

export function conditionalEventAnchors(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '3',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 3 / 5,
    y: 0,
  });
  anchors.push({
    id: '2',
    penId: pen.id,
    x: 3 / 5,
    y: 1,
  });
  anchors.push({
    id: '1',
    penId: pen.id,
    x: 1,
    y: 0.5,
  });

  pen.anchors = anchors;
}
