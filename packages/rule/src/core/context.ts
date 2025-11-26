import { Config, Context, Rule } from '../types';
import { Meta2d, Pen } from "@meta2d/core"
import { SEPARATOR, validatePlugin } from '../utils';

export function createContext(config:Config<Pen>, meta2d:Meta2d): Context<Pen>{

  const plugins = config.plugins
  const ruleMaps = new Map<string, Rule>();

  plugins?.forEach(plugin=>{
    if(!validatePlugin(plugin))return
    plugin.rules.forEach(rule=>{
      const ruleFullName = plugin.name + SEPARATOR + rule.name
      ruleMaps.set(ruleFullName, rule)
    })
  })

  const pens = meta2d.store.data.pens
  return {
    meta2d: meta2d,
    nodes:pens,
    point: pens[0],
    index: 0,
    ruleMaps,
    config,
  }
}