import type { Pen } from '@meta2d/core';

/** 坐标轴样式配置。 */
export interface AxisConfig {
  lineStyle?: { color?: string; width?: number; type?: string };
  axisLabel?: {
    fontSize?: number;
    fontColor?: string;
    textDecoration?: string;
    fontStyle?: string;
    fontWeight?: string;
    fontFamily?: string;
    lineHeight?: number;
  };
}

export interface LabelConfig {
  fontSize?: number;
  fontColor?: string;
  fontStyle?: string;
  textDecoration?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: number;
}
export interface TickLabelConfig extends LabelConfig {
  show?: boolean;
  labelLine?: { show?: boolean };
  color?: string;
}

export interface TitleLabelConfig extends LabelConfig {
  color?: string;
}

export type ChartValue = number | string | { name?: string; value?: number | string };
export type ChartSeries = ChartValue[];

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}

export interface ChartPen extends Pen {
  data?: ChartSeries[] | ChartSeries;
  xAxisData?: string[];
  chartsColor?: string[];
  chartsRadius?: Array<Array<string | number>>;
  smooth?: boolean;
  replaceMode?: ReplaceMode;
  min?: number;
  max?: number;
  splitNumber?: number;
  startAngle?: number;
  endAngle?: number;
  value?: number;
  unit?: string;
  isClock?: boolean;
  hourvalue?: number;
  minutevalue?: number;
  secondvalue?: number;
  axisLine?: Array<[number, string]>;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  tickLabel?: TickLabelConfig;
  titleLabel?: TitleLabelConfig;
}

export const defaultColors = ['#1890ff', '#2fc25b', '#facc14', '#c23531', '#2f4554', '#61a0a8', '#d48265'];

export function getColors(pen: ChartPen): string[] {
  return pen.chartsColor?.length ? pen.chartsColor : defaultColors;
}

export function getNumericValue(value: ChartValue): number {
  const raw = typeof value === 'object' && value !== null ? value.value : value;
  const result = Number(raw);
  return Number.isFinite(result) ? result : 0;
}

export function getItemName(value: ChartValue, index: number): string {
  if (typeof value === 'object' && value !== null && value.name !== undefined) {
    return String(value.name);
  }
  return String(value ?? index);
}

export function getSeries(pen: ChartPen): ChartSeries[] {
  if (!Array.isArray(pen.data) || !pen.data.length) {
    return [];
  }
  const first = pen.data[0];
  return Array.isArray(first) ? (pen.data as ChartSeries[]) : [pen.data as ChartSeries];
}

export function getRange(pen: ChartPen) {
  const values = getSeries(pen).flat().map(getNumericValue).filter(Number.isFinite);
  const min = pen.min ?? (values.length ? Math.min(0, ...values) : 0);
  const max = pen.max ?? (values.length ? Math.max(1, ...values) : 1);
  return { min, max: max === min ? min + 1 : max };
}

export function parseRadius(value: string | number | undefined, total: number, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // 数字配置沿用 2.0 行为按像素解释，字符串百分比按环形半径比例解释。
    return value;
  }
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    return (Number.parseFloat(value) / 100) * total;
  }
  return fallback;
}
