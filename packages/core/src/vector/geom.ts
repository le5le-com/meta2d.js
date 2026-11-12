/**
 * Vector IR 的构建工具，供外部格式解析器生成矢量图元数据（通用矩阵、曲线算法在 ./math）。
 *
 * 核心是 VectorBuilder：解析器用**源格式自己的坐标系**调用 moveTo / lineTo / ellipse …，
 * 构建器按当前矩阵（Y 轴翻转、块插入变换、OCS 镜像等）换算成 IR 坐标，同时累计包围盒。
 */
import {
  VectorBox,
  VectorColor,
  VectorGeom,
  VectorHatchLine,
  VectorItem,
  VectorMatrix,
  VectorOp,
  VectorOpSize,
  VectorPathData,
  VectorStyle,
  VectorTextItem,
} from './types';
import {
  applyMatrix,
  angleOnArc,
  BoxAccumulator,
  cubicAt,
  cubicExtrema,
  ellipseSweep,
  ellipseToCubics,
  bulgeToArc,
  composeMatrix,
  IDENTITY,
  isIdentity,
  isSimilarity,
  matrixScale,
  multiplyMatrix,
  rotateMatrix,
  scaleMatrix,
  TAU,
  transformBox,
  translateMatrix,
} from './math';


/** 将路径数据的包围盒累加到 acc，曲线取精确极值 */
export function accumulatePathBox(d: VectorPathData, acc: BoxAccumulator) {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < d.length; ) {
    const op = d[i];
    switch (op) {
      case VectorOp.Move:
      case VectorOp.Line:
        cx = d[i + 1];
        cy = d[i + 2];
        acc.add(cx, cy);
        break;
      case VectorOp.Cubic: {
        const [x1, y1, x2, y2, x, y] = [d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6]];
        acc.add(x, y);
        for (const t of cubicExtrema(cx, x1, x2, x)) acc.add(cubicAt(cx, x1, x2, x, t), cubicAt(cy, y1, y2, y, t));
        for (const t of cubicExtrema(cy, y1, y2, y)) acc.add(cubicAt(cx, x1, x2, x, t), cubicAt(cy, y1, y2, y, t));
        cx = x;
        cy = y;
        break;
      }
      case VectorOp.Quad: {
        const [x1, y1, x, y] = [d[i + 1], d[i + 2], d[i + 3], d[i + 4]];
        // 二次曲线 = 控制点按 2/3 提升的三次曲线
        const c1x = cx + ((x1 - cx) * 2) / 3;
        const c1y = cy + ((y1 - cy) * 2) / 3;
        const c2x = x + ((x1 - x) * 2) / 3;
        const c2y = y + ((y1 - y) * 2) / 3;
        acc.add(x, y);
        for (const t of cubicExtrema(cx, c1x, c2x, x)) acc.add(cubicAt(cx, c1x, c2x, x, t), cubicAt(cy, c1y, c2y, y, t));
        for (const t of cubicExtrema(cy, c1y, c2y, y)) acc.add(cubicAt(cx, c1x, c2x, x, t), cubicAt(cy, c1y, c2y, y, t));
        cx = x;
        cy = y;
        break;
      }
      case VectorOp.Ellipse: {
        const [ex, ey, rx, ry, rot, sa, ea, acw] = [d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6], d[i + 7], d[i + 8]];
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const at = (t: number): [number, number] => {
          const px = rx * Math.cos(t);
          const py = ry * Math.sin(t);
          return [ex + px * cos - py * sin, ey + px * sin + py * cos];
        };
        const sweep = ellipseSweep(sa, ea, !!acw);
        const end = sa + sweep;
        acc.add(...at(sa));
        acc.add(...at(end));
        // 极值参数：x 方向 tan t = -ry·sin / (rx·cos)，y 方向 tan t = ry·cos / (rx·sin)
        const tx = Math.atan2(-ry * sin, rx * cos);
        const ty = Math.atan2(ry * cos, rx * sin);
        for (const base of [tx, tx + Math.PI, ty, ty + Math.PI]) {
          if (Math.abs(sweep) >= TAU || angleOnArc(base, sa, end, sweep < 0)) {
            acc.add(...at(base));
          }
        }
        [cx, cy] = at(end);
        break;
      }
    }
    i += VectorOpSize[op] || 1;
  }
}

