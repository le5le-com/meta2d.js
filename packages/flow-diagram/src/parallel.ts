import { Point } from '@meta2d/core';
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
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 0.5,
      y: 1,
    },
  ] as const;
  pen.anchors = points.map(({ x, y }, index) => {
    return {
      id: index + '',
      x,
      y,
      penId: pen.id,
    };
  });
}
