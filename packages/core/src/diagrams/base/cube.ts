import { Pen, Point } from '../../models';

export function cube(ctx: CanvasRenderingContext2D, pen: Pen) {
  const { x, y, width,height, ex, ey } = pen;
  // 初始偏移：按宽度的比例
  let offset = width * 0.25;
  const z: number = (pen as any).z;
  if (typeof z === 'number') {
    if (z > 1) {
      offset = z;
    } else if (z >= 0) {
      offset = width * z;
    }
  }
  
  const maxOffset = Math.min(width, height) * 0.5;
  offset = Math.max(0, Math.min(offset, maxOffset));

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

  // up (顶部先画，避免被前面遮挡)
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
    (pen as any).backgroundUp
  );

  // right (右侧其次)
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
    (pen as any).backgroundRight
  );
  face(ctx, [p1, p2, p3, p4], (pen as any).backgroundFront);
}

function face(ctx: CanvasRenderingContext2D, points: Point[], fillStyle = '') {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < points.length; ++i) {
    if (i) {
      ctx.lineTo(points[i].x, points[i].y);
    } else {
      ctx.moveTo(points[i].x, points[i].y);
    }
  }
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