/** 估算文字外接盒（无法在解析期测量真实字宽，按字符类别近似） */
export function estimateTextWidth(text: string, height: number) {
  let max = 0;
  for (const line of text.split('\n')) {
    let w = 0;
    for (const ch of line) {
      w += charWidth(ch);
    }
    max = Math.max(max, w);
  }
  return max * height;
}

/** 字符宽度（字高的倍数），与 estimateTextWidth 一致 */
function charWidth(ch: string) {
  if (ch.codePointAt(0) > 0x2e80) return 1;
  if (ch === ' ') return 0.35;
  if (/[A-Z0-9mwMW]/.test(ch)) return 0.7;
  return 0.55;
}

/**
 * 定宽文字的自动换行（CAD MTEXT 参考框宽度）：按 maxWidth（与 height 同单位，已扣除宽度因子）折行。
 * 规则同 AutoCAD / 1.0 原生文字的缺省换行：中日韩字符逐字可断，连续的 ASCII 字符（单词、编号）不拆开，
 * 单个单词超宽时独占一行溢出，空格可在行尾吞掉。maxWidth 无效时只按 \n 分行
 */
export function wrapTextLines(text: string, height: number, maxWidth?: number): string[] {
  const paragraphs = text.split('\n');
  if (!(maxWidth > 0) || !(height > 0)) return paragraphs;
  const limit = maxWidth / height + 1e-6;
  const lines: string[] = [];
  for (const para of paragraphs) {
    // 切成不可再分的片段：连续 ASCII 可见字符为一段，其余字符各自一段
    const words = para.match(/[\x21-\x7e]+|[\s\S]/gu) || [];
    let line = '';
    let lw = 0;
    for (const word of words) {
      let ww = 0;
      for (const ch of word) ww += charWidth(ch);
      if (line && lw + ww > limit) {
        lines.push(line.replace(/ +$/, ''));
        if (word === ' ') {
          line = '';
          lw = 0;
          continue;
        }
        line = word;
        lw = ww;
      } else {
        line += word;
        lw += ww;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** 文字项实际显示的行（定宽文字按 bw 自动换行） */
export function textItemLines(item: VectorTextItem): string[] {
  return wrapTextLines(item.text, item.h, item.bw > 0 ? item.bw / (item.w || 1) : undefined);
}

export function textItemBox(item: VectorTextItem): VectorBox {
  const textLines = textItemLines(item);
  const lines = textLines.length;
  const lh = (item.lh || 1.25) * item.h;
  const w = Math.max(estimateTextWidth(textLines.join('\n'), item.h) * (item.w || 1), item.bw || 0);
  const h = item.h + lh * (lines - 1);
  let x0 = 0;
  if (item.a === 'center') x0 = -w / 2;
  else if (item.a === 'right' || item.a === 'end') x0 = -w;
  let y0: number;
  switch (item.b) {
    case 'top':
    case 'hanging':
      y0 = 0;
      break;
    case 'middle':
      y0 = -h / 2;
      break;
    case 'bottom':
    case 'ideographic':
      y0 = -h - item.h * 0.2;
      break;
    default:
      y0 = -item.h;
  }
  const acc = new BoxAccumulator();
  const m = composeMatrix(scaleMatrix(1, item.m ? -1 : 1), rotateMatrix(item.r || 0), translateMatrix(item.x, item.y));
  for (const [px, py] of [
    [x0, y0],
    [x0 + w, y0],
    [x0, y0 + h],
    [x0 + w, y0 + h],
  ]) {
    acc.add(...applyMatrix(m, px, py));
  }
  return acc.box();
}

/**
 * 计算几何的包围盒。
 * @param resolve 根据 id 取共享几何（用于 ref），找不到时忽略该引用
 */
export function computeItemsBox(items: VectorItem[], resolve?: (id: string) => VectorGeom | undefined): VectorBox {
  const acc = new BoxAccumulator();
  for (const item of items) {
    switch (item.t) {
      case 'p': {
        if (typeof item.s?.lw !== 'number') {
          // 无线宽，或线宽跟随图元（'$lw'，几何框不含线宽）
          accumulatePathBox(item.d, acc);
          break;
        }
        // 粗线按半个线宽外扩（只扩这一条自己的包围盒，不能扩累计值，否则每条粗线都会把整体再撑大一圈）
        const own = new BoxAccumulator();
        accumulatePathBox(item.d, own);
        if (!own.empty) {
          const h = item.s.lw / 2;
          acc.add(own.minX - h, own.minY - h);
          acc.add(own.maxX + h, own.maxY + h);
        }
        break;
      }
      case 'h':
        accumulatePathBox(item.d, acc);
        break;
      case 't':
        acc.addBox(textItemBox(item));
        break;
      case 'r': {
        const def = resolve?.(item.id);
        def && acc.addBox(transformBox(item.m, def.bbox));
        break;
      }
    }
  }
  return acc.box();
}

/**
 * 路径构建器。所有坐标先经过 `matrix` 再写入，包围盒同步累计。
 */
export class VectorPathBuilder {
  d: VectorPathData = [];
  /** 当前点（变换后） */
  private cx = 0;
  private cy = 0;
  private hasPoint = false;

  constructor(public matrix: VectorMatrix = IDENTITY) {}

  get empty() {
    return this.d.length === 0;
  }

  private map(x: number, y: number) {
    return applyMatrix(this.matrix, x, y);
  }

  moveTo(x: number, y: number) {
    const [px, py] = this.map(x, y);
    this.d.push(VectorOp.Move, px, py);
    this.cx = px;
    this.cy = py;
    this.hasPoint = true;
    return this;
  }

  lineTo(x: number, y: number) {
    if (!this.hasPoint) {
      return this.moveTo(x, y);
    }
    const [px, py] = this.map(x, y);
    this.d.push(VectorOp.Line, px, py);
    this.cx = px;
    this.cy = py;
    return this;
  }

  cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    if (!this.hasPoint) this.moveTo(x1, y1);
    const [a, b] = this.map(x1, y1);
    const [c, d] = this.map(x2, y2);
    const [e, f] = this.map(x, y);
    this.d.push(VectorOp.Cubic, a, b, c, d, e, f);
    this.cx = e;
    this.cy = f;
    return this;
  }

  quadTo(x1: number, y1: number, x: number, y: number) {
    if (!this.hasPoint) this.moveTo(x1, y1);
    const [a, b] = this.map(x1, y1);
    const [e, f] = this.map(x, y);
    this.d.push(VectorOp.Quad, a, b, e, f);
    this.cx = e;
    this.cy = f;
    return this;
  }

  close() {
    if (this.hasPoint) {
      this.d.push(VectorOp.Close);
    }
    return this;
  }

  /** 折线（点已在源坐标系） */
  polyline(points: [number, number][], closed = false) {
    points.forEach(([x, y], i) => (i ? this.lineTo(x, y) : this.moveTo(x, y)));
    closed && this.close();
    return this;
  }

  /**
   * 椭圆弧，参数语义与 Canvas ellipse 相同（在源坐标系中）。
   * @param connect 是否与当前点相连（false 时先 moveTo 起点，避免出现多余连线）
   */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    start: number,
    end: number,
    anticlockwise = false,
    connect = false,
  ) {
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (!(rx > 0) || !(ry > 0)) {
      return this;
    }
    const m = this.matrix;
    if (isSimilarity(m)) {
      // 相似变换：解析地变换椭圆参数。镜像时参数角取反、方向翻转（推导见 types.ts 旁的设计说明）
      const s = Math.hypot(m[0], m[1]);
      const alpha = Math.atan2(m[1], m[0]);
      const mirrored = m[0] * m[3] - m[1] * m[2] < 0;
      const [ncx, ncy] = this.map(cx, cy);
      let nrot: number;
      let ns = start;
      let ne = end;
      let nacw = anticlockwise;
      if (mirrored) {
        nrot = alpha - rotation;
        ns = -start;
        ne = -end;
        nacw = !anticlockwise;
      } else {
        nrot = alpha + rotation;
      }
      const nrx = rx * s;
      const nry = ry * s;
      const cos = Math.cos(nrot);
      const sin = Math.sin(nrot);
      const sx = ncx + nrx * Math.cos(ns) * cos - nry * Math.sin(ns) * sin;
      const sy = ncy + nrx * Math.cos(ns) * sin + nry * Math.sin(ns) * cos;
      if (!connect || !this.hasPoint) {
        this.d.push(VectorOp.Move, sx, sy);
      }
      this.d.push(VectorOp.Ellipse, ncx, ncy, nrx, nry, nrot, ns, ne, nacw ? 1 : 0);
      const sweep = ellipseSweep(ns, ne, nacw);
      const t = ns + sweep;
      this.cx = ncx + nrx * Math.cos(t) * cos - nry * Math.sin(t) * sin;
      this.cy = ncy + nrx * Math.cos(t) * sin + nry * Math.sin(t) * cos;
      this.hasPoint = true;
      return this;
    }
    // 非等比变换：离散成贝塞尔后逐点变换
    const { start: sp, curves } = ellipseToCubics(cx, cy, rx, ry, rotation, start, end, anticlockwise);
    if (!connect || !this.hasPoint) this.moveTo(sp[0], sp[1]);
    else this.lineTo(sp[0], sp[1]);
    for (const c of curves) {
      this.cubicTo(c[0], c[1], c[2], c[3], c[4], c[5]);
    }
    return this;
  }

  /** 从当前点按凸度画圆弧到 (x, y)（源坐标系） */
  bulgeTo(x: number, y: number, bulge: number, from: [number, number]) {
    if (!bulge || Math.abs(bulge) < 1e-10) {
      return this.lineTo(x, y);
    }
    const arc = bulgeToArc(from[0], from[1], x, y, bulge);
    if (!(arc.r > 0) || !Number.isFinite(arc.r)) {
      return this.lineTo(x, y);
    }
    return this.ellipse(arc.cx, arc.cy, arc.r, arc.r, 0, arc.start, arc.end, arc.decreasing, true);
  }
}

/** 用一组 item 生成几何，包围盒自动计算；尺寸为 0 的方向按 minSize 撑开（水平线、竖线也能被选中） */
export function createGeom(
  items: VectorItem[],
  resolve?: (id: string) => VectorGeom | undefined,
  minSize = 0,
): VectorGeom {
  const bbox = computeItemsBox(items, resolve);
  if (bbox.width < minSize) {
    bbox.x -= (minSize - bbox.width) / 2;
    bbox.width = minSize;
  }
  if (bbox.height < minSize) {
    bbox.y -= (minSize - bbox.height) / 2;
    bbox.height = minSize;
  }
  return { bbox, items };
}

/** 构造路径 item 的便捷函数，省略空样式 */
export function pathItem(d: VectorPathData, style?: VectorStyle) {
  const item: VectorItem = { t: 'p', d };
  if (style) {
    const s: VectorStyle = {};
    let any = false;
    for (const key in style) {
      const v = (style as any)[key];
      if (v !== undefined && v !== null) {
        (s as any)[key] = v;
        any = true;
      }
    }
    any && (item.s = s);
  }
  return item;
}

/** 将图案线族按矩阵变换 */
export function transformHatchLine(m: VectorMatrix, line: VectorHatchLine): VectorHatchLine {
  const [x, y] = applyMatrix(m, line.x, line.y);
  const dx = m[0] * line.dx + m[2] * line.dy;
  const dy = m[1] * line.dx + m[3] * line.dy;
  const ux = Math.cos(line.a);
  const uy = Math.sin(line.a);
  const a = Math.atan2(m[1] * ux + m[3] * uy, m[0] * ux + m[2] * uy);
  const s = matrixScale(m);
  return { a, x, y, dx, dy, dash: line.dash?.map((v) => v * s) };
}

/** 颜色是否为 IR 中的动态取值 */
export function isDynamicColor(c: VectorColor | undefined) {
  return c === '$fg' || c === '$bg';
}

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

/**
 * 按矩阵变换整条路径数据。椭圆弧在相似变换下解析变换，否则转成贝塞尔。
 */
export function transformPathData(d: VectorPathData, m: VectorMatrix): VectorPathData {
  if (isIdentity(m)) return d.slice();
  const b = new VectorPathBuilder(m);
  for (let i = 0; i < d.length; ) {
    const op = d[i];
    switch (op) {
      case VectorOp.Move:
        b.moveTo(d[i + 1], d[i + 2]);
        break;
      case VectorOp.Line:
        b.lineTo(d[i + 1], d[i + 2]);
        break;
      case VectorOp.Cubic:
        b.cubicTo(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6]);
        break;
      case VectorOp.Quad:
        b.quadTo(d[i + 1], d[i + 2], d[i + 3], d[i + 4]);
        break;
      case VectorOp.Close:
        b.close();
        break;
      case VectorOp.Ellipse:
        // 原数据里椭圆前面总有一条 move/line 到起点，这里与当前点相连即可
        b.ellipse(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6], d[i + 7], !!d[i + 8], true);
        break;
      default:
        return b.d;
    }
    i += VectorOpSize[op];
  }
  return b.d;
}

