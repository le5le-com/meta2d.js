export function deepClone(o?: any) {
  if (Array.isArray(o)) {
    const arr = [];
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
    const _o = {};
    for (let key in o) {
      if (key === 'calculative' || key === 'lastFrame') {
        continue;
      }
      _o[key] = deepClone(o[key]);
    }
    return _o;
  }

  return o;
}
