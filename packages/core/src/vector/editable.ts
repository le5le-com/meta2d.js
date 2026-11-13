import type { VectorTextItem } from '@meta2d/drawir';
import { estimateTextWidth, textItemLines } from '@meta2d/drawir';

/**
 * 把解析出来的数据转成 meta2d 1.0 原生、可编辑的图元。
 */

/** 原生文字的行高倍数（与 1.0 calcTextLines / drawText 的排版一致：每行占 fontSize * lineHeight，行内垂直居中） */
const LINE_HEIGHT = 1.5;

export interface EditableTextOptions {
  id: string;
  /**
   * 来源名称（如 CAD 实体类型 TEXT / MTEXT / ATTRIB），写入 pen.cadName。
   * 1.0 的 pen.name 是图形类型（这里固定为 'text'），不能用来存来源名称
   */
  name?: string;
  /** 前景色缺省值（IR 里 fill 为空或 '$fg' 时用） */
  color?: string;
  /** 额外属性 */
  extra?: Record<string, any>;
}

/**
 * IR 文字项 → 1.0 原生文字图元（name: 'text'）。
 * 双击即可修改内容，属性面板可改字号、颜色、字体。
 */
export function textItemToPen(item: VectorTextItem, opts: EditableTextOptions): any {
  const size = item.h;
  // 定宽文字（CAD MTEXT 参考框，item.bw）：图元宽度固定为框宽，交给原生文字按宽度自动换行（whiteSpace 缺省）。
  // 原生文字不支持宽度因子，字形按 1 绘制，框宽同样除以宽度因子，使每行字数与 CAD 一致
  const fixed = item.bw > 0;
  const lines = fixed ? textItemLines(item) : item.text.split('\n');
  const rowHeight = size * LINE_HEIGHT;
  // 留一点余量：估算宽度不准时不至于被裁剪
  const width = fixed
    ? Math.max(item.bw / (item.w || 1), size)
    : Math.max(estimateTextWidth(item.text, size) * (item.w || 1) * 1.08 + size * 0.2, size);
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
  let baseline: 'top' | 'middle' | 'bottom' = 'top';
  switch (item.b) {
    case 'top':
    case 'hanging':
      top = -pad;
      break;
    case 'middle':
      top = -height / 2;
      baseline = 'middle';
      break;
    case 'bottom':
    case 'ideographic':
      top = -height + pad;
      baseline = 'bottom';
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
    name: 'text',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    text: item.text,
    // 1.0 中 0 < fontSize < 1 表示「相对图元高度的比例」（见 canvas.setCalculativeByScale）。
    // 字高不足 1 时按比例写：size / height * 图元高度 = size，结果一致
    fontSize: size >= 1 || !(height > 0) ? size : size / height,
    lineHeight: LINE_HEIGHT,
    textAlign: a,
    textBaseline: baseline,
    // 自适应宽度的文字不自动换行；定宽文字按图元宽度自动换行（whiteSpace 缺省：中文逐字、英文按单词）。均不省略
    whiteSpace: fixed ? undefined : 'nowrap',
    ellipsis: false,
    // 文字图元不需要连线锚点
    disableAnchor: true,
    anchors: [] as any[],
    ...opts.extra,
  };
  opts.name && (pen.cadName = opts.name);
  fill && (pen.textColor = fill);
  if (Math.abs(r) > 1e-6) pen.rotate = (r * 180) / Math.PI;
  item.font && (pen.fontFamily = item.font);
  item.bold && (pen.fontWeight = 'bold');
  item.italic && (pen.fontStyle = 'italic');
  return pen;
}
