import type { Options, PerspectiveOptions, Point } from "../../types";
import {
  centerOfPoints,
  getLineOriginAnchors,
  getNodeOriginRect,
  rectCorners,
} from "./store";
import type { Meta2dLike, PenLike } from "./store";
import {
  applyLineTransform,
  resetLineTransformCore,
} from "./line";
import {
  applyNodeTransform,
  resetNodeTransformCore,
} from "./pen";

export * from "./line";
export * from "./pen";

export function createTransFormEngine(options: Options) {}

/**
 * 切换一组图元（连线 + 普通图元混合）的视角并渲染。
 * 连线走锚点透视（保持连线形态），普通图元走 rect 四角投影
 * （位置与大小变化）；缺省时所有目标共享同一个环绕中心，
 * 整个场景作为一个整体旋转。
 *
 * @param meta2d Meta2d 实例
 * @param pens 目标图元（单个或数组），组合子图元会被忽略（随父级联动）
 * @param options x/y/z 旋转角度、视距 dist、环绕中心 center
 * @returns 传入的图元数组
 */
export function transformPens(
  meta2d: Meta2dLike,
  pens: PenLike | PenLike[],
  options: PerspectiveOptions = {}
): PenLike[] {
  const list = (Array.isArray(pens) ? pens : [pens]).filter(Boolean);
  const lines = list.filter((pen) => pen.type === 1);
  const nodes = list.filter((pen) => !pen.type && !pen.parentId);

  let center = options.center;
  if (!center) {
    const pts: Point[] = [];
    lines.forEach((pen) => pts.push(...getLineOriginAnchors(meta2d, pen)));
    nodes.forEach((pen) => {
      const rect = getNodeOriginRect(meta2d, pen);
      rect && pts.push(...rectCorners(rect));
    });
    if (pts.length) {
      center = centerOfPoints(pts);
    }
  }

  const opts = { ...options, center };
  applyNodeTransform(meta2d, nodes, opts);
  applyLineTransform(meta2d, lines, opts);
  meta2d.render();
  return list;
}

/**
 * 恢复一组图元（连线 + 普通图元混合）到视角变换前的原始状态并渲染
 */
export function resetPensTransform(
  meta2d: Meta2dLike,
  pens: PenLike | PenLike[]
): void {
  const list = (Array.isArray(pens) ? pens : [pens]).filter(Boolean);
  resetLineTransformCore(
    meta2d,
    list.filter((pen) => pen.type === 1)
  );
  resetNodeTransformCore(
    meta2d,
    list.filter((pen) => !pen.type)
  );
  meta2d.render();
}
