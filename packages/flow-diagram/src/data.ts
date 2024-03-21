import { Pen } from '../../core/src/pen';
export function flowData(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, ex, ey } = pen.calculative.worldRect;
  const penOffsetX: number = (pen as any).offsetX;
  let offsetX = width / 7;
  if (penOffsetX > 1) {
    offsetX = penOffsetX;
  } else if (penOffsetX > 0) {
    offsetX = width * penOffsetX;
  }
  path.moveTo(x + offsetX, y);
  path.lineTo(ex, y);
  path.lineTo(x + width - offsetX, ey);
  path.lineTo(x, ey);
  path.closePath();
  if (path instanceof Path2D) return path;
}

export function flowDataAnchors(pen: Pen) {
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 13/14,
      y: 0.5,
    },
    {
      x: 0.5,
      y: 1,
    },
    {
      x: 1/14,
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
