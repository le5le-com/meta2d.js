import type { Meta2d, Pen } from '@meta2d/core';

type TimePen = Pen & {
  fillZero?: boolean;
  timeFormat?: string;
  timeout?: number;
};

const timers = new Map<string, ReturnType<typeof setInterval>>();

export const timeDefine = {
  type: 'time',
  draw: time,
  create,
  afterUpdate,
  destroy,
};

export function time(ctx: CanvasRenderingContext2D, pen: Pen) {
  ctx.beginPath();
  ctx.rect(pen.x, pen.y, pen.width, pen.height);
  ctx.closePath();
  if (pen.lineWidth !== 0) {
    ctx.stroke();
  }
}

function formatTime(this: Meta2d, pen: TimePen) {
  const weeks = ['天', '一', '二', '三', '四', '五', '六'];
  const now = new Date();
  const pad = pen.fillZero ? '0' : '';
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, pad);
  const day = `${now.getDate()}`.padStart(2, pad);
  const hours = `${now.getHours()}`.padStart(2, pad);
  const minutes = `${now.getMinutes()}`.padStart(2, pad);
  const seconds = `${now.getSeconds()}`.padStart(2, pad);
  if (!pen.timeFormat) {
    return `${year}:${month}:${day} ${hours}:${minutes}:${seconds} 星期${weeks[now.getDay()]}`;
  }
  const fn = new Function(
    'year',
    'month',
    'day',
    'week',
    'hours',
    'minutes',
    'seconds',
    `return ${pen.timeFormat}`,
  ) as (...args: Array<string | number>) => string;
  return fn(year, month, day, weeks[now.getDay()], hours, minutes, seconds);
}

function create(this: Meta2d, pen: TimePen) {
  destroy.call(this, pen);
  const update = () => this.setValue({ id: pen.id, text: formatTime.call(this, pen) }, { preventEvent: true });
  update();
  timers.set(pen.id, setInterval(update, pen.timeout || 1000));
}

function afterUpdate(this: Meta2d, pen: TimePen, value: Record<string, unknown>) {
  if (value.timeout !== undefined || value.timeFormat !== undefined || value.fillZero !== undefined) {
    create.call(this, pen);
  }
}

function destroy(this: Meta2d, pen: TimePen) {
  const timer = timers.get(pen.id);
  if (timer) {
    clearInterval(timer);
    timers.delete(pen.id);
  }
}
