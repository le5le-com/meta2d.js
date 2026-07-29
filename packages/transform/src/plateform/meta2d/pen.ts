import { perspectiveTransform } from "../../core/view";
import type { PerspectiveOptions, Point } from "../../types";
import {
  canonicalPen,
  centerOfPoints,
  getNodeOriginRect,
  getScaleOrigin,
  originRectMap,
  rectCorners,
} from "./store";
import type { Meta2dLike, PenLike, RectData } from "./store";

/**
 * @returns 被变换的图元数组
 */
export function applyNodeTransform(
  meta2d: Meta2dLike,
  nodes: PenLike | PenLike[],
  options: PerspectiveOptions = {}
): PenLike[] {
  const { x = 0, y = 0, z = 0, dist = 1000, center, rotate = true } = options;
  const pens = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);
  const { scale, origin: viewOrigin } = getScaleOrigin(meta2d);

  const items: { pen: PenLike; origin: RectData }[] = [];
  for (const raw of pens) {
    const pen = canonicalPen(meta2d, raw);
    if (pen.type || pen.parentId) {
      continue;
    }
    const origin = getNodeOriginRect(meta2d, pen);
    if (!origin) {
      continue;
    }
    items.push({ pen, origin });
  }
  if (!items.length) {
    return pens;
  }

  let c = center;
  if (!c) {
    const allCorners: Point[] = [];
    items.forEach((item) => allCorners.push(...rectCorners(item.origin)));
    c = centerOfPoints(allCorners);
  }

  for (const { pen, origin } of items) {
    const projected = perspectiveTransform(rectCorners(origin), c, x, y, z, dist);
    let next: { x: number; y: number; width: number; height: number; rotate: number };
    if (rotate) {
      next = calcProjectedQuad(projected, origin.rotate || 0);
    } else {
      const xs = projected.map((p) => p.x);
      const ys = projected.map((p) => p.y);
      const bx = Math.min(...xs);
      const by = Math.min(...ys);
      next = {
        x: bx,
        y: by,
        width: Math.max(...xs) - bx,
        height: Math.max(...ys) - by,
        rotate: origin.rotate || 0,
      };
    }
    meta2d.setValue(
      {
        id: pen.id,
        x: (next.x - viewOrigin.x) / scale,
        y: (next.y - viewOrigin.y) / scale,
        width: next.width / scale,
        height: next.height / scale,
        rotate: next.rotate,
      },
      { render: false, doEvent: false, history: false }
    );
  }

  return pens;
}

function distanceOf(a: Point, b: Point): number {
  return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
}

/**
 * 用投影四边形近似表达节点：中心取四角均值，宽/高取对边平均长度，
 * 旋转角取顶边与底边倾角的均值（度），叠加到原始 rotate 上
 */
function calcProjectedQuad(corners: Point[], baseRotate: number) {
  const [p0, p1, p2, p3] = corners;
  const width = (distanceOf(p0, p1) + distanceOf(p3, p2)) / 2;
  const height = (distanceOf(p0, p3) + distanceOf(p1, p2)) / 2;
  const topAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const bottomAngle = Math.atan2(p2.y - p3.y, p2.x - p3.x);
  const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
  const cy = (p0.y + p1.y + p2.y + p3.y) / 4;

  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotate: baseRotate + ((topAngle + bottomAngle) / 2) * (180 / Math.PI),
  };
}

/**
 * 切换普通图元视角（2d -> 伪 3d 透视变换，位置与大小随视角变化）并渲染
 *
 * @param meta2d Meta2d 实例
 * @param nodes 目标图元（单个或数组），连线与组合子图元会被忽略
 * @param options x/y/z 旋转角度、视距 dist、环绕中心 center；
 *                center 缺省时，以所有目标图元原始位置的总包围盒中心作为统一环绕中心
 * @returns 被变换的图元数组
 */
export function transformNode(
  meta2d: Meta2dLike,
  nodes: PenLike | PenLike[],
  options: PerspectiveOptions = {}
): PenLike[] {
  const pens = applyNodeTransform(meta2d, nodes, options);
  meta2d.render();
  return pens;
}

/** 恢复普通图元到视角变换前的原始状态（不触发渲染），供组合调用 */
export function resetNodeTransformCore(
  meta2d: Meta2dLike,
  nodes: PenLike | PenLike[]
): void {
  const pens = (Array.isArray(nodes) ? nodes : [nodes]).filter(Boolean);

  for (const raw of pens) {
    const pen = canonicalPen(meta2d, raw);
    const snapshot = originRectMap.get(pen);
    if (!snapshot) {
      continue;
    }
    originRectMap.delete(pen);
    // 快照即 scale 为 1 的数据坐标，与 setValue/setPenRect 的坐标口径一致，直接写回
    meta2d.setValue(
      {
        id: pen.id,
        x: snapshot.x,
        y: snapshot.y,
        width: snapshot.width,
        height: snapshot.height,
        rotate: snapshot.rotate,
      },
      { render: false, doEvent: false, history: false }
    );
  }
}

/**
 * 恢复普通图元到视角变换前的原始状态并渲染
 * （不调用此函数而直接 transformNode(x:0,y:0,z:0) 也可还原，且保留快照便于继续动态调整）
 */
export function resetNodeTransform(
  meta2d: Meta2dLike,
  nodes: PenLike | PenLike[]
): void {
  resetNodeTransformCore(meta2d, nodes);
  meta2d.render();
}
