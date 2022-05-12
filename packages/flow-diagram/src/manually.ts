import { Point } from '@topology/core/src/point';
import { Pen } from '../../core/src/pen';
export function flowManually(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, height, ex, ey } = pen.calculative.worldRect;
  const offsetY = height / 4;
  path.moveTo(x, y + offsetY);
  path.lineTo(ex, y);
  path.lineTo(ex, ey);
  path.lineTo(x, ey);
  path.closePath();
  if (path instanceof Path2D) return path;
}

export function flowManuallyAnchors(pen: Pen) {
  const anchors: Point[] = [];
  anchors.push({
    id: '0',
    penId: pen.id,
    x: 0.5,
    y: 0.125,
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
    y: 1,
  });

  anchors.push({
    id: '3',
    penId: pen.id,
    x: 0,
    y: 0.5,
  });
  pen.anchors = anchors;
}
