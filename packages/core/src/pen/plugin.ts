// 该文件为penPlugin的相关文件

import {Pen} from "@meta2d/core";

/**
 * @description 闭包 重写 pen的生命周期，为了追加回调函数
 * @return 生命周期操作函数，可在原生命周期回调函数基础上进行执行多个函数，可通过传参，设置函数的增加和删除，类似addEventListener 和 removeEventListener
 * @bug 漏洞：后面的生命周期无法将前面的生命周期需要的参数正确传递
 */
function rewritePenLifeCycle() {
  let funcMap = null;
  let funcPenMap = new Map();
  return (pen: Pen, lifeCycle, func: Function, del= false )=>{
    if(funcPenMap.has(pen) && funcPenMap.get(pen)){
      funcMap = funcPenMap.get(pen);
    }else {
      funcPenMap.set(pen,funcMap = new Map());
    }
    if(typeof func !== "function")return ()=>{
      console.warn('[rewritePenLifeCycle] warn: not a function ');
    };
    let funcListSet = new Set();
    let originFuncMap = new Map(); // 原始事件回调Map
    if(funcMap.has(lifeCycle) && funcMap.get(lifeCycle)){
      funcListSet = funcMap.get(lifeCycle);
    }else {
      originFuncMap.set(lifeCycle,pen[lifeCycle]);
      funcMap.set(lifeCycle,funcListSet);
    }
    if(del){
      funcListSet.delete(func);
    }else {
      funcListSet.add(func);
    }
    let originLifeCycle = originFuncMap.get(lifeCycle); // 原始事件;
    let rewriteFunc = (...args)=>{
      originLifeCycle?.(...args);
      funcListSet.forEach(i=>{
        // @ts-ignore
        i(...args);
      });
    };
    pen[lifeCycle] = rewriteFunc;
  };
}
export let setLifeCycleFunc = rewritePenLifeCycle();

// 检验penPlugin
export function validationPlugin(plugin){
  // 校验penPlugin
  if(!plugin.name && !plugin.install){
    console.error('installPenPlugin Error: Validation Failed');
    return false;
  }
  return  true;
}
