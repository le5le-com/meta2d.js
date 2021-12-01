import { Pen, Point } from '@topology/core';

export function mindLine(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  const { x, y, width, height } = pen.calculative.worldRect;
  path.moveTo(x, y + height);
  path.lineTo(x + width, y + height);
  path.closePath();
  return path;
}

export function mindLineAnchors(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '0',
    x: 0,
    y: 1,
  });
  anchors.push({
    id: '0',
    x: 1,
    y: 1,
  });
  pen.anchors = anchors;
}
