// const obj = {a:{b:[0,1,2]}}
// getter(obj, 'a.b.1')
export function getter(object: any, path: string) {
  if (path == undefined) {
    return object;
  }
  const arr = path.split('.');
  while (arr.length && (object = object[arr.shift()]));
  return object;
}

// setter(obj, 'a.b.1', 111)
export function setter(object: any, path: string, value: any) {
  if (path == undefined) {
    return;
  }
  path.split('.').reduce((o, p, i) => (o[p] = path.split('.').length === ++i ? value : o[p] || {}), object);
}

export function deepClone<T>(o: T): T {
  if (Array.isArray(o)) {
    const arr = [] as T & any[];
    o.forEach((item) => {
      arr.push(deepClone(item));
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
      // Worker 环境没有 DOM 构造器，必须先判断构造器是否存在再执行 instanceof。
      const isElement = typeof HTMLElement !== 'undefined' && o[key] instanceof HTMLElement;
      const isImage = typeof HTMLImageElement !== 'undefined' && o[key] instanceof HTMLImageElement;
      const isMedia = typeof HTMLMediaElement !== 'undefined' && o[key] instanceof HTMLMediaElement;
      if (isElement || isImage || isMedia) {
        continue;
      }

      _o[key] = deepClone(o[key]);
    }
    return _o;
  }

  return o;
}

// 深度合并两个对象，添加或更新差异部分。如果存在相同的key，值的类型不一致，则以source的值为准
export function deepMerge(target: any, source: any) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceVal = source[key];
      if (!sourceVal) {
        continue;
      }

      if (typeof sourceVal !== 'object' || Array.isArray(sourceVal)) {
        target[key] = sourceVal;
        continue;
      }

      const targetVal = target[key];
      if (typeof targetVal === 'object') {
        deepMerge(targetVal, sourceVal);
        continue;
      }

      target[key] = sourceVal;
    }
  }

  return target;
}
