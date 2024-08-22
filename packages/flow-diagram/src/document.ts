import { Pen } from '@meta2d/core/src/pen';
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
  const points = [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 1,
      y: 0.5,
    },
    {
      x: 0.5,
      y: 6 / 7,
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
