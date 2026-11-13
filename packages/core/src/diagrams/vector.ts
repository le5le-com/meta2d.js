import { Pen } from '../pen';
import {
  ellipseToCubics,
  getVector,
  matrixScale,
  penRectOfGeom,
  textItemLines,
  VectorBox,
  VectorColor,
  VectorGeom,
  VectorHatchItem,
  VectorImageItem,
  VectorItem,
  VectorOp,
  VectorOpSize,
  VectorPathData,
  VectorStyle,
  VectorTextItem,
} from '../vector';

/**
 * 通用矢量图元（name: 'vector'）的解释器，移植自 meta2d 2.0。
 *
 * 数据：pen.vector = { bbox, items }（见 vector/types.ts）。几何在局部坐标中，
 * 绘制时把 bbox 映射到图元的 worldRect，所以缩放、拖拽图元都不需要改几何数据。
 * 共享几何（CAD 块）按 id 引用，定义在 meta2d.data.vectors 中。
 *
 * 取代 1.0 的 drawCommand（parseType: 'dxf'）：drawCommand 每帧逐条解释 {c, v} 指令并按
 * worldRect / dxfOrigin 换算坐标，块引用在解析时深拷贝展开；vector 的路径是扁平数字数组，
 * 可缓存为 Path2D，块定义只存一份。
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type PathSink = Pick<Path2D, 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'quadraticCurveTo' | 'closePath' | 'ellipse'>;

/**
 * 几何框在图元框中的实际位置（penRectOfGeom 的逆运算）。
 * 解析时图元框 = 几何框在细的方向撑到 MIN_PEN_SIZE 并居中；之后用户缩放图元时，
 * 几何框按「当前图元框 / 解析时图元框」同比例缩放。
 */
function innerRect(pen: Pen, bbox: VectorBox) {
  // 1.0 在画布坐标中绘制：worldRect 已含 data.scale，r0 是解析时的图元框（图纸坐标）
  const rect = pen.calculative.worldRect;
  const r0 = penRectOfGeom(bbox);
  const kx = r0.width ? rect.width / r0.width : 1;
  const ky = r0.height ? rect.height / r0.height : 1;
  return {
    x: rect.x + (bbox.x - r0.x) * kx,
    y: rect.y + (bbox.y - r0.y) * ky,
    width: bbox.width * kx,
    height: bbox.height * ky,
  };
}

/** 引用嵌套上限，防止块定义循环引用导致栈溢出 */
const MAX_DEPTH = 24;
/** 单个图案线族最多画多少条线，超过时改为半透明填充（线已密到看不清） */
const MAX_HATCH_LINES = 1500;

interface DrawState {
  /** 局部坐标 → 世界坐标的平均缩放（线宽换算用） */
  k: number;
  /** 局部坐标 → 设备像素的平均缩放（含视口缩放和 dpr）。判断「看不清」时用它：文字太小、虚线 / 图案太密 */
  px: number;
  /** 当前「随块」前景色 */
  fg: string | CanvasGradient | CanvasPattern;
  /** 图元背景（可能多层：渐变 + 纯色） */
  bgs: any[];
  /** 世界坐标（1.0 为画布坐标，含 data.scale）下的最小线宽（图元线宽，或 1 物理像素） */
  minLw: number;
  /** 图元级虚线（世界坐标），子项没有自己的虚线时使用 */
  penDash?: number[];
  /** 是否可以使用 Path2D 缓存（导出 SVG 时不行） */
  cache: boolean;
  /** 着色模式：固定颜色也改用前景色（pen.vectorTint） */
  tint: boolean;
  /** 图元线宽（世界坐标），供 lw: '$lw' 使用 */
  penLw: number;
  depth: number;
  /** 进入 drawVector 时（映射到局部坐标之前）的变换：图元背景渐变、图案所在的坐标系 */
  base?: DOMMatrix;
  /** 图片还没加载好：加载完成后重绘 */
  wait?: () => void;
}

const pathCache = new WeakMap<VectorPathData, Path2D>();

