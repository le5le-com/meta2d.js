import { GridDrawerContext } from '../store';
import {Point} from "../point";

export function defaultGridDrawer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { store, canvas }: GridDrawerContext,
  mousePos: Point
) {
  const { data, options } = store;
  const { gridRotate, gridColor, gridSize, scale, origin, gridScope } = data;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = gridColor || options.gridColor;

  let size = (gridSize || options.gridSize) * scale;
  size = size < 0 ? 0 : size;

  const width = (data.width || options.width) * scale;
  const height = (data.height || options.height) * scale;
  const startX = (data.x || options.x || 0) + origin.x;
  const startY = (data.y || options.y || 0) + origin.y;

  const ratio = store.dpiRatio;
  const cW = canvas.width / ratio;
  const cH = canvas.height / ratio;

  const scope = gridScope || options.gridScope;

  if (scope === 'full') {
    drawFullGrid(ctx, cW, cH, startX, startY, size, gridRotate);
  } else if (scope === 'inner') {
    if (width && height) {
      drawInnerGrid(ctx, startX, startY, width, height, size, gridRotate);
    } else {
      drawFullGrid(ctx, cW, cH, startX, startY, size, gridRotate);
    }
  } else if (scope === 'outer') {
    if (width && height) {
      ctx.beginPath();
      ctx.rect(0, 0, cW, cH);
      ctx.rect(startX, startY, width, height);
      ctx.clip('evenodd');
      drawFullGrid(ctx, cW, cH, startX, startY, size, gridRotate);
    } else {
      drawFullGrid(ctx, cW, cH, startX, startY, size, gridRotate);
    }
  } else {
    if (!width || !height) {
      drawFullGrid(ctx, cW, cH, startX, startY, size, gridRotate);
    } else {
      drawInnerGrid(ctx, startX, startY, width, height, size, gridRotate);
    }
  }

  ctx.restore();
  return false
}

function drawFullGrid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cW: number,
  cH: number,
  startX: number,
  startY: number,
  size: number,
  gridRotate?: number
) {
  const m = startX / size;
  const n = startY / size;
  const offset = size * 10; //补偿值
  const newX = startX - Math.ceil(m) * size;
  const newY = startY - Math.ceil(n) * size;
  const endX = cW + newX + offset;
  const endY = cH + newY + offset;

  if (gridRotate) {
    const radian1 = (gridRotate * Math.PI) / 180;
    const radian2 = radian1 + Math.PI / 2;

    const normal1 = { x: Math.sin(radian1), y: -Math.cos(radian1) };
    const normal2 = { x: Math.sin(radian2), y: -Math.cos(radian2) };
    drawPreciseLines(ctx, cW, cH, size, normal1, radian1);
    drawPreciseLines(ctx, cW, cH, size, normal2, radian2);
  } else {
    ctx.beginPath();
    for (let i = newX; i <= endX; i += size) {
      ctx.moveTo(i, newY);
      ctx.lineTo(i, cH + newY + offset);
    }
    for (let i = newY; i <= endY; i += size) {
      ctx.moveTo(newX, i);
      ctx.lineTo(cW + newX + offset, i);
    }
    ctx.stroke();
  }
}

function drawInnerGrid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  startX: number,
  startY: number,
  width: number,
  height: number,
  size: number,
  gridRotate?: number
) {
  if (gridRotate) {
    const radian1 = (gridRotate * Math.PI) / 180;
    const radian2 = radian1 + Math.PI / 2;

    const normal1 = { x: Math.sin(radian1), y: -Math.cos(radian1) };
    const normal2 = { x: Math.sin(radian2), y: -Math.cos(radian2) };
    drawPreciseLinesInRect(ctx, startX, startY, width, height, size, normal1, radian1);
    drawPreciseLinesInRect(ctx, startX, startY, width, height, size, normal2, radian1);
  } else {
    ctx.beginPath();
    const endX = width + startX;
    const endY = height + startY;
    for (let i = startX; i <= endX; i += size) {
      ctx.moveTo(i, startY);
      ctx.lineTo(i, endY);
    }
    for (let i = startY; i <= endY; i += size) {
      ctx.moveTo(startX, i);
      ctx.lineTo(endX, i);
    }
    ctx.stroke();
  }
}

function drawParallelLines(ctx, width, height, spacing, angle) {
  const radian = (angle * Math.PI) / 180;
  const cos = Math.cos(radian);
  const sin = Math.sin(radian);

  const lineCount =
    Math.ceil(
      Math.max(width, height) /
        (spacing * Math.min(Math.abs(cos), Math.abs(sin)))
    ) * 2;

  ctx.beginPath();
  for (let i = -lineCount; i < lineCount; i++) {
    const x = i * spacing;
    if (sin > 0) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (height / sin) * cos, height);
    } else {
      ctx.moveTo(x, height);
      ctx.lineTo(x - (height / sin) * cos, 0);
    }
  }
  ctx.stroke();
}

function drawPreciseLines(ctx, width, height, spacing, normal, angle) {
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
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

function drawPreciseLinesInRect(ctx, x, y, width, height, spacing, normal, angle) {
    const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height }
    ];

    let min = Infinity, max = -Infinity;
    corners.forEach(p => {
        const proj = p.x * normal.x + p.y * normal.y;
        min = Math.min(min, proj);
        max = Math.max(max, proj);
    });

    const totalLength = max - min;
    const lineCount = Math.ceil(totalLength / spacing);
    const startOffset = min;

    ctx.beginPath();
    for (let i = 0; i <= lineCount; i++) {
        const d = startOffset + i * spacing;

        const points = [];
        for (let j = 0; j < corners.length; j++) {
            const p1 = corners[j];
            const p2 = corners[(j + 1) % 4];

            const edgeVecX = p2.x - p1.x;
            const edgeVecY = p2.y - p1.y;

            const denominator = normal.x * edgeVecY - normal.y * edgeVecX;
            if (Math.abs(denominator) > 1e-6) {
                const t = (d - p1.x * normal.x - p1.y * normal.y) /
                         (normal.x * edgeVecX + normal.y * edgeVecY);

                if (t >= 0 && t <= 1) {
                    points.push({
                        x: p1.x + t * edgeVecX,
                        y: p1.y + t * edgeVecY
                    });
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
