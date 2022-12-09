import { Pen, Point } from '@meta2d/core';

export function andGate(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  const myh = height / 6;
  const myw = width / 4;
  path.moveTo(x + myw * 2, y + 0);
  path.lineTo(x + myw * 2, y + myh);
  path.moveTo(x, y + myh + myw * 2);
  path.arc(
    x + myw * 2,
    y + myh + myw * 2,
    myw * 2,
    Math.PI * 1,
    Math.PI * 2,
    false
  );
  path.lineTo(x + myw * 4, y + myh * 5);
  path.lineTo(x, y + myh * 5);
  path.lineTo(x, y + myh + myw * 2);
  path.moveTo(x + myw, y + myh * 5);
  path.lineTo(x + myw, y + myh * 6);
  path.moveTo(x + myw * 2, y + myh * 5);
  path.lineTo(x + myw * 2, y + myh * 6);
  path.moveTo(x + myw * 3, y + myh * 5);
  path.lineTo(x + myw * 3, y + myh * 6);
  path.closePath();
  if (path instanceof Path2D) return path;
}

export function andGateAnchors(pen: Pen) {
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 0.25,
      y: 1,
    },
    {
      x: 0.5,
      y: 1,
    },
    {
      x: 0.75,
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
