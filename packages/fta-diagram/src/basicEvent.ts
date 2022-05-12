import { Pen, Point } from '@topology/core';

export function basicEvent(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const vlineL = height - width;
  const radius = 0.5 * width;
  path.moveTo(x + width / 2, y);
  path.lineTo(x + width / 2, y + vlineL);
  path.moveTo(x + width, y + radius + vlineL);
  path.arc(x + width / 2, y + radius + vlineL, radius, 0, Math.PI * 2, false);

  path.closePath();

  if (path instanceof Path2D) return path;
}

export function basicEventAnchors(pen: Pen) {
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
    x: 0.5,
    y: 1,
  });

  pen.anchors = anchors;
}
