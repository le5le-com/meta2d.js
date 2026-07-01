import { Pen } from '../pen';
import { Point } from '../point';

export function polygon(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const points = getPolygonPoints(pen);

  points.forEach(({ x, y }, index) => {
    if (index) {
      path.lineTo(x, y);
    } else {
      path.moveTo(x, y);
    }
  });

  path.closePath();
  if (path instanceof Path2D) return path;
}

function getPolygonPoints(pen: Pen) {
  const { x, y, width, height } = pen.calculative.worldRect;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(width, height) / 2;
  const sides = Math.max(
    3,
    Math.round(
      Number(
        (pen.calculative as any).sides ||
          (pen.calculative as any).sideCount ||
          (pen.calculative as any).edgeCount,
      ) || 5,
    ),
  );
  const startAngle = -Math.PI / 2;

  return new Array(sides).fill(0).map((_, index) => {
    const angle = startAngle + (Math.PI * 2 * index) / sides;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });
}
