import { GridDrawerContext } from '../store';
import { Point } from '../point';

export function defaultGridDrawer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { area, align, size, color, rotate }: GridDrawerContext,
  mousePos: Point
) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = color;

  if (rotate) {
    const radian1 = (rotate * Math.PI) / 180;
    const radian2 = radian1 + Math.PI / 2;
    const normal1 = { x: Math.sin(radian1), y: -Math.cos(radian1) };
    const normal2 = { x: Math.sin(radian2), y: -Math.cos(radian2) };
    drawPreciseLines(ctx, area, size, normal1, radian1);
    drawPreciseLines(ctx, area, size, normal2, radian2);
  } else {
    const m = align.x / size;
    const n = align.y / size;
    const offset = size * 10;
    const newX = align.x - Math.ceil(m) * size;
    const newY = align.y - Math.ceil(n) * size;
    const endX = area.x + area.width + offset;
    const endY = area.y + area.height + offset;

    ctx.beginPath();
    for (let i = newX; i <= endX; i += size) {
      ctx.moveTo(i, newY);
      ctx.lineTo(i, area.y + area.height + offset);
    }
    for (let i = newY; i <= endY; i += size) {
      ctx.moveTo(newX, i);
      ctx.lineTo(area.x + area.width + offset, i);
    }
    ctx.stroke();
  }

  return false;
}

function drawPreciseLines(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  area: { x: number; y: number; width: number; height: number },
  spacing: number,
  normal: { x: number; y: number },
  angle: number
) {
  const corners = [
    { x: area.x, y: area.y },
    { x: area.x + area.width, y: area.y },
    { x: area.x + area.width, y: area.y + area.height },
    { x: area.x, y: area.y + area.height },
  ];

  let minProjection = Infinity;
  let maxProjection = -Infinity;

  corners.forEach((corner) => {
    const proj = corner.x * normal.x + corner.y * normal.y;
    minProjection = Math.min(minProjection, proj);
    maxProjection = Math.max(maxProjection, proj);
  });

  const lineCount = Math.ceil((maxProjection - minProjection) / spacing);

  ctx.beginPath();
  for (let i = 0; i <= lineCount; i++) {
    const d = minProjection + i * spacing;

    let points = [];
    for (let j = 0; j < corners.length; j++) {
      const p1 = corners[j];
      const p2 = corners[(j + 1) % corners.length];

      const denom = normal.x * (p2.y - p1.y) - normal.y * (p2.x - p1.x);
      if (Math.abs(denom) > 1e-6) {
        const t =
          (d - p1.x * normal.x - p1.y * normal.y) /
          (normal.x * (p2.x - p1.x) + normal.y * (p2.y - p1.y));
        if (t >= 0 && t <= 1) {
          const x = p1.x + t * (p2.x - p1.x);
          const y = p1.y + t * (p2.y - p1.y);
          points.push({ x, y });
        }
      }
    }

    if (points.length >= 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
    }
  }
  ctx.stroke();
}
