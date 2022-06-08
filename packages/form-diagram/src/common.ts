<<<<<<< HEAD
import { Pen } from '../../core/src/pen';
<<<<<<< HEAD
=======
import { ChartData } from '../../core/src/pen';

<<<<<<< HEAD
import { calcExy } from '@topology/core';
>>>>>>> b30d7d8 (add_table_beforeValue)
=======
import { calcExy, Rect } from '@topology/core';

export interface Pos {
  row: number;
  col: number;
}

>>>>>>> b050489 (render)
export interface formPen extends Pen {
  optionPos?: any[];
  direction?: string;
  checkboxWidth?: number;
  options?: any[];
  optionHeight?: number;
  checkboxHeight?: number;
  calculative?: {
    barRect: Rect;
    ballRect: Rect;
    texts: any[];
    activeCell: Pos;
    hoverCell: Pos;
    inputCell: Pos;
  } & Pen['calculative'];
  checked?: boolean;
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
  value?: number;
  min?: number;
  max?: number;
  table?: {
    rowHeight: number;
    colWidth: number;
    header: {
      data: any;
      show: boolean;
      height: number;
      fontWeight: number;
    };
    data: any;
  };
  colPos: number[];
  rowPos: number[];
  tableWidth: number;
  tableHeight: number;
  isInit: boolean;
}
=======
import { calcExy } from "@topology/core";
>>>>>>> 99df05d (canvasRect not calc again; use calcExy method)

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
    };
    calcExy(pen.calculative.worldRect);
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
      };
      calcExy(pen.calculative.worldRect);
    }
  }
}
