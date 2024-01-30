/**
 * 拷贝一个对象
 * @param o - object to clone
 * @param keepCalc 是否保留计算属性， false, 不保留， true, 保留（但 calculative.canvas 属性仍不保存）
 * @returns 拷贝后的对象
 */
export function deepClone<T>(o: T, keepCalc = false): T {
  if (Array.isArray(o)) {
    const arr = [] as T & any[];
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
    const _o = {} as T;
    for (const key in o) {
      if (
        ['canvas', 'lastFrame'].includes(key) ||
        o[key] instanceof HTMLImageElement ||
        o[key] instanceof HTMLMediaElement
      ) {
        continue;
      } else if (key === 'calculative' && !keepCalc) {
        continue;
      } else if (key === 'singleton') {
        if (keepCalc) {
          _o[key] = {} as any;
        } else {
          _o[key] = o[key];
        }
        continue;
      }
      _o[key] = deepClone(o[key], keepCalc);
    }
    return _o;
  }

  return o;
}

export function deepSetValue<T>(o: any, keyWords: string[], value: number): T {
  if (Array.isArray(o)) {
    const arr = [] as T & any[];
    o.forEach((item) => {
      arr.push(deepSetValue(item, keyWords, value));
    });
    return arr;
  } else if (typeof o === 'object') {
    if (o === null) {
      return null;
    }
    // const _o = {} as any;
    for (const key in o) {
      if (keyWords.includes(key)) {
        if(Array.isArray(o[key])){
          o[key].forEach((i,index)=>{
            if(!Number.isNaN(Number(i))){
              o[key][index] = Number(i * value);
            }
          });
        }else {
          if(Number.isNaN(Number(o[key]))){
            continue;
          }
          o[key] = Number(o[key]) * value;
        }
      } else {
        o[key] = deepSetValue(o[key], keyWords, value);
      }
    }
    return o;
  }
  return o;
}
