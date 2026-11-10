/**
 * 矢量图元中间表示（Vector IR）。
 *
 * CAD（DXF）、Visio（VSDX）等外部格式的解析器都输出这一种数据，core 里只有一个通用解释器
 * （diagrams/base/vector.ts）负责绘制。设计约束：
 * 1. 纯数据（可 JSON 序列化、可 structuredClone 到 Worker），不含函数；
 * 2. 局部坐标系，Y 轴向下；几何在 bbox 内，绘制时整体映射到 pen 的矩形，所以缩放图元不用改几何；
 * 3. 指令集小而固定：解析器把各种曲线（SPLINE、NURBS、凸度圆弧…）在解析期化成这几种基础指令，
 *    新格式只需要写解析器，不需要改解释器。
 */

import type { Box, Matrix } from '@meta2d/math';

/** 2D 仿射矩阵（即 @meta2d/math 的 Matrix），与 Canvas `transform(a, b, c, d, e, f)` 同序 */
export type VectorMatrix = Matrix;

/**
 * 路径指令，扁平数字数组（比对象数组小一个数量级，序列化和跨线程克隆都便宜）：
 * - `0, x, y` moveTo
 * - `1, x, y` lineTo
 * - `2, x1, y1, x2, y2, x, y` bezierCurveTo
 * - `3, x1, y1, x, y` quadraticCurveTo
 * - `4` closePath
 * - `5, cx, cy, rx, ry, rotation, startAngle, endAngle, anticlockwise(0|1)` ellipse，语义同 Canvas
 */
export type VectorPathData = number[];

export const enum VectorOp {
  Move = 0,
  Line = 1,
  Cubic = 2,
  Quad = 3,
  Close = 4,
  Ellipse = 5,
}

/** 每条指令占用的数组长度（含操作码） */
export const VectorOpSize = [3, 3, 7, 5, 1, 9];

/**
 * 颜色取值：
 * - 普通 CSS 颜色字符串：固定颜色
 * - `'$fg'`：前景色。顶层是图元当前描边色（随 pen.color、悬停、选中、主题变化），块引用里可被 ref.c 覆盖
 * - `'$bg'`：图元背景（pen.background / 渐变 / 悬停背景），图元没有背景时不填充
 * - `'none'`：不绘制
 */
export type VectorColor = string;

export interface VectorStyle {
  /** 描边色，缺省 = `'$fg'` */
  stroke?: VectorColor;
  /** 填充色，缺省 = 不填充 */
  fill?: VectorColor;
  /**
   * 线宽，局部坐标单位（随图元缩放，真实几何宽度，如 CAD 多段线全局宽度）。缺省用图元线宽；比图元线宽细时取图元线宽，避免缩小后看不见。
   * '$lw'：完全由图元的 lineWidth 决定（可在属性面板修改），配合 stroke: '$fg'、fill: '$bg' 使用，图元的外观就和原生图元一样可编辑
   */
  lw?: number | '$lw';
  /** 显示线宽，屏幕像素，不随缩放变化（如 CAD 的打印线宽）。与 lw 同时存在时取两者在屏幕上较粗的 */
  px?: number;
  /** 虚线，局部坐标单位 */
  dash?: number[];
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
  /** 填充规则，缺省 nonzero */
  rule?: CanvasFillRule;
  /** 透明度 0-1 */
  alpha?: number;
}

export interface VectorPathItem {
  t: 'p';
  d: VectorPathData;
  s?: VectorStyle;
}

export interface VectorTextItem {
  t: 't';
  text: string;
  /** 锚点，局部坐标 */
  x: number;
  y: number;
  /** 字高（局部坐标单位），即字号 */
  h: number;
  /** 旋转弧度（Y 轴向下坐标系，正值顺时针） */
  r?: number;
  /** 宽度因子，缺省 1 */
  w?: number;
  /** 镜像：字形沿基线翻转（CAD 中负缩放 / 镜像块里的文字），绘制时在旋转后 scale(1, -1) */
  m?: 1;
  /** 水平对齐，缺省 left */
  a?: CanvasTextAlign;
  /** 垂直基线，缺省 alphabetic */
  b?: CanvasTextBaseline;
  /** 行高倍数，缺省 1.25 */
  lh?: number;
  font?: string;
  bold?: boolean;
  italic?: boolean;
  /** 文字颜色，缺省 `'$fg'` */
  fill?: VectorColor;
}

/** 图案填充：边界 + 若干组平行线族，绘制时裁剪到边界内 */
export interface VectorHatchItem {
  t: 'h';
  /** 边界路径（多个闭合环，按 evenodd 规则得到孔洞） */
  d: VectorPathData;
  lines: VectorHatchLine[];
  /** 图案线颜色，缺省 `'$fg'` */
  stroke?: VectorColor;
}

export interface VectorHatchLine {
  /** 线方向角（弧度，局部坐标） */
  a: number;
  /** 线族中一条线经过的点 */
  x: number;
  y: number;
  /** 相邻两条线之间的平移向量 */
  dx: number;
  dy: number;
  /** 线型，正数实线、负数间隙（局部坐标单位） */
  dash?: number[];
}

/** 引用共享几何（CAD 块 / Visio 母版），只存一份定义，多处引用 */
export interface VectorRefItem {
  t: 'r';
  /** 共享几何 id，见 Meta2dData.vectors */
  id: string;
  /** 定义坐标 → 当前坐标 */
  m: VectorMatrix;
  /** 块内「随块」颜色（`'$fg'`）在此次引用中的取值，缺省沿用外层前景色 */
  c?: VectorColor;
}

export type VectorItem = VectorPathItem | VectorTextItem | VectorHatchItem | VectorRefItem;

/** 轴对齐矩形（即 @meta2d/math 的 Box） */
export type VectorBox = Box;

export interface VectorGeom {
  /** 几何在局部坐标中的范围，绘制时映射到 pen 的 x/y/width/height */
  bbox: VectorBox;
  items: VectorItem[];
}

/** 解析器的统一输出：可直接 meta2d.open()，也可 addVectors + addPens 追加到当前图纸 */
export interface VectorDocument {
  pens: any[];
  /** 共享几何定义 */
  vectors?: Record<string, VectorGeom>;
  width?: number;
  height?: number;
}
