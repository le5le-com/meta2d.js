import { Config, Rule, RuleEngine, RuleState } from '../types';
import { createContext } from './context';
import { BaseTraverser } from './traverse';
import { Meta2d, Pen } from '@meta2d/core';
import { execValidate } from './execValidate';
export function createEngine(
  config:Config<Pen>,
  meta2d:Meta2d
):RuleEngine{

  const context = createContext(config, meta2d)
  const traverser = (config.traverser || BaseTraverser)(context)
  const rules = config.rules

  /**
   * @description 单独检查一个节点是否符合要求
   * */
  const check = (node:Pen)=>{
    for (const rule of rules) {
      if(rule.target(node)){  // 此处循环嵌套过多，考虑性能优化（map存储node和对应规则）
        for (const ruleKey in rule.rules) {
          if(rule.rules[ruleKey] === RuleState.CLOSE){
            continue
          }
          const exec = context.ruleMaps.get(ruleKey)
          if(exec){
            if(!execValidate(exec, context, node)){
              return false
            }
          }
        }
      }
    }
    return true
  }

  /**
   * @description 从traverser中遍历所有节点，检查是否符合要求
   * */
  const start = ()=>{
    main: while (!traverser.done.value){
      const node = traverser.point
      const res = check(node)
      traverser.point = traverser.next()
    }
  }

  return {
    start,
    traverser,
    context,
    check
  }
}