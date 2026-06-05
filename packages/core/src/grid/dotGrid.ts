import { GridDrawerContext } from '../store';
import { Point } from '../point';

export function dotGridDrawer(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  { store, area, align, size, color }: GridDrawerContext,
  mousePos?: Point
) {
  const baseColor = color;
  ctx.fillStyle = baseColor;

  const radius = Math.max(0.5, 1.5 * store.data.scale);

  const m = align.x / size;
  const n = align.y / size;
  const offset = size * 10;
  const newX = align.x - Math.ceil(m) * size;
  const newY = align.y - Math.ceil(n) * size;
  const endX = area.x + area.width + offset;
  const endY = area.y + area.height + offset;

  for (let x = newX + radius; x <= endX - radius; x += size) {
    for (let y = newY + radius; y <= endY - radius; y += size) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return true;
}
