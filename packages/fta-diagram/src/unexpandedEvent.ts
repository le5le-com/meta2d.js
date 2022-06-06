import { Pen, Point } from '@topology/core';

export function unexpandedEvent(
  pen: Pen,
  ctx?: CanvasRenderingContext2D
): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  const myh = height / 3;
  const myw = 0.5 * width;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.lineTo(x + width, y + 2 * myh);
  path.lineTo(x + myw, y + height);
  path.lineTo(x, y + 2 * myh);
  path.lineTo(x + myw, y + myh);

  path.closePath();
  if (path instanceof Path2D) return path;
}

export function unexpandedEventAnchors(pen: Pen) {
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 1,
      y: 2 / 3,
    },
    {
      x: 0.5,
      y: 1,
    },
    {
      x: 0,
      y: 2 / 3,
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
