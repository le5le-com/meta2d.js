import type { VectorGeom, VectorItem } from './types';

/**
 * 共享几何（CAD 块、Visio 母版）仓库。
 *
 * 每个线程（主线程、render / hover worker）各持一份：主线程用于导出 SVG，worker 用于绘制。
 * 由 Meta2d.open（data.vectors）和 Meta2d.addVectors（WorkerMessage.AddVectors）同步。
 * 只增不删：撤销、粘贴回来的图元可能仍引用旧定义，定义本身很小且按 id 去重。
 */
const vectorDefs: Record<string, VectorGeom> = Object.create(null);

export function setVectors(defs?: Record<string, VectorGeom>) {
  if (!defs) {
    return;
  }
  for (const id in defs) {
    defs[id] && (vectorDefs[id] = defs[id]);
  }
}

export function getVector(id: string): VectorGeom | undefined {
  return vectorDefs[id];
}

export function hasVector(id: string) {
  return id in vectorDefs;
}

/** 收集 items 直接或间接引用的共享几何 id（用于协同时只同步用到的定义） */
export function collectVectorRefs(
  items: VectorItem[] | undefined,
  resolve: (id: string) => VectorGeom | undefined = getVector,
  out = new Set<string>(),
) {
  if (!items) {
    return out;
  }
  for (const item of items) {
    if (item.t === 'r' && !out.has(item.id)) {
      out.add(item.id);
      collectVectorRefs(resolve(item.id)?.items, resolve, out);
    }
  }
  return out;
}
