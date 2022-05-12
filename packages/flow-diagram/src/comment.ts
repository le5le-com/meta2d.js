import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowComment(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ey } = pen.calculative.worldRect;
  const offsetX = width / 4;
  path.moveTo(x + offsetX, y);
  path.lineTo(x, y);
  path.lineTo(x, ey);
  path.lineTo(x + offsetX, ey);
  if (path instanceof Path2D) return path;
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
    id: '2',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  pen.anchors = anchors;
}
