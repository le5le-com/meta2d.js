import type { Point } from "../../types";

/**
 * 以下为结构化类型：只声明本库用到的最小接口，
 * 避免对 @meta2d/core 产生强依赖，Meta2d 实例天然满足该结构
 */
export interface WorldAnchor extends Point {
  id?: string;
  penId?: string;
  connectTo?: string;
  prev?: WorldAnchor;
  next?: WorldAnchor;
  [key: string]: any;
}

export interface PenLike {
  id?: string;
  type?: number;
  parentId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotate?: number;
  anchors?: WorldAnchor[];
  calculative?: {
    worldAnchors?: WorldAnchor[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface RectData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number; // 原始旋转角度（度），不受 scale/origin 影响
}

export interface Meta2dLike {
  canvas: {
    initLineRect: (pen: PenLike) => void;
    updatePenRect: (pen: PenLike) => void;
  };
  store: {
    data: {
      scale?: number;
      origin?: Point;
    };
    pens?: { [id: string]: PenLike };
  };
  render: (patchFlags?: boolean | number) => void;
  setValue: (
    data: { id?: string; [key: string]: any },
    options?: { render?: boolean; doEvent?: boolean; history?: boolean }
  ) => void;
}

/**
 * 归一到 store.pens 中的原始 pen 对象。
 */
export function canonicalPen(meta2d: Meta2dLike, pen: PenLike): PenLike {
  return (pen?.id && meta2d.store?.pens?.[pen.id]) || pen;
}

/**
 * 原始状态快照，统一存 scale 为 1 时的数据坐标（不含 scale/origin）。
 * 透视变换不可逆（含投影除法），多次切换视角必须始终基于原始数据计算，
 * 否则误差会累积；而画布缩放会改变存储坐标，
 * 快照存数据坐标才能保证缩放画布后再变换尺寸依然正确。
 */
export const originAnchorsMap = new WeakMap<PenLike, WorldAnchor[]>();
export const originRectMap = new WeakMap<PenLike, RectData>();

export function getScaleOrigin(meta2d: Meta2dLike): {
  scale: number;
  origin: Point;
} {
  const data = meta2d.store?.data || {};
  return {
    scale: data.scale || 1,
    origin: data.origin || { x: 0, y: 0 },
  };
}

function cloneAnchor(pt: WorldAnchor): WorldAnchor {
  const clone: WorldAnchor = { ...pt };
  // 运行时缓存，变换后由 initLineRect / updatePenRect 重新计算
  delete clone.curvePoints;
  delete clone.lineLength;
  delete clone.start;
  if (pt.prev) {
    clone.prev = { ...pt.prev };
  }
  if (pt.next) {
    clone.next = { ...pt.next };
  }
  return clone;
}

/** 画布存储坐标 -> scale 为 1 的数据坐标（含贝塞尔控制点） */
function anchorToData(
  pt: WorldAnchor,
  scale: number,
  origin: Point
): WorldAnchor {
  const clone = cloneAnchor(pt);
  clone.x = (pt.x - origin.x) / scale;
  clone.y = (pt.y - origin.y) / scale;
  if (pt.prev) {
    clone.prev = {
      ...pt.prev,
      x: (pt.prev.x - origin.x) / scale,
      y: (pt.prev.y - origin.y) / scale,
    };
  }
  if (pt.next) {
    clone.next = {
      ...pt.next,
      x: (pt.next.x - origin.x) / scale,
      y: (pt.next.y - origin.y) / scale,
    };
  }
  return clone;
}

/** scale 为 1 的数据坐标 -> 当前画布存储坐标（含贝塞尔控制点） */
export function anchorToWorld(
  pt: WorldAnchor,
  scale: number,
  origin: Point
): WorldAnchor {
  const clone = cloneAnchor(pt);
  clone.x = pt.x * scale + origin.x;
  clone.y = pt.y * scale + origin.y;
  if (pt.prev) {
    clone.prev = {
      ...pt.prev,
      x: pt.prev.x * scale + origin.x,
      y: pt.prev.y * scale + origin.y,
    };
  }
  if (pt.next) {
    clone.next = {
      ...pt.next,
      x: pt.next.x * scale + origin.x,
      y: pt.next.y * scale + origin.y,
    };
  }
  return clone;
}

export function centerOfPoints(pts: Point[]): Point {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

export function rectCorners(rect: RectData): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

/**
 * 获取连线的原始锚点（当前画布存储坐标）。
 * 首次调用时建立快照（数据坐标），之后始终返回原始数据换算到当前缩放下的坐标，
 * 与连线当前是否已被变换无关。
 */
export function getLineOriginAnchors(
  meta2d: Meta2dLike,
  pen: PenLike
): WorldAnchor[] {
  pen = canonicalPen(meta2d, pen);
  const worldAnchors = pen.calculative?.worldAnchors;
  if (!worldAnchors || worldAnchors.length < 2) {
    return [];
  }
  const { scale, origin } = getScaleOrigin(meta2d);
  let snapshot = originAnchorsMap.get(pen);
  if (!snapshot) {
    snapshot = worldAnchors.map((pt) => anchorToData(pt, scale, origin));
    originAnchorsMap.set(pen, snapshot);
  }
  return snapshot.map((pt) => anchorToWorld(pt, scale, origin));
}

/**
 * 获取节点的原始 rect（当前画布存储坐标）。
 * 首次调用时建立快照（数据坐标），语义同 getLineOriginAnchors。
 */
export function getNodeOriginRect(
  meta2d: Meta2dLike,
  pen: PenLike
): RectData | undefined {
  pen = canonicalPen(meta2d, pen);
  if (
    pen.x == null ||
    pen.y == null ||
    pen.width == null ||
    pen.height == null
  ) {
    return undefined;
  }
  const { scale, origin } = getScaleOrigin(meta2d);
  let snapshot = originRectMap.get(pen);
  if (!snapshot) {
    snapshot = {
      x: (pen.x - origin.x) / scale,
      y: (pen.y - origin.y) / scale,
      width: pen.width / scale,
      height: pen.height / scale,
      rotate: pen.rotate || 0,
    };
    originRectMap.set(pen, snapshot);
  }
  return {
    x: snapshot.x * scale + origin.x,
    y: snapshot.y * scale + origin.y,
    width: snapshot.width * scale,
    height: snapshot.height * scale,
    rotate: snapshot.rotate,
  };
}
