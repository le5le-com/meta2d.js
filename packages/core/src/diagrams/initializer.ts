import type { Meta2d } from '../meta2d';

/** 每个 Meta2d 实例挂载后执行的宿主初始化函数类型。 */
export type Meta2dInitializer = (meta2d: Meta2d) => void | Promise<void>;

let initializer: Meta2dInitializer | undefined;

/**
 * 设置 Meta2d 实例初始化器。
 *
 * 初始化器会在每个 `<le5le-meta2d>` 元素挂载并完成内部 Worker 创建后自动执行，
 * 适合统一加载字体、设置图标字体以及注册 Canvas/DOM 图元库，宿主应用只需配置一次。
 */
export function setMeta2dInitializer(nextInitializer?: Meta2dInitializer) {
  initializer = nextInitializer;
}

/** 执行当前宿主配置的 Meta2d 实例初始化器。 */
export function initializeMeta2d(meta2d: Meta2d) {
  return initializer?.(meta2d);
}
