import { Pen } from '../../core/src/pen';
import { ChartData } from '../../core/src/pen';

import { calcRightBottom, Rect } from '@meta2d/core';

export interface Pos {
  row: number;
  col: number;
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
  } & Pen['calculative'];
  checked?: boolean | string;
  onColor?: string;
  disable?: boolean;
  disableOnColor?: string;
  offColor?: string;
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
}

export interface cellData extends ChartData {
  row: number;
  col: number;
  value: string;
}

export function getTextLength(text: string, pen: any) {
  const textScale = (pen.calculative.worldRect.height * 14) / 16;
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || '';
  const chineseLen = chinese.length;
  const width =
    (text.length - chineseLen) * textScale * 0.6 + chineseLen * textScale;
  return width;
}

export function initOptions(pen: any) {
  if (pen.direction == 'horizontal') {
    const optionPos = [];
    let textLength = 0;
    const h = pen.height;
    pen.checkboxHeight = h;
    pen.options.forEach((item: any, index: number) => {
      optionPos.push(index * (40 + h) + textLength);
      textLength += getTextLength(item.text, pen);
    });
    pen.optionPos = optionPos;
    const width = optionPos.length * (40 + h) + textLength;
    pen.checkboxWidth = width;
    pen.width = width;
    pen.calculative.width = width;
    pen.calculative.worldRect = {
      x: pen.x,
      y: pen.y,
      height: pen.height,
      width: pen.width,
      center: {
        x: pen.x + pen.width / 2,
        y: pen.y + pen.height / 2,
      },
    };
    calcRightBottom(pen.calculative.worldRect);
  } else if (pen.direction == 'vertical') {
    if (pen.optionInterval == undefined) {
      pen.optionInterval = 20;
    }
    if (!pen.optionHeight) {
      pen.optionHeight = 20;
    }
    const optionPos = [];
    pen.options.forEach((item: any, index: number) => {
      optionPos.push(index * (pen.optionInterval + pen.optionHeight));
    });
    pen.optionPos = optionPos;
    const height = optionPos[optionPos.length - 1] + pen.optionHeight;
    pen.checkboxHeight = height;
    if (!pen.width) {
      pen.height = height;
      pen.calculative.height = height;
      pen.calculative.worldRect = {
        x: pen.x,
        y: pen.y,
        height: pen.height,
        width: pen.width,
        center: {
          x: pen.x + pen.width / 2,
          y: pen.y + pen.height / 2,
        },
      };
      calcRightBottom(pen.calculative.worldRect);
    }
  }
}
