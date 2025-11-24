import { createEngine } from './RuleEngine';
import { Config } from '../types';
import { Meta2d, Pen } from '@meta2d/core';

export function RuleEngine (
  config:Config<Pen>,
  meta2d:Meta2d
){
  const engine = createEngine(config,meta2d)
  return engine
}