/** 把路径数据写入 ctx 或 Path2D。noEllipse 时椭圆转贝塞尔（某些 Canvas 模拟实现不支持 ellipse） */
export function traceVectorPath(sink: PathSink, d: VectorPathData, noEllipse = false) {
  for (let i = 0; i < d.length; ) {
    const op = d[i];
    switch (op) {
      case VectorOp.Move:
        sink.moveTo(d[i + 1], d[i + 2]);
        break;
      case VectorOp.Line:
        sink.lineTo(d[i + 1], d[i + 2]);
        break;
      case VectorOp.Cubic:
        sink.bezierCurveTo(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6]);
        break;
      case VectorOp.Quad:
        sink.quadraticCurveTo(d[i + 1], d[i + 2], d[i + 3], d[i + 4]);
        break;
      case VectorOp.Close:
        sink.closePath();
        break;
      case VectorOp.Ellipse:
        if (noEllipse) {
          const { start, curves } = ellipseToCubics(
            d[i + 1],
            d[i + 2],
            d[i + 3],
            d[i + 4],
            d[i + 5],
            d[i + 6],
            d[i + 7],
            !!d[i + 8],
          );
          sink.lineTo(start[0], start[1]);
          for (const c of curves) {
            sink.bezierCurveTo(c[0], c[1], c[2], c[3], c[4], c[5]);
          }
        } else {
          sink.ellipse(d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5], d[i + 6], d[i + 7], !!d[i + 8]);
        }
        break;
      default:
        // 未知指令：数据损坏，停止解释，避免死循环
        return;
    }
    i += VectorOpSize[op];
  }
}

/** 准备好当前路径：可缓存时返回 Path2D，否则直接写进 ctx 的当前路径并返回 undefined */
function preparePath(ctx: Ctx, d: VectorPathData, state: DrawState): Path2D | undefined {
  if (state.cache && typeof Path2D !== 'undefined') {
    let p = pathCache.get(d);
    if (!p) {
      p = new Path2D();
      traceVectorPath(p, d);
      pathCache.set(d, p);
    }
    return p;
  }
  ctx.beginPath();
  traceVectorPath(ctx as any, d, true);
  return undefined;
}

function resolveColor(c: VectorColor | undefined, state: DrawState, fallback: 'fg' | 'none') {
  if (c === undefined) {
    return fallback === 'fg' ? state.fg : undefined;
  }
  if (c === 'none') return undefined;
  if (c === '$fg' || state.tint) return state.fg;
  return c;
}

/** 虚线一个周期在屏幕上不足这么多像素时按实线画：看不出虚线，而且逐段描边非常慢 */
const MIN_DASH_PERIOD_PX = 3;

function setDash(ctx: Ctx, dash: number[] | undefined, px: number) {
  // canvas2svg 等模拟实现可能没有 setLineDash
  if (!ctx.setLineDash) {
    return;
  }
  if (dash?.length) {
    let period = 0;
    for (const v of dash) period += v;
    if (period * px >= MIN_DASH_PERIOD_PX) {
      ctx.setLineDash(dash);
      return;
    }
  }
  ctx.setLineDash([]);
}

function applyStroke(ctx: Ctx, s: VectorStyle | undefined, state: DrawState) {
  // 统一到局部坐标：几何线宽 lw 本来就是局部单位；最小线宽、显示线宽 px 是屏幕量，换算回局部。
  // lw 为 '$lw' 时线宽由图元的 lineWidth 决定（属性面板可改）
  if (s?.lw === ('$lw' as any)) {
    ctx.lineWidth = state.penLw / state.k;
    s.dash?.length
      ? setDash(ctx, s.dash, state.px)
      : setDash(ctx, state.penDash?.length ? state.penDash.map((v) => v / state.k) : undefined, state.px);
    s.cap && (ctx.lineCap = s.cap);
    s.join && (ctx.lineJoin = s.join);
    return;
  }
  let lw = Math.max((s?.lw as number) || 0, state.minLw / state.k);
  s?.px && (lw = Math.max(lw, s.px / state.px));
  ctx.lineWidth = lw;
  if (s?.dash?.length) {
    setDash(ctx, s.dash, state.px);
  } else {
    setDash(ctx, state.penDash?.length ? state.penDash.map((v) => v / state.k) : undefined, state.px);
  }
  s?.cap && (ctx.lineCap = s.cap);
  s?.join && (ctx.lineJoin = s.join);
}

