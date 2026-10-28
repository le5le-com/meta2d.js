import type { Meta2d, Pen } from '@meta2d/core';
import { pSBC } from '@meta2d/core/src/utils/color';

export interface RadioItem {
  key: string;
  text: string;
  isForbidden?: boolean;
}

export interface RadioItemPosition {
  x: number;
  y?: number;
  itemWidth?: number;
}

export interface RadioPen extends Pen {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  data?: RadioItem[];
  options?: RadioItem[];
  direction?: 'horizontal' | 'vertical';
  theme?: 'button' | string;
  selectKey?: string;
  selectedKey?: string;
  itemPosition?: RadioItemPosition[];
}

interface RadioLayout {
  positions: RadioItemPosition[];
  verticalRows: Array<{ y: number; radius: number }>;
}

interface RadioPoint {
  x: number;
  y: number;
}

export const radioDefine = {
  type: 'radio',
  draw: radio,
  beforeUpdate: radioBeforeUpdate,
  mouseDown: radioMouseDown,
};

export function radio(ctx: CanvasRenderingContext2D, pen: RadioPen) {
  const x = pen.x;
  const y = pen.y;
  const h = pen.height;
  const w = pen.width;
  const data = getData(pen);
  if (!data.length) return;

  const layout = getLayout(pen, data);
  const gap = 10;
  const fontSize = getFontSize(pen);
  const direction = pen.direction || 'horizontal';

  if (direction === 'horizontal') {
    const radius = fontSize / 2;
    const middleY = y + h / 2;
    if (pen.theme === 'button') {
      data.forEach((item, index) => {
        const position = layout.positions[index];
        drawItem(ctx, item, position.x, y, pen, position.itemWidth || 0, h, item.isForbidden);
        const textGap = ((position.itemWidth || 0) - item.text.length * fontSize) / 2;
        drawRadioText(ctx, item.text, position.x + textGap, middleY, pen, item.isForbidden, 'start');
      });
    } else {
      data.forEach((item, index) => {
        const position = layout.positions[index];
        const centerX = position.x + radius;
        drawCircle(ctx, pen, { x: centerX, y: middleY, radius }, item.key, item.isForbidden);
        drawRadioText(ctx, item.text, centerX + gap + radius, middleY, pen, item.isForbidden, 'start');
      });
    }
  } else if (direction === 'vertical') {
    if (pen.theme === 'button') {
      const itemHeight = h / data.length;
      const centerX = x + w / 2;
      data.forEach((item, index) => {
        const itemY = y + itemHeight * index;
        drawItem(ctx, item, x, itemY, pen, w, itemHeight, item.isForbidden);
        drawRadioText(ctx, item.text, centerX, itemY + itemHeight / 2, pen, item.isForbidden, 'center');
      });
    } else {
      const radius = fontSize / 2;
      const centerX = x + gap + radius;
      data.forEach((item, index) => {
        const row = layout.verticalRows[index];
        drawCircle(ctx, pen, { x: centerX, y: row.y, radius }, item.key, item.isForbidden);
        drawRadioText(
          ctx,
          item.text,
          centerX + gap + (item.text.length * fontSize) / 2,
          row.y,
          pen,
          item.isForbidden,
          'center'
        );
      });
    }
  }
}

export function radioBeforeUpdate(this: Meta2d, pen: RadioPen) {
  if (pen.__val?.options !== undefined && pen.__val.data === undefined) {
    pen.__val.data = pen.__val.options;
  }
  return true;
}

export function radioMouseDown(this: Meta2d, source: RadioPen, event: RadioPoint) {
  const pen = (source.id ? this.penMap.get(source.id) : source) as RadioPen | undefined;
  if (!pen || pen.disabled) return false;
  const data = getData(pen);
  const layout = getLayout(pen, data);
  let selected: string | undefined;

  const direction = pen.direction || 'horizontal';
  if (direction === 'horizontal') {
    for (let index = 0; index < data.length; index++) {
      const position = layout.positions[index];
      if (
        !data[index].isForbidden &&
        event.x > position.x &&
        event.x < position.x + (position.itemWidth || 0)
      ) {
        selected = data[index].key;
        break;
      }
    }
  } else if (direction === 'vertical') {
    if (pen.theme === 'button') {
      const itemHeight = pen.height / data.length;
      for (let index = 0; index < data.length; index++) {
        if (
          !data[index].isForbidden &&
          event.y > pen.y + itemHeight * index &&
          event.y < pen.y + itemHeight * (index + 1)
        ) {
          selected = data[index].key;
        }
      }
    } else {
      for (let index = 0; index < data.length; index++) {
        const row = layout.verticalRows[index];
        if (!data[index].isForbidden && event.y > row.y - row.radius && event.y < row.y + row.radius) {
          selected = data[index].key;
        }
      }
    }
  }

  if (selected !== undefined) {
    this.setValue({ id: pen.id, selectKey: selected, selectedKey: selected });
    this.emitter.emit('valueUpdate', { ...pen, selectKey: selected, selectedKey: selected });
  }
  return false;
}

