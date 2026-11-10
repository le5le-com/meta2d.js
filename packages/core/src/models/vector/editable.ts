import type { VectorTextItem } from './types';
import { estimateTextWidth } from './geom';

/**
 * 把解析出来的数据转成 meta2d 原生、可编辑的图元。
 *
 * 矢量图元（type: 'vector'）适合表达任意几何，但文字放在几何里就只能看不能改。这里约定：
 * - 文字一律生成原生 `text` 图元：双击改内容，属性面板改字号、颜色、字体、粗斜体、对齐；
 * - 形状图元的主颜色写到 pen.color / pen.background / pen.lineWidth，几何里用 '$fg' / '$bg' / '$lw' 引用，
 *   属性面板改颜色、线宽立即生效（见 diagrams/base/vector.ts）。
 *
 * 只依赖纯数据模块，解析器在 Worker / Node 中也能调用。
 */

/** meta2d 的 TextAlign / TextVertical 取值（与 models/pen/const.ts 一致，这里不引入以免拉起运行时依赖） */
const ALIGN = { left: 1, center: 2, right: 3 } as const;
const VERTICAL = { top: 1, middle: 2, bottom: 3 } as const;

/** 原生文字的默认行高倍数（与 core 的 getFont / calcTextLines 一致） */
const LINE_HEIGHT = 1.5;

export interface EditableTextOptions {
  id: string;
  /** 文字图元的名称（图层面板里显示） */
  name?: string;
  /** 前景色缺省值（IR 里 fill 为空或 '$fg' 时用） */
  color?: string;
  /** 额外属性 */
  extra?: Record<string, any>;
}

/**
 * IR 文字项 → 原生 text 图元。
 *
 * 几何对应关系：IR 文字以锚点 (x, y) + 对齐方式定位、绕锚点旋转 r；
 * 原生文字以框 (x, y, width, height) 定位、绕框中心旋转 rotate（角度）。
 * 先在「未旋转」的文字坐标系里算出框相对锚点的位置，再把框中心绕锚点转过去，二者画出来的位置一致。
 *
 * 镜像文字（m=1，CAD 镜像块里的字）按正常方向生成：可编辑文字镜像显示没有意义，且 meta2d 没有对应属性。
 */
export function textItemToPen(item: VectorTextItem, opts: EditableTextOptions): any {
  const size = item.h;
  const lines = item.text.split('\n');
  const rowHeight = size * LINE_HEIGHT;
  const textWidth = estimateTextWidth(item.text, size) * (item.w || 1);
  // 留一点余量：估算宽度不准时不至于换行
  const width = Math.max(textWidth * 1.08 + size * 0.2, size);
  const height = rowHeight * lines.length;

  // 框相对锚点的位置（未旋转坐标，Y 向下）
  const a = item.a === 'right' || item.a === 'end' ? 'right' : item.a === 'center' ? 'center' : 'left';
  const left = a === 'left' ? 0 : a === 'center' ? -width / 2 : -width;
  // 首行基线 / 顶 / 中 / 底 → 框顶。原生文字每行在 rowHeight 中垂直居中，字形约占 [基线-0.8h, 基线+0.2h]
  const pad = (rowHeight - size) / 2;
  let top: number;
  let vertical: 'top' | 'middle' | 'bottom' = 'top';
  switch (item.b) {
    case 'top':
    case 'hanging':
      top = -pad;
      break;
    case 'middle':
      top = -height / 2;
      vertical = 'middle';
      break;
    case 'bottom':
    case 'ideographic':
      top = -height + pad;
      vertical = 'bottom';
      break;
    default:
      // alphabetic：锚点是首行基线
      top = -pad - size * 0.8;
  }

  const r = item.r || 0;
  // 框中心（未旋转）相对锚点
  const cx0 = left + width / 2;
  const cy0 = top + height / 2;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const cx = item.x + cx0 * cos - cy0 * sin;
  const cy = item.y + cx0 * sin + cy0 * cos;

  const fill = item.fill && item.fill !== '$fg' && item.fill !== 'none' ? item.fill : opts.color;
  const pen: any = {
    id: opts.id,
    type: 'text',
    name: opts.name || 'text',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    text: item.text,
    fontSize: size,
    lineHeight: LINE_HEIGHT,
    textAlign: ALIGN[a],
    textVertical: VERTICAL[vertical],
    // 不自动换行（TextWrap.Nowrap = 2）、不省略，保持与原图一致；双击编辑后按内容自动调整框大小
    textWrap: 2,
    ellipsis: false,
    textAutoSize: true,
    // 文字图元不需要连线锚点
    disableAnchor: true,
    anchors: [] as any[],
    ...opts.extra,
  };
  fill && (pen.textColor = fill);
  if (Math.abs(r) > 1e-6) pen.rotate = (r * 180) / Math.PI;
  item.font && (pen.fontFamily = item.font);
  item.bold && (pen.fontWeight = 'bold');
  item.italic && (pen.fontStyle = 'italic');
  return pen;
}
