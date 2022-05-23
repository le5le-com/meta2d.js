import { Pen } from '../pen';
import { Point } from '../point';

export function cube(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width, ex, ey } = pen.calculative.worldRect;
  let offset = width * 0.25;

  const z: number = (pen as any).z;
  if (z > 1) {
    offset = z;
  } else if (z > 0) {
    offset = width * z;
  }

  const p1 = {
    x: x,
    y: y + offset,
  };
  const p2 = {
    x: ex - offset,
    y: y + offset,
  };
  const p3 = {
    x: ex - offset,
    y: ey,
  };
  const p4 = {
    x: x,
    y: ey,
  };

  // front
  face(
    ctx,
    [p1, p2, p3, p4],
    (pen as any).backgroundFront || pen.background,
    pen.color
  );

  // up
  face(
    ctx,
    [
      p1,
      {
        x: x + offset,
        y: y,
      },
      { x: ex, y: y },
      p2,
    ],
    (pen as any).backgroundUp || pen.background,
    pen.color
  );

  // right
  face(
    ctx,
    [
      p2,
      { x: ex, y: y },
      {
        x: ex,
        y: ey - offset,
      },
      p3,
    ],
    (pen as any).backgroundRight || pen.background,
    pen.color
  );
}

function face(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fillStyle = '',
  strokeStyle = ''
) {
  ctx.save();
  fillStyle && (ctx.fillStyle = fillStyle);
  strokeStyle && (ctx.strokeStyle = strokeStyle);
  ctx.beginPath();
  for (let i = 0; i < points.length; ++i) {
    if (i) {
      ctx.lineTo(points[i].x, points[i].y);
    } else {
      ctx.moveTo(points[i].x, points[i].y);
    }
  }
  ctx.closePath();
  fillStyle && ctx.fill();
  ctx.stroke();
  ctx.restore();
}
