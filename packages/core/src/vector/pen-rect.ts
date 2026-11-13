import type { VectorBox } from '@meta2d/drawir';

/**
 * 图元框的最小边长（画布坐标）。core 的视口筛选会跳过宽或高小于 2 的普通图元（isTinyPen），
 * 而 CAD 里的水平线、竖线包围盒某个方向恰好为 0，必须撑开，否则整张图的横竖线全部不显示。
 */
export const MIN_PEN_SIZE = 2;

/** 由几何包围盒得到图元的 x / y / width / height：细的方向撑到 MIN_PEN_SIZE 并居中，几何不变 */
export function penRectOfGeom(bbox: VectorBox) {
  const width = Math.max(bbox.width, MIN_PEN_SIZE);
  const height = Math.max(bbox.height, MIN_PEN_SIZE);
  return {
    x: bbox.x - (width - bbox.width) / 2,
    y: bbox.y - (height - bbox.height) / 2,
    width,
    height,
  };
}
