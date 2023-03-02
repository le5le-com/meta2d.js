import { Pen } from '../../core/src/pen';

export function getValidValue(num: any, value: number) {
  if (isNaN(num)) {
    return;
  }
  if (value === -1) {
    return num;
  }
  // return num - parseInt(num) == 0 ? num : Number(num).toFixed(value);
  // return Number(num).toFixed(value);
  return Math.round(Number(num) * 1000) / 1000;
}

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}

export interface leChartPen extends Pen {
  // echarts?: any;
  echarts?: {
    option: {
      xAxis: {
        data: any[];
      };
      series: any[];
      color: string[];
    };
  };
  startAngle?: number;
  endAngle?: number;
  min?: number;
  max?: number;
  axisLine?: [number, string];
  unit?: string;
  value?: number;
  splitNumber?: number;
  isClock?: boolean;
  hourvalue?: string;
  minutevalue?: string;
  secondvalue?: string;
  data?: any[]; // (number[] | { name: string; value: number }...)[];
  chartsColor?: string[];
  smooth?: boolean;
  chartsRadius?: string[][];
  frames?: leChartPen[];
  xAxisData?: string[];
  replaceMode?: ReplaceMode;
  clockInterval?: NodeJS.Timer;
}