/**
 * 用画布坐标的渐变 / 图案绘制局部坐标的路径。
 *
 * 图元背景（线性 / 径向渐变、背景图）和渐变前景色由渲染器按图元框在画布坐标中创建，
 * 而矢量几何在局部坐标中绘制（drawVector 先把 bbox 映射到图元框）。Canvas 的渐变、图案坐标
 * 跟随绘制时的当前变换解释，直接 fill / stroke 会把画布坐标的渐变当成局部坐标，
 * 整个图元落在渐变线的一端，只剩一种颜色。这里把路径变换回进入 drawVector 时的坐标系再绘制，
 * 与原生图元的渐变完全一致；描边线宽、虚线按局部 → 画布的缩放换算。
 *
 * 不能使用 Path2D 或读不到变换（导出 SVG 等）时返回 false，由调用方按原方式绘制。
 */
function paintInBase(ctx: Ctx, path: Path2D | undefined, state: DrawState, fill: boolean, rule?: CanvasFillRule): boolean {
  if (!path || !state.base) {
    return false;
  }
  let rel: DOMMatrix;
  try {
    rel = state.base.inverse().multiply(ctx.getTransform());
  } catch {
    return false;
  }
  const world = new Path2D();
  world.addPath(path, rel);
  ctx.save();
  ctx.setTransform(state.base);
  if (fill) {
    ctx.fill(world, rule);
  } else {
    const k = Math.sqrt(Math.abs(rel.a * rel.d - rel.b * rel.c)) || 1;
    ctx.lineWidth *= k;
    const dash = ctx.getLineDash?.();
    dash?.length && ctx.setLineDash(dash.map((v) => v * k));
    ctx.lineDashOffset *= k;
    ctx.stroke(world);
  }
  ctx.restore();
  return true;
}

/** 渐变、图案（非字符串颜色）需要在画布坐标中绘制 */
const isPaint = (style: unknown) => !!style && typeof style !== 'string';

function drawPathItem(ctx: Ctx, d: VectorPathData, s: VectorStyle | undefined, state: DrawState) {
  const fill = s?.fill;
  // 线宽跟随图元且图元线宽为 0：不描边（与 meta2d 原生图元「线宽 0 = 无边框」一致）
  const stroke = s?.lw === ('$lw' as any) && state.penLw === 0 ? undefined : resolveColor(s?.stroke, state, 'fg');
  const path = preparePath(ctx, d, state);
  const alpha = s?.alpha;
  const oldAlpha = ctx.globalAlpha;
  alpha != undefined && (ctx.globalAlpha = oldAlpha * alpha);

  if (fill === '$bg') {
    for (const bg of state.bgs) {
      ctx.fillStyle = bg;
      (isPaint(bg) && paintInBase(ctx, path, state, true, s?.rule)) || (path ? ctx.fill(path, s?.rule) : ctx.fill(s?.rule));
    }
  } else {
    const color = resolveColor(fill, state, 'none');
    if (color) {
      ctx.fillStyle = color;
      (isPaint(color) && paintInBase(ctx, path, state, true, s?.rule)) || (path ? ctx.fill(path, s?.rule) : ctx.fill(s?.rule));
    }
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    applyStroke(ctx, s, state);
    (isPaint(stroke) && paintInBase(ctx, path, state, false)) || (path ? ctx.stroke(path) : ctx.stroke());
  }
  alpha != undefined && (ctx.globalAlpha = oldAlpha);
}

