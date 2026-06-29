import { makeSafeFn } from './safe';
import type { Options } from '../options';

export function formatTime(format?: string, utcDate?:string, options?: Pick<Options, 'allowScript'>) {
  const weeks = ['天', '一', '二', '三', '四', '五', '六'];
  let now = new Date();
  if(utcDate){
    now = new Date(utcDate);
  }
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const week = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  if (!format) {
    return `${year}:${month}:${day} ${hours}:${minutes}:${seconds} 星期${weeks[week]}`;
  }
  let fn = makeSafeFn(
    options,
    'year',
    'month',
    'day',
    'week',
    'hours',
    'minutes',
    'seconds',
    `return ${format}`
  );
  const time = fn(year, month, day, weeks[week], hours, minutes, seconds);
  fn = null;
  return time;
}
