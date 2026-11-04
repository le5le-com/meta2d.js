import type { Pen } from '@meta2d/core';
import { ChartPen, ChartValue, getColors, getNumericValue } from './common';

interface HeatmapCache {
  width: number;
  height: number;
  dataRef: ChartPen['data'];
  colorsRef: ChartPen['chartsColor'];
  /** 数据、配色、min/max 的内容指纹；跨 Worker 传递后引用会变，但内容不变时仍可命中 */
  signature: number;
  canvas?: OffscreenCanvas;
  rows?: number[][];
  columnCount?: number;
}

// 按图元缓存生成结果；拖拽只改变坐标时直接复用缓存。
const heatmapCaches = new Map<string, HeatmapCache>();
// 拖入画布前的预览图元没有 id，坐标又逐帧变化，统一占用一个槽位，避免每帧新建缓存导致内存暴涨。
const NO_ID_KEY = '__heatmap_no_id__';

export function heatmap(ctx: CanvasRenderingContext2D, pen: ChartPen) {
  const width = Math.max(1, Math.floor(pen.width) || 1);
  const height = Math.max(1, Math.floor(pen.height) || 1);
  const key = pen.id || NO_ID_KEY;
  let cache = heatmapCaches.get(key);

  if (cache && cache.width === width && cache.height === height) {
    // 引用相同直接命中；引用不同（postMessage 结构化克隆后每帧都是新对象）再比内容指纹，
    // 指纹只做一次线性扫描，远小于逐像素双三次插值的开销。
    if (cache.dataRef === pen.data && cache.colorsRef === pen.chartsColor) {
      drawCache(ctx, pen, cache);
      return;
    }
    if (cache.signature === getSignature(pen)) {
      cache.dataRef = pen.data;
      cache.colorsRef = pen.chartsColor;
      drawCache(ctx, pen, cache);
      return;
    }
  }

  const rows = normalizeRows(pen.data);
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  if (!rows.length || !columnCount) {
    heatmapCaches.delete(key);
    return;
  }
  cache = createCache(rows, pen, width, height, columnCount);
  heatmapCaches.set(key, cache);
  drawCache(ctx, pen, cache);
}

/** 图元删除时释放对应缓存，避免长期编辑造成 Worker 内存增长。 */
export function destroyHeatmap(this: unknown, pen: Pen) {
  if (pen.id) heatmapCaches.delete(pen.id);
}

function drawCache(ctx: CanvasRenderingContext2D, pen: ChartPen, cache: HeatmapCache) {
  if (cache.canvas) {
    // drawImage 受变换和裁剪区约束，目标尺寸按图元真实宽高铺满，局部重绘时不会越界留痕。
    ctx.drawImage(cache.canvas, pen.x, pen.y, pen.width, pen.height);
  } else if (cache.rows && cache.columnCount) {
    // 无 OffscreenCanvas 时不能用 putImageData：它无视变换与裁剪，会画到错误位置且无法被局部重绘擦除。
    drawCells(ctx, pen, cache.rows, cache.columnCount);
  }
}

function getRows(data: ChartPen['data']): unknown[][] {
  if (!Array.isArray(data) || !data.length) return [];
  const source = Array.isArray(data[0]) ? (data as unknown[]) : [data];
  return source.filter(Array.isArray) as unknown[][];
}

function normalizeRows(data: ChartPen['data']): number[][] {
  return getRows(data).map((row) => row.map((value) => getNumericValue(value as ChartValue)));
}

/** 对影响像素结果的全部输入（数据、配色、min/max）做 FNV-1a 哈希，单次线性扫描且不分配新数组。 */
function getSignature(pen: ChartPen): number {
  let hash = 2166136261;
  const mix = (value: number) => {
    hash = Math.imul(hash ^ (value | 0), 16777619);
  };
  const mixNumber = (value: number) => {
    // 整数部分与小数部分分开混入，避免 1.5 与 1.7 这类值碰撞。
    mix(value);
    mix((value % 1) * 1e9);
  };
  for (const row of getRows(pen.data)) {
    mix(row.length);
    for (const value of row) mixNumber(getNumericValue(value as ChartValue));
  }
  for (const color of getColors(pen)) {
    const text = String(color);
    mix(text.length);
    for (let i = 0; i < text.length; i++) mix(text.charCodeAt(i));
  }
  mixNumber(Number.isFinite(pen.min) ? (pen.min as number) : NaN);
  mixNumber(Number.isFinite(pen.max) ? (pen.max as number) : NaN);
  return hash >>> 0;
}

function getRange(rows: number[][], pen: ChartPen): { min: number; max: number } {
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const row of rows) {
    for (const value of row) {
      if (value < dataMin) dataMin = value;
      if (value > dataMax) dataMax = value;
    }
  }
  const min = Number.isFinite(pen.min) ? (pen.min as number) : Number.isFinite(dataMin) ? dataMin : 0;
  const max = Number.isFinite(pen.max) ? (pen.max as number) : Number.isFinite(dataMax) ? dataMax : 1;
  return { min, max };
}

