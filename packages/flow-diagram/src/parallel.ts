import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowParallel(
  pen: Pen,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.ey);

  return path;
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
