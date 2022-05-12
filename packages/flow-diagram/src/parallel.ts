import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowParallel(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, ex, ey } = pen.calculative.worldRect;

  path.moveTo(x, y);
  path.lineTo(ex, y);
  path.moveTo(x, ey);
  path.lineTo(ex, ey);
  if (path instanceof Path2D) return path;
}

export function flowParallelAnchors(pen: Pen) {
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
