import { Context, Rule } from '../types';
import { Pen } from '@meta2d/core';

export function execValidate(exec: Rule, context: Context<Pen>, node: Pen): boolean {
  if (!exec || !exec.validate || !node) return false;
  const res = exec?.validate.call(exec,context, node);
  if (res) {
    // 正确则下一个
    return true;
  } else {
    // 错误则根据用户配置进行下一步判断
    exec.fail?.call(exec,context, node);
    if (context.config.stopByError) {
      return false;
    } else {
      return true;
    }
  }
}