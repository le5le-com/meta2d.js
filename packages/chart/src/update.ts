import type { IValue, Meta2d } from '@meta2d/core';
import { ChartPen, ChartSeries, ReplaceMode } from './common';

/** 处理笛卡尔图的 dataX/dataY 增量更新。 */
export function beforeCartesianUpdate(this: Meta2d, pen: ChartPen) {
  const value = pen.__val as IValue & { dataX?: string[]; dataY?: ChartSeries[] };
  if (!value || value.data !== undefined || (!value.dataX && !value.dataY)) return true;
  const oldLabels = [...(pen.xAxisData || [])];
  const oldSeries = normalizeSeries(pen.data);
  const labels = value.dataX || [];
  const incoming = value.dataY || [];
  if (pen.replaceMode === ReplaceMode.ReplaceAll) {
    pen.xAxisData = [...labels]; pen.data = incoming.map((series) => [...series]);
  } else if (pen.replaceMode === ReplaceMode.Replace) {
    const next = oldSeries.map((series) => [...series]);
    labels.forEach((label, index) => { const target = oldLabels.indexOf(label); if (target < 0) return; next.forEach((series, seriesIndex) => { if (incoming[seriesIndex]?.[index] !== undefined) series[target] = incoming[seriesIndex][index]; }); });
    pen.data = next;
  } else {
    pen.xAxisData = [...oldLabels, ...labels];
    const count = Math.max(oldSeries.length, incoming.length);
    pen.data = Array.from({ length: count }, (_, index) => [...(oldSeries[index] || []), ...(incoming[index] || [])]);
  }
  delete value.dataX; delete value.dataY;
  return true;
}

/** 处理饼图的 dataY 增量更新，按名称替换数据项。 */
export function beforeSeriesUpdate(this: Meta2d, pen: ChartPen) {
  const value = pen.__val as IValue & { dataY?: ChartSeries[] };
  if (!value || value.data !== undefined || !value.dataY) return true;
  const oldSeries = normalizeSeries(pen.data);
  if (pen.replaceMode === ReplaceMode.ReplaceAll) {
    pen.data = value.dataY.map((series) => [...series]);
  } else if (pen.replaceMode === ReplaceMode.Replace) {
    const next = oldSeries.map((series) => [...series]);
    value.dataY.forEach((series, seriesIndex) => series.forEach((item) => {
      const name = typeof item === 'object' && item !== null ? item.name : undefined;
      const target = next[seriesIndex]?.findIndex((old) => typeof old === 'object' && old !== null && old.name === name);
      if (target !== undefined && target >= 0) next[seriesIndex][target] = item;
    }));
    pen.data = next;
  } else {
    pen.data = Array.from({ length: Math.max(oldSeries.length, value.dataY.length) }, (_, index) => [...(oldSeries[index] || []), ...(value.dataY?.[index] || [])]);
  }
  delete value.dataX; delete value.dataY;
  return true;
}

function normalizeSeries(data: ChartPen['data']): ChartSeries[] {
  if (!Array.isArray(data) || !data.length) return [];
  return Array.isArray(data[0]) ? data as ChartSeries[] : [data as ChartSeries];
}
