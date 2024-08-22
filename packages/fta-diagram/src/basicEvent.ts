import { Pen, Point } from '@meta2d/core';

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
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 0.5,
      y: 1,
    },
  ] as const;
  pen.anchors = points.map(({ x, y }, index) => {
    return {
      id: `${index}`,
      penId: pen.id,
      x,
      y,
    };
  });
}
