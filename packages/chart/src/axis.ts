import { getFont } from '@meta2d/core/src/models/pen/service';
import { ChartPen, getItemName, getRange, getSeries, getNumericValue } from './common';
import { scaleCompute, ScaleResult } from './normalizedAxis';

export interface AxisRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function font(pen: ChartPen, axis: 'xAxis' | 'yAxis') {
  const label = pen[axis]?.axisLabel;
  return getFont({
    fontStyle: label?.fontStyle || pen.fontStyle,
    fontWeight: label?.fontWeight || pen.fontWeight,
    fontFamily: label?.fontFamily || pen.fontFamily,
    fontSize: label?.fontSize || pen.fontSize || 12,
    lineHeight: label?.lineHeight || pen.lineHeight,
  });
}

/** 绘制折线图/柱状图共用的坐标轴，并返回绘图区和刻度范围。 */
export function drawAxis(ctx: CanvasRenderingContext2D, pen: ChartPen): { rect: AxisRect; range: ScaleResult } {
  const scale = (pen.calculative as { scale?: number } | undefined)?.scale || 1;
  const padding = {
    left: Math.min(50, pen.width * 0.15),
    right: Math.min(20, pen.width * 0.05),
    top: Math.min(20, pen.height * 0.1),
    bottom: Math.min(35, pen.height * 0.2),
  };
  const rect: AxisRect = {
    x: pen.x + padding.left,
    y: pen.y + padding.top,
    width: Math.max(1, pen.width - padding.left - padding.right),
    height: Math.max(1, pen.height - padding.top - padding.bottom),
  };
  const basicRange = getRange(pen);
  const range = scaleCompute({
    min: basicRange.min,
    max: basicRange.max,
    splitNumber: pen.splitNumber || 5,
    preferZero: true,
  });
  const split = range.splitNumber || 5;
  const yLabel = pen.yAxis?.axisLabel;

  ctx.save();
  ctx.lineWidth = 1 * scale;
  ctx.strokeStyle = pen.yAxis?.lineStyle?.color || '#E9E9E9';
  ctx.fillStyle = yLabel?.fontColor || pen.color || '#BFBFBF';
  ctx.font = font(pen, 'yAxis');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= split; i++) {
    const y = rect.y + (i * rect.height) / split;
    const value = (range.max || 0) - i * (range.interval || 0);
    ctx.fillText(String(Math.round(value * 1000) / 1000), rect.x - 10 * scale, y);
    if (i < split) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([2 * scale, 2 * scale]);
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.width, y);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = pen.xAxis?.lineStyle?.color || '#BFBFBF';
  ctx.lineWidth = (pen.xAxis?.lineStyle?.width || 1) * scale;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.height);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height);
  ctx.stroke();

  const labels = pen.xAxisData || [];
  const count = Math.max(labels.length, getSeries(pen).reduce((max, series) => Math.max(max, series.length), 0), 1);
  ctx.font = font(pen, 'xAxis');
  ctx.fillStyle = pen.xAxis?.axisLabel?.fontColor || pen.color || '#BFBFBF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  labels.forEach((label, index) => {
    const x = rect.x + ((index + 0.5) * rect.width) / count;
    ctx.fillText(label, x, rect.y + rect.height + 10 * scale);
  });
  ctx.restore();
  return { rect, range };
}

export function getAxisValue(pen: ChartPen, index: number): number {
  return getNumericValue(getSeries(pen).flat()[index] || 0);
}

export { getItemName };
