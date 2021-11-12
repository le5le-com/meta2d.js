import { Pen } from '../pen';
import { Point } from '../point';

export function triangle(pen: Pen, path?: CanvasRenderingContext2D | Path2D) {
  if (!pen.onDestroy) {
    pen.onAdd = onAdd;
  }
  if (!path) {
    path = new Path2D();
  }
  path.moveTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.y
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    pen.calculative.worldRect.y
  );

  path.closePath();

  return path;
}

function onAdd(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.5, //pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
    y: 0, //pen.calculative.worldRect.y,
  });

  anchors.push({
    id: '1',
    penId: pen.id,
    x: 1, //pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    y: 1, //pen.calculative.worldRect.y + pen.calculative.worldRect.height,
  });

  anchors.push({
    id: '2',
    penId: pen.id,
    x: 0, //pen.calculative.worldRect.x,
    y: 1, //pen.calculative.worldRect.y + pen.calculative.worldRect.height,
  });
  // pen.calculative.worldAnchors = anchors;
  pen.anchors = anchors;
}
