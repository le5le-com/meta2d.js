import type { Pen, Rect } from '@meta2d/core';

export interface Pos {
  row: number;
  col: number;
  lineRow?: number;
  lineCol?: number;
  allRow?:number;
  allCol?:number;
}

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}
export interface formPen extends Pen {
  optionPos?: number[];
  direction?: string;
  checkboxWidth?: number;
  isForbidden?: boolean;
  options?: {
    isForbidden?: boolean;
    isChecked?: boolean;
    background?: string;
    text?: string;
  }[];
  optionHeight?: number;
  checkboxHeight?: number;
  calculative?: {
    barRect?: Rect;
    ballRect?: Rect;
    texts?: any[];
    activeCell?: Pos;
    hoverCell?: Pos;
    inputCell?: Pos;
    isUpdateData?: boolean;
    isHover?: boolean;
    isInput?: boolean;
    maxOffsetY?:number;
    stap?:number;
  } & Pen['calculative'];
  checked?: any;
  onColor?: string;
  disable?: boolean;
  disableOnColor?: string;
  offColor?: string;
  offStrokeColor?: string;
  onStrokeColor?: string;
  disableOffColor?: string;
  _textWidth?: number;
  _fontSize?: number;
  unit?: string;
  sliderWidth?: number;
  sliderHeight?: number;
  barHeight?: number;
  value?: number | string;
  min?: number;
  max?: number;
  table?: {
    rowHeight?: number;
    colWidth?: number;
    header?: {
      data?: any;
      show?: boolean;
      height?: number;
      fontWeight?: number;
    };
    data?: any[];
  };
  colPos?: number[];
  rowPos?: number[];
  tableWidth?: number;
  tableHeight?: number;
  isInit?: boolean;
  rowHeight?: number;
  colWidth?: number;
  styles?: {
    row?: number;
    col?: number;
    color?: string;
    background?: string;
    width?: number;
    height?: number;
    wheres?: { comparison?: string; key?: string; value?: string }[];
    pens?: formPen[];
  }[];
  data?: any;
  isFirstTime?: boolean;
  replaceMode?: ReplaceMode;
  timer?: any;
  bordered?: boolean;
  vLine?: boolean;
  hLine?: boolean;
  stripe?: boolean; //是否显示斑马纹
  stripeColor?: string; //斑马纹颜色
  hasHeader?: boolean; //是否显示表头
  btnBackground?: string;
  colStyle?: any;
  maxNum?:number; //最大展示数量
  offsetY?:number;
  interval?:any;
  oldY?:number;
  row?:number;
  col?:number;
  swiper?:boolean; //是否轮播
  initScale?:number;
  initWorldRect?:Rect;
  disableDefaultClick?:boolean;
  clockInterval?: ReturnType<typeof setInterval>;
  timeout?: number;
  timeFormat?: string;
  fillZero?: boolean;
}

export interface cellData {
  row: number;
  col: number;
  value: string;
}

export function getTextLength(text: string, pen: any) {
  const textScale = (pen.height * 14) / 16;
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || '';
  const chineseLen = chinese.length;
  const width =
    (text.length - chineseLen) * textScale * 0.6 + chineseLen * textScale;
  return width;
}

