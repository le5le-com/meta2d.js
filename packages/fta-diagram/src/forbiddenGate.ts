import { Pen, Point } from '../../core';

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
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 1,
      y: 0.5,
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
