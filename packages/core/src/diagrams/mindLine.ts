import { Pen, Point } from '@topology/core';

export function mindLine(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  path.moveTo(x, y + height);
  path.lineTo(x + width, y + height);
  path.closePath();
  if (path instanceof Path2D) return path;
}

export function mindLineAnchors(pen: Pen) {
  const points = [
    {
      x: 0,
      y: 1,
    },
    {
      x: 1,
      y: 1,
    },
  ] as const;
  pen.anchors = points.map(({ x, y }, index) => {
    return {
      id: index + '',
      x,
      y,
      penId: pen.id,
    };
  });
}
