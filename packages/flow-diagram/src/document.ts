import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowDocument(
  pen: Pen,
  path?: CanvasRenderingContext2D | Path2D
) {
  if (!path) {
    path = new Path2D();
  }
  const x = pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2;
  const y =
    pen.calculative.worldRect.y + (pen.calculative.worldRect.height * 6) / 7;
  const offsetY = pen.calculative.worldRect.height / 6;
  path.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y);
  path.lineTo(pen.calculative.worldRect.ex, y);
  path.bezierCurveTo(
    pen.calculative.worldRect.ex - 20,
    y - offsetY,
    x + pen.calculative.worldRect.width / 5,
    y - offsetY,
    x,
    y
  );
  path.bezierCurveTo(
    x - pen.calculative.worldRect.width / 5,
    y + offsetY,
    pen.calculative.worldRect.x,
    y + offsetY,
    pen.calculative.worldRect.x,
    y
  );
  path.closePath();
  return path;
}

export function flowDocumentAnchors(pen: Pen) {
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
    x: 1,
    y: 0.5,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0.5,
    y: 6 / 7,
  });

  anchors.push({
    id: '3',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  pen.anchors = anchors;
}
