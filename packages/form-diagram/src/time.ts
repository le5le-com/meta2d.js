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
  const weeks = ['天', '一', '二', '三', '四', '五', '六'];
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
  const fn = new Function(
    'year',
    'month',
    'day',
    'week',
    'hours',
    'minutes',
    'seconds',
    pen.timeFormat
      ? `return ${pen.timeFormat}`
      : 'return `${year}:${month}:${day} ${hours}:${minutes}:${seconds} 星期${week}`'
  );
  const time = fn(year, month, day, weeks[week], hours, minutes, seconds);
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
