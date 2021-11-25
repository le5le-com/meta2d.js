import { Pen } from '../pen';
import { Point } from '../point';

export function triangle(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!path) {
    path = new Path2D();
  }
  path.moveTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2, pen.calculative.worldRect.y);
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + pen.calculative.worldRect.height);
  path.lineTo(pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2, pen.calculative.worldRect.y);

  path.closePath();

  return path;
}

export function triangleAnchors(pen: Pen) {
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
    x: 0.75,
    y: 0.5,
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
    x: 0.25,
    y: 0.5,
  });
  pen.anchors = anchors;
}
