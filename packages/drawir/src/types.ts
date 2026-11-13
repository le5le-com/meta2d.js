/**
 * 矢量图元中间表示（Vector IR）。
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
 * - `'$fg'`：由渲染后端使用文档或调用方提供的前景色解析，块引用里可被 ref.c 覆盖
 * - `'$bg'`：由渲染后端使用文档或调用方提供的背景色解析，没有背景时不填充
 * - `'none'`：不绘制
 */
export type VectorColor = string;
export type VectorLineCap = 'butt' | 'round' | 'square';
export type VectorLineJoin = 'bevel' | 'round' | 'miter';
export type VectorFillRule = 'nonzero' | 'evenodd';
export type VectorTextAlign = 'left' | 'right' | 'center' | 'start' | 'end';
export type VectorTextBaseline = 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';

/** 渐变色标 */
export interface VectorGradientStop {
  /** 位置 0~1 */
  o: number;
  /** CSS 颜色（不支持 '$fg' / '$bg'） */
  c: string;
}

/**
 * 渐变，参数语义同 Canvas：
 * - `linear`：createLinearGradient(x0, y0, x1, y1)
 * - `radial`：createRadialGradient(x0, y0, r0, x1, y1, r1)
 *
 * 坐标在「渐变空间」中，m 把渐变空间映射到局部坐标（缺省为单位矩阵，即直接用局部坐标）。
 * 借助 m 可以表达任意仿射变换后的渐变：椭圆形径向渐变、斜切后的线性渐变（等值线不再垂直于渐变方向）。
 * 几何经矩阵变换时（transformItem、块引用）只需左乘到 m，渐变随几何一起变换。
 */
export interface VectorGradient {
  type: 'linear' | 'radial';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 径向渐变的内、外圆半径（渐变空间） */
  r0?: number;
  r1?: number;
  /** 渐变空间 → 局部坐标 */
  m?: VectorMatrix;
  stops: VectorGradientStop[];
}

/** 填充 / 描边：颜色或渐变 */
export type VectorPaint = VectorColor | VectorGradient;

export interface VectorStyle {
  /** 描边：颜色或渐变 */
  stroke?: VectorPaint;
  /** 填充：颜色或渐变 */
  fill?: VectorPaint;
  /** 局部单位线宽；'$lw' 由文档或渲染调用方的 lineWidth 决定。 */
  lw?: number | '$lw';
  /** 与缩放无关的显示线宽，具体像素语义由后端实现。 */
  px?: number;
  dash?: number[];
  cap?: VectorLineCap;
  join?: VectorLineJoin;
  rule?: VectorFillRule;
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
  /**
   * 定宽文字的换行宽度（局部坐标单位，含宽度因子），如 CAD MTEXT 的参考框宽度。
   * 设置后文字在该宽度内自动换行，a 为文字相对框的对齐（框的左边 / 中线 / 右边在锚点处）
   */
  bw?: number;
  /** 镜像：字形沿基线翻转（CAD 中负缩放 / 镜像块里的文字），绘制时在旋转后 scale(1, -1) */
  m?: 1;
  /** 水平对齐，缺省 left */
  a?: VectorTextAlign;
  /** 垂直基线，缺省 alphabetic */
  b?: VectorTextBaseline;
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
  /** 共享几何 id，见 VectorDocument.vectors */
  id: string;
  /** 定义坐标 → 当前坐标 */
  m: VectorMatrix;
  /** 块内「随块」颜色（`'$fg'`）在此次引用中的取值，缺省沿用外层前景色 */
  c?: VectorColor;
}

/**
 * 图片：把图片画进单位正方形 (0,0)-(1,1)，再经 m 变换到局部坐标（旋转、斜切、镜像都在 m 里）。
 * 图片加载是异步的，由渲染后端缓存，加载完成后重绘
 */
export interface VectorImageItem {
  t: 'i';
  /** 图片地址：URL、data URL 或 blob URL */
  src: string;
  /** 单位正方形 → 局部坐标 */
  m: VectorMatrix;
  /** 不透明度 0~1，缺省 1 */
  alpha?: number;
  /** 圆角半径（局部坐标单位） */
  radius?: number;
  /**
   * 图片在框内的适配方式：
   * - `'fill'`（缺省）：拉伸填满
   * - `'contain'`：等比缩放、完整显示、居中
   * - `'cover'`：等比缩放、铺满、居中裁剪
   */
  fit?: 'fill' | 'contain' | 'cover';
}

/**
 * 裁剪：items 只在裁剪路径 d 内可见（Canvas clip），可嵌套。
 * 用于设计稿的蒙版（mask）、容器的内容裁剪（clip content）等
 */
export interface VectorClipItem {
  t: 'c';
  /** 裁剪路径（局部坐标），多个闭合环 */
  d: VectorPathData;
  /** 裁剪路径的填充规则，缺省 nonzero */
  rule?: VectorFillRule;
  /** 被裁剪的内容（同一局部坐标） */
  items: VectorItem[];
}

export type VectorItem = VectorPathItem | VectorTextItem | VectorHatchItem | VectorRefItem | VectorImageItem | VectorClipItem;

/** 轴对齐矩形（即 @meta2d/math 的 Box） */
export type VectorBox = Box;

export interface VectorGeom {
  /** 几何自身坐标系中的范围。 */
  bbox: VectorBox;
  items: VectorItem[];
}

/** 纯矢量文档：只有几何、指令和共享定义，不包含任何编辑器或平台对象。 */
export interface VectorDocument extends VectorGeom {
  vectors?: Record<string, VectorGeom>;
  width?: number;
  height?: number;
  /** '$fg' 的缺省颜色。 */
  color?: string;
  /** '$bg' 的缺省填充及页面背景。 */
  background?: string;
  lineWidth?: number;
  lineDash?: number[];
  [key: string]: any;
}
