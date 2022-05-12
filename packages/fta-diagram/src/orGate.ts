import { Pen, Point } from '@topology/core';

export function orGate(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  const myw = width / 2;
  const myh = height / 10;
  path.moveTo(x + myw, y);
  path.lineTo(x + myw, y + myh);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x + myw * 2, y + myh, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + myh);
  path.quadraticCurveTo(x, y + myh, x, y + myh * 9);
  path.quadraticCurveTo(x + myw, y + myh * 6, x + myw * 2, y + myh * 9);
  path.moveTo(x + myw, y + (height * 3) / 4);
  path.lineTo(x + myw, y + height);
  path.moveTo(x + (myw * 2) / 5, y + (height * 201) / 250);
  path.lineTo(x + (myw * 2) / 5, y + height);
  path.moveTo(x + (myw * 8) / 5, y + (height * 201) / 250);
  path.lineTo(x + (myw * 8) / 5, y + height);

  path.closePath();

  if (path instanceof Path2D) return path;
}

export function orGateAnchors(pen: Pen) {
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
    x: 1 / 5,
    y: 1,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 1,
  });

  anchors.push({
    id: '3',
    penId: pen.id,
    x: 4 / 5,
    y: 1,
  });
  pen.anchors = anchors;
}
