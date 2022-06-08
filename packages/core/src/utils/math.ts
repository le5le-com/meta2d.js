export function abs(num: number, percent: number | string): number {
  if (+percent) {
    return +percent;
  }

  if (!percent || percent[(percent as string).length - 1] !== '%') {
    return 0;
  }

  percent = (percent as string).substr(0, (percent as string).length - 1);

  return (num * +percent) / 100;
}

/**
 * 实际值是否在范围中, 数学上的开闭
 * @param realValue 实际值
 * @param collection 集合规范，与数学上相同，如[0, 100]，前闭后闭；如[0, 100)，前闭后开；
 * @returns undefined 说明参数不规范 ，true 说明在范围内，false 说明不在范围内
 */
export function valueInRange(realValue: number, collection: unknown): boolean {
  if (isNaN(realValue)) {
    console.warn(`realValue not number`);
    return;
  }
  if (typeof collection !== 'string') {
    console.warn('collection must be string');
    return;
  }
  const [start, end] = [collection[0], collection[collection.length - 1]];
  if (!['[', '('].includes(start)) {
    console.warn('collection must start with "[" or "("');
    return;
  }
  if (![']', ')'].includes(end)) {
    console.warn('collection must end with "]" or ")"');
    return;
  }
  const nums = collection.substring(1, collection.length - 1).split(',');
  if (nums.length !== 2) {
    console.warn('collection must have 2 numbers');
    return;
  }
  const [startNum, endNum] = [+nums[0], +nums[1]];
  if (startNum >= endNum) {
    console.warn('startNum must less than endNum');
    return;
  }
  // 大于 startNum 左肯定成立
  const left =
    realValue > startNum || (start === '[' && realValue === startNum)
      ? true
      : false;
  if (!left) {
    return false;
  }
  // 执行到这，左边已经是true了，判断右边
  const right =
    realValue < endNum || (end === ']' && realValue === endNum) ? true : false;

  return right;
}

/**
 * 实际值是否在数组中，即是否属于
 * 例如: [1,2,3] 只有 1 2 3 是属于 collection 的
 * .. 范围值 30..50 等于 闭区间的 [30,50] ，即范围值
 * [1,20,30..50,65] 只有 1 20 30..50 65 是属于 collection 的
 * @param realValue 实际值
 * @param collection 集合
 * @returns undefined 说明参数不规范 ，true 说明在范围内，false 说明不在范围内
 */
export function valueInArray(realValue: number, collection: unknown): boolean {
  if (isNaN(realValue)) {
    console.warn(`realValue not number`);
    return;
  }
  if (typeof collection !== 'string') {
    console.warn('collection must be string');
    return;
  }
  const [start, end] = [collection[0], collection[collection.length - 1]];
  if (start !== '[' || end !== ']') {
    console.warn('collection must start with "[" and end with "]"');
    return;
  }
  const numStrs = collection.substring(1, collection.length - 1).split(',');
  for (const numStr of numStrs) {
    if (numStr.includes('..')) {
      // 范围值
      const [start, end] = numStr.split('..');
      const [startNum, endNum] = [+start, +end];
      if (startNum >= endNum) {
        console.warn('startNum must less than endNum');
        return;
      }
      if (realValue >= startNum && realValue <= endNum) {
        return true;
      }
    } else {
      // 单个值
      const num = +numStr;
      if (realValue === num) {
        return true;
      }
    }
  }
  return false;
}
