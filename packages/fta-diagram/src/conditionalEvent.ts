import { Pen, Point } from '../../core';

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
  const points = [
    {
      x: 0.6,
      y: 0,
    },
    { x: 1, y: 0.5 },
    { x: 0.6, y: 1 },
    { x: 0, y: 0.5 },
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
