import {
  ellipseToCubics,
  getVector,
  matrixScale,
  Pen,
  penRectOfGeom,
  VectorBox,
  VectorColor,
  VectorGeom,
  VectorHatchItem,
  VectorItem,
  VectorOp,
  VectorOpSize,
  VectorPathData,
  VectorStyle,
  VectorTextItem,
  textItemLines,
} from '../../models';

/**
 * 通用矢量图元（type: 'vector'）的解释器。
 *
 * 数据：pen.vector = { bbox, items }（见 @meta2d/drawir）。几何在局部坐标中，
 * 绘制时把 bbox 映射到 pen 的矩形，所以缩放、拖拽图元都不需要改几何数据。
 *
 * 运行在 render / hover worker（OffscreenCanvas）和主线程（导出 SVG）中，只依赖纯数据。
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type PathSink = Pick<Path2D, 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'quadraticCurveTo' | 'closePath' | 'ellipse'>;

/**
 * 几何框在图元框中的实际位置（penRectOfGeom 的逆运算）。
 * 解析时图元框 = 几何框在细的方向撑到 MIN_PEN_SIZE 并居中；之后用户缩放图元时，
 * 几何框按「当前图元框 / 解析时图元框」同比例缩放。
 */
function innerRect(pen: Pen, bbox: VectorBox) {
  const r0 = penRectOfGeom(bbox);
  const kx = r0.width ? pen.width / r0.width : 1;
  const ky = r0.height ? pen.height / r0.height : 1;
  return {
    x: pen.x + (bbox.x - r0.x) * kx,
    y: pen.y + (bbox.y - r0.y) * ky,
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
  /** 世界坐标下的最小线宽（图元线宽，或 1 物理像素） */
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
    s.dash?.length ? setDash(ctx, s.dash, state.px) : state.penDash?.length ? setDash(ctx, state.penDash.map((v) => v / state.k), state.px) : ctx.setLineDash([]);
    s.cap && (ctx.lineCap = s.cap);
    s.join && (ctx.lineJoin = s.join);
    return;
  }
  let lw = Math.max((s?.lw as number) || 0, state.minLw / state.k);
  s?.px && (lw = Math.max(lw, s.px / state.px));
  ctx.lineWidth = lw;
  if (s?.dash?.length) {
    setDash(ctx, s.dash, state.px);
  } else if (state.penDash?.length) {
    setDash(ctx, state.penDash.map((v) => v / state.k), state.px);
  } else {
    ctx.setLineDash([]);
  }
  s?.cap && (ctx.lineCap = s.cap);
  s?.join && (ctx.lineJoin = s.join);
}

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
      path ? ctx.fill(path, s?.rule) : ctx.fill(s?.rule);
    }
  } else {
    const color = resolveColor(fill, state, 'none');
    if (color) {
      ctx.fillStyle = color;
      path ? ctx.fill(path, s?.rule) : ctx.fill(s?.rule);
    }
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    applyStroke(ctx, s, state);
    path ? ctx.stroke(path) : ctx.stroke();
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
      ctx.setLineDash([]);
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
        ctx.setLineDash(pattern.dash);
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
  /** 共享几何解析，缺省使用当前线程的仓库 */
  resolve?: (id: string) => VectorGeom | undefined;
  /** 导出 SVG 等不支持 Path2D 的场景置 false */
  cache?: boolean;
  /** 世界坐标 → 屏幕像素的缩放（data.scale），用于保证线条至少 1 物理像素 */
  scale?: number;
}

/**
 * 绘制矢量图元。调用前 ctx 已由渲染器设置好 strokeStyle（含悬停/选中色）、lineWidth、旋转翻转等状态。
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
  ctx.save();
  const ox = bbox.width > 0 ? inner.x : inner.x + inner.width / 2;
  const oy = bbox.height > 0 ? inner.y : inner.y + inner.height / 2;
  ctx.translate(ox, oy);
  ctx.scale(sx, sy);
  ctx.translate(-bbox.x, -bbox.y);

  const k = Math.sqrt(Math.abs(sx * sy)) || 1;
  let px = k * (opts.scale || 1);
  try {
    // 当前完整变换（视口缩放、dpr、图元缩放）：局部 1 单位 = 多少设备像素
    const t = ctx.getTransform();
    const det = Math.sqrt(Math.abs(t.a * t.d - t.b * t.c));
    det > 0 && (px = det);
  } catch {
    // 导出 SVG 的 Canvas 模拟实现可能不支持 getTransform，按传入的缩放估算
  }
  // 最小线宽（世界坐标）：图元线宽，缺省 1 设备像素。不能读 ctx.lineWidth ——
  // 图元没设线宽时渲染器不会重置它，残留的是上一个图元的线宽（会把细线画成粗带）
  const worldPx = px / k; // 世界 1 单位 = 多少设备像素
  const onePx = worldPx > 0 ? 1 / worldPx : 1;
  const minLw = pen.lineWidth > 1 ? pen.lineWidth : onePx;
  // '$lw'：线宽跟随图元。lineWidth 为 0 表示不描边，没有设置时 1 像素
  const penLw = pen.lineWidth > 0 ? Math.max(pen.lineWidth, onePx) : onePx;

  drawItems(
    ctx,
    geom.items,
    {
      k,
      px,
      fg: ctx.strokeStyle,
      bgs: pen.fillStyles?.length ? pen.fillStyles : [],
      minLw,
      penDash: pen.lineDash,
      cache: opts.cache !== false,
      tint: !!pen.vectorTint,
      penLw,
      depth: 0,
    },
    opts.resolve || getVector,
  );
  ctx.restore();
}

/** penDefines 用的绘制入口 */
export function vector(ctx: CanvasRenderingContext2D, pen: Pen) {
  drawVector(ctx, pen);
}
