/**
 * 拷贝一个对象
 * @param o - object to clone
 * @param keepCalc 是否保留计算属性， false, 不保留， true, 保留（但 calculative.canvas 属性仍不保存）
 * @returns 拷贝后的对象
 */
export function deepClone(o?: any, keepCalc = false) {
  if (Array.isArray(o)) {
    const arr = [];
    o.forEach((item) => {
      arr.push(deepClone(item, keepCalc));
    });
    return arr;
  } else if (typeof o === 'object') {
    if (o === null) {
      return null;
    } else if (o.constructor === RegExp) {
      return o;
    }
    const _o = {};
    for (let key in o) {
      if (
        ['canvas', 'lastFrame'].includes(key) ||
        o[key] instanceof HTMLImageElement ||
        o[key] instanceof HTMLMediaElement
      ) {
        continue;
      } else if (key === 'calculative' && !keepCalc) {
        continue;
      }
      _o[key] = deepClone(o[key], keepCalc);
    }
    return _o;
  }

  return o;
}
