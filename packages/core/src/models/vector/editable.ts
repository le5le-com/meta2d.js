import type { VectorTextItem } from './types';
import { estimateTextWidth } from './geom';

/**
 * 把解析出来的数据转成 meta2d 原生、可编辑的图元。
 */
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
 */
export function textItemToPen(item: VectorTextItem, opts: EditableTextOptions): any {
  const size = item.h;
  const lines = item.text.split('\n');
  const rowHeight = size * LINE_HEIGHT;
  const textWidth = estimateTextWidth(item.text, size) * (item.w || 1);
  // 留一点余量：估算宽度不准时不至于换行
  const width = Math.max(textWidth * 1.08 + size * 0.2, size);
  const height = rowHeight * lines.length;

  // 镜像文字（CAD 负缩放块 / OCS 镜像里的文字，item.m）：原生文字不能镜像字形。
  // 「旋转 r、沿基线镜像」= 「旋转 r+π、左右镜像」，去掉左右镜像即得正向可读、覆盖同一区域的文字：
  // 旋转加 π，左右对齐对调（垂直对齐不变）。不处理时文字会上下颠倒
  let a: 'left' | 'center' | 'right' =
    item.a === 'right' || item.a === 'end' ? 'right' : item.a === 'center' ? 'center' : 'left';
  let r = item.r || 0;
  if (item.m) {
    r += Math.PI;
    r > Math.PI && (r -= Math.PI * 2);
    a = a === 'left' ? 'right' : a === 'right' ? 'left' : a;
  }
  // 框相对锚点的位置（未旋转坐标，Y 向下）
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
