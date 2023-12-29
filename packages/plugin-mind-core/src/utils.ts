import {Pen} from "@meta2d/core";

export function createDom(tag: string, config: {
  style?: object
  event?: string,
  func?: any,
  className?: string
} = {
  style: {},
  event: undefined,
  func: undefined,
  className: undefined
}) {
  // 创建dom
  let dom = document.createElement(tag);
  // 设置dom样式
  if (config.style) {
    if (typeof config.style === 'object') {
      Object.assign(dom.style, config.style);
      config.className && dom.classList.add(config.className);
    } else {
      throw new Error('createDom error: parma "style" must be a Object');
    }
  }
  // 绑定dom事件；
  if (typeof config.event === 'string' && typeof config.func === 'function') {
    dom.addEventListener(config.event, (e) => {
      config.func(e);
    });
  }
  return dom;
}


export function debounce(fn: Function, delay: number) {
  let timer: any = null;
  return function (pen: Pen, recursion = true) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      fn.call(this, pen, recursion);
    }, delay);
  };
}


export function deepMerge(obj1: any, obj2: any) {
  let newObj = Object.assign({}, obj1);

  for (let key in obj2) {
    if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object') {
      newObj[key] = deepMerge(obj1[key], obj2[key]);
    } else {
      newObj[key] = obj2[key];
    }
  }

  return newObj;
}

export function replaceAfterPosition(str: string, position: number, regex: RegExp, replacement: string) {
  // 判断位置是否超出字符串长度
  if (position >= str.length) return str;

  // 截取从指定位置开始到字符串末尾的子字符串
  const substringToReplace = str.slice(position);

  // 在子字符串中执行替换操作
  const replacedSubstring = substringToReplace.replace(regex, replacement);

  // 将替换后的子字符串与前面的部分结合
  const resultString = str.slice(0, position) + replacedSubstring;

  return resultString;
}


export function debounceFirstOnly(func: Function, wait: number) {
  let timeout: any;
  let executed = false; // 标志是否已经执行过一次

  return function (...args: any[]) {
    // @ts-ignore
    const context = this;

    if (!executed) {
      func.apply(context, args);
      executed = true;
    }

    clearTimeout(timeout);
    timeout = setTimeout(function () {
      executed = false; // 重置执行标志，使得函数可以在下一次防抖周期首次被触发时执行
    }, wait);
  };
}

export function isObjectLiteral(value: object) {
  return Object.prototype.toString.call(value) === '[object Object]';
}


export function removeDuplicates(list: any[]) {
  const uniqueResults = [];
  const uniqueNames = new Set();
  for (const res of list) {
    if (!uniqueNames.has(res.name)) {
      uniqueNames.add(res.name);
      uniqueResults.push(res);
    }
  }
  return uniqueResults;
}

//沙盒
export function scopedEval(scope: object, expr: string) {
  const scopeKeys = Object.keys(scope);
  const scopeValues = Object.values(scope);

  // 函数的参数名称与作用域的键相匹配，函数体是表达式
  const func = new Function(...scopeKeys/*这是变量名列表*/, `return ${expr};`);

  // 将作用域的值作为参数传递
  try {
    let re = func(...scopeValues);
    return re;
  } catch (e: any) {
    error('[ScopedEval] Error: ', e.message);
  }
}

// tslint:disable-next-line:variable-name
export function escapeRegExp(str: string) {
  // RegExp.escape的提案用法，替换所有可能的特殊字符
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


export function error(scope: string, message: string) {
  throw new Error(`plugin-mind-core ${scope} Error: ${message}`);
}


export function warn(scope: string, message: string) {
  console.warn(`mind-plugin-core ${scope} Warn: ${message}`);
}

export function deepCopy(obj: any, cache = new WeakMap()) {
  // 基本数据类型直接返回
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 处理日期
  if (obj instanceof Date) {
    return new Date(obj);
  }

  // 处理正则表达式
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  // 处理函数
  if (typeof obj === 'function') {
    return obj.bind(null);
  }

  // 避免循环引用
  if (cache.has(obj)) {
    return cache.get(obj);
  }

  // 处理数组和对象
  let copy: any = Array.isArray(obj) ? [] : {};

  // 将拷贝的结果存入缓存
  cache.set(obj, copy);

  // 递归拷贝所有属性
  Object.keys(obj).forEach((key) => {
    copy[key] = deepCopy(obj[key], cache);
  });

  // 拷贝原型链上的属性
  const proto = Object.getPrototypeOf(obj);
  if (proto) {
    Object.setPrototypeOf(copy, proto);
  }

  return copy;
}


function isObject(object: object) {
  return object != null && typeof object === 'object';
}

export function compareObjects(object1: any, object2: any) {
  const diffs: any = {};
  const compare = function (item1: any, item2: any, key: string) {
    const type1 = Object.prototype.toString.call(item1);
    const type2 = Object.prototype.toString.call(item2);
    if (type1 !== type2) {
      diffs[key] = {oldVal: item1, newVal: item2};
      return;
    }

    if (isObject(item1) && isObject(item2)) {
      const objDiffs = compareObjects(item1, item2);
      if (Object.keys(objDiffs).length > 0) {
        diffs[key] = objDiffs;
      }
    } else if (item1 !== item2) {
      diffs[key] = {oldVal: item1, newVal: item2};
    }
  };

  for (const key in object1) {
    if (object1.hasOwnProperty(key)) {
      compare(object1[key], object2[key], key);
    }
  }

  for (const key in object2) {
    if (object2.hasOwnProperty(key)) {
      if (!object1.hasOwnProperty(key)) {
        diffs[key] = {oldVal: undefined, newVal: object2[key]};
      }
    }
  }

  return diffs;
}

export function isIntersection(arr1: string[], arr2: string[]) {
  // 将两个数组转换为 Set 集合
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  let isIntersection = false;
  // 创建一个空数组来存储交集元素
  // const intersection = [];

  // 遍历一个数组，并检查另一个数组是否有相同元素
  for (const item of set1) {
    if (set2.has(item)) {
      // intersection.push(item);
      isIntersection = true;
      break;
    }
  }
  return isIntersection;
}
