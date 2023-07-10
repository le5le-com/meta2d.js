export function formatTime(format?: string) {
  const weeks = ['天', '一', '二', '三', '四', '五', '六'];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const week = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const fn = new Function(
    'year',
    'month',
    'day',
    'week',
    'hours',
    'minutes',
    'seconds',
    format
      ? `return ${format}`
      : 'return `${year}:${month}:${day} ${hours}:${minutes}:${seconds} 星期${week}`'
  );
  const time = fn(year, month, day, weeks[week], hours, minutes, seconds);
  return time;
}
