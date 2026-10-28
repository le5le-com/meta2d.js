import type { Meta2d, Pen, Point, Rect } from '@meta2d/core';
import { pSBC } from '@meta2d/core/src/utils';
import { formPen } from './common';

type SliderPen = formPen & { barRect?: Rect; ballRect?: Rect };

export const sliderDefine = {
  type: 'slider',
  draw: slider,
  create,
  beforeUpdate,
  afterUpdate,
  mouseDown,
  mouseMove,
  mouseUp,
  changeTheme,
};

function normalizeValue(pen: SliderPen, value = Number(pen.value ?? 0)) {
  const min = pen.min ?? 0;
  const max = pen.max ?? 100;
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function initLayout(pen: SliderPen) {
  const inset = Math.min(20, pen.width / 4);
  const barHeight = Math.max(2, Math.min(pen.barHeight || 4, pen.height));
  const barWidth = Math.max(1, pen.width - inset * 2);
  const min = pen.min ?? 0;
  const max = pen.max ?? 100;
  const percent = max === min ? 0 : (normalizeValue(pen) - min) / (max - min);
  const ballSize = Math.max(barHeight * 3.5, 8);

  pen.barRect = {
    x: pen.x + inset,
    y: pen.y + (pen.height - barHeight) / 2,
    width: barWidth,
    height: barHeight,
  };
  pen.ballRect = {
    x: pen.barRect.x + barWidth * percent,
    y: pen.y + pen.height / 2,
    width: ballSize,
    height: ballSize,
  };
}

export function slider(ctx: CanvasRenderingContext2D, pen: SliderPen) {
  initLayout(pen);
  const bar = pen.barRect;
  const ball = pen.ballRect;
  const activeColor = pen.disabled
    ? pen.disabledColor || pSBC(0.6, pen.activeColor) || '#999'
    : pen.activeColor || '#1890ff';
  const background = pen.disabled
    ? pen.disabledBackground || pSBC(0.6, pen.background) || '#d9d9d9'
    : pen.background || '#d9d9d9';
  const radius = bar.height / 2;

  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, bar.width, bar.height, radius);
  ctx.fillStyle = background;
  ctx.fill();

  const activeWidth = Math.max(0, ball.x - bar.x);
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, activeWidth, bar.height, radius);
  ctx.fillStyle = activeColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.width / 2, 0, Math.PI * 2);
  ctx.fillStyle = pen.btnBackground || '#fff';
  ctx.strokeStyle = activeColor;
  ctx.lineWidth = Math.max(1, ball.width / 10);
  ctx.fill();
  ctx.stroke();
}

function create(this: Meta2d, pen: SliderPen) {
  initLayout(pen);
}

function beforeUpdate(this: Meta2d, pen: SliderPen) {
  const value = pen.__val?.value;
  if (value !== undefined) {
    pen.value = normalizeValue(pen, Number(value));
  }
  return true;
}

function afterUpdate(this: Meta2d, pen: SliderPen) {
  initLayout(pen);
}

function setByPoint(meta2d: Meta2d, source: Pen, point: Point) {
  const pen = meta2d.penMap.get(source.id) as SliderPen;
  if (!pen || pen.disabled) {
    return;
  }
  initLayout(pen);
  const min = pen.min ?? 0;
  const max = pen.max ?? 100;
  const percent = Math.min(1, Math.max(0, (point.x - pen.barRect.x) / pen.barRect.width));
  meta2d.setValue({ id: pen.id, value: Math.round((min + (max - min) * percent) * 100) / 100 });
}

function mouseDown(this: Meta2d, pen: Pen, point: Point) {
  setByPoint(this, pen, point);
  return false;
}

function mouseMove(this: Meta2d, pen: Pen, point: Point) {
  if (!this.mousedown) {
    return;
  }
  setByPoint(this, pen, point);
  return false;
}

function mouseUp(this: Meta2d, source: Pen) {
  const pen = this.penMap.get(source.id);
  pen && this.emitter.emit('change', pen);
  return false;
}

function changeTheme(this: Meta2d, pen: SliderPen, styles: Record<string, string>) {
  pen.background = styles.sliderBg || pen.background;
  pen.btnBackground = styles.sliderBtnBg || pen.btnBackground;
  pen.activeColor = styles.tabActiveBg || pen.activeColor;
}