function drawText(ctx: Ctx, item: VectorTextItem, state: DrawState) {
  const color = resolveColor(item.fill, state, 'fg');
  if (!color || !item.text) {
    return;
  }
  // 字号按设备像素设置再反向缩放：局部坐标的字号常常远小于 1，浏览器对极小字号会取整甚至不画
  const px = state.px;
  const size = item.h * px;
  if (!(size >= 1)) {
    // 不足 1 像素，画了也看不清
    return;
  }
  ctx.save();
  ctx.translate(item.x, item.y);
  item.r && ctx.rotate(item.r);
  ctx.scale((item.w || 1) / px, (item.m ? -1 : 1) / px);
  ctx.font = `${item.italic ? 'italic ' : ''}${item.bold ? 'bold ' : ''}${size}px ${item.font || 'Arial, sans-serif'}`;
  ctx.textAlign = item.a || 'left';
  ctx.textBaseline = item.b || 'alphabetic';
  ctx.fillStyle = color;
  // 定宽文字（item.bw）按框宽自动换行
  const lines = textItemLines(item);
  const lh = (item.lh || 1.25) * size;
  // 多行时整段对齐：middle 以整段中线对齐锚点，bottom 以末行对齐锚点，其余首行对齐锚点（与 textItemBox 一致）
  let y0 = 0;
  if (item.b === 'middle') y0 = (-(lines.length - 1) * lh) / 2;
  else if (item.b === 'bottom' || item.b === 'ideographic') y0 = -(lines.length - 1) * lh;
  lines.forEach((line, i) => line && ctx.fillText(line, 0, y0 + i * lh));
  ctx.restore();
}

/** DXF 风格线型（正数画、负数空、0 点）转 Canvas 虚线数组与起始偏移 */
function toCanvasDash(dash: number[] | undefined, dot: number): { dash: number[] } | undefined {
  if (!dash?.length) {
    return undefined;
  }
  const out: number[] = [];
  if (dash[0] < 0) {
    // canvas 总是从「画」开始：前置一个长度为 0 的画段
    out.push(0);
  }
  for (const v of dash) {
    const len = v === 0 ? dot : Math.abs(v);
    const isDraw = v >= 0;
    const expectDraw = out.length % 2 === 0;
    if (isDraw === expectDraw) {
      out.push(len);
    } else {
      // 连续两个同类段合并
      out.length ? (out[out.length - 1] += len) : out.push(0, len);
    }
  }
  out.length % 2 && out.push(0);
  return { dash: out };
}

