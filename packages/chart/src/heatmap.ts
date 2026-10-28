import type { Pen } from '@meta2d/core';
import { ChartPen, ChartValue, getColors, getNumericValue } from './common';

interface HeatmapCache {
  width: number;
  height: number;
  dataRef: ChartPen['data'];
  colorsRef: ChartPen['chartsColor'];
  min?: number;
  max?: number;
  canvas?: OffscreenCanvas;
  imageData?: ImageData;
}

// 按图元缓存生成结果；拖拽只改变坐标时直接复用缓存。
const heatmapCaches = new Map<string, HeatmapCache>();

export function heatmap(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const width = Math.max(1, Math.floor(pen.width));
  const height = Math.max(1, Math.floor(pen.height));
  const key = pen.id || `${pen.x}:${pen.y}`;
  let cache = heatmapCaches.get(key);

  // 数据对象引用不变时无需扫描矩阵，更不能在拖动帧中序列化大数据。
  if (cache && cache.width === width && cache.height === height && cache.dataRef === pen.data && cache.colorsRef === pen.chartsColor && cache.min === pen.min && cache.max === pen.max) {
    drawCache(ctx, pen, cache, width, height);
    return;
  }

  const rows = normalizeRows(pen.data);
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  if (!rows.length || !columnCount) {
    if (pen.id) heatmapCaches.delete(pen.id);
    return;
  }
  cache = createCache(rows, pen, width, height, columnCount);
  heatmapCaches.set(key, cache);
  drawCache(ctx, pen, cache, width, height);
}

/** 图元删除时释放对应缓存，避免长期编辑造成 Worker 内存增长。 */
export function destroyHeatmap(this: unknown, pen: Pen) {
  if (pen.id) heatmapCaches.delete(pen.id);
}

function drawCache(ctx: CanvasRenderingContext2D, pen: ChartPen, cache: HeatmapCache, width: number, height: number) {
  if (cache.canvas) {
    ctx.drawImage(cache.canvas, pen.x, pen.y, width, height);
  } else if (cache.imageData) {
    ctx.putImageData(cache.imageData, pen.x, pen.y);
  }
}

function normalizeRows(data: ChartPen['data']): number[][] {
  if (!Array.isArray(data) || !data.length) return [];
  const source = Array.isArray(data[0]) ? (data as unknown[]) : [data];
  return source.filter(Array.isArray).map((row) => (row as unknown[]).map((value) => getNumericValue(value as ChartValue)));
}

function createCache(rows: number[][], pen: ChartPen, width: number, height: number, columnCount: number): HeatmapCache {
  const imageData = createImageData(rows, pen, width, height, columnCount);
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const canvasContext = canvas.getContext('2d');
    if (canvasContext) {
      canvasContext.putImageData(imageData, 0, 0);
      return { width, height, dataRef: pen.data, colorsRef: pen.chartsColor, min: pen.min, max: pen.max, canvas };
    }
  }
  return { width, height, dataRef: pen.data, colorsRef: pen.chartsColor, min: pen.min, max: pen.max, imageData };
}

function createImageData(rows: number[][], pen: ChartPen, width: number, height: number, columnCount: number): ImageData {
  const values = rows.flat().filter(Number.isFinite);
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const value of values) {
    if (value < dataMin) dataMin = value;
    if (value > dataMax) dataMax = value;
  }
  const min = Number.isFinite(pen.min) ? (pen.min as number) : Number.isFinite(dataMin) ? dataMin : 0;
  const max = Number.isFinite(pen.max) ? (pen.max as number) : Number.isFinite(dataMax) ? dataMax : 1;
  const colors = getColors(pen).map(parseColor);
  const image = typeof ImageData !== 'undefined' ? new ImageData(width, height) : ({ width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData);
  const rowCount = rows.length;
  for (let py = 0; py < height; py++) {
    const gy = (py / Math.max(1, height - 1)) * (rowCount - 1);
    for (let px = 0; px < width; px++) {
      const gx = (px / Math.max(1, width - 1)) * (columnCount - 1);
      const value = bicubic(rows, gx, gy, min, max, columnCount);
      const color = interpolatePalette(colors, max === min ? 0 : (value - min) / (max - min));
      const offset = (py * width + px) * 4;
      image.data[offset] = color[0]; image.data[offset + 1] = color[1]; image.data[offset + 2] = color[2]; image.data[offset + 3] = 255;
    }
  }
  return image;
}

function cubic(value: number, coefficient = -0.5): number {
  const absolute = Math.abs(value);
  if (absolute <= 1) return (coefficient + 2) * absolute ** 3 - (coefficient + 3) * absolute ** 2 + 1;
  if (absolute < 2) return coefficient * absolute ** 3 - 5 * coefficient * absolute ** 2 + 8 * coefficient * absolute - 4 * coefficient;
  return 0;
}

function bicubic(rows: number[][], x: number, y: number, min: number, max: number, columnCount: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y); const dx = x - ix; const dy = y - iy;
  let result = 0;
  for (let row = -1; row <= 2; row++) for (let col = -1; col <= 2; col++) {
    const rowIndex = Math.max(0, Math.min(rows.length - 1, iy + row));
    const colIndex = Math.max(0, Math.min(columnCount - 1, ix + col));
    result += (rows[rowIndex]?.[colIndex] || 0) * cubic(col - dx) * cubic(row - dy);
  }
  return Math.min(max, Math.max(min, result));
}

function parseColor(color: string): [number, number, number] {
  const value = String(color || '').trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(value)) return value.split('').map((part) => Number.parseInt(part + part, 16)) as [number, number, number];
  if (/^[0-9a-f]{6}$/i.test(value)) return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4), 16)];
  return [128, 128, 128];
}

function interpolatePalette(colors: Array<[number, number, number]>, percent: number): [number, number, number] {
  const safe = colors.length ? colors : [[24, 144, 255] as [number, number, number]];
  const position = Math.min(1, Math.max(0, percent)) * (safe.length - 1);
  const index = Math.min(safe.length - 2, Math.floor(position));
  const ratio = position - index;
  const left = safe[index]; const right = safe[index + 1] || left;
  return [0, 1, 2].map((key) => Math.round(left[key] + (right[key] - left[key]) * ratio)) as [number, number, number];
}
