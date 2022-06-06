import { Pen, Point } from '@topology/core';

export function xorGate(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;

  let myw = width / 2;
  let myh = height / 10;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  path.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  path.moveTo(x, y + myh * 10);
  path.quadraticCurveTo(x + myw, y + myh * 7, x + myw * 2, y + myh * 10);
  path.moveTo(x + (myw * 2) / 5, y + (height * 201) / 250 + myh);
  path.lineTo(x + (myw * 2) / 5, y + height);
  path.moveTo(x + (myw * 8) / 5, y + (height * 201) / 250 + myh);
  path.lineTo(x + (myw * 8) / 5, y + height);
  path.closePath();

  if (path instanceof Path2D) return path;
}

export function xorGateAnchors(pen: Pen) {
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 1 / 5,
      y: 1,
    },
    {
      x: 4 / 5,
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