function drawHatch(ctx: Ctx, item: VectorHatchItem, state: DrawState) {
  const color = resolveColor(item.stroke, state, 'fg');
  if (!color || !item.lines?.length) {
    return;
  }
  // 边界外接盒（局部坐标），决定要画多少条线
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < item.d.length; ) {
    const op = item.d[i];
    const size = VectorOpSize[op];
    if (!size) break;
    // 只取端点和控制点近似即可（裁剪会精确处理）
    for (let j = 1; j + 1 < size; j += 2) {
      const x = item.d[i + j];
      const y = item.d[i + j + 1];
      if (op === VectorOp.Ellipse) {
        const r = Math.max(item.d[i + 3], item.d[i + 4]);
        minX = Math.min(minX, item.d[i + 1] - r);
        maxX = Math.max(maxX, item.d[i + 1] + r);
        minY = Math.min(minY, item.d[i + 2] - r);
        maxY = Math.max(maxY, item.d[i + 2] + r);
        break;
      }
      x < minX && (minX = x);
      x > maxX && (maxX = x);
      y < minY && (minY = y);
      y > maxY && (maxY = y);
    }
    i += size;
  }
  if (!(maxX >= minX)) {
    return;
  }

  ctx.save();
  const path = preparePath(ctx, item.d, state);
  path ? ctx.clip(path, 'evenodd') : ctx.clip('evenodd');
  ctx.strokeStyle = color;
  ctx.lineWidth = state.minLw / state.k;
  const corners = [
    [minX, minY],
    [maxX, minY],
    [minX, maxY],
    [maxX, maxY],
  ];

  for (const line of item.lines) {
    const ux = Math.cos(line.a);
    const uy = Math.sin(line.a);
    // 法向间距：偏移向量在法向上的投影
    const nx = -uy;
    const ny = ux;
    const spacing = line.dx * nx + line.dy * ny;
    if (!(Math.abs(spacing) > 1e-12)) {
      continue;
    }
    const shift = line.dx * ux + line.dy * uy;
    let nMin = Infinity;
    let nMax = -Infinity;
    let tMin = Infinity;
    let tMax = -Infinity;
    for (const [cx, cy] of corners) {
      const n = ((cx - line.x) * nx + (cy - line.y) * ny) / spacing;
      const t = (cx - line.x) * ux + (cy - line.y) * uy;
      n < nMin && (nMin = n);
      n > nMax && (nMax = n);
      t < tMin && (tMin = t);
      t > tMax && (tMax = t);
    }
    const i0 = Math.floor(Math.min(nMin, nMax));
    const i1 = Math.ceil(Math.max(nMin, nMax));
    if (i1 - i0 > MAX_HATCH_LINES || Math.abs(spacing) * state.px < 2) {
      // 太密：画出来就是一片，直接半透明填充
      ctx.globalAlpha *= 0.35;
      ctx.fillStyle = color;
      ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
      ctx.globalAlpha /= 0.35;
      continue;
    }
    const dot = state.minLw / state.k;
    let pattern = toCanvasDash(line.dash, dot);
    let period = pattern ? pattern.dash.reduce((a, b) => a + b, 0) : 0;
    if (pattern && period * state.px < MIN_DASH_PERIOD_PX) {
      pattern = undefined;
      period = 0;
    }
    if (!pattern) {
      ctx.setLineDash?.([]);
      ctx.beginPath();
    }
    for (let i = i0; i <= i1; i++) {
      // 第 i 条线经过的点：基点 + i * 偏移
      const px = line.x + i * line.dx;
      const py = line.y + i * line.dy;
      // 让线段覆盖整个外接盒：沿方向前后各延伸
      const base = (px - line.x) * ux + (py - line.y) * uy;
      const t0 = tMin - base - Math.abs(shift);
      const t1 = tMax - base + Math.abs(shift);
      const x0 = px + ux * t0;
      const y0 = py + uy * t0;
      const x1 = px + ux * t1;
      const y1 = py + uy * t1;
      if (pattern) {
        // 每条线的虚线相位都从它自己的基点算起，相邻线的图案才能对齐
        ctx.setLineDash?.(pattern.dash);
        // 起点处的相位 = offset，基点（距起点 -t0）处相位应为 0 ⇒ offset ≡ t0 (mod period)
        ctx.lineDashOffset = period ? ((t0 % period) + period) % period : 0;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
    }
    pattern || ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 图片项（t: 'i'）：异步加载并缓存，加载完成后通知重绘
// ---------------------------------------------------------------------------

type VectorImageSource = CanvasImageSource & { width: number; height: number };

interface VectorImageEntry {
  img?: VectorImageSource;
  failed?: boolean;
}

const imageCache = new Map<string, VectorImageEntry>();
const imageListeners = new Set<(src: string) => void>();

/** 有图片正在加载的画布，图片加载完成后重绘（多张图片合并到一次重绘） */
const waitingCanvases = new Set<any>();
let redrawTimer: any;
imageListeners.add(() => {
  if (redrawTimer) return;
  redrawTimer = setTimeout(() => {
    redrawTimer = undefined;
    const list = [...waitingCanvases];
    waitingCanvases.clear();
    list.forEach((c) => c?.render?.(true));
  }, 16);
});

/** 监听矢量图元里的图片加载完成（渲染器据此重绘），返回取消监听的函数 */
export function onVectorImageLoad(cb: (src: string) => void) {
  imageListeners.add(cb);
  return () => {
    imageListeners.delete(cb);
  };
}

function loadVectorImage(src: string): Promise<VectorImageSource> {
  if (typeof Image !== 'undefined') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // data: / blob: 不需要跨域；其它地址按匿名跨域加载，否则画布被污染后不能导出图片
      /^(data|blob):/i.test(src) || (img.crossOrigin = 'anonymous');
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  // Worker：没有 Image，用 fetch + createImageBitmap
  return fetch(src)
    .then((r) => r.blob())
    .then((b) => createImageBitmap(b));
}

/** 取已加载的图片；第一次取时开始加载，返回 undefined */
export function getVectorImage(src: string): VectorImageSource | undefined {
  let entry = imageCache.get(src);
  if (!entry) {
    entry = {};
    imageCache.set(src, entry);
    const e = entry;
    loadVectorImage(src).then(
      (img) => {
        e.img = img;
        imageListeners.forEach((cb) => cb(src));
      },
      () => {
        e.failed = true;
      },
    );
  }
  return entry.img;
}

function drawImageItem(ctx: Ctx, item: VectorImageItem, img: VectorImageSource | undefined) {
  if (!img || !item.src) {
    return;
  }
  const m = item.m;
  // 框在局部坐标中的宽高（单位正方形两条边经 m 后的长度）
  const bw = Math.hypot(m[0], m[1]);
  const bh = Math.hypot(m[2], m[3]);
  const iw = img.width;
  const ih = img.height;
  if (!(bw > 0 && bh > 0 && iw > 0 && ih > 0)) {
    return;
  }
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  item.alpha != undefined && (ctx.globalAlpha *= item.alpha);
  if (item.radius > 0) {
    // 单位正方形里的圆角：两个方向的缩放不同，用椭圆角
    const rx = Math.min(item.radius / bw, 0.5);
    const ry = Math.min(item.radius / bh, 0.5);
    const H = Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(1 - rx, 0);
    ctx.ellipse(1 - rx, ry, rx, ry, 0, -H, 0);
    ctx.lineTo(1, 1 - ry);
    ctx.ellipse(1 - rx, 1 - ry, rx, ry, 0, 0, H);
    ctx.lineTo(rx, 1);
    ctx.ellipse(rx, 1 - ry, rx, ry, 0, H, Math.PI);
    ctx.lineTo(0, ry);
    ctx.ellipse(rx, ry, rx, ry, 0, Math.PI, Math.PI + H);
    ctx.closePath();
    ctx.clip();
  }
  try {
    if (item.fit === 'contain') {
      const s = Math.min(bw / iw, bh / ih);
      const dw = (iw * s) / bw;
      const dh = (ih * s) / bh;
      ctx.drawImage(img, (1 - dw) / 2, (1 - dh) / 2, dw, dh);
    } else if (item.fit === 'cover') {
      const s = Math.max(bw / iw, bh / ih);
      const sw = bw / s;
      const sh = bh / s;
      ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, 1, 1);
    } else {
      ctx.drawImage(img, 0, 0, 1, 1);
    }
  } catch {
    // 图片解码失败、SVG 导出的模拟画布不支持该图片源
  }
  ctx.restore();
}

function drawItems(
  ctx: Ctx,
  items: VectorItem[],
  state: DrawState,
  resolve: (id: string) => VectorGeom | undefined,
) {
  for (const item of items) {
    switch (item.t) {
      case 'p':
        drawPathItem(ctx, item.d, item.s, state);
        break;
      case 't':
        drawText(ctx, item, state);
        break;
      case 'h':
        drawHatch(ctx, item, state);
        break;
      case 'i': {
        const img = getVectorImage(item.src);
        img ? drawImageItem(ctx, item, img) : state.wait?.();
        break;
      }
      case 'r': {
        if (state.depth >= MAX_DEPTH) {
          break;
        }
        const def = resolve(item.id);
        if (!def) {
          break;
        }
        ctx.save();
        const m = item.m;
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        const fg = item.c && item.c !== '$fg' ? resolveColor(item.c, state, 'fg') : state.fg;
        const ms = matrixScale(m);
        drawItems(
          ctx,
          def.items,
          { ...state, k: state.k * ms, px: state.px * ms, fg: fg || state.fg, depth: state.depth + 1 },
          resolve,
        );
        ctx.restore();
        break;
      }
    }
  }
}

export interface VectorDrawOptions {
  /** 共享几何解析，缺省先取图元所在图纸的 data.vectors，再取全局仓库 */
  resolve?: (id: string) => VectorGeom | undefined;
  /** 导出 SVG 等不支持 Path2D 的场景置 false，缺省自动判断 */
  cache?: boolean;
}

/** 是否 canvas2svg（downloadSvg 用）：不支持 Path2D、ellipse、getTransform */
function isSvgContext(ctx: any) {
  return typeof ctx.getSerializedSvg === 'function';
}

/**
 * 绘制矢量图元。调用前 ctx 已由渲染器（renderPen / renderPenRaw）设置好
 * strokeStyle（含悬停/选中色）、虚线、旋转翻转等状态；背景色在 pen.calculative.fillStyles 中。
 */
export function drawVector(ctx: Ctx, pen: Pen, opts: VectorDrawOptions = {}) {
  const geom = pen.vector;
  if (!geom?.items?.length || !geom.bbox) {
    return;
  }
  const { bbox } = geom;
  // 图元框 = 几何框在细的方向上撑到 MIN_PEN_SIZE（便于显示和选中，见 penRectOfGeom）。
  // 绘制时先反推「几何框在图元框里的位置」，只缩放几何框本身 —— 直接把几何框拉伸到图元框，
  // 高度 0.3 的短竖线会被拉到 2，斜线被拉成一条粗带
  const inner = innerRect(pen, bbox);
  let sx = bbox.width > 0 ? inner.width / bbox.width : 0;
  let sy = bbox.height > 0 ? inner.height / bbox.height : 0;
  sx || (sx = sy || 1);
  sy || (sy = sx);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
    return;
  }
  let base: DOMMatrix | undefined;
  try {
    base = ctx.getTransform?.();
  } catch {
    // 导出 SVG 的 Canvas 模拟实现可能不支持 getTransform
  }
  ctx.save();
  const ox = bbox.width > 0 ? inner.x : inner.x + inner.width / 2;
  const oy = bbox.height > 0 ? inner.y : inner.y + inner.height / 2;
  ctx.translate(ox, oy);
  ctx.scale(sx, sy);
  ctx.translate(-bbox.x, -bbox.y);

  const store = pen.calculative.canvas?.store;
  const k = Math.sqrt(Math.abs(sx * sy)) || 1;
  // 缺省按 dpr 估算；能读到当前变换时以变换为准
  let px = k * ((typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
  try {
    // 当前完整变换（视口缩放、dpr、图元缩放）：局部 1 单位 = 多少设备像素
    const t = ctx.getTransform();
    const det = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
    det > 0 && (px = det);
  } catch {
    // 导出 SVG 的 Canvas 模拟实现可能不支持 getTransform，按传入的缩放估算
  }
  // 最小线宽（画布坐标）：图元线宽，缺省 1 设备像素。不能读 ctx.lineWidth ——
  // 图元线宽 ≤ 1 时渲染器不会设置它，残留的可能是外层的线宽（会把细线画成粗带）
  const worldPx = px / k; // 画布 1 单位 = 多少设备像素
  const onePx = worldPx > 0 ? 1 / worldPx : 1;
  // calculative.lineWidth 已乘 data.scale（画布坐标）
  const lineWidth = pen.calculative.lineWidth ?? pen.lineWidth;
  const minLw = pen.lineWidth > 1 ? lineWidth : onePx;
  // '$lw'：线宽跟随图元。lineWidth 为 0 表示不描边（与 1.0 原生图元一致），没有设置时 1 像素
  const penLw = pen.lineWidth === 0 ? 0 : pen.lineWidth > 0 ? Math.max(lineWidth, onePx) : onePx;
  // 图元虚线：渲染器已按 data.scale 换算并设置到 ctx 上
  let penDash: number[] | undefined;
  try {
    const d = ctx.getLineDash?.();
    d?.length && (penDash = d);
  } catch {
    // ignore
  }
  const resolve =
    opts.resolve ||
    ((id: string) => (store?.data as any)?.vectors?.[id] || getVector(id));

  drawItems(
    ctx,
    geom.items,
    {
      k,
      px,
      fg: ctx.strokeStyle,
      bgs: pen.calculative.fillStyles?.length ? pen.calculative.fillStyles : [],
      minLw,
      penDash,
      cache: opts.cache ?? !isSvgContext(ctx),
      tint: !!pen.vectorTint,
      penLw,
      depth: 0,
      base,
      wait: () => waitingCanvases.add(pen.calculative.canvas),
    },
    resolve
  );
  ctx.restore();
}

/** registerCanvasDraw 用的绘制入口 */
export function vector(ctx: CanvasRenderingContext2D, pen: Pen) {
  drawVector(ctx, pen);
}