function getData(pen: RadioPen) {
  return pen.data || pen.options || [];
}

function getFontSize(pen: RadioPen) {
  const fontSize = Number(pen.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14;
}

/** 使用1.0的间距公式，同时供 Worker 绘制和主线程点击命中使用。 */
function getLayout(pen: RadioPen, data: RadioItem[]): RadioLayout {
  const positions: RadioItemPosition[] = [];
  const verticalRows: Array<{ y: number; radius: number }> = [];
  const gap = 10;
  const fontSize = getFontSize(pen);
  const direction = pen.direction || 'horizontal';
  if (direction === 'horizontal') {
    const radius = fontSize / 2;
    let textLengthSum = 0;
    data.forEach((item) => {
      textLengthSum += item.text.length * fontSize;
    });
    let itemX = pen.x;
    if (pen.theme === 'button') {
      const temporaryGap = (pen.width - textLengthSum) / (data.length * 2);
      const itemGap = temporaryGap > gap ? temporaryGap : gap;
      data.forEach((item) => {
        const itemWidth = item.text.length * fontSize + 2 * itemGap;
        positions.push({ x: itemX, itemWidth });
        itemX += itemWidth;
      });
    } else {
      itemX += radius;
      const temporaryGap = data.length > 1
        ? (pen.width - (data.length * (2 * radius + gap) + textLengthSum)) / (data.length - 1)
        : 0;
      const itemGap = temporaryGap > gap ? temporaryGap : gap;
      data.forEach((item) => {
        const itemWidth = 2 * radius + gap + item.text.length * fontSize;
        positions.push({ x: itemX - radius, itemWidth });
        itemX += itemWidth + itemGap;
      });
    }
  } else if (direction === 'vertical' && pen.theme !== 'button') {
    const radius = fontSize / 2;
    const temporaryGap = data.length > 1
      ? (pen.height - data.length * fontSize) / (data.length - 1)
      : 0;
    const itemGap = temporaryGap > gap ? temporaryGap : gap;
    let itemY = pen.y + radius;
    data.forEach(() => {
      verticalRows.push({ y: itemY, radius });
      itemY += 2 * radius + itemGap;
    });
  }
  return { positions, verticalRows };
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  pen: RadioPen,
  circle: { x: number; y: number; radius: number },
  key: string,
  isForbidden?: boolean
) {
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
  if (pen.selectKey === key || pen.selectedKey === key) {
    let stroke = pen.background || '#4583FF';
    if (isForbidden || pen.disabled) {
      stroke = pen.disabledBackground || pSBC(0.6, pen.background || '#4583FF') || '#20242A';
    }
    ctx.strokeStyle = stroke;
  } else {
    ctx.strokeStyle = pen.borderColor || '#56595e';
  }
  ctx.stroke();
  ctx.closePath();
  if (pen.selectKey === key || pen.selectedKey === key) {
    ctx.beginPath();
    let fill = pen.background || '#4583FF';
    if (isForbidden || pen.disabled) {
      fill = pen.disabledBackground || pSBC(0.6, pen.background || '#4583FF') || '#20242A';
    }
    ctx.fillStyle = fill;
    ctx.arc(circle.x, circle.y, circle.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  item: RadioItem,
  x: number,
  y: number,
  pen: RadioPen,
  width: number,
  height: number,
  isForbidden?: boolean
) {
  if (item.key === pen.selectKey || item.key === pen.selectedKey) {
    let fill = pen.background || '#272c33';
    if (isForbidden || pen.disabled) {
      fill = pen.disabledBackground || (pen.background ? pSBC(0.6, pen.background) : '#636363') || '#636363';
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, width, height);
    fill = pen.activeBackground || 'RGBA(69,131,255,0.2)';
    if (isForbidden || pen.disabled) fill = pSBC(0.6, fill) || fill;
    ctx.fillStyle = fill;
  } else {
    ctx.fillStyle = pen.background || '#272c33';
  }
  ctx.fillRect(x, y, width, height);
}

function drawRadioText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  pen: RadioPen,
  isForbidden: boolean | undefined,
  textAlign: CanvasTextAlign
) {
  ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.fontWeight || 'normal'} ${getFontSize(pen)}px/${pen.lineHeight || 1} ${pen.fontFamily || 'Arial'}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = textAlign;
  let fill = pen.textColor || pen.color || '#FFFFFF';
  if (isForbidden || pen.disabled) {
    fill = pen.disabledTextColor || pSBC(0.6, pen.color || '#FFFFFF') || 'rgba(255,255,255,0.26)';
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
