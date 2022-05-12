import { Point } from '@topology/core';
import { Pen } from '../../core/src/pen';
export function flowDocument(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height, ex, center } = pen.calculative.worldRect;
  const centerX = center.x;
  const rightBottomY = y + (height * 6) / 7;
  const offsetY = height / 6;
  path.moveTo(x, y);
  path.lineTo(ex, y);
  path.lineTo(ex, rightBottomY);
  path.bezierCurveTo(
    ex - 20,
    rightBottomY - offsetY,
    centerX + width / 5,
    rightBottomY - offsetY,
    centerX,
    rightBottomY
  );
  path.bezierCurveTo(
    centerX - width / 5,
    rightBottomY + offsetY,
    x,
    rightBottomY + offsetY,
    x,
    rightBottomY
  );
  path.closePath();
  if (path instanceof Path2D) return path;
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
