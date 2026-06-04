import { GridDrawerContext } from '../store';
import { Point } from '../point';

export function dotGridDrawer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { store, canvas }: GridDrawerContext,
  mousePos?: Point
) {
  const { data, options } = store;
  const { gridColor, gridSize, scale, origin, gridScope } = data;
  ctx.save();
  const baseColor = gridColor || options.gridColor;
  ctx.fillStyle = baseColor;

  if (mousePos) {
    const effectRadius = 150;
    const gradient = ctx.createRadialGradient(
      mousePos.x,
      mousePos.y,
      0,
      mousePos.x,
      mousePos.y,
      effectRadius
    );
    gradient.addColorStop(0, '#ff4d4f');
    gradient.addColorStop(1, baseColor);
    ctx.fillStyle = gradient;
  }

  let size = (gridSize || options.gridSize) * scale;
  size = size < 0 ? 0 : size;
  const radius = Math.max(0.5, 1.5 * scale);

  const width = (data.width || options.width) * scale;
  const height = (data.height || options.height) * scale;
  const startX = (data.x || options.x || 0) + origin.x;
  const startY = (data.y || options.y || 0) + origin.y;

  const ratio = store.dpiRatio;
  const cW = canvas.width / ratio;
  const cH = canvas.height / ratio;

  const scope = gridScope || options.gridScope;

  if (scope === 'full') {
    drawFullDots(ctx, cW, cH, startX, startY, size, radius);
  } else if (scope === 'inner') {
    if (width && height) {
      drawInnerDots(ctx, startX, startY, width, height, size, radius);
    } else {
      drawFullDots(ctx, cW, cH, startX, startY, size, radius);
    }
  } else if (scope === 'outer') {
    if (width && height) {
      ctx.beginPath();
      ctx.rect(0, 0, cW, cH);
      ctx.rect(startX, startY, width, height);
      ctx.clip('evenodd');
      drawFullDots(ctx, cW, cH, startX, startY, size, radius);
    } else {
      drawFullDots(ctx, cW, cH, startX, startY, size, radius);
    }
  } else {
    if (!width || !height) {
      drawFullDots(ctx, cW, cH, startX, startY, size, radius);
    } else {
      drawInnerDots(ctx, startX, startY, width, height, size, radius);
    }
  }

  ctx.restore();
  return true
}

function drawFullDots(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cW: number,
  cH: number,
  startX: number,
  startY: number,
  size: number,
  radius: number
) {
  const m = startX / size;
  const n = startY / size;
  const offset = size * 10;
  const newX = startX - Math.ceil(m) * size;
  const newY = startY - Math.ceil(n) * size;
  const endX = cW + newX + offset;
  const endY = cH + newY + offset;

  for (let x = newX + radius; x <= endX - radius; x += size) {
    for (let y = newY + radius; y <= endY - radius; y += size) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawInnerDots(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  startX: number,
  startY: number,
  width: number,
  height: number,
  size: number,
  radius: number
) {
  const endX = width + startX;
  const endY = height + startY;
  for (let x = startX + radius; x <= endX - radius; x += size) {
    for (let y = startY + radius; y <= endY - radius; y += size) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
