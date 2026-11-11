import { t } from '@meta2d/core';

export function time(pen: any, ctx?: CanvasRenderingContext2D): Path2D {
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height } = pen.calculative.worldRect;
  path.rect(x, y, width, height);

  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    pen.onDestroy = onDestroy;
    if (pen.interval) {
      pen.onDestroy(pen);
      pen.onAdd(pen);
    }
  }
  if (!pen.interval) {
    pen.onAdd(pen);
  }

  if (path instanceof Path2D) return path;
  return;
}

function formatTime(pen: any) {
  //更多 https://blog.csdn.net/Endeavorseven/article/details/101310628
  const weeks = ['日', '一', '二', '三', '四', '五', '六'].map(t);
  const now = new Date();
  const year = now.getFullYear();
  let pad = '';
  if (pen.fillZero) {
    pad = '0';
  }
  const month = (now.getMonth() + 1 + '').padStart(2, pad);
  const day = (now.getDate() + '').padStart(2, pad);
  const week = now.getDay();
  const hours = (now.getHours() + '').padStart(2, pad);
  const minutes = (now.getMinutes() + '').padStart(2, pad);
  const seconds = (now.getSeconds() + '').padStart(2, pad);
  if (!pen.timeFormat) {
    return `${year}:${month}:${day} ${hours}:${minutes}:${seconds} ${t('星期')}${weeks[week]}`;
  }
  let timeFormat = (pen.timeFormat + '').trim();

  // 基于标准时间标记进行替换：YYYY、MM、DD、HH、mm、ss、d
  const hasStandardFormat = /YYYY|MM|DD|HH|mm|ss|dddd/.test(timeFormat);
  if (hasStandardFormat) {
    let result = timeFormat;
    result = result.replace(/YYYY/g, year.toString());
    result = result.replace(/MM/g, month);
    result = result.replace(/DD/g, day);
    result = result.replace(/HH/g, hours);
    result = result.replace(/mm/g, minutes);
    result = result.replace(/ss/g, seconds);
    result = result.replace(/dddd/g, weeks[week]);
    return result;
  }

  if (!timeFormat.startsWith('`')) {
    timeFormat = `\`${timeFormat}\``;
  }
  let fn = new Function(
    'year',
    'month',
    'day',
    'week',
    'hours',
    'minutes',
    'seconds',
    `return ${timeFormat}`
  );
  const time = fn(year, month, day, weeks[week], hours, minutes, seconds);
  fn = null;
  return time;
}

function onAdd(pen: any) {
  pen.interval = setInterval(() => {
    const text = formatTime(pen);
    pen.calculative.canvas.parent.setValue(
      { id: pen.id, text },
      { history: false, doEvent: false, render: false }
    );
    pen.calculative.canvas.render();
  }, pen.timeout || 1000);
}

function onDestroy(pen: any) {
  if (pen.interval) {
    clearInterval(pen.interval);
    pen.interval = undefined;
  }
}
