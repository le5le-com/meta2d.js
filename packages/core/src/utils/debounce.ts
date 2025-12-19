const debounces = new WeakMap();
const throttles = new WeakMap();

export function debounce(fn: Function, delay: number, params?: any) {
  let cache: any = debounces.get(fn);
  if (cache) {
    clearTimeout(cache.timer);
  } else {
    cache = {};
    debounces.set(fn, cache);
  }
  return new Promise((resolve, reject) => {
    cache.timer = setTimeout(async () => {
      resolve(await fn(params));
      debounces.delete(fn);
    }, delay);
  });
}

export async function throttle(fn: Function, delay: number, params?: any) {
  const now = new Date().getTime();
  const start: number = debounces.get(fn);
  throttles.set(fn, now);
  if (start && now - start < delay) {
    return;
  }

  return await fn(params);
}


export class InstanceDebouncer {
  static instances = new WeakMap();
  
  static debounce(instance, methodName, wait = 300) {
    const key = Symbol(`${instance.constructor.name}.${methodName}`);
    
    if (!this.instances.has(instance)) {
      this.instances.set(instance, {});
    }
    
    const instanceData = this.instances.get(instance);
    
    return (...args) => {
      if (instanceData[key]) {
        clearTimeout(instanceData[key]);
      }
      
      instanceData[key] = setTimeout(() => {
        instance[methodName](...args);
        delete instanceData[key];
      }, wait);
    };
  }
}


