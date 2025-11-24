import { Context, Traverser } from '../types';
import { Pen } from "@meta2d/core"

export function BaseTraverser(
  ctx: Context<Pen>
):ReturnType<Traverser<Context<Pen>, Pen>> {

  ctx.nodes = ctx.nodes.filter(node=> !node.type) // 遍历所有的图元（非连线）
  let point = ctx.point
  let done = false
  const next = (context?: Context<Pen>): Pen => {
    const next = context?.nodes[++context.index] // 默认遍历方法为按图元顺序遍历
    if (!next) done = true

    return next as unknown as Pen
  }
  return {
    point,
    next,
    done
  }
}