/** 按矩阵变换一个 IR 项。k：矩阵的平均缩放（线宽、字号、虚线随之缩放） */
export function transformItem(item: VectorItem, m: VectorMatrix, k = matrixScale(m)): VectorItem {
  switch (item.t) {
    case 'p': {
      const out: VectorItem = { t: 'p', d: transformPathData(item.d, m) };
      if (item.s) {
        const s: VectorStyle = { ...item.s };
        typeof s.lw === 'number' && (s.lw *= k);
        s.dash && (s.dash = s.dash.map((v) => v * k));
        out.s = s;
      }
      return out;
    }
    case 'h':
      return {
        ...item,
        d: transformPathData(item.d, m),
        lines: item.lines.map((l) => transformHatchLine(m, l)),
      };
    case 'r':
      return { ...item, m: multiplyMatrix(m, item.m) };
    case 't': {
      const [x, y] = applyMatrix(m, item.x, item.y);
      const ux = Math.cos(item.r || 0);
      const uy = Math.sin(item.r || 0);
      // 文字基线方向、字高方向经过矩阵后的情况
      const dx = m[0] * ux + m[2] * uy;
      const dy = m[1] * ux + m[3] * uy;
      const vx = m[0] * -uy + m[2] * ux;
      const vy = m[1] * -uy + m[3] * ux;
      const hs = Math.hypot(vx, vy) || k;
      const ws = Math.hypot(dx, dy) || k;
      const det = m[0] * m[3] - m[1] * m[2];
      const out: VectorTextItem = { ...item, x, y, h: item.h * hs };
      const r = Math.atan2(dy, dx);
      r ? (out.r = r) : delete out.r;
      // 镜像变换：字形镜像标记取反
      if (det < 0) {
        out.m ? delete out.m : (out.m = 1);
      }
      const w = (item.w || 1) * (ws / hs);
      Math.abs(w - 1) > 1e-3 ? (out.w = w) : delete out.w;
      // 定宽文字的框宽沿基线方向缩放
      item.bw > 0 && (out.bw = item.bw * ws);
      return out;
    }
  }
  return item;
}
