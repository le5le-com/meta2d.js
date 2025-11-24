import { Config, Rule, RuleEngine } from '../types';
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

  const start = ()=>{
    main: while (!traverser.done){
      const node = traverser.next();
      for (const rule of rules) {
        if(rule.target(node)){  // 此处循环嵌套过多，考虑性能优化（map存储node和对应规则）
          for (const ruleKey in rule) {
            const exec = context.ruleMaps.get(ruleKey)
            if(exec){
              if(!execValidate(exec, context, node)){
                break main
              }
            }
          }
        }
      }
    }
  }

  return {
    start,
    traverser,
    context,
  }
}