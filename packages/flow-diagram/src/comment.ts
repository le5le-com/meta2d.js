import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowComment(
  pen: Pen,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }

  const offsetX = pen.calculative.worldRect.width / 4;
  path.moveTo(
    pen.calculative.worldRect.x + offsetX,
    pen.calculative.worldRect.y
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.ey);
  path.lineTo(
    pen.calculative.worldRect.x + offsetX,
    pen.calculative.worldRect.ey
  );

  return path;
}

export function flowCommentAnchors(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.25,
    y: 0,
  });

  anchors.push({
    id: '1',
    penId: pen.id,
    x: 0.25,
    y: 1,
  });

  anchors.push({
    id: '1',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  pen.anchors = anchors;
}
