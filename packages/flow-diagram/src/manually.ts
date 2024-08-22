import { Pen } from '@meta2d/core/src/pen';
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
  const points = [
    {
      x: 0.5,
      y: 0.125,
    },
    {
      x: 1,
      y: 0.5,
    },
    {
      x: 0.5,
      y: 1,
    },
    {
      x: 0,
      y: 0.5,
    },
  ] as const;
  pen.anchors = points.map(({ x, y }, index) => {
    return {
      id: `${index}`,
      penId: pen.id,
      x,
      y,
    };
  });
}