function createCache(rows: number[][], pen: ChartPen, width: number, height: number, columnCount: number): HeatmapCache {
  const base = { width, height, dataRef: pen.data, colorsRef: pen.chartsColor, signature: getSignature(pen) };
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const canvasContext = canvas.getContext('2d');
    if (canvasContext) {
      canvasContext.putImageData(createImageData(rows, pen, width, height, columnCount), 0, 0);
      return { ...base, canvas };
    }
  }
  return { ...base, rows, columnCount };
}

/**
 * 可分离双三次插值：先沿 x 方向把每行数据插值到目标宽度，再沿 y 方向插值到目标高度。
 * 结果与逐像素 4×4 卷积一致，但计算量从 16·W·H 降到 4·(rows·W + W·H)，且权重按行/列预计算。
 */
function createImageData(rows: number[][], pen: ChartPen, width: number, height: number, columnCount: number): ImageData {
  const { min, max } = getRange(rows, pen);
  const palette = createPalette(getColors(pen).map(parseColor));
  const lastIndex = PALETTE_SIZE - 1;
  const span = max - min;
  const image = typeof ImageData !== 'undefined' ? new ImageData(width, height) : ({ width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData);
  const rowCount = rows.length;

  // 第一步：每行沿 x 插值，参差行缺失的单元按 0 处理（与原实现一致）。
  const xTaps = createTaps(width, columnCount);
  const horizontal = new Float64Array(rowCount * width);
  for (let row = 0; row < rowCount; row++) {
    const source = rows[row];
    for (let px = 0; px < width; px++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        const tap = px * 4 + k;
        sum += (source[xTaps.indexes[tap]] || 0) * xTaps.weights[tap];
      }
      horizontal[row * width + px] = sum;
    }
  }

  // 第二步：沿 y 插值并查表着色。
  const yTaps = createTaps(height, rowCount);
  const data = image.data;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let value = 0;
      for (let k = 0; k < 4; k++) {
        const tap = py * 4 + k;
        value += horizontal[yTaps.indexes[tap] * width + px] * yTaps.weights[tap];
      }
      value = Math.min(max, Math.max(min, value));
      const percent = span === 0 ? 0 : (value - min) / span;
      const color = Math.round(Math.min(1, Math.max(0, percent)) * lastIndex) * 3;
      const offset = (py * width + px) * 4;
      data[offset] = palette[color];
      data[offset + 1] = palette[color + 1];
      data[offset + 2] = palette[color + 2];
      data[offset + 3] = 255;
    }
  }
  return image;
}

/** 预计算每个目标像素对应的 4 个源索引及双三次权重。 */
function createTaps(size: number, count: number): { indexes: Int32Array; weights: Float64Array } {
  const indexes = new Int32Array(size * 4);
  const weights = new Float64Array(size * 4);
  for (let p = 0; p < size; p++) {
    const position = (p / Math.max(1, size - 1)) * (count - 1);
    const base = Math.floor(position);
    const delta = position - base;
    for (let k = 0; k < 4; k++) {
      const offset = k - 1;
      indexes[p * 4 + k] = Math.max(0, Math.min(count - 1, base + offset));
      weights[p * 4 + k] = cubic(offset - delta);
    }
  }
  return { indexes, weights };
}

function cubic(value: number, coefficient = -0.5): number {
  const absolute = Math.abs(value);
  if (absolute <= 1) return (coefficient + 2) * absolute ** 3 - (coefficient + 3) * absolute ** 2 + 1;
  if (absolute < 2) return coefficient * absolute ** 3 - 5 * coefficient * absolute ** 2 + 8 * coefficient * absolute - 4 * coefficient;
  return 0;
}

/** 无 OffscreenCanvas 环境的兜底：按单元格填充矩形，遵循当前变换与裁剪。 */
function drawCells(ctx: CanvasRenderingContext2D, pen: ChartPen, rows: number[][], columnCount: number) {
  const { min, max } = getRange(rows, pen);
  const colors = getColors(pen).map(parseColor);
  const cellWidth = pen.width / columnCount;
  const cellHeight = pen.height / rows.length;
  ctx.save();
  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < columnCount; col++) {
      const value = row[col] || 0;
      const [r, g, b] = interpolatePalette(colors, max === min ? 0 : (value - min) / (max - min));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      // 宽高 +0.5 覆盖相邻单元间的抗锯齿缝隙。
      ctx.fillRect(pen.x + col * cellWidth, pen.y + rowIndex * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
    }
  });
  ctx.restore();
}

const PALETTE_SIZE = 1024;

/** 把渐变色带预先展开成查找表，避免每个像素都分配数组做插值。 */
function createPalette(colors: Array<[number, number, number]>): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(PALETTE_SIZE * 3);
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const color = interpolatePalette(colors, i / (PALETTE_SIZE - 1));
    palette[i * 3] = color[0];
    palette[i * 3 + 1] = color[1];
    palette[i * 3 + 2] = color[2];
  }
  return palette;
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
  const index = Math.max(0, Math.min(safe.length - 2, Math.floor(position)));
  const ratio = position - index;
  const left = safe[index]; const right = safe[index + 1] || left;
  return [0, 1, 2].map((key) => Math.round(left[key] + (right[key] - left[key]) * ratio)) as [number, number, number];
}
