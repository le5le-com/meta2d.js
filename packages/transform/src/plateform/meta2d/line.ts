import { perspectiveTransform } from "../../core/view";
import type { PerspectiveOptions } from "../../types";
import {
  anchorToWorld,
  canonicalPen,
  centerOfPoints,
  getLineOriginAnchors,
  getScaleOrigin,
  originAnchorsMap,
} from "./store";
import type { Meta2dLike, PenLike, WorldAnchor } from "./store";

export type { Meta2dLike } from "./store";

/** @deprecated 等价于 PerspectiveOptions，保留以兼容已有调用 */
export type LinePerspectiveOptions = PerspectiveOptions;

/**
 * 连线视角变换（不触发渲染），供组合调用。
 *
 * 原理：连线最终渲染自 pen.calculative.worldAnchors（绝对坐标），
 * 这里对原始锚点做 perspectiveTransform 透视变换后写回 worldAnchors，
 * 再调用 canvas.initLineRect 重新计算连线 rect、相对 anchors 并刷新 Path2D 渲染缓存。
 *
 * @returns 被变换的连线数组
 */
export function applyLineTransform(
  meta2d: Meta2dLike,
  lines: PenLike | PenLike[],
  options: PerspectiveOptions = {}
): PenLike[] {
  const { x = 0, y = 0, z = 0, dist = 1000, center } = options;
  const pens = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);

  // 收集可用连线及其原始锚点（当前画布存储坐标，首次调用时建立快照）
  const items: { pen: PenLike; origin: WorldAnchor[] }[] = [];
  for (const raw of pens) {
    const pen = canonicalPen(meta2d, raw);
    const origin = getLineOriginAnchors(meta2d, pen);
    if (origin.length < 2) {
      continue;
    }
    items.push({ pen, origin });
  }
  if (!items.length) {
    return pens;
  }

  // 未指定 center 时，以所有目标连线原始锚点的总包围盒中心为统一环绕中心，
  // 保证整组连线绕同一个点旋转，而不是各自绕自身中心
  let c = center;
  if (!c) {
    const allAnchors: WorldAnchor[] = [];
    items.forEach((item) => allAnchors.push(...item.origin));
    c = centerOfPoints(allAnchors);
  }

  for (const { pen, origin } of items) {
    // 透视变换后的锚点（保留 id / penId / connectTo 等原有字段）
    const transformed = perspectiveTransform(
      origin,
      c,
      x,
      y,
      z,
      dist
    ) as WorldAnchor[];

    // 贝塞尔控制点（prev / next）同样需要变换
    transformed.forEach((pt, index) => {
      const o = origin[index];
      if (o.prev) {
        pt.prev = perspectiveTransform([{ ...o.prev }], c, x, y, z, dist)[0];
      }
      if (o.next) {
        pt.next = perspectiveTransform([{ ...o.next }], c, x, y, z, dist)[0];
      }
    });

    pen.calculative!.worldAnchors = transformed;
    // 重新计算 rect、相对 anchors、文本区域并刷新 Path2D 渲染缓存
    meta2d.canvas.initLineRect(pen);
  }

  return pens;
}

/**
 * 切换连线视角（2d -> 伪 3d 透视变换）并渲染
 *
 * @param meta2d Meta2d 实例
 * @param lines 目标连线（单个或数组）
 * @param options x/y/z 旋转角度、视距 dist、环绕中心 center；
 *                center 缺省时，以所有目标连线原始锚点的总包围盒中心作为统一环绕中心
 * @returns 被变换的连线数组
 */
export function transformLine(
  meta2d: Meta2dLike,
  lines: PenLike | PenLike[],
  options: PerspectiveOptions = {}
): PenLike[] {
  const pens = applyLineTransform(meta2d, lines, options);
  meta2d.render();
  return pens;
}

/** 恢复连线到视角变换前的原始状态（不触发渲染），供组合调用 */
export function resetLineTransformCore(
  meta2d: Meta2dLike,
  lines: PenLike | PenLike[]
): void {
  const pens = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  const { scale, origin: viewOrigin } = getScaleOrigin(meta2d);

  for (const raw of pens) {
    const pen = canonicalPen(meta2d, raw);
    const snapshot = originAnchorsMap.get(pen);
    if (!snapshot) {
      continue;
    }
    pen.calculative!.worldAnchors = snapshot.map((pt) =>
      anchorToWorld(pt, scale, viewOrigin)
    );
    originAnchorsMap.delete(pen);
    meta2d.canvas.initLineRect(pen);
  }
}

/**
 * 恢复连线到视角变换前的原始状态并渲染
 * （不调用此函数而直接 transformLine(x:0,y:0,z:0) 也可还原，且保留快照便于继续动态调整）
 */
export function resetLineTransform(
  meta2d: Meta2dLike,
  lines: PenLike | PenLike[]
): void {
  resetLineTransformCore(meta2d, lines);
  meta2d.render();
}
