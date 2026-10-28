import { PlayState, WorkerMessage } from '../../types';
import { penDefines } from '../../diagrams';
import { fillDefaultAnchors } from '../../diagrams/base';
import { renderLineGradientPath } from '../../diagrams/line/gradient';
import {
  lineAnimationArrow,
  lineAnimationBeads,
  lineAnimationDefault,
  lineAnimationDot,
  lineAnimationElement,
  lineAnimationIcon,
  lineAnimationImage,
  lineAnimationPen,
  lineAnimationWaterDrop,
} from '../../diagrams/line/animate';
import {
  calcTextLines,
  calcTextRect,
  calcIconRect,
  calcImageRect,
  ColorType,
  createBackgroundGradient,
  createGradient,
  createLineGradient,
  createTextGradient,
  expandRect,
  flipRender,
  getAllChildren,
  getFont,
  getRectOfPoints,
  GradientType,
  InteractiveType,
  isEffectiveShowChild,
  isEffectiveVisible,
  isTinyPen,
  LineAnimation,
  LineAnimationType,
  PatchFlag,
  Pen,
  PenCategory,
  Point,
  Rect,
  rectToPoints,
  rotateRender,
  setBackground,
  setBackgrounds,
  TextDecoration,
  translateRect,
} from '../../models';
import { Options } from '../../types';
import { deepClone, pSBC } from '../../utils';
import { loadIconfonts } from '../utility/iconfont';
import { loadFontFaceCss } from '../utility/fonts';
import { fetchImage } from '../utility/image';
import { probe } from '../../perf/probe';

let options: Options = {};

let dpr = 1;
let ctx: OffscreenCanvasRenderingContext2D;
let width: number;
let height: number;
let data: any = { x: 0, y: 0 };
let penMap: Map<string, Pen> = new Map(); // 保存原始最完整的pen属性。其他线程传递过来的pen可能属性不完整
let images = {};

let inViewPenIds: any[] = [];

// ── M7a（PanBlit）第 1 步的量测状态，详见文档 §2「M7a · 平移只搬运不重算」 ──
/**
 * 画布上现有像素所对应的**设备像素原点**。`NaN` = 未知（首帧 / 换数据 / 改过画布尺寸）。
 *
 * 平移的 matrix 是 `scale(dpr).translate(data.x, data.y).scale(scale)`，所以纯平移时
 * 屏幕位移恒等于 `dpr * Δdata.x`，与 scale 无关。每次都拿**绝对真值** `dpr * data.x`
 * 和它比（而不是把每步的 Δ 累加），这样整数化的残差恒定 ≤0.5 设备像素、**不会累积**。
 */
let paintedX = NaN;
let paintedY = NaN;
/**
 * 画布像素的实际相位与当前视口的差（设备像素）= paintedX − dpr·data.x，|phaseX| ≤ 0.5。
 *
 * 快路径只能按整数设备像素搬，搬过来的像素停在 paintedX，而不是准确的 dpr·data.x。
 * applyTransform 把它加进 CTM ⇒ 之后画的一切（窄带、动画、Patch 的脏区）都画在像素实际所在的相位上，
 * 与搬过来的像素严丝合缝；代价是整张图与准确位置差不到半个设备像素，看不出来。
 * 若窄带仍按准确位置画，它与搬过来的像素之间就有一道 ≤1 设备像素的错位，1px 的竖线在接缝处会断开一格。
 * 全量重绘（resetRender）把原点对齐到整设备像素 ⇒ paintedX 恒为整数，细线的明暗不随平移位置变（见 resetRender）。
 */
let phaseX = 0;
let phaseY = 0;
/** 上一条视口「除 x/y 之外的一切」的签名。见 viewSig */
let lastViewSig = '';

let penBoundarys = {}; // {[penId]: {penIds, boundary}}
let pathBBoxs = {}; // {pathId: Rect}

// gif的动画帧
let gifs = {}; // {[penId]: [imageBitmap, duration]}
// gif播放器
let gifPlayers: {
  [key: string]: {
    image: string; // gif的图片地址，用于查找gif动画帧
    index: number;
    duration?: number;
    lastTime?: number;
    play?: boolean;
  };
} = {};

let patchPens: Pen[] = []; // 临时需要绘画的pen
let boundary: Rect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

let hoverId: string;
let lastHoverPens: Pen[];
let lastHoverBoundary: Rect;

let drawingLine: string;
let connectedLines: string[];

let activeMap: any; // active包围盒内图元状态map
let lastInActivePens: Pen[]; // 在active包围盒内的pens
let lastActiveBoundary: Rect;
let dragging: boolean;
let dragCopy: boolean;

let matrix: DOMMatrix;

let destoryed = false;
let lastAnimate = 0;

let textOutsides = {};
let inputtingPen: string;

let penDraws: {
  [key: string]: (
    ctx: OffscreenCanvasRenderingContext2D,
    pen: Pen,
    pathOrOptions?: string | any,
    pathRectOrData?: Rect | any,
  ) => any;
} = {};

let lineAnimationDraws: {
  [key: number]: (ctx: OffscreenCanvasRenderingContext2D, pen: Pen, animation: LineAnimation, elem?: any) => void;
} = {
  [LineAnimationType.Default]: lineAnimationDefault,
  [LineAnimationType.Beads]: lineAnimationBeads,
  [LineAnimationType.Dot]: lineAnimationDot,
  [LineAnimationType.Arrow]: lineAnimationArrow,
  [LineAnimationType.WaterDrop]: lineAnimationWaterDrop,
  [LineAnimationType.Image]: lineAnimationImage,
  [LineAnimationType.Icon]: lineAnimationIcon,
  [LineAnimationType.Pen]: lineAnimationPen,
  [LineAnimationType.Element]: lineAnimationElement,
};

let animateTimer: number | null = null;

if (typeof structuredClone === 'undefined') {
  globalThis.structuredClone = deepClone;
}

const workerFns: { [key: number]: Function } = {
  [WorkerMessage.Init]: onInit,
  [WorkerMessage.Resize]: onResize,
  [WorkerMessage.Option]: onOption,
  [WorkerMessage.RegisterPen]: onRegisterPen,
  [WorkerMessage.Data]: onData,
  [WorkerMessage.DataChunk]: onDataChunk,
  [WorkerMessage.AddPath]: onAddPath,
  [WorkerMessage.UpdateView]: onUpdateView,
  [WorkerMessage.Hover]: onHover,
  [WorkerMessage.Active]: onActive,
  [WorkerMessage.Patch]: onPatch,
  [WorkerMessage.DragPens]: onDragPens,
  [WorkerMessage.ImageFetched]: onImageFetched,
  [WorkerMessage.GifFetched]: onGifFetched,
  [WorkerMessage.IconFetch]: onIconFetch,
  [WorkerMessage.CalcPenBoundary]: onCalcPenBoundary,
  [WorkerMessage.DrawingLine]: onDrawingLine,
  [WorkerMessage.Magnifier]: onMagnifier,
  [WorkerMessage.ToPng]: onToPng,
  [WorkerMessage.RenderAnimation]: onRenderAnimation,
  [WorkerMessage.UpdateAnimateState]: onUpdateAnimateState,
  [WorkerMessage.Destory]: onDestory,
  [WorkerMessage.FontLoad]: onFontLoad,
  [WorkerMessage.PerfProbe]: onPerfProbe,
};

/** 上一条消息处理完的时刻，用于量消息之间的空档（见下） */
let lastExit = 0;
/**
 * 当前正在处理的消息 action，只用于给 `render:pens` 的样本分组。
 *
 * 不分组时动画路径（~20µs）与视口全量重绘（~44ms）混进同一个采样器，
 * 几个大样本就能把均值抬高数倍（设计文档 D12）。
 */
let renderTag: number | string = '';

self.onmessage = (e: MessageEvent) => {
  // 第六十六轮：攒着的 Patch（见 deferPatch）必须在任何别的消息碰画布之前画掉，保证先后次序不变；
  // Patch 自己在 onPatch 里决定合并还是先冲掉再画
  if (pendingPatch && e.data.action !== WorkerMessage.Patch) {
    flushPatches();
  }
  if (probe.on) {
    // 按 action 分别统计每类消息的处理耗时与条数，无需逐个 handler 埋点。
    // 注意：onToPng / onMagnifier / onFontLoad / onRegisterPen 是 async，这里只量到
    // 第一个 await，热路径（Hover / Patch / RenderAnimation / UpdateView）都是同步的。
    const t = probe.now();
    const gapFrom = lastExit;
    // 第一次碰 e.data 就是结构化克隆的反序列化点（Chrome 惰性解，解完缓存），
    // 所以这一行的耗时 = 整条消息的入站解码成本。单独记下来，因为 M1/M3 的帧聚合
    // 正是靠「N 条 → 1 条」省掉 N−1 次**每条固定**的解码开销；按字节计的那部分
    // 合并后还在。deser 占 handle 多少，直接决定 M1 值多少（见文档 §0.5-H12）。
    const action = e.data.action;
    probe.time('deser:' + action, t);
    renderTag = action;
    workerFns[action](e);
    probe.time('handle:' + action, t);
    probe.count('recv:' + action);

    // 消息之间的空档：上一条处理完 → 这一条的 onmessage 入口。⚠ 混着真正的空闲，只能用来定位时间摊在谁头上，
    // 不能直接当成可省的开销（设计文档 §0.5-H10）。
    if (gapFrom) {
      probe.sample('msg:gap:' + action, (t - gapFrom) * 1000);
    }
    lastExit = probe.now();
    return;
  }
  workerFns[e.data.action](e);
};

function onPerfProbe(e: MessageEvent) {
  // 探针消息是主线程最后发的，它在队列里排了多久 = 这个 worker 当前积压了多少。
  // 分辨率 1ms（Date.now 跨线程可比，performance.now 不行），量几百毫秒级的积压够用。
  e.data.sentAt && probe.sample('probe:lag', Date.now() - e.data.sentAt);
  const audit = e.data.canvasAudit ? auditCanvas() : undefined;
  const report: any = probe.collect('render', e.data.reset !== false);
  audit && (report.canvasAudit = audit);
  probe.rawPost({
    action: WorkerMessage.PerfReport,
    reportId: e.data.reportId,
    report,
  });
}

function registerDefault() {
  for (const item of penDefines) {
    if (item.draw) {
      penDraws[item.type] = item.draw;
    }
  }
}
registerDefault();

function onInit(e: MessageEvent) {
  options = e.data.options || {};
  probe.setEnabled(options.perfProbe);
  probe.hookPostMessage();

  width = e.data.canvas.width;
  height = e.data.canvas.height;
  dpr = e.data.dpr || 1;
  ctx = e.data.canvas.getContext('2d');
  resetRender();
}

function onResize(e: MessageEvent) {
  width = e.data.width;
  height = e.data.height;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  resetRender();

  patchPens = [];
  if (!inViewPenIds?.length) {
    return;
  }
  inViewPenIds.forEach((id: string) => {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  });
  renderPens(ctx);
  patchPens = [];
}

function onOption(e: MessageEvent) {
  Object.assign(options, e.data.options);
  probe.setEnabled(options.perfProbe);
  probe.hookPostMessage();
  // 每次显式置位都重新装填审计预算 —— `setOptions({ pixelAudit: 3 })` 读作「再审 3 条」，
  // 不是「总共审 3 条」。不带这个字段的 setOptions 不动预算。
  if (e.data.options?.pixelAudit != undefined) {
    auditLeft = e.data.options.pixelAudit;
  }
  if (e.data.options?.animAudit != undefined) {
    animAuditLeft = e.data.options.animAudit;
  }
  if (e.data.options?.patchAudit != undefined) {
    patchAuditLeft = e.data.options.patchAudit;
  }
  Object.assign(data, e.data.data);

  resetRender();

  patchPens = [];
  if (!inViewPenIds?.length) {
    return;
  }
  inViewPenIds.forEach((id: string) => {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  });
  renderPens(ctx);

  patchPens = [];
}

async function onRegisterPen(e: MessageEvent) {
  // 注册图元
  const { penDefines } = await import(/* @vite-ignore */ e.data.path);
  for (const item of penDefines) {
    if (item.draw) {
      penDraws[item.type] = item.draw;
    }
  }

  if (penMap.size && inViewPenIds?.length) {
    // 如果已经有图元了，触发全量重绘以应用新注册的绘制函数
    resetRender();
    patchPens = [];
    inViewPenIds.forEach((id: string) => {
      const pen = penMap.get(id);
      pen && patchPens.push(pen);
    });
    renderPens(ctx);
    patchPens = [];

    // 通知主线程注册完成
    self.postMessage({ action: WorkerMessage.RegisterPen });
  }
}

function onData(e: MessageEvent) {
  penMap.clear();
  lastInActivePens = undefined;
  lastActiveBoundary = undefined;
  lastHoverPens && (lastHoverPens.length = 0);
  inViewPenIds = [];

  cancalAnimation();

  if (e.data.data.pens) {
    data = e.data.data;
    // 主线程没发的默认锚点（见 elideDefaultAnchors）
    fillDefaultAnchors(data.pens, e.data.defaultAnchors);
    // 整份数据换了 ⇒ 墨迹余量从头算（它平时只增不减，见 maxInkPad）
    maxInkPad = 0;
    data.pens.forEach((pen: Pen) => {
      // 计算文字坐标
      pen.text && calcTextRect(pen);

      penMap.set(pen.id, pen);
      trackInkPad(pen);
    });

    images = {};
    gifs = {};
    penBoundarys = {};
    gifPlayers = {};
    hoverId = undefined;
    activeMap = undefined;
  } else {
    // 设置数据选项
    Object.assign(data, e.data.data);
  }

  pathBBoxs = e.data.pathBBoxs;
  loadIconfonts(data.iconfonts);

  resetRender();

  e.data.data.pens && (patchPens.length = 0);
}

/**
 * 分批打开的后批（见主线程 Meta2d.planProgressiveLoad）：只登记，不画 —— 原则上都在视口外；
 * 补的过程中被平移进视口的，calc 会发 UpdateView 来（它在这批之后到）。处理同 onData 里登记每个图元那段。
 */
function onDataChunk(e: MessageEvent) {
  fillDefaultAnchors(e.data.pens, e.data.defaultAnchors);
  for (const pen of e.data.pens as Pen[]) {
    pen.text && calcTextRect(pen);
    penMap.set(pen.id, pen);
    trackInkPad(pen);
  }
  self.postMessage({ action: WorkerMessage.DataChunkDone, from: 'render', loadSeq: e.data.loadSeq });
}

function onAddPath(e: MessageEvent) {
  if (!data.paths) {
    data.paths = {};
  }

  // 添加路径到缓存
  for (const id in e.data.paths) {
    data.paths[id] = e.data.paths[id].path;
    pathBBoxs[id] = e.data.paths[id].rect;
  }
}

/**
 * 视口的「除 x/y 之外的一切」的签名。
 *
 * M7a 只有在**纯平移**时才能搬运像素。`data` 上除了 x/y 还有 color / lineWidth /
 * background / penBackground / penGradient / lineGradient / paths … 任何一个变了，
 * 全画布的观感就变了，搬运就是错的。这里刻意**不枚举**要比哪些字段 —— 枚举漏一个
 * 就是一个只在特定配置下出现的花屏；用整体签名则默认安全：以后有人往 data 上加字段，
 * 签名自动变化 ⇒ 自动退回全量重绘，不需要谁记得改这里。
 *
 * `pens` 已被主线程置空（`{...this.data, pens: []}`），剩下的只是文档级选项，很小。
 */
function viewSig(d: any): string {
  const { x, y, ...rest } = d || {};
  return JSON.stringify(rest);
}

/**
 * 把画布整体搬 (sx, sy) 个设备像素。
 *
 * `'copy'` 而不是默认的 `'source-over'`：① 画布是带透明度的，source-over 会把半透明
 * 图元叠在旧像素上（颜色加深）；② `'copy'` 把源矩形之外的目标像素全部清成透明 ——
 * 位移新暴露的那条 L 形窄带自动就是干净的，连 clearRect 都不用。
 * 自拷贝（源 = 目标）规范要求按源的快照来，Chrome 如此实现。
 */
function blitOnce(sx: number, sy: number) {
  ctx.save();
  ctx.resetTransform();
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false; // 整数偏移 + 1:1 缩放，理论上无关，保险
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(ctx.canvas, sx, sy);
  ctx.restore();
}

/** 抗锯齿/亚像素的兜底余量（世界单位）。其余余量按 pen 实算，见 `inkBox`。 */
const INK_PAD_MIN = 2;
/**
 * 阴影的可见半径 ≈ `SHADOW_BLUR_K × shadowBlur`。规范里高斯的 σ = blur/2，3σ 之外
 * 肉眼与实现都当作没有；取 2（= 4σ）是宁大勿小 —— 这个常数估小了就是花屏，估大了只是多画。
 */
const SHADOW_BLUR_K = 2;
/**
 * 连线箭头的最小余量。与 `models/pen/service.ts` 里算 line 包围盒用的
 * `expandRect(rect, max(lineWidth/2, fromArrowSize, toArrowSize, 10))` 是**同一个 10**。
 */
const ARROW_PAD_MIN = 10;

/**
 * 一个 pen 的墨迹包围盒（世界坐标），结果写进这四个模块级变量而不是返回数组 ——
 * 这个函数每条视口要跑 2.2 万次，返回元组就是每条视口 2.2 万次分配。
 */
let ink0 = 0;
let ink1 = 0;
let ink2 = 0;
let ink3 = 0;
/** `inkBox` 顺带算出的「这个 pen 的墨迹伸出自身矩形最远多少」（世界单位，四边取最大）。 */
let inkPad = 0;
/**
 * 全局墨迹余量 = 所有图元里 `inkPad` 的最大值（世界单位）。**只增不减**。
 *
 * 它是第 5 步「窄带向内加宽」的宽度。为什么必须是**全局**最大值而不是某几个 pen 的：
 * 加宽要盖住的是**上一条视口里没画、这一条才画**的图元（它的矩形刚跨进视口，墨迹却
 * 早就伸进来了）—— 在选图元之前，我们并不知道那是谁，只能按最坏情况留够。
 *
 * 只增不减是**保守**的一侧（多画不会错，少画就是花屏），代价是某个大号旋转/阴影图元
 * 被删掉之后余量不会自动缩回。真实代价由 `view:inkPad` / `view:bandPct` /
 * `view:full:farPad` 三个读数盯着：要是它被少数几个巨物拉爆，下一轮再换成
 * 「按窄带附近的图元自适应」。
 */
let maxInkPad = 0;

/**
 * 一个 pen 的**完整**墨迹包围盒（世界坐标）。宁大勿小 —— 漏选会在窄带里留下残缺
 * （看得见），多选只是多画几个（看不见）。
 *
 * 下面五条分支每一条都由像素审计的一类差异顶着（rotate / thick / shadow / text / line，
 * 设计文档结论 34），不是照着「可能有哪些墨迹」写出来的。
 *
 * 顺序要紧，和 `renderPens` 里装 ctx 的顺序对齐：
 * 描边/箭头 → 文本外溢 → flip 对称化 → rotate 绕 pivot 转 → 阴影。
 * 阴影放最后是因为 `shadowOffsetX/Y`、`shadowBlur` **不随 CTM 旋转/缩放**（规范如此），
 * 它是在最终像素上加的一圈。
 */
function inkBox(pen: any) {
  const x = pen.x ?? 0;
  const y = pen.y ?? 0;
  // pen.ex/ey 可能是 undefined（见 renderPens 里同样的兜底）；宽高也可能为负
  const ex = pen.ex ?? x + (pen.width ?? 0);
  const ey = pen.ey ?? y + (pen.height ?? 0);
  const rx0 = x < ex ? x : ex;
  const ry0 = y < ey ? y : ey;
  const rx1 = x < ex ? ex : x;
  const ry1 = y < ey ? ey : y;

  // ① 描边向外溢出 lineWidth/2（thick：lineWidth 16 ⇒ 8，而常数余量只有 2），
  //    连线端点的箭头再往外顶 arrowSize（line：箭头三角半高 8，框高还是 0）。
  let pad = INK_PAD_MIN;
  const lw = pen.lineWidth;
  if (lw > 2 * INK_PAD_MIN) {
    pad = lw / 2;
  }
  if (pen.category === PenCategory.Line && (pen.fromArrow || pen.toArrow)) {
    const a = (pen.fromArrowSize || 0) > (pen.toArrowSize || 0) ? pen.fromArrowSize : pen.toArrowSize;
    const arrow = a > ARROW_PAD_MIN ? a : ARROW_PAD_MIN;
    if (arrow > pad) {
      pad = arrow;
    }
  }
  let x0 = rx0 - pad;
  let y0 = ry0 - pad;
  let x1 = rx1 + pad;
  let y1 = ry1 + pad;

  // ② 外溢文本。`pen.textBox` 是 renderText 第一次画这个 pen 时由 calcTextLines 实测的
  //    （世界坐标），有它就用它 —— 那是唯一准确的来源，`textOutsides` 发给 calc 的也是它。
  //    没有它（这个 pen 还没被画过，比如一直在视口外）只能估。估**必须偏大**：这个 pen
  //    第一次进视口的那一条，用的就是这个估值算出来的 `maxInkPad`，估小了那一条就花屏
  //    （下一条才会被实测的 textBox 修正，但错过的那一帧已经看见了）。
  const tb = pen.textBox;
  // `calcTextLines` 先把 textBox 置成 ±Infinity 再逐行填。有几条提前 return 的分支
  // （省略号那几条）压根不填 ⇒ **必须验有限**：放一个 Infinity 进来，`maxInkPad` 就永远
  // 是 Infinity，之后每一条视口都判 `farPad` 退回全量，M7a 从此静悄悄地整个失效。
  // ex/ey 与 width/height 两套都取大的：`onRenderAnimation` 改尺寸时只加了 width/height，
  // 没同步 ex/ey（那段是既有代码），单看 ex 会偏小。
  const tex = tb ? Math.max(tb.ex ?? -Infinity, tb.x + (tb.width ?? 0)) : 0;
  const tey = tb ? Math.max(tb.ey ?? -Infinity, tb.y + (tb.height ?? 0)) : 0;
  if (tb && Number.isFinite(tb.x) && Number.isFinite(tb.y) && Number.isFinite(tex) && Number.isFinite(tey)) {
    if (tb.x < x0) {
      x0 = tb.x;
    }
    if (tb.y < y0) {
      y0 = tb.y;
    }
    if (tex > x1) {
      x1 = tex;
    }
    if (tey > y1) {
      y1 = tey;
    }
  } else if (pen.text) {
    const fs = pen.fontSize ?? data.fontSize ?? 12;
    const lh = pen.lineHeight ?? data.lineHeight ?? 1.5;
    let lines = 1;
    for (let i = 0; i < pen.text.length; i++) {
      if (pen.text.charCodeAt(i) === 10) {
        lines++;
      }
    }
    // 每字 1.2em + letterSpacing：汉字 1em、Latin 更窄，1.2 是宁大勿小的一侧。
    const cw = fs * 1.2 + (pen.letterSpacing || 0);
    const full = pen.text.length * cw;
    let tw = full;
    if (pen.textWidth > 0) {
      // 设了 textWidth 才折行（service.ts 如此）⇒ 宽度被钳住，行数反过来涨。
      tw = pen.textWidth;
      const wrapped = Math.ceil(full / pen.textWidth);
      if (wrapped > lines) {
        lines = wrapped;
      }
    }
    const th = lines * fs * lh;
    const ox = (tw - (rx1 - rx0)) / 2;
    const oy = (th - (ry1 - ry0)) / 2;
    if (ox > 0) {
      x0 -= ox;
      x1 += ox;
    }
    if (oy > 0) {
      y0 -= oy;
      y1 += oy;
    }
  }

  // ③ flip 是绕自身中心镜像（flipRender）⇒ 非对称的墨迹（外溢文本正是）会翻到另一侧。
  //    把盒子对中心对称化，比判断翻到哪边便宜也更难写错。
  if (pen.flipX) {
    const d = rx0 - x0 > x1 - rx1 ? rx0 - x0 : x1 - rx1;
    x0 = rx0 - d;
    x1 = rx1 + d;
  }
  if (pen.flipY) {
    const d = ry0 - y0 > y1 - ry1 ? ry0 - y0 : y1 - ry1;
    y0 = ry0 - d;
    y1 = ry1 + d;
  }

  // ④ rotate：`rotateRender` 是绕 **pen.pivot** 转（不是绕中心）⇒ 直接把四个角转过去
  //    取新包围盒，比「外接圆」既准又不慢。Line 不转（renderPens 里就是这么判的）。
  if (pen.rotate && pen.category !== PenCategory.Line) {
    let r = (pen.rotate * Math.PI) / 180;
    // 与 rotateRender 同一套符号：flipX/flipY 各把角度取反一次
    if (pen.flipX) {
      r = -r;
    }
    if (pen.flipY) {
      r = -r;
    }
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const px = pen.pivot ? pen.pivot.x : (rx0 + rx1) / 2;
    const py = pen.pivot ? pen.pivot.y : (ry0 + ry1) / 2;
    const ax = x0 - px;
    const ay = y0 - py;
    const bx = x1 - px;
    const by = y1 - py;
    // 四个角：(ax,ay) (bx,ay) (ax,by) (bx,by)
    const qx0 = ax * cos - ay * sin;
    const qx1 = bx * cos - ay * sin;
    const qx2 = ax * cos - by * sin;
    const qx3 = bx * cos - by * sin;
    const qy0 = ax * sin + ay * cos;
    const qy1 = bx * sin + ay * cos;
    const qy2 = ax * sin + by * cos;
    const qy3 = bx * sin + by * cos;
    x0 = px + Math.min(qx0, qx1, qx2, qx3);
    x1 = px + Math.max(qx0, qx1, qx2, qx3);
    y0 = py + Math.min(qy0, qy1, qy2, qy3);
    y1 = py + Math.max(qy0, qy1, qy2, qy3);
  }

  // ⑤ 阴影：整团画在图元之外（像素审计里最脏的一类）。
  //    `shadowBlur/OffsetX/OffsetY` 按规范**不受 CTM 影响**（单位是输出像素），但各实现
  //    对「要不要跟着 transform 缩放」历来不一致 ⇒ 两种解释都盖住：世界单位取两者的大者。
  //    `textShadow` 走的是另一组字段（renderText 里就是这么取的）。
  const shadowed = pen.shadowColor || (pen.textShadow && (pen.textShadowColor || pen.shadowColor));
  if (shadowed) {
    const blur = Math.max(pen.shadowBlur || 0, pen.textShadow ? pen.textShadowBlur || 0 : 0);
    const offX = Math.max(Math.abs(pen.shadowOffsetX || 0), pen.textShadow ? Math.abs(pen.textShadowOffsetX || 0) : 0);
    const offY = Math.max(Math.abs(pen.shadowOffsetY || 0), pen.textShadow ? Math.abs(pen.textShadowOffsetY || 0) : 0);
    if (blur || offX || offY) {
      // 设备像素 → 世界单位的换算 = 1/(dpr·scale)。> 1 时按世界单位那一种解释更大，反之亦然
      const inv = 1 / (dpr * (data.scale || 1));
      const f = inv > 1 ? inv : 1;
      const sxPad = (SHADOW_BLUR_K * blur + offX) * f;
      const syPad = (SHADOW_BLUR_K * blur + offY) * f;
      x0 -= sxPad;
      y0 -= syPad;
      x1 += sxPad;
      y1 += syPad;
    }
  }

  ink0 = x0;
  ink1 = y0;
  ink2 = x1;
  ink3 = y1;
  inkPad = Math.max(rx0 - x0, ry0 - y0, x1 - rx1, y1 - ry1);
}

/**
 * 把一个 pen 的墨迹余量并进全局最大值。**图元增改的每一个入口都要叫一次** ——
 * 漏一个入口的症状是：那一类图元刚进视口时，窄带外留下一条它的残缺墨迹，
 * 而所有性能读数都正常（结论 27 那一类缺陷）。像素审计是唯一的判据。
 */
function trackInkPad(pen: any) {
  inkBox(pen);
  if (inkPad > maxInkPad) {
    maxInkPad = inkPad;
  }
}

/** 窄带内的图元，按 `pen.index` 升序（= 绘制顺序）。复用同一个数组。 */
const bandPens: Pen[] = [];

/**
 * 要重画的那几块矩形（**设备像素**，两两不相交），最多 4 块。
 * `[x, y, w, h]` 平铺，`bandLegs[i]` 是第 i 块的名字。复用同一个数组，不分配。
 *
 * 选取（世界坐标）、clip、像素审计的分区**三处共用这一份几何**：同一个形状写三遍，
 * 总有一遍会写错，而且未必是画面上看得出来的那一遍。
 */
const bandRects: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const bandLegs: string[] = ['', '', '', ''];
/** 同一批矩形换算成世界坐标 `[x0, y0, x1, y1]`，供选取用。 */
const bandRectsWorld: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let bandRectCount = 0;

/**
 * 算出这一条视口要重画的几块矩形（设备像素）。
 *
 * 只画新暴露的 L 形窄带不够（像素审计，设计文档结论 34）：差异还来自「搬运之后，
 * 快路径与全量重绘画的图元集合不一样」的地方，逐条推：
 *
 * ```
 *  进入侧（新暴露的那一条）        宽 |s|      —— 无源可搬，第 3 步就在画
 *  进入侧再往内 pad               宽 pad      ←【新】上一条视口时这个图元的矩形还在
 *                                             视口外（calc 的 calcInViewPens 只按矩形
 *                                             判，不带墨迹余量）⇒ 全量重绘那一遍**没画
 *                                             它**，可它的墨迹早就伸进来了 ⇒ 这一条视口
 *                                             它进了视口要补画，补的正是这条 pad
 *  离开侧那一条                   宽 pad      ←【新】反过来：上一条视口画了它，这一条
 *                                             它的矩形已经出了视口 ⇒ 全量重绘不再画它，
 *                                             而搬过来的像素上还留着它伸进来的墨迹，
 *                                             得擦掉
 * ```
 *
 * 两条【新】的都只有 `pad = maxInkPad` 那么宽，因为「矩形在视口外、墨迹还在视口内」
 * 最远就是 `maxInkPad`。竖条满高、横条让开竖条那几列 ⇒ **四块两两不相交**
 * （面积可以直接相加，`view:bandPct` 才是准的；clip 也不会有重叠处）。
 *
 * ⚠️ 只加宽 clip 不行 —— pad 那几块里是**搬过来的像素**（有内容），半透明墨迹
 * （shadow 正是）再画一遍会加深。所以 `clipBand` 里跟着一次 `clearRect`：
 * 先清空整个重画区，再连同重选到的图元一起画。
 */
function computeBandRects(sx: number, sy: number, pad: number) {
  bandRectCount = 0;
  const push = (x: number, y: number, w: number, h: number, leg: string) => {
    if (w <= 0 || h <= 0) {
      return;
    }
    const j = bandRectCount << 2;
    bandRects[j] = x;
    bandRects[j + 1] = y;
    bandRects[j + 2] = w;
    bandRects[j + 3] = h;
    bandLegs[bandRectCount] = leg;
    bandRectCount++;
  };

  // 横条的 x 区间：扣掉两条满高的竖条，保证互不相交
  let l = 0;
  let r = width;
  if (sx) {
    const vw = Math.abs(sx) + pad;
    if (sx > 0) {
      // 内容往右搬 ⇒ 左边新暴露，右边是离开侧
      push(0, 0, vw, height, 'v');
      push(width - pad, 0, pad, height, 'vx');
      l = vw;
      r = width - pad;
    } else {
      push(width - vw, 0, vw, height, 'v');
      push(0, 0, pad, height, 'vx');
      l = pad;
      r = width - vw;
    }
  }
  if (sy) {
    const hh = Math.abs(sy) + pad;
    const w = r - l;
    if (sy > 0) {
      push(l, 0, w, hh, 'h');
      push(l, height - pad, w, pad, 'hx');
    } else {
      push(l, height - hh, w, hh, 'h');
      push(l, 0, w, pad, 'hx');
    }
  }
}

/**
 * 选出**重画区**里的图元 —— 区块由 `computeBandRects`
 * 给出（新暴露的 L 形窄带 + 进入侧 pad + 离开侧 pad），这里只负责「谁的墨迹碰到了它们」。
 *
 * 两层过滤，顺序有讲究：先按**矩形**判在不在视口里（与 calc 对齐，见函数体里的长注释，
 * 顺带把一半图元挡在 `inkBox` 之前），再按**墨迹包围盒**判碰没碰到重画区。
 * 同一个 pen 只会进数组一次（区块本来就两两不相交）。
 *
 * 判定在**世界坐标**里做，因为 pen 的坐标和 `boundary` 都是世界坐标：
 * `matrix = scale(dpr)·translate(data.x, data.y)·scale(scale)`
 * ⇒ `dev = dpr·(scale·world + data.x)` ⇒ `world = (dev/dpr − data.x)/scale`。
 *
 * 只有在 `probePanBlit` 判定为纯平移（`sx || sy` 且签名未变）之后才会被调用，
 * 所以这里可以放心假设 `scale` 与上一帧相同。
 *
 * **遍历 `penMap.values()` 而不是 `inViewPenIds`**：按字符串 id 逐个 `penMap.get` 比直接遍历贵 ~6 倍，
 * 多扫的视口外图元反而更便宜（设计文档 §0.5-H16）。代价是丢了 `pen.index` 顺序，末尾对入选的那几百条补排序。
 * 视口过滤要自己做：墨迹可以从视口外伸进来。
 */
/**
 * 刚算出来的那个墨迹盒（`ink0..3`）碰没碰到重画区（世界坐标的 `bandRectsWorld`）。
 * 抽出来是为了让像素审计里的**集合差**用的是与选取**同一段**判定代码 ——
 * 拿两段等价的判定去比较两个集合，比出来的差可能是判定自己的差。
 */
function inkHitsBand(): boolean {
  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    if (
      ink2 >= bandRectsWorld[j] &&
      ink0 <= bandRectsWorld[j + 2] &&
      ink3 >= bandRectsWorld[j + 1] &&
      ink1 <= bandRectsWorld[j + 3]
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 粗筛：矩形四边各外扩 pad（世界单位）之后，碰没碰到任何一块重画区。
 * 先比所有块的外接盒（绝大多数图元在这一步就出局），再逐块比。
 * 矩形用 min/max 规整，宽高为负的也对（inkBox 同样这么处理）。
 */
function rectPadHitsBand(pen: any, pad: number, bx0: number, by0: number, bx1: number, by1: number): boolean {
  const x = pen.x;
  const y = pen.y;
  const ex = pen.ex;
  const ey = pen.ey;
  const x0 = (x < ex ? x : ex) - pad;
  const x1 = (x < ex ? ex : x) + pad;
  const y0 = (y < ey ? y : ey) - pad;
  const y1 = (y < ey ? ey : y) + pad;
  if (x1 < bx0 || x0 > bx1 || y1 < by0 || y0 > by1) {
    return false;
  }
  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    if (x1 >= bandRectsWorld[j] && x0 <= bandRectsWorld[j + 2] && y1 >= bandRectsWorld[j + 1] && y0 <= bandRectsWorld[j + 3]) {
      return true;
    }
  }
  return false;
}

/** `selectBandPens` 上一次用的视口四条边（世界坐标），只为让审计能复用同一份判定。 */
let viewX0 = 0;
let viewX1 = 0;
let viewY0 = 0;
let viewY1 = 0;

let bandCoarseTick = 0;

function selectBandPens() {
  bandPens.length = 0;
  const s = data.scale || 1;
  // 与 applyTransform 的矩阵一致：带上 phaseX / phaseY
  const toWorldX = (devX: number) => (devX - phaseX) / dpr / s - (data.x || 0) / s;
  const toWorldY = (devY: number) => (devY - phaseY) / dpr / s - (data.y || 0) / s;

  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    bandRectsWorld[j] = toWorldX(bandRects[j]);
    bandRectsWorld[j + 1] = toWorldY(bandRects[j + 1]);
    bandRectsWorld[j + 2] = toWorldX(bandRects[j] + bandRects[j + 2]);
    bandRectsWorld[j + 3] = toWorldY(bandRects[j + 1] + bandRects[j + 3]);
  }
  // 视口四条边（世界坐标）。存到模块变量里是给像素审计用的 —— `audit:selMissWhy`
  // 要判「漏选的那个 pen 是被哪一条子句挡下的」，必须用**这一条**视口边界，
  // 在审计里照着再算一遍就又是一份会走样的拷贝（第 4 步的教训）。
  const fx0 = (viewX0 = toWorldX(0));
  const fx1 = (viewX1 = toWorldX(width));
  const fy0 = (viewY0 = toWorldY(0));
  const fy1 = (viewY1 = toWorldY(height));

  // 先用「矩形外扩 maxInkPad」粗筛，碰不到任何一块重画区的直接跳过，不算 inkBox（设计文档 9.9be）。
  // 依据：maxInkPad 是全部图元墨迹伸出自身矩形的最大量（trackInkPad 在每个增改入口维护、只增不减），
  // 所以「矩形 ± maxInkPad」一定盖住墨迹盒 ⇒ 粗筛说碰不到，精筛（inkHitsBand）也一定碰不到 —— 结果集不变。
  // 旋转、外溢文本、flip、阴影都在 inkBox 的 ①~⑤ 里，inkPad 是这几步之后的最终外伸量 ⇒ 都被 maxInkPad 盖住。
  // 取证：下面每 16 次顺带不粗筛再选一遍（view:bandCoarseBad 必须恒为 0）。
  const pad = maxInkPad;
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    bx0 = Math.min(bx0, bandRectsWorld[j]);
    by0 = Math.min(by0, bandRectsWorld[j + 1]);
    bx1 = Math.max(bx1, bandRectsWorld[j + 2]);
    by1 = Math.max(by1, bandRectsWorld[j + 3]);
  }
  const coarse = options.bandCoarse !== false && isFinite(pad);
  let rotated = 0;
  let coarseSkip = 0;
  for (const pen of penMap.values()) {
    // ---- 与 calc 的 `calcInViewPens` 逐字对齐 ----
    // 快路径的判据是「与全量重绘**逐像素相同**」，而全量重绘画的是 calc 发来的
    // `inViewPenIds`。calc 只按**矩形**判在不在视口里，还把 width/height < 2 的节点整个丢掉（isTinyPen，连线除外）
    // （calcInViewPens）。这里要是按墨迹判「在视口里」，快路径就会画出基准**没画**的
    // 墨迹 —— 那是比基准更对的画面，但仍然是一处差异，像素审计分不出「谁更对」。
    // 所以这一层复制 calc 的规矩；calc 那个「矩形出了视口就不画它的墨迹」的缺陷
    // 单独记账（文档 D21），由它自己那一步去修，修的时候这里要跟着改。
    // 改错的症状：视口边缘一条墨迹残缺 / 多余，性能读数全正常 ⇒ 只有像素审计看得见。
    if (pen.ex == undefined) {
      pen.ex = pen.x + pen.width;
      pen.ey = pen.y + pen.height;
    }
    if (isTinyPen(pen)) {
      continue;
    }
    if (!(pen.ex > fx0 && pen.x < fx1 && pen.ey > fy0 && pen.y < fy1)) {
      continue;
    }
    if (coarse && !rectPadHitsBand(pen, pad, bx0, by0, bx1, by1)) {
      coarseSkip++;
      continue;
    }

    inkBox(pen);
    if (inkHitsBand()) {
      bandPens.push(pen);
      if ((pen as any).rotate) {
        rotated++;
      }
    }
  }
  bandPens.sort((a, b) => a.index - b.index);
  probe.count('view:bandRotated', rotated);
  probe.sample('view:bandCoarseSkip', coarseSkip);
  // 取证：开探针时每 16 次顺带不粗筛再选一遍，比集合。**Bad 必须恒为 0**，否则粗筛漏了图元（窄带里缺墨迹）
  if (coarse && probe.on && ++bandCoarseTick >= 16) {
    bandCoarseTick = 0;
    probe.count('view:bandCoarseChecked');
    const ref = new Set<string>();
    for (const pen of penMap.values()) {
      if (isTinyPen(pen)) {
        continue;
      }
      if (!(pen.ex > fx0 && pen.x < fx1 && pen.ey > fy0 && pen.y < fy1)) {
        continue;
      }
      inkBox(pen);
      inkHitsBand() && ref.add(pen.id);
    }
    if (ref.size !== bandPens.length || bandPens.some((p) => !ref.has(p.id))) {
      probe.count('view:bandCoarseBad');
    }
  }
  probe.sample('view:bandScan', penMap.size);
  return bandPens.length;
}

/**
 * 把 ctx 裁到 `computeBandRects` 算出的那几块（**设备像素**空间，一条路径一次 `clip()`），
 * 并把整个重画区清空。
 *
 * 边界全是整数设备像素（`sx/sy` 已 `Math.round` 过，`pad` 已 `Math.ceil` 过，
 * `width/height` 是画布尺寸），所以 clip 的覆盖是精确的、不会在接缝上留半透明像素。
 *
 * **为什么要 clearRect**：新暴露的窄带已被 `blitOnce` 的 `'copy'` 清成透明，但 pad 那几块里
 * 是**搬过来的像素**（有内容），不清就在上面叠一遍 ⇒ 半透明墨迹（shadow 正是）加深，
 * 离开侧那条的陈迹也擦不掉。清的是「clip 之内」，一次 `clearRect(0,0,width,height)`
 * 正好就是那几块，不用逐块清。
 *
 * 调用方负责配对的 `ctx.restore()`。
 */
function clipBand() {
  ctx.save();
  ctx.resetTransform();
  ctx.beginPath();
  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    ctx.rect(bandRects[j], bandRects[j + 1], bandRects[j + 2], bandRects[j + 3]);
  }
  ctx.clip();
  ctx.clearRect(0, 0, width, height);
}

/**
 * M7a 快路径：**纯平移时整屏搬像素，只重画新暴露的那条 L 形窄带**。
 *
 * 返回 `true` = 这一条视口已经画完了，调用方直接 return，不要再走全量重绘。
 * 返回 `false` = 判定不是纯平移（或快路径被关掉），调用方按老路 `resetRender()` + 全量重绘。
 *
 * ```
 * 判定（任一成立就退回全量，并在 view:full:<reason> 上计次）
 *   resize  画布尺寸变了 ⇒ 现有像素作废
 *   first   paintedX 是 NaN ⇒ 画布刚被清过，没有可搬的东西
 *   sig     data 上除 x/y 之外任何字段变了（**缩放落在这里**）
 *   zero    位移不足半个设备像素 ⇒ **一笔都不画**，直接 return true（计在 view:skip，
 *           不是 view:full:*）。关掉 panBlit 时才退回全量，见那里的注释。
 *   far     位移 ≥ 画布尺寸 ⇒ 窄带就是整块画布，搬了白搬
 *   farPad  第 5 步加宽（|s| + 2·pad）之后铺满整条边 ⇒ 同上，单独记账看 pad 的租金
 * 命中则：computeBandRects → blitOnce(sx,sy) → clipBand()（裁 + 清空重画区）
 *         → applyTransform() → 只画 bandPens → restore（弹裁剪区）
 *         → **再 applyTransform 一次**（restore 把 CTM 也退回去了）
 * ```
 *
 * `options.panBlit === false` 时退化成第 1~3.6 步的**只量不改画面**模式：
 * 照样 blit、照样采全部 `view:*` 读数，但返回 `false` 让调用方整屏 `clearRect` 擦掉痕迹。
 * 这样 A/B 两侧的探针开销一致，差的只有「有没有真的省下全量重绘」。
 *
 * 各步的读数与来历见设计文档 §0.5-H14 ~ H18（M7a）。
 */
function tryPanBlit(d: any, resized: boolean): boolean {
  viewSeq++;
  const _tSig = probe.now();
  const sig = viewSig(d);
  probe.time('view:sig', _tSig);

  // 画布设备像素数与 dpr：现有报告里没有这两个数，而 blit 成本正比于它们
  // （dpr=1 是 1.99Mpx/8MB，dpr=2 是 7.97Mpx/32MB，差 4 倍），模型不能两头都蒙。
  probe.sample('canvas:px', width * height);
  probe.sample('canvas:dpr', dpr);

  const first = Number.isNaN(paintedX);
  const trueX = dpr * (d.x || 0);
  const trueY = dpr * (d.y || 0);
  // 整数化：blit 只能按整数设备像素搬。拿绝对真值比，残差不累积（见 paintedX 注释）。
  const sx = first ? 0 : Math.round(trueX - paintedX);
  const sy = first ? 0 : Math.round(trueY - paintedY);
  // 留住取整**之前**的参照点：函数末尾 `paintedX = paintedX0 + sx` 会把它覆盖掉，
  // 而亚像素残差探针要的是这一条视口取整时丢掉的那一点（见末尾 `view:resX1k`）。
  const paintedX0 = first ? trueX : paintedX;
  const paintedY0 = first ? trueY : paintedY;
  // 第 5 步：窄带要向内加宽的量（设备像素）。世界单位 → 设备像素 = ×dpr×scale，
  // 向上取整保证 clip / 选取 / 审计分区三处用的是同一个整数边界。
  const padDev = Math.ceil(maxInkPad * dpr * (data.scale || 1));

  let reason = '';
  // resize 先判：它也会把 paintedX 置成 NaN，若让 `first` 先判，`view:full:resize`
  // 就永远是 0，看报告的人会以为改画布尺寸不触发全量重绘。退回原因要报得准。
  if (resized) {
    reason = 'resize';
  } else if (first) {
    reason = 'first';
  } else if (sig !== lastViewSig) {
    // 缩放也落在这里：scale 是 data 的字段，签名会变
    reason = 'sig';
  } else if (!sx && !sy) {
    // 位移不足半个设备像素 ⇒ 画布上的像素已经就是这一条视口该有的样子。见下面的 view:skip。
    reason = 'zero';
  } else if (Math.abs(sx) >= width || Math.abs(sy) >= height) {
    // 窄带 = 整块画布，blit 纯属浪费。真实 M7a 在这里也退回全量。
    reason = 'far';
  } else if ((sx && Math.abs(sx) + 2 * padDev >= width) || (sy && Math.abs(sy) + 2 * padDev >= height)) {
    // 第 5 步：加宽之后（进入侧 |s| + pad、离开侧 pad）铺满了整条边 ⇒ 重画区就是整屏，
    // 搬了白搬，而且四块矩形会互相重叠。单独记一个原因，就是为了量「pad 到底多常把
    // 快路径挤掉」—— 这是全局 `maxInkPad` 这个设计要付的租金，得看得见。
    reason = 'farPad';
  }
  lastViewSig = sig;

  // ---- 位移为零的视口一笔都不画（设计文档 §0.5-H18） ----
  //
  // 走到这里说明：没 resize、没 first、`sig` 未变、位移又舍入成 0
  // ⇒ 视口和文档级选项都和上一次画的时候一样，画布上的像素**已经是对的**。
  //
  // 前提是「`UpdateView` 不会捎带**需要重绘**的变化」。发往 render worker 的 `UpdateView`
  // 全工程只有 calc 的三个发送点：`onResize` / `onData` / `onTranslateScale`
  // （calc 的 `onOption` **不发** —— 别照着旧注释找）。逐条核：
  //   · `onTranslateScale`：纯视口，正是这条要跳的；
  //   · `onResize`：`resize` 在上面的阶梯里排在 `zero` 之前，走不到这里；
  //   · `onData`：图元内容确实换了，但 render 自己的 `onData` 会先跑并
  //     `resetRender()`（把 paintedX/Y 置 NaN）⇒ 那条 `UpdateView` 落在 `first`。
  //     **依赖一个投递顺序**：`meta2d.ts` 里 Data 先发 renderWorker 再发 calcWorker，
  //     而 calc 那条 `UpdateView` 还要绕一趟主线程才到 render ⇒ render 的 `onData`
  //     必定在前。谁要是把那两次 postMessage 调了个个儿，这条就不成立了。
  // 图元内容的其他变化走 `Patch` / `RenderAnimation`，各自带自己的重绘。
  // 万一以后有人把 `UpdateView` 当成「重画一切」的信号来用，症状是**画面停止更新**，
  // 那就是这里要先改。
  //
  // **不许动 paintedX/Y**：位移舍入成 0 不等于真的没动（|trueX − paintedX| < 0.5）。
  // 若每次都把 paintedX 追平到 trueX，像素留在原地而参照点一路爬，亚像素误差就会
  // 无界累积（0.4 → 0.8 → 1.2 … 每步都判 0）。保持不动，残差自然会在某一条上凑够
  // 半个像素、舍入成 1 而被搬掉 —— 这正是 paintedX 拿绝对真值比的意义。
  // 同理也不重装 CTM：ctx 和模块级 `matrix` 一起停在上一条视口，两者自洽，
  // 后续动画重绘不会错位（差的那 <0.5 设备像素与快路径本身的残差同量级）。
  //
  // 关掉 panBlit 时不走这条（落回 `view:full:zero`）：A/B 两侧只准差「快路径开没开」
  // 这一个变量，否则减出来的收益分不清是哪一笔。
  if (reason === 'zero' && options.panBlit !== false) {
    // 像素没动，data.x 变了 ⇒ 相位跟着变；之后谁再 applyTransform，算出来的仍是像素所在的那个相位
    phaseX = paintedX - trueX;
    phaseY = paintedY - trueY;
    probe.count('view:skip');
    lastFast = 'skip';
    lastSx = 0;
    lastSy = 0;
    lastPadDev = 0;
    // 一笔都没画 ⇒ 重画区是空的。像素审计照这个分区，差异会全部落在「重画区外」，
    // 正是 `skip` 这个主张该被检验的方式（第 4.5 步的注释）。
    bandRectCount = 0;
    return true;
  }

  probe.count(reason ? 'view:full:' + reason : 'view:pure');
  if (reason) {
    return false;
  }

  probe.sample('view:shift', Math.abs(sx) + Math.abs(sy));
  // 搬完之后像素停在 paintedX0 + sx（见末尾 paintedX 的注释）⇒ 窄带的选取（selectBandPens 的 toWorldX）
  // 与绘制（applyTransform）都按这个相位来。panBlit: false 时随后的全量重绘会在 resetRender 里归零。
  phaseX = paintedX0 + sx - trueX;
  phaseY = paintedY0 + sy - trueY;
  computeBandRects(sx, sy, padDev);
  // 四块两两不相交 ⇒ 面积直接相加就是重画区的真面积
  let bandArea = 0;
  for (let i = 0; i < bandRectCount; i++) {
    const j = i << 2;
    bandArea += bandRects[j + 2] * bandRects[j + 3];
  }
  // `view:bandPct` 是实际重画区（几何窄带 + 两侧 pad）占画布的比例
  probe.sample('view:bandPct', (bandArea * 100) / (width * height));
  probe.sample('view:inkPad', maxInkPad);

  // 第 3 步：窄带里到底有几个图元。「面积占比 × 密度」是个估算（隐含密度均匀，
  // 且没算图元自身尺寸跨过窄带边界那一圈），这里拿真实计数去校准它。
  // 顺带量选取本身的开销 —— 第十二轮它就是新瓶颈（2751µs，占 60fps 预算三成），
  // 改扫 `penMap.values()` 之后扫描量涨到 `view:bandScan`（2.22 万）而耗时应当反降。
  const _tSel = probe.now();
  const bandCount = selectBandPens();
  probe.time('view:bandSelect', _tSel);
  probe.sample('view:bandCount', bandCount);
  if (inViewPenIds.length) {
    probe.sample('view:bandPctPens', (bandCount * 100) / inViewPenIds.length);
  }

  const _tb = probe.now();
  blitOnce(sx, sy);
  probe.time('view:blit', _tb);

  if (options.panBlit === false) {
    // 只量不改画面（panBlit: false）：调用方接着 `resetRender()` 全量重绘，
    // 上面那一下 blit 会被整屏 clearRect 擦掉 ⇒ 画面逐像素与关掉 M7a 时相同。
    //
    // performance.now() 只有 100µs 粒度（D11），按批计时才有分辨率。正负交替，免得内容被推出画布。
    // **只有在这条分支里才能这么干** —— 快路径上再拷 4 次就是花屏。
    if (probe.on && performance.now() - _tb < 0.3) {
      const _tb4 = probe.now();
      blitOnce(-sx, -sy);
      blitOnce(sx, sy);
      blitOnce(-sx, -sy);
      blitOnce(sx, sy);
      probe.time('view:blit:x4', _tb4);
    }
    return false;
  }

  // ---- 第 4 步：真的走快路径，不再全量重绘 ----
  // 顺序要紧：先 clip（设备像素空间，要先 resetTransform）再装 matrix。
  // clip 一旦设好就固定在设备像素上，之后改 CTM 不会移动它。
  clipBand();
  applyTransform();
  // 窄带的裁剪已经由 clipBand 做了（而且是 L 形，`boundary` 那个单矩形表达不了），
  // 所以这里把 boundary 归零，让 renderPens 不要再自己 clip/clearRect 一遍。
  boundary = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };
  const _prevPatch = patchPens;
  const _prevTag = renderTag;
  patchPens = bandPens;
  // D12：窄带那次重绘与全量那次是两个总体，混进同一个采样器就谁也不代表
  renderTag = '5b';
  renderPens(ctx);
  renderTag = _prevTag;
  patchPens = _prevPatch;
  ctx.restore(); // 配对 clipBand 的 save
  // **必须紧跟一次 applyTransform()**：`clipBand` 的 `save()` 是在 `applyTransform()`
  // 之前做的，所以这次 `restore()` 不只弹掉 L 形裁剪区，还把 CTM 一起退回了**上一条**
  // 视口的矩阵。而 `renderPens` 自己从不装 CTM —— `onRenderAnimation` / `onHover` /
  // `onActive` / `onPatch` 全都直接吃这个环境值。不重装的结果是：模块级 `matrix` 是新的
  // （擦除矩形算对了），ctx 的 CTM 是旧的（图元画到旧位置还被裁掉）⇒「平移后动画和文字节点错位」（D16）。
  //
  // 不变量（全量路径由 `resetRender()` 末尾那次 applyTransform 保证，两条路必须一致）：
  // **离开 onUpdateView 时，ctx 的 CTM 必须等于当前视口的矩阵。**
  applyTransform();

  // 搬过来的像素只挪了整数 sx / sy，它们对应的原点是 paintedX0 + sx，**不是** trueX：
  // 取整丢掉的那点残差还在这些像素上。原来这里写 trueX（以为「残差归零」），残差就被丢掉、
  // 每步至多 0.5 设备像素地一路累积；只有新画的窄带在准确位置 ⇒ 来回抖动平移多次后，
  // 搬过来的部分与窄带错开好几个像素，竖线被切成上下错位的几截（dpr 非整数时必现；
  // dpr = 1 且鼠标按整数像素移动时 trueX − paintedX 恒为整数、残差恒 0，所以看不出来）。
  // 记成 paintedX0 + sx：残差留给下一条的 Math.round 去补，|trueX − paintedX| 恒 ≤ 0.5（见 paintedX 注释）。
  // 窄带也画在这个相位上（phaseX，上面 computeBandRects 之前设好），与搬过来的像素没有接缝。
  paintedX = paintedX0 + sx;
  paintedY = paintedY0 + sy;
  lastFast = 'pure';
  lastSx = sx;
  lastSy = sy;
  lastPadDev = padDev;
  // **亚像素相位残差**：`sx` 是整数，真实位移不是，
  // 差出来的这一点就是「搬过来的像素与重画的像素之间对不齐多少个设备像素」。
  // 它 ≠ 0 ⇒ 每条抗锯齿边最多错半个像素，rotate/shadow 那几千 px 有了着落；
  // 它 = 0 ⇒ 搬运是**相位精确**的，那两类的差异只能出在 blit 这个原语本身
  // （见 `audit:selfBlit`）。乘 1000 取整是因为探针只汇总数值分布，小数会被均值掩掉。
  probe.sample('view:resX1k', Math.round((trueX - paintedX0 - sx) * 1000));
  probe.sample('view:resY1k', Math.round((trueY - paintedY0 - sy) * 1000));
  return true;
}

/** 上一条视口的回执**发出**的时刻（`Date.now()`，跨线程可比）。见 `sampleViewTrip`。 */
let lastAckAt = 0;

/**
 * 把视口的「一圈往返」拆开量（设计文档结论 29 / D18）：
 *
 *   view:trip:calc  calc 盖章 → 主线程发出   （calc 自己的积压 + 主线程消息泵的排队）
 *   view:trip:post  主线程发出 → render 开始处理（≈ msg:gap:5，留作交叉校验）
 *   view:trip:ack   render 发出上一条回执 → 主线程发出这一条
 *                   （回执的回程 + 主线程等下一条 UpdateView 的空档，**最可疑的一段**）
 */
function sampleViewTrip(e: MessageEvent) {
  const now = Date.now();
  const { calcSentAt, postedAt } = e.data;
  if (postedAt) {
    calcSentAt && probe.sample('view:trip:calc', postedAt - calcSentAt);
    probe.sample('view:trip:post', now - postedAt);
    lastAckAt && probe.sample('view:trip:ack', postedAt - lastAckAt);
  }
}

/**
 * 全量重绘当前视口 —— 慢路径的那一段，一字未改，只是抽成了函数。
 *
 * 抽它只为一个目的：让像素审计的基准和真实的慢路径是**同一段代码**。
 * 基准要是另写一份，比出来的差异就说不清是「快路径错了」还是「两份基准本来就不一样」。
 */
function fullRepaintView() {
  resetRender();
  // 全量重绘之后现有像素的原点 = 对齐后的整设备像素（resetRender 设好的 phaseX / phaseY）
  paintedX = dpr * (data.x || 0) + phaseX;
  paintedY = dpr * (data.y || 0) + phaseY;

  patchPens.length = 0;
  if (!inViewPenIds.length) {
    return;
  }
  inViewPenIds.forEach((id: string) => {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  });
  renderPens(ctx);

  patchPens = [];
}

/** 上一条视口走的是哪条快路径（`pure` = 搬 + 重画窄带，`skip` = 一笔不画）及其位移（设备像素）。 */
let lastFast = '';
let lastSx = 0;
let lastSy = 0;
/** 上一条快路径用的墨迹加宽量（设备像素），只为让审计读数自带上下文。 */
let lastPadDev = 0;

/**
 * 视口流水号（每条 `UpdateView` +1）与上一条**被审计**的视口的图元集合。
 *
 * 只为回答一个问题：搬过来的那片像素，是用哪一批图元画的。相邻两条才可比 ——
 * 中间隔了没审计的视口，集合差就不是「一步之内的变化」了（见 `audit:setGone`）。
 */
let viewSeq = 0;
let prevViewSeq = -2;
let prevViewIds: string[] = [];

function onUpdateView(e: MessageEvent) {
  probe.on && sampleViewTrip(e);
  try {
    let resized = false;
    if (e.data.width && e.data.height && (width !== e.data.width || height !== e.data.height)) {
      width = e.data.width;
      height = e.data.height;
      // 给 canvas.width 赋值本身就会清屏 ⇒ 现有像素作废
      ctx.canvas.width = width;
      ctx.canvas.height = height;
      resized = true;
      paintedX = NaN;
      paintedY = NaN;
    }

    data = e.data.data || data || { x: 0, y: 0 };
    inViewPenIds = e.data.penIds || [];
    if (e.data.repaint) {
      // 内容变了（分批打开补进了视口里的图元，见 calc onDataChunk）⇒ 现有像素不能搬，走整屏重画
      paintedX = NaN;
      paintedY = NaN;
    }

    // M7a 快路径：纯平移时整屏搬像素 + 只重画新暴露的 L 形窄带，画完就 return。
    // 判定为非纯平移时返回 false，落到下面的全量重绘 —— 那条路一字未改。
    //
    // 注意条件：`options.panBlit === false` 时仍然要进去（那是「只量不改画面」模式，
    // 里面自己会 return false），所以这里只在**探针和快路径都关掉**时才整个跳过。
    if ((probe.on || options.panBlit !== false) && tryPanBlit(data, resized)) {
      // 像素审计（默认关）：只有真走了快路径的条才有可比的对象。它会把同一条视口
      // 用慢路径再画一遍当基准 ⇒ 屏上留下的是基准，审计本身不会留下错误的画面。
      auditLeft > 0 && auditPixels();
      return;
    }

    fullRepaintView();
  } finally {
    // 视口背压（设计文档 §0.5-H2 / Phase 1.2）：回执 = 「我画完了，可以给下一条」。主线程据此只保留最新的一条待发（onUpdateView），
    // 中间那些过期视口在发出之前就被丢掉。
    // 必须放在 finally：上面有 `!inViewPenIds.length` 的提前 return，漏发一次回执
    // 就会让主线程永久停发视口 —— 画面卡死，比积压严重得多。
    // 回执发出的时刻：下一条视口用它算 `view:trip:ack`，主线程用它算 `main:ackWait`。
    const ackAt = Date.now();
    // pens：这一条视口画了几个图元。主线程据此发 viewRendered 事件，外部（如 benchmark）用「第一次 pens > 0」判定首屏真正画出来了
    self.postMessage({ action: WorkerMessage.ViewRendered, sentAt: probe.on ? ackAt : undefined, pens: inViewPenIds.length });
    lastAckAt = ackAt;
  }
}

function onHover(e: MessageEvent) {
  // hover 一步要重绘两次（先按老状态擦掉上一个图元的 hover 效果，再画新的），
  // 拆开量：如果 hover:clear ≈ hover:draw，那「一次 hover 两份成本」是真的，
  // 优化方向就是让两个脏区合并成一次重绘（Phase 1 局部重绘）。
  const _tClear = probe.now();
  // 清除上一次的绘画状态
  if (lastHoverPens?.length) {
    patchPens = lastHoverPens;
    boundary = lastHoverBoundary;
    hoverId = undefined;

    renderPens(ctx);
  }
  probe.time('hover:clear', _tClear);

  hoverId = e.data.hoverId;
  boundary = e.data.boundary;
  patchPens = [];
  if (!e.data.penIds || !e.data.penIds.length) {
    lastHoverPens = undefined;
    lastHoverBoundary = undefined;
    // 移出图元（只擦不画）的次数，用来解释 hover:draw 的样本数为何少于 recv:Hover
    probe.count('hover:noPen');
    return;
  }
  e.data.penIds.forEach((id: string) => {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  });
  const _tDraw = probe.now();
  renderPens(ctx);
  probe.time('hover:draw', _tDraw);
  probe.sample('hover:pens', patchPens.length);

  lastHoverPens = patchPens;
  lastHoverBoundary = boundary;
}

function onActive(e: MessageEvent) {
  inputtingPen = undefined;
  // 兜底（见 onPatch 那段）：选中状态重新下发 ⇒ 拖动一定已经结束；即使某次松手没产生 Patch，被拖图元也不会一直被藏着
  dragging = false;
  // 清除上一次的绘画状态
  if (lastInActivePens?.length) {
    patchPens = lastInActivePens;
    boundary = lastActiveBoundary;
    activeMap = undefined;
    renderPens(ctx);
  }

  activeMap = e.data.activeMap;
  if (!activeMap) {
    lastInActivePens = undefined;
    lastActiveBoundary = undefined;
    return;
  }

  boundary = e.data.activeBoundary;
  patchPens = [];
  for (const id in activeMap) {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  }
  patchPens.sort((a, b) => {
    return a.index - b.index;
  });
  e.data.render && renderPens(ctx);
  lastInActivePens = patchPens;
  lastActiveBoundary = boundary;
  // if (lastActiveBoundary.box) {
  //   ctx.strokeStyle = 'red';
  //   ctx.beginPath();
  //   ctx.rect(
  //     lastActiveBoundary.box.x - 1,
  //     lastActiveBoundary.box.y - 1,
  //     lastActiveBoundary.box.width + 2,
  //     lastActiveBoundary.box.height + 2
  //   );
  //   ctx.stroke();
  // }
}

function onPatch(e: MessageEvent) {
  if (options.patchCoalesce !== false && canDeferPatch(e.data)) {
    deferPatch(e.data);
  } else {
    flushPatches();
    try {
      onPatchBody(e);
    } finally {
      // 回执必须发出去，哪怕上面抛错：主线程收不到就停发 setValue（虽有超时兜底，但会卡 1 秒）
      e.data.ackSeq != undefined && postPatchRendered([e.data.ackSeq]);
    }
  }
}

/** setValue 队列的背压回执（见 Meta2d.consumePatchQueue）：这些批次已经画到画布上了 */
function postPatchRendered(seqs: number[]) {
  self.postMessage({ action: WorkerMessage.PatchRendered, seqs });
}

/**
 * Patch 按帧合并（结构同动画的 M4 合并绘制，设计文档 9.9bb）。
 * 多选缩放 / 旋转时每个 mousemove 一条 Patch，逐条擦旧区 + 画新区会让 render 排队（图元落后选框）。
 *
 * 做法：只改已有图元属性的 Patch（没有增删）**立刻应用属性**（便宜，状态马上是对的），但**不立刻画**；
 * 记下它的新旧两块区域，攒到这一帧末尾，一次清空所有区域、按层级把碰到这些区域的图元各画一次。
 * 正确性与动画合并同一个论证：逐条画时每个像素的终态 = 「所有碰到它的图元按层级各画一次」，一次画完相同。
 * 有增删的 Patch、以及其它会读写主画布的消息（视口、悬停、选中、动画…）到来前先冲掉，保证先后次序不变。
 */
let pendingPatch:
  | { rects: any[]; ids: Set<string>; datas: any[]; acks: number[]; full?: boolean; changed?: string[] }
  | undefined;
let patchFrame = 0;

function canDeferPatch(d: any) {
  return !d.add?.length && !d.remove?.length && (d.newBoundary || d.oldBoundary || d.full) && patchAuditLeft <= 0;
}

/**
 * 第 3 步：calc 判定这批改动铺满视口（full），整屏重画视口里的图元，而不是由 calc 求出上万个 id 再传过来。
 * 与 fullRepaintView 相同（M7a 的搬运前提 paintedX/Y 照样有效），只多一件事：
 * inViewPenIds 是上一条视口算的，被这批改动从视口外挪进来的图元（moved）不在里面，要补上。
 * 整屏重画是所有局部重画的上界 ⇒ 同一帧里攒着的其它块不用再画。
 *
 * ⚠ changed：这批改了的全部图元。原来的局部重画会把它们（含视口外的）每个都画一遍，而画文字时
 * 顺带量出新的文字框、经 textOutsides 告诉 calc 文字伸出图元多远。整屏只画视口里的 ⇒ 视口外被改的
 * 文字不量，calc 手里留着旧文字框；之后再改它们时脏区按旧框算、偏小，邻居被清掉却不在重画清单里
 * （平移进视口后与整屏重画比对，每格文字溢出处差一列像素）。所以没画到的要单独量一遍。
 */
function repaintFullView(moved?: Iterable<string>, changed?: Iterable<string>) {
  const extra: Pen[] = [];
  let inView: Set<string>;
  if (moved) {
    for (const id of moved) {
      inView ??= new Set(inViewPenIds);
      const pen = !inView.has(id) && penMap.get(id);
      pen && extra.push(pen);
    }
  }
  if (!extra.length) {
    fullRepaintView();
  } else {
    resetRender();
    paintedX = dpr * (data.x || 0) + phaseX;
    paintedY = dpr * (data.y || 0) + phaseY;
    const list: Pen[] = extra;
    inViewPenIds.forEach((id: string) => {
      const pen = penMap.get(id);
      pen && list.push(pen);
    });
    list.sort((a, b) => a.index - b.index);
    patchPens = list;
    renderPens(ctx);
    patchPens = [];
  }
  if (changed) {
    measureUndrawnTexts(changed, inView ?? new Set(inViewPenIds), extra);
  }
}

/** 见 repaintFullView 的 changed：给没画到的文字图元量文字框，并像 renderPens 末尾那样发给主线程 / calc */
function measureUndrawnTexts(changed: Iterable<string>, inView: Set<string>, drawn: Pen[]) {
  const drawnIds = drawn.length ? new Set(drawn.map((p) => p.id)) : undefined;
  ctx.save();
  for (const id of changed) {
    if (inView.has(id) || drawnIds?.has(id)) {
      continue;
    }
    const pen = penMap.get(id);
    // applyPatchState 已经把 textLines / textBox 清掉了（改了文字或几何时）；没清的说明文字框没变
    if (!pen || pen.textLines || pen.text == undefined || pen.text === '') {
      continue;
    }
    ctx.font = getFont(pen, data);
    measureTextBox(ctx, pen);
  }
  ctx.restore();
  if (Object.keys(textOutsides).length) {
    self.postMessage({ action: WorkerMessage.TextOutside, textOutsides });
    textOutsides = {};
  }
}

function deferPatch(d: any) {
  if (!pendingPatch) {
    pendingPatch = { rects: [], ids: new Set(), datas: [], acks: [] };
  }
  // 先记回执再做别的：下面抛错时 flushPatches 仍会把它发出去
  d.ackSeq != undefined && pendingPatch.acks.push(d.ackSeq);
  // 拖动状态 / 悬停框 / 属性这几件事与画无关，照原样马上做（onPatchBody 前半段 + 末尾悬停那段）
  applyPatchState(d);
  if (d.full) {
    // 整屏重画（见 repaintFullView）：块和清单都不用记了，只记挪进视口的图元
    pendingPatch.full = true;
    d.fullChanged && (pendingPatch.changed ??= []).push(...d.fullChanged);
    d.fullMoved?.forEach((id: string) => pendingPatch.ids.add(id));
  } else if (d.rects) {
    // 分块脏区：逐块进裁剪，newBoundary 只是外接框，不能进（进了就退回成整个并集）
    for (const r of d.rects) {
      r.width > 0 && pendingPatch.rects.push(alignedClipRect(r));
    }
    d.newPenIds?.forEach((id: string) => pendingPatch.ids.add(id));
  } else {
    for (const [b, ids] of [
      [d.oldBoundary, d.oldPensIds],
      [d.newBoundary, d.newPenIds],
    ] as any[]) {
      if (!b || !(b.width > 0 || (b.box && b.box.width > 0))) {
        continue;
      }
      pendingPatch.rects.push(alignedClipRect(b));
      ids?.forEach((id: string) => pendingPatch.ids.add(id));
    }
  }
  if (d.newPenIds && hoverId) {
    followHover(
      d,
      d.newPenIds.map((id: string) => penMap.get(id)).filter(Boolean),
    );
  }
  if (!patchFrame) {
    patchFrame = requestAnimationFrame(() => {
      patchFrame = 0;
      flushPatches();
    });
  }
}

/**
 * 第 2 步：Patch 只画视口内。画布就是视口那么大，画布外的块和墨迹整个在画布外的图元画了也不显示
 * （裁剪会丢掉，但路径、文字测量、fillText 的 CPU 一分不少）。8000 数据点的场景约 28% 的图元在画布外。
 *
 * 只按 render 自己此刻的变换（matrix）判，不交给 calc：calc 的视口比 render 新（视口要经主线程背压后才到），
 * 按新视口剔掉的图元在 render 还显示的旧视口里可能看得见。
 * 视口一变，render 按 penMap 里的最新数据重画新露出的部分，所以这里不画的不会漏（平移后与整屏重画逐像素一致）。
 *
 * 曾测到逐图元裁剪让主线程掉 ~10 fps，后查明是测试浏览器长时间运行后的环境问题：干净的浏览器里帧率不变、
 * 延迟少 ~40ms（交替复测三轮一致）。
 */
function viewportWorld(): { x0: number; y0: number; x1: number; y1: number } | undefined {
  const m = matrix;
  if (!m || m.b !== 0 || m.c !== 0 || !m.a || !m.d || !(width > 0) || !(height > 0)) {
    return undefined;
  }
  const ax = -m.e / m.a;
  const bx = (width - m.e) / m.a;
  const ay = -m.f / m.d;
  const by = (height - m.f) / m.d;
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

/** 去掉墨迹整个在画布外的图元（顺序不变）；判不了时（带旋转 / 斜切的变换）原样返回 */
function visiblePens(list: Pen[]): Pen[] {
  if (options.patchViewportCull === false) {
    return list;
  }
  const v = viewportWorld();
  if (!v) {
    return list;
  }
  const out: Pen[] = [];
  for (const pen of list) {
    inkBox(pen);
    if (!(ink2 < v.x0 || ink0 > v.x1 || ink3 < v.y0 || ink1 > v.y1)) {
      out.push(pen);
    }
  }
  probe.count('patch:culled', list.length - out.length);
  return out;
}

/**
 * 合帧 / 分块重画前：改了文字的图元先量出新的文字框，伸出裁剪块的部分补一块，碰到它的图元补进重画清单。
 *
 * calc 的块是按它手里的**旧**文字框算的 —— 新文字要 render 画的时候才量得出来。新值比旧值宽（"4" → "3133"）时，
 * 新文字伸出块外被裁掉一截，块外还留着邻居旧的像素（与整屏重画差到 ~210/255，随机改 50 个、几轮就出现）。
 * 原来的并集框也有同样的问题，只是框很大，只有贴在框边上的图元才碰上；分块后几乎每批都碰上。
 *
 * 在这里量而不是让 calc 估：字体、字号、对齐都在 render 手里，量出来是准的；量的结果画的时候直接复用（textLines 已填好），
 * 不多量一次。只有真伸出块外才扫一遍 penMap 找邻居（墨迹判定同 auditPatch 的参照）。
 *
 * @param rects alignedClipRect 的结果，补的块直接追加进去
 * @returns 补过图元、按层级排好序的清单（没有伸出块外的就原样返回）
 */
function coverGrownText(list: Pen[], rects: any[]): Pen[] {
  let extra: any[] | undefined;
  // 与 calc getPenRects 给细线补的余量同一个式子：块按这个余量算，量出来的框也按它比，才比得齐
  const pad = 0.5 + 0.5 / (data.scale || 1);
  // 「新文字框是否已被某一块盖住」按格子查，不与每块逐个比：位置刷新时每个图元的文字都要重量（textLines 被清了），
  // 500 个改动 × 1000 块逐个比就是 50 万次比较（~10ms），而它们几乎全被自己的块盖住
  let rectBuckets: Map<number, any[]> | undefined;
  const covered = (r: any) => {
    if (!rectBuckets) {
      rectBuckets = bucketRects(rects);
    }
    const b = rectBuckets.get(cellKey(Math.floor(r.x / GrownCell), Math.floor(r.y / GrownCell)));
    return !!b && b.some((c) => c.minX <= r.minX && c.minY <= r.minY && c.maxX >= r.maxX && c.maxY >= r.maxY);
  };
  for (const pen of list) {
    // applyPatchState 改了文字（或几何）时把 textLines 清掉了；没清的说明文字框没变
    if (pen.textLines || pen.text == undefined || pen.text === '') {
      continue;
    }
    ctx.save();
    ctx.font = getFont(pen, data);
    measureTextBox(ctx, pen);
    ctx.restore();
    let r: any;
    if (pen.rotate) {
      // 旋转的文字框是斜的：直接用墨迹外接盒（宁大勿小）
      inkBox(pen);
      r = alignedClipRect({ x: ink0, y: ink1, width: ink2 - ink0, height: ink3 - ink1 });
    } else {
      const tb = pen.textBox;
      const ex = tb && Math.max(tb.ex ?? -Infinity, tb.x + (tb.width ?? 0));
      const ey = tb && Math.max(tb.ey ?? -Infinity, tb.y + (tb.height ?? 0));
      if (!tb || !Number.isFinite(tb.x) || !Number.isFinite(tb.y) || !Number.isFinite(ex) || !Number.isFinite(ey)) {
        continue;
      }
      r = alignedClipRect({ x: tb.x - pad, y: tb.y - pad, width: ex - tb.x + 2 * pad, height: ey - tb.y + 2 * pad });
    }
    // 盖住它的块一定包含它的左上角 ⇒ 只看左上角所在那一格里的块
    if (covered(r)) {
      continue;
    }
    (extra ??= []).push(r);
  }
  if (!extra) {
    return list;
  }
  probe.count('patch:grownText', extra.length);
  rects.push(...extra);
  const ids = new Set<string>();
  for (const pen of list) {
    ids.add(pen.id);
  }
  // 找碰到补块的图元。补块散在全图（位置刷新时几乎每批都有几百块），逐个图元算 inkBox 再比每一块太贵
  // （500 个改动 ⇒ ~15ms）。先把补块按粗网格分桶，图元的矩形外扩全局墨迹余量（maxInkPad：任何图元的墨迹
  // 伸出自身矩形都不超过它）后只看落在同一格的块 —— 绝大多数图元所在的格子里一块也没有，一次查表就排除。
  const buckets = bucketRects(extra);
  const near: Set<any> = new Set();
  for (const pen of penMap.values()) {
    if (ids.has(pen.id)) {
      continue;
    }
    // 旋转 / 连线的矩形与墨迹差得远，按矩形分桶不可靠 ⇒ 与每块直接比
    let cands: Iterable<any> = extra;
    if (!pen.rotate && pen.category !== PenCategory.Line) {
      const px = pen.x ?? 0;
      const py = pen.y ?? 0;
      const pex = pen.ex ?? px + (pen.width ?? 0);
      const pey = pen.ey ?? py + (pen.height ?? 0);
      const cx0 = Math.floor((Math.min(px, pex) - maxInkPad) / GrownCell);
      const cy0 = Math.floor((Math.min(py, pey) - maxInkPad) / GrownCell);
      const cx1 = Math.floor((Math.max(px, pex) + maxInkPad) / GrownCell);
      const cy1 = Math.floor((Math.max(py, pey) + maxInkPad) / GrownCell);
      near.clear();
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const b = buckets.get(cellKey(cx, cy));
          b && b.forEach((r) => near.add(r));
        }
      }
      if (!near.size) {
        continue;
      }
      cands = near;
    }
    inkBox(pen);
    for (const r of cands) {
      if (!(ink2 < r.x || ink0 > r.x + r.width || ink3 < r.y || ink1 > r.y + r.height)) {
        list.push(pen);
        ids.add(pen.id);
        break;
      }
    }
  }
  list.sort((a, b) => a.index - b.index);
  return list;
}

/** coverGrownText 给补块分桶的格子边长（世界坐标）。图元、文字通常远小于它，一个图元多半只落在 1~4 格 */
const GrownCell = 64;

/** 把块（alignedClipRect 的结果，x / y / width / height 是世界坐标）登记到它盖到的每一格 */
function bucketRects(rects: any[]): Map<number, any[]> {
  const buckets = new Map<number, any[]>();
  for (const r of rects) {
    const cx0 = Math.floor(r.x / GrownCell);
    const cy0 = Math.floor(r.y / GrownCell);
    const cx1 = Math.floor((r.x + r.width) / GrownCell);
    const cy1 = Math.floor((r.y + r.height) / GrownCell);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cellKey(cx, cy);
        let b = buckets.get(k);
        !b && buckets.set(k, (b = []));
        b.push(r);
      }
    }
  }
  return buckets;
}

/** 格子坐标 → 键。场景坐标在 ±2^20 格以内（6700 万世界单位）都不会冲突 */
function cellKey(cx: number, cy: number) {
  return (cx + 0x100000) * 0x200000 + (cy + 0x100000);
}

/** 去掉整块在画布外的裁剪块（alignedClipRect 的结果，minX..maxY 是设备像素）；全在外时这批不画 */
function visibleClipRects(rects: any[]): any[] {
  if (options.patchViewportCull === false || !(width > 0) || !(height > 0)) {
    return rects;
  }
  return rects.filter((r) => r.maxX > 0 && r.minX < width && r.maxY > 0 && r.minY < height);
}

/** 把攒着的 Patch 一次画掉。任何会读写主画布的消息处理前都要先调它 */
function flushPatches() {
  const p = pendingPatch;
  if (!p) {
    return;
  }
  pendingPatch = undefined;
  if (p.full) {
    // 第 3 步：这一帧有一批铺满视口的改动 ⇒ 整屏重画一次就盖住了所有攒着的块。
    // ids 里除了挪进视口的，可能还有同帧其它块的清单：不在 inViewPenIds 里的都补画，多画只是被裁剪丢掉
    const _tF = probe.now();
    try {
      repaintFullView(p.ids, p.changed);
    } finally {
      p.acks.length && postPatchRendered(p.acks);
    }
    probe.time('patch:fullView', _tF);
    return;
  }
  const list: Pen[] = [];
  p.ids.forEach((id) => {
    const pen = penMap.get(id);
    pen && list.push(pen);
  });
  list.sort((a, b) => a.index - b.index);
  const _t = probe.now();
  try {
    // 新文字比块宽的先补块、补图元（见 coverGrownText），再去掉整块在画布外的（见 visibleClipRects）
    const all = coverGrownText(list, p.rects);
    const rects = visibleClipRects(p.rects);
    rects.length && drawMergedAnim(visiblePens(all), rects, '4m');
  } finally {
    p.acks.length && postPatchRendered(p.acks);
  }
  probe.time('patch:merged', _t);
}

/** 1.png：悬停中的图元被 Patch 挪走 ⇒ 下次要擦的悬停区域跟着换成新区域（见 onPatchBody 里的说明） */
function followHover(d: any, newPens: Pen[]) {
  if (hoverId && lastHoverPens?.length && d.update?.some((p: Pen) => p.id === hoverId) && d.newBoundary) {
    lastHoverPens = newPens;
    lastHoverBoundary = d.newBoundary;
  }
}

/** Patch 里与画无关的那一半：拖动状态、缓存属性、文字位置。立刻做，合并与否都一样 */
function applyPatchState(d: any) {
  // 拖动途中也会有别的 Patch（比如文字刷新），不能一律当成「松手提交」结束拖动，
  // 否则被拖图元会在原位置重画出来（设计文档 D43 / 23.png）。只有这两种才结束：
  // 被拖（选中）图元的**几何**提交（translatePens 带 PatchFlag.Rect），或增删图元（Alt 拖动复制）。
  // 正在画的连线在增删图元、或这条线本身的几何被提交时清。兜底：onActive 也结束拖动。
  const touchesActive =
    !!activeMap &&
    !!d.update?.some(
      (p: Pen) => p.patchFlag & PatchFlag.Rect && (activeMap[p.id] || (p.parentId && activeMap[p.parentId])),
    );
  const addsOrRemoves = !!(d.add?.length || d.remove?.length);
  if (touchesActive || addsOrRemoves || !activeMap) {
    dragging = false;
    connectedLines = undefined;
  }
  // 拖已有连线的端点重画（DragLineFrom / To）结束时提交的是 update 不是 add：原来只认增删，
  // 主线程结束时发的 CalcPenBoundary { drawingLine: undefined } 又不带 pens，calc 不转发 ⇒
  // drawingLine 一直停在这条线上，render 永远跳过它，连线消失。在提交它的同一个 Patch 里清，不依赖消息先后。
  if (addsOrRemoves || (drawingLine && d.update?.some((p: Pen) => p.id === drawingLine && p.patchFlag & PatchFlag.Rect))) {
    drawingLine = undefined;
  }

  // 更新缓存数据属性
  if (d.remove) {
    d.remove.forEach((pen: Pen) => {
      penMap.delete(pen.id);
      delete inViewPenIds[pen.id];
      delete penBoundarys[pen.id];
      delete gifPlayers[pen.id];
    });

    if (lastInActivePens) {
      lastInActivePens = lastInActivePens.filter((item) => !d.remove.some((item2) => item.id === item2.id));
    }

    if (lastHoverPens) {
      lastHoverPens = lastHoverPens.filter((item) => !d.remove.some((item2) => item.id === item2.id));
    }

    if (Object.keys(gifPlayers).length === 0) {
      cancalAnimation();
    }
  }

  d.update?.forEach((item: Pen) => {
    const pen = penMap.get(item.id) || penMap.get(item.oldId);
    if (!pen) {
      return;
    }
    Object.assign(pen, item);

    if (('lineSmooth' in item || item.anchors) && pen.calculative) {
      delete pen.calculative.lineSegments;
      delete pen.calculative.gradientSegments;
    }
    // 原来这里还有一行 patchPens.push(pen)：下面两遍重画之前都会先 patchPens = []，那一行从没被用上；
    // 合并时不画 ⇒ 它只会让全局的 patchPens 越攒越长，删掉

    // 计算文字坐标
    if (item.text || (pen.text && item.patchFlag & PatchFlag.Rect)) {
      pen.textLines = undefined; // 清除文字行缓存
      pen.textBox = undefined; // 清除文字范围缓存
      calcTextRect(pen);
    }
    trackInkPad(pen);
  });
  d.add?.forEach((item: Pen) => {
    penMap.set(item.id, item);
    inViewPenIds.push(item.id);
    // 计算文字坐标
    item.text && calcTextRect(item);
    trackInkPad(item);
  });

}

function onPatchBody(e: MessageEvent) {
  applyPatchState(e.data);

  if (e.data.full) {
    // 第 3 步（不合帧时走这里）：整屏重画，见 repaintFullView
    repaintFullView(e.data.fullMoved, e.data.fullChanged);
    return;
  }

  if (e.data.rects) {
    // 分块脏区（不合帧时走这里）：一次清空所有块、按层级把碰到它们的图元各画一次，同 flushPatches
    const _tR = probe.now();
    patchPens = [];
    e.data.newPenIds?.forEach((id: string) => {
      const pen = penMap.get(id);
      pen && patchPens.push(pen);
    });
    const aligned = e.data.rects.filter((r: any) => r.width > 0).map((r: any) => alignedClipRect(r));
    const list = coverGrownText(patchPens, aligned);
    const rects = visibleClipRects(aligned);
    rects.length && drawMergedAnim(visiblePens(list), rects, '4r');
    patchPens = [];
    probe.time('patch:regionsDraw', _tR);
    followHover(e.data, list);
    if (patchAuditLeft > 0) {
      patchAuditLeft--;
      auditPatch(e.data);
    }
    return;
  }

  // 1. 先擦除并重绘老位置区域
  //    calc 命中 reuseOldRegion 时不会发 oldBoundary（Phase 1.0a），这一整段被跳过。
  //    计时器必须放在 if 里面：放外面的话跳过时会记下一个 ~20µs 的空样本，
  //    `patch:old` 这个名字就成了「有时是重绘耗时、有时是什么都没做」的混合量。
  //    让它在跳过时**整个不存在**，缺席本身就是「第一遍没跑」的信号。
  if (e.data.oldBoundary) {
    const _tOld = probe.now();
    boundary = e.data.oldBoundary;
    patchPens = [];
    e.data.oldPensIds.forEach((id: string) => {
      const pen = penMap.get(id);
      pen && patchPens.push(pen);
    });
    probe.sample('patch:oldIds', patchPens.length);
    renderPens(ctx, patchPens, true);
    probe.time('patch:old', _tOld);
  }

  // 2. 重绘新位置区域
  const _tNew = probe.now();
  boundary = e.data.newBoundary;
  patchPens = [];

  e.data.newPenIds?.forEach((id: string) => {
    const pen = penMap.get(id);
    pen && patchPens.push(pen);
  });

  probe.sample('patch:newIds', patchPens.length);
  if (patchPens.length) {
    renderPens(ctx, patchPens, true);
  }
  probe.time('patch:new', _tNew);
  // 1.png（按住拖动图元、在图元内松手、再移出：图元一部分是选中色、一部分还是悬停色）：
  // 悬停中的图元被这条 Patch 挪了位置，新位置是按 hoverId 画的（悬停色），可 lastHoverBoundary 还是
  // 拖动前悬停时算的旧位置 ⇒ 移出时 onHover 只擦旧框，新旧不重叠的那部分悬停色留在画布上。
  // calc 的 hoverId 没变（鼠标一直在同一个图元上）⇒ 不会再来一条 Pick 更新它，只能在这里接上：
  // 悬停色此刻只存在于刚画过的新区域里 ⇒ 下次要擦的就是这块、这批图元。
  followHover(e.data, patchPens);
  // calc 命中 reuseRegion 时 oldPensIds 与 newPenIds 是同一个数组、boundary 也相同，
  // 而上面的 update 循环已经把 pen 改成新值了 ⇒ 第 1 遍画的和第 2 遍一模一样，纯浪费。
  // 这个计数就是「白画了一整遍」的次数。
  if (probe.on && e.data.oldPensIds && e.data.oldPensIds === e.data.newPenIds) {
    probe.count('patch:samePass');
  }
  if (patchAuditLeft > 0) {
    patchAuditLeft--;
    auditPatch(e.data);
  }
}

function onDragPens(e: MessageEvent) {
  dragging = true;

  // 同步完整属性数据给其他线程
  if (e.data.sync) {
    connectedLines = e.data.connectedLines;

    const pens = [];
    for (const item of e.data.pens) {
      const pen = penMap.get(item.id);
      if (pen && !pen.locked) {
        for (const p of [pen, ...getAllChildren(penMap, pen)]) {
          // fillStyles 为渲染时临时计算的属性，可能包含 CanvasGradient/CanvasPattern，
          // 无法被 postMessage 结构化克隆，传递前需剔除（渲染时会重新计算）
          if (p.fillStyles) {
            const { fillStyles, ...rest } = p;
            pens.push(rest);
          } else {
            pens.push(p);
          }
        }
      }
    }
    self.postMessage({
      action: WorkerMessage.DragPens,
      pens,
    });
  }

  if (e.data.render) {
    dragCopy = e.data.dragCopy;
  }
}

function onImageFetched(e: MessageEvent) {
  Object.assign(images, e.data.imageMap);
}

function onGifFetched(e: MessageEvent) {
  Object.assign(gifs, e.data.gifMap);
  for (const pen of e.data.gifPens) {
    gifPlayers[pen.id] = {
      index: 0,
      lastTime: 0,
      image: pen.image,
      play: pen.play,
    };
  }

  if (!animateTimer) {
    animateTimer = requestAnimationFrame(animate);
  }
}

function onIconFetch(e: MessageEvent) {
  const { iconfonts } = e.data;
  if (iconfonts?.length) {
    loadIconfonts(iconfonts);
  }
}

async function onFontLoad(e: MessageEvent) {
  const { fontFaceCss } = e.data;
  try {
    await loadFontFaceCss(fontFaceCss);
    redrawTextAfterFontsReady();
  } catch (error) {
    console.warn('渲染线程字体加载失败，已使用回退字体', error);
  }
}

function redrawTextAfterFontsReady() {
  patchPens = [];
  for (const id of inViewPenIds) {
    const pen = penMap.get(id);
    if (!pen) {
      continue;
    }

    // 首帧可能使用了回退字体，必须清理测量结果后重新计算。
    pen.textLines = undefined;
    pen.textBox = undefined;
    pen.text && calcTextRect(pen);
    trackInkPad(pen);
    patchPens.push(pen);
  }

  resetRender();
  renderPens(ctx);
  patchPens = [];
}

function cancalAnimation() {
  if (animateTimer) {
    cancelAnimationFrame(animateTimer);
    animateTimer = null;
  }
}

function onCalcPenBoundary(e: MessageEvent) {
  inputtingPen = e.data.inputtingPen;

  drawingLine = e.data.drawingLine?.id;
  Object.assign(penBoundarys, e.data.boundarys);

  if (e.data.render) {
    for (const id in e.data.boundarys) {
      const item = e.data.boundarys[id];
      boundary = item.boundary;
      patchPens = [];
      item.penIds.forEach((id: string) => {
        const pen = penMap.get(id);
        pen &&
          pen.id !== e.data.drawingLine?.id &&
          (!e.data.drag || !activeMap || activeMap[pen.id] == undefined) &&
          patchPens.push(pen);
      });

      renderPens(ctx, patchPens, true);
    }
  }
}

function onDrawingLine(e: MessageEvent) {
  if (lastHoverPens?.length) {
    const i = lastHoverPens.findIndex((item) => item.id === e.data.pen.id);
    if (i < 0) {
      lastHoverPens.push(e.data.pen);
    } else {
      lastHoverPens[i] = e.data.pen;
    }
  }
}

/**
 * 把 `matrix` 按当前视口重建、装进 ctx，并铺上默认画笔样式。
 *
 * 从 `resetRender()` 里拆出来的**后半段** —— 唯一的区别是**不清屏**。
 * M7a（PanBlit）需要这半段：整屏自拷贝之后画面是有效的，只有新暴露的那条 L 形窄带要重画，
 * 这时候既不能整屏 `clearRect`，又必须把变换和样式恢复成绘制图元时该有的样子。
 * 见文档 §2「M7a · 平移只搬运不重算」。
 *
 * `boundary` 归零仍然留在 `resetRender()` 里 —— 它的语义是「这一遍没有裁剪区」，
 * 属于清屏那一侧；窄带路径要自己设 `boundary`，不该被这里覆盖掉。
 */
function applyTransform() {
  // 平移带上 phaseX / phaseY：画在画布像素实际所在的相位上，见 phaseX 注释
  matrix = new DOMMatrix()
    .scale(dpr)
    .translate((data.x || 0) + phaseX / dpr, (data.y || 0) + phaseY / dpr)
    .scale(data.scale || 1);
  ctx.setTransform(matrix);

  // 设置默认选项
  ctx.strokeStyle = data.color;
  if (data.lineWidth) {
    ctx.lineWidth = data.lineWidth / (data.scale || 1);
  } else {
    ctx.lineWidth = 1 / (data.scale || 1);
  }
  ctx.textBaseline = 'middle';
  // 其他默认选项设置...
}

function resetRender() {
  boundary = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);

  // 清屏后整屏重画：原点对齐到整设备像素（必须在 applyTransform 之前）。
  // 不对齐（相位取 0、画在准确位置）的话，dpr 非整数时每次全量重绘的相位 = dpr·data.x 的小数部分，
  // 随平移位置变 ⇒ 同一条细线这次实、下次虚，明暗跳变（dpr = 1 且按整数像素平移时小数部分不变，看不出来）。
  // 对齐后相位只在 ±0.5 之间、像素原点恒为整数 ⇒ 线条的明暗只取决于它在图上的位置，与平移无关。
  phaseX = Math.round(dpr * (data.x || 0)) - dpr * (data.x || 0);
  phaseY = Math.round(dpr * (data.y || 0)) - dpr * (data.y || 0);
  applyTransform();

  // M7a：清屏 ⇒「画布上现在什么都没有」，作废搬运的前提。
  // 只有真正把当前视口画完的那一方（`onUpdateView`）才有资格写回 paintedX/Y。
  //
  // 这么写是**故意保守**的：`onResize` / `onOption` / `onSetData` 也走 resetRender，
  // 它们有的会接着整屏重画、有的不会（`onSetData` 就不画），逐个去判断「画完没有」
  // 既容易漏又会随以后的改动失效。留成 NaN 的代价只是下一条视口多一次全量重绘
  // （走 `first` 分支），而漏判的代价是整屏错位 —— 两边不对称，选贵的那边。
  paintedX = NaN;
  paintedY = NaN;
}

/**
 * 一块脏区（逻辑坐标）外扩 1、对齐到整设备像素，返回逻辑坐标下的矩形与设备像素的整数边界。
 * 逐条绘制与合并绘制共用 ——
 * 边界落在同一批整像素上，多矩形裁剪才不会与逐条裁剪产生任何抗锯齿差异。
 */
function alignedClipRectSlow(b: any) {
  // 扩大1个像素，避免压在线中间
  let { x, y, width, height } = b;

  // 存在旋转时，需要使用一个未旋转的矩形包围盒
  if (b.box) {
    x = b.box.x;
    y = b.box.y;
    width = b.box.width;
    height = b.box.height;
  }
  x -= 1;
  y -= 1;
  width += 2;
  height += 2;

  // 计算屏幕像素对齐
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];

  const screenCorners = corners.map((corner) => {
    const point = new DOMPoint(corner.x, corner.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  });

  let minX = screenCorners[0].x;
  let minY = screenCorners[0].y;
  let maxX = screenCorners[0].x;
  let maxY = screenCorners[0].y;

  for (const corner of screenCorners) {
    if (corner.x < minX) minX = corner.x;
    if (corner.y < minY) minY = corner.y;
    if (corner.x > maxX) maxX = corner.x;
    if (corner.y > maxY) maxY = corner.y;
  }

  minX = Math.floor(minX);
  minY = Math.floor(minY);
  maxX = Math.ceil(maxX);
  maxY = Math.ceil(maxY);

  const inverseMatrix = matrix.inverse();
  const logicalMin = new DOMPoint(minX, minY).matrixTransform(inverseMatrix);
  const logicalMax = new DOMPoint(maxX, maxY).matrixTransform(inverseMatrix);

  return {
    x: logicalMin.x,
    y: logicalMin.y,
    width: logicalMax.x - logicalMin.x,
    height: logicalMax.y - logicalMin.y,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/**
 * alignedClipRect 的算术版，结果与 alignedClipRectSlow 逐位相同（原路每块区域要 6 次 new DOMPoint +
 * 一次 matrix.inverse()，合并绘制时这是大头，设计文档第四十七轮）。
 *
 * 视图矩阵只有缩放与平移（b = c = 0）时，DOMPoint.matrixTransform 算的是 a·x + c·y + e，c·y = 0，
 * 加 0 不改浮点结果 ⇒ 直接算 a·x + e 逐位相同；逆矩阵在视图不变时只求一次（matrix 每次都是新对象，按身份缓存）。
 * 矩阵带旋转 / 斜切 ⇒ 走原路。开探针时每 64 次顺带跑原路逐位比对（render:alignChecked / render:alignMismatch）。
 */
let _invFor: DOMMatrix | undefined;
let _inv: DOMMatrix | undefined;
let _alignTick = 0;

function alignedClipRect(b: any) {
  const m = matrix;
  if (!m || m.b !== 0 || m.c !== 0) {
    return alignedClipRectSlow(b);
  }
  if (_invFor !== m) {
    _inv = m.inverse();
    _invFor = m;
  }
  const inv = _inv!;
  if (inv.b !== 0 || inv.c !== 0) {
    return alignedClipRectSlow(b);
  }

  // 扩大1个像素，避免压在线中间（与 alignedClipRectSlow 同序）
  let x: number;
  let y: number;
  let width: number;
  let height: number;
  if (b.box) {
    x = b.box.x;
    y = b.box.y;
    width = b.box.width;
    height = b.box.height;
  } else {
    x = b.x;
    y = b.y;
    width = b.width;
    height = b.height;
  }
  x -= 1;
  y -= 1;
  width += 2;
  height += 2;

  const sx0 = m.a * x + m.e;
  const sx1 = m.a * (x + width) + m.e;
  const sy0 = m.d * y + m.f;
  const sy1 = m.d * (y + height) + m.f;
  const minX = Math.floor(sx0 < sx1 ? sx0 : sx1);
  const maxX = Math.ceil(sx0 < sx1 ? sx1 : sx0);
  const minY = Math.floor(sy0 < sy1 ? sy0 : sy1);
  const maxY = Math.ceil(sy0 < sy1 ? sy1 : sy0);

  const lx0 = inv.a * minX + inv.e;
  const ly0 = inv.d * minY + inv.f;
  const lx1 = inv.a * maxX + inv.e;
  const ly1 = inv.d * maxY + inv.f;
  const r = { x: lx0, y: ly0, width: lx1 - lx0, height: ly1 - ly0, minX, minY, maxX, maxY };

  if (probe.on && ++_alignTick % 64 === 0) {
    const ref = alignedClipRectSlow(b);
    probe.count('render:alignChecked');
    if (
      ref.x !== r.x ||
      ref.y !== r.y ||
      ref.width !== r.width ||
      ref.height !== r.height ||
      ref.minX !== minX ||
      ref.minY !== minY ||
      ref.maxX !== maxX ||
      ref.maxY !== maxY
    ) {
      probe.count('render:alignMismatch');
    }
  }
  return r;
}

/** M4 第 2 步：合并绘制期间为 true —— 外面已经设好了多矩形裁剪，renderPens 里不计 render:noClip */
let mergedClip = false;

function renderPens(ctx: OffscreenCanvasRenderingContext2D, pens: Pen[] = patchPens, clear?: boolean, bitmaps?: any) {
  if (!clear && !pens?.length) {
    return;
  }

  // 绘画图元
  options.performance && console.time('render pens');
  const _tRender = probe.now();
  // 画布尺寸必须在这里先存下来：下面 `let { x, y, width, height } = boundary` 会把
  // 模块级的 width/height（画布设备像素）遮蔽成脏区的宽高。第一版 clipPct 就是栽在
  // 这上面，分母用成了脏区自己，于是恒等于 dpr²≈417%（见文档 D7）。
  const _cw = width;
  const _ch = height;
  // 没有脏区 ⇒ 下面不设 clip，这一次是无界重绘。计次数，好和 render:clipPct 的样本数对齐。
  // 排除 M7a 快路径（`renderTag === '5b'`）：它的 boundary 是零，但 clip 已经由
  // `clipBand` 在外面设好了（L 形，单个 boundary 矩形表达不了）。不排除的话这个
  // 计数器就从「有多少次无界重绘」变成「有多少次没走 boundary 分支」，含义就废了。
  if (probe.on && pens === patchPens && renderTag !== '5b' && !mergedClip && !(boundary && boundary.width > 0)) {
    probe.count('render:noClip');
  }
  ctx.save();
  if (boundary && boundary.width > 0 && pens === patchPens) {
    // M4 第 2 步：对齐计算抽成 alignedClipRect（原样搬出），合并绘制用同一个函数 ⇒ 两条路逐像素同一块
    const r = alignedClipRect(boundary);
    const { minX, minY, maxX, maxY } = r;

    // Phase 1 的关键数：这一次重绘真正覆盖了全画布的百分之几。
    // minX..maxY 已经是设备像素（matrix 里含 dpr），与 _cw*_ch 同一量纲。
    // clipPct 取与画布的交集（0~100，真实重绘面积）；clipRaw 不裁，>100 说明脏区
    // 已经甩出视口 —— 两个数一起看才知道「局部重绘」到底局部在哪。
    if (probe.on && _cw && _ch) {
      const area = (maxX - minX) * (maxY - minY);
      const ix = Math.max(0, Math.min(maxX, _cw) - Math.max(minX, 0));
      const iy = Math.max(0, Math.min(maxY, _ch) - Math.max(minY, 0));
      probe.sample('render:clipPct', (ix * iy * 100) / (_cw * _ch));
      probe.sample('render:clipRaw', (area * 100) / (_cw * _ch));
    }

    ctx.clearRect(r.x, r.y, r.width, r.height);

    // 设置局部重绘区域
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.width, r.height);
    ctx.clip();
  }

  for (const pen of pens) {
    if (!isEffectiveVisible(pen, penMap)) {
      continue;
    }
    if (!isEffectiveShowChild(pen, penMap)) {
      continue;
    }

    if (pen.type === 'group') {
      continue;
    }

    if (pen.category === PenCategory.HtmlElement) {
      if (bitmaps && bitmaps[pen.id]) {
        ctx.drawImage(bitmaps[pen.id], pen.x, pen.y, pen.width, pen.height);
      }
      continue;
    }

    if (
      !dragCopy &&
      connectedLines?.length &&
      (connectedLines.includes(pen.id) || connectedLines.includes(pen.parentId))
    ) {
      continue;
    }

    if (drawingLine && (pen.id === drawingLine || pen.parentId === drawingLine)) {
      continue;
    }
    if (dragging && !dragCopy && activeMap && (activeMap[pen.id] || activeMap[pen.parentId])) {
      // 拖拽不绘画active图元
      continue;
    }

    ctx.save();

    pen.fillStyles = undefined;
    // 图片和 GIF 保持默认透明，只使用图元显式配置的背景及状态背景。
    const isImagePen = pen.type === 'image' || pen.type === 'gif';
    const lineGradient = pen.lineGradient || (!pen.color ? data.lineGradient : undefined);

    // 基础样式使用下面方式性能提高1倍
    if (pen.disabled) {
      ctx.strokeStyle = pen.disabledColor || pSBC(0.4, pen.color || data.color);
    } else if (pen.id === hoverId) {
      if (pen.hoverColor) {
        ctx.strokeStyle !== pen.hoverColor && (ctx.strokeStyle = pen.hoverColor);
      } else if (pen.interactive & InteractiveType.Event && ctx.strokeStyle !== data.hoverColor) {
        ctx.strokeStyle = data.hoverColor;
      } else {
        ctx.strokeStyle = pen.color || data.color;
      }

      if (pen.hoverBackground) {
        pen.fillStyles = [pen.hoverBackground];
      }
    } else if (activeMap && activeMap[pen.id] > 1) {
      if (pen.activeColor) {
        ctx.strokeStyle !== pen.activeColor && (ctx.strokeStyle = pen.activeColor);
      } else if (pen.interactive & InteractiveType.Event && ctx.strokeStyle !== data.activeColor) {
        ctx.strokeStyle = data.activeColor;
      } else {
        ctx.strokeStyle = pen.color || data.color || options.color;
      }

      if (pen.activeBackground) {
        pen.fillStyles = [pen.activeBackground];
      }
    } else if (lineGradient && pen.category !== PenCategory.Line) {
      ctx.strokeStyle = createLineGradient(ctx, pen, lineGradient);
    } else if (pen.color) {
      ctx.strokeStyle !== pen.color && (ctx.strokeStyle = pen.color);
    } else if (ctx.strokeStyle !== data.color) {
      ctx.strokeStyle = data.color || options.color;
    }
    if (pen.lineWidth) {
      if (pen.lineWidth <= 1 && ctx.lineWidth !== 1 / data.scale) {
        ctx.lineWidth = 1 / data.scale;
      } else if (ctx.lineWidth !== pen.lineWidth) {
        ctx.lineWidth = pen.lineWidth;
      }
    } else if (pen.lineWidth === 0) {
      ctx.strokeStyle = 'transparent';
    }
    if (ctx.lineCap !== pen.lineCap) {
      ctx.lineCap = pen.lineCap || 'square';
    }

    if (ctx.lineJoin !== pen.lineJoin) {
      ctx.lineJoin = pen.lineJoin || 'round';
    }

    if (pen.opacity !== undefined) {
      ctx.globalAlpha = pen.opacity ?? 1;
    }

    if (pen.shadowColor) {
      ctx.shadowColor = pen.shadowColor;
      ctx.shadowBlur = pen.shadowBlur || 0;
      ctx.shadowOffsetX = pen.shadowOffsetX || 0;
      ctx.shadowOffsetY = pen.shadowOffsetY || 0;
    }

    if (pen.lineDash) {
      ctx.setLineDash(pen.lineDash);
    }
    if (pen.flipX || pen.flipY) {
      flipRender(ctx, pen);
    }
    if (pen.rotate && pen.category !== PenCategory.Line) {
      rotateRender(ctx, pen);
    }

    if (!pen.fillStyles) {
      if (pen.disabled) {
        pen.fillStyles = [pen.disabledBackground || pSBC(0.4, pen.background) || 'transparent'];
      } else if (pen.backgrounds) {
        setBackgrounds(ctx, pen, images);
      } else if (pen.background || pen.gradient) {
        setBackground(ctx, pen, images);
      } else if (!isImagePen && data.penGradient) {
        pen.fillStyles = [createBackgroundGradient(ctx, pen, data.penGradient)];
      } else if (!isImagePen && data.penBackground) {
        pen.fillStyles = [data.penBackground];
      }
    }
    translateRect(pen, -0.5, -0.5); // 为了更好的1像素对齐
    if (penDraws[pen.type]) {
      if (pen.pathId) {
        penDraws[pen.type](ctx, pen, data.paths[pen.pathId], pathBBoxs[pen.pathId]);
      } else {
        // 对于连线类型，传递 options 和 data 以支持箭头渲染
        if (pen.category === PenCategory.Line) {
          if (pen.borderWidth) {
            ctx.save();
            ctx.strokeStyle = pen.borderColor || pen.color;
            ctx.lineWidth = pen.lineWidth + pen.borderWidth;
            penDraws[pen.type](ctx, pen, options, data);
            ctx.restore();
          }
          const useGradientLine =
            !!lineGradient?.colorStops?.length && pen.lineWidth !== 0 && !pen.disabled && pen.id !== hoverId;
          if (useGradientLine) {
            renderLineGradientPath(ctx, pen, lineGradient);
          } else {
            penDraws[pen.type](ctx, pen, options, data);
          }
          if (pen.linePosition > 0 && pen.animations.length && pen.play > PlayState.None) {
            const animation = pen.animations[pen.currentAnimation || 0]?.lineAnimation;
            if (animation.type != undefined && lineAnimationDraws[animation.type]) {
              ctx.save();
              if (animation.type === LineAnimationType.Image) {
                const image = images[animation.image];
                if (image) {
                  lineAnimationDraws[animation.type](ctx, pen, animation, image);
                }
              } else {
                lineAnimationDraws[animation.type](ctx, pen, animation);
              }
              const shouldRedrawLine =
                animation.type === LineAnimationType.Default ||
                animation.type === LineAnimationType.Beads ||
                animation.type === LineAnimationType.Dot;

              if (shouldRedrawLine) {
                penDraws[pen.type](ctx, pen, options, data);
              }
              ctx.restore();
            }
          }
        } else {
          penDraws[pen.type](ctx, pen);
        }
      }
    } else {
      if (pen.fillStyles?.length) {
        for (const bg of pen.fillStyles) {
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.rect(pen.x, pen.y, pen.width, pen.height);
          ctx.fill();
        }
      } else if (!isImagePen && !pen.text && !pen.icon && (!pen.image || (!images[pen.image] && !gifs[pen.image]))) {
        // 图片加载前或加载失败时保持透明，其他未注册图元仍使用默认占位背景。
        ctx.fillStyle = data.unknowBackground || '#d9d9d960';
        ctx.beginPath();
        ctx.rect(pen.x, pen.y, pen.width, pen.height);
        ctx.fill();
      }

      if (pen.id === hoverId) {
        // 绘画边界盒子
        ctx.strokeRect(pen.x, pen.y, pen.width, pen.height);
      }
    }

    if (pen.progress && !isNaN(pen.progress)) {
      let progress = pen.progress;
      const progressMin = pen.progressMin || 0;
      const progressMax = pen.progressMax || 1;

      progress = (progress - progressMin) / (progressMax - progressMin);
      progress = Math.max(0, Math.min(1, progress));

      if (pen.progressColors && pen.progressColors.length) {
        for (const progressColor of pen.progressColors) {
          let grd = null;

          if (pen.verticalProgress) {
            grd = pen.reverseProgress
              ? ctx.createLinearGradient(pen.x, pen.y, pen.x, pen.y + pen.height * progress)
              : ctx.createLinearGradient(pen.x, pen.ey, pen.x, pen.ey - pen.height * progress);
          } else {
            grd = pen.reverseProgress
              ? ctx.createLinearGradient(pen.ex, pen.y, pen.ex - pen.width * progress, pen.y)
              : ctx.createLinearGradient(pen.x, pen.y, pen.x + pen.width * progress, pen.y);
          }

          if (progressColor.type === ColorType.LinearGradient && progressColor.gradient) {
            for (const colorStop of progressColor.gradient.colorStops) {
              grd.addColorStop(colorStop.i, colorStop.color);
            }
          } else {
            const color = progressColor.color || data.color;
            grd.addColorStop(0, color);
            grd.addColorStop(1, color);
          }

          // 最后添加透明色阶实现进度效果
          grd.addColorStop(1, 'transparent');
          ctx.fillStyle = grd;
          ctx.fill();
        }
      }
    }

    if (pen.image) {
      if (images[pen.image]) {
        renderImage(ctx, pen, images[pen.image]);
      }

      const gifFrames = gifs[pen.image];
      const gifPlayer = gifPlayers[pen.id];
      const gifFrame = gifFrames?.[gifPlayer?.index];
      if (gifFrames && gifPlayer && gifFrame?.imageBitmap) {
        renderImage(ctx, pen, gifFrames[gifPlayer.index].imageBitmap);
      }
    }

    if (pen.icon) {
      renderIcon(ctx, pen);
    }

    if (pen.textVisible != false && pen.text && pen.id !== inputtingPen) {
      renderText(ctx, pen);
    }
    translateRect(pen, 0.5, 0.5);

    ctx.restore();
  }

  ctx.restore();

  if (Object.keys(textOutsides).length && pens === patchPens) {
    self.postMessage({
      action: WorkerMessage.TextOutside,
      textOutsides,
    });
    textOutsides = {};
  }
  // 画布重绘与导出（onToPng 传的是自己的离屏 ctx）分开统计，别混进同一个均值里；
  // 画布重绘再按触发它的 action 分组（见 renderTag），否则动画与全量重绘混在一起，
  // 均值谁也不代表。penCount 同理 —— 动画路径 p50=4，视口路径 ~14000。
  probe.time(pens === patchPens ? 'render:pens:' + renderTag : 'render:export', _tRender);
  probe.sample(pens === patchPens ? 'render:penCount:' + renderTag : 'render:penCount', pens.length);
  options.performance && console.timeEnd('render pens');
}

function clipRoundRect(ctx: OffscreenCanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));

  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(rect.ex - r, rect.y);
  ctx.quadraticCurveTo(rect.ex, rect.y, rect.ex, rect.y + r);
  ctx.lineTo(rect.ex, rect.ey - r);
  ctx.quadraticCurveTo(rect.ex, rect.ey, rect.ex - r, rect.ey);
  ctx.lineTo(rect.x + r, rect.ey);
  ctx.quadraticCurveTo(rect.x, rect.ey, rect.x, rect.ey - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
  ctx.clip();
}

export function renderImage(ctx: OffscreenCanvasRenderingContext2D, pen: Pen, image: CanvasImageSource) {
  if (!image) {
    return;
  }
  const rect = calcImageRect(pen, image);
  ctx.save();
  if (pen.imageRadius) {
    clipRoundRect(ctx, rect, pen.imageRadius);
  }
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

export function renderIcon(ctx: OffscreenCanvasRenderingContext2D, pen: Pen) {
  const rect = calcIconRect(pen);
  const size = pen.iconSize || Math.min(rect.width, rect.height);

  let fill: string;

  if (pen.disabled) {
    fill = pen.disabledTextColor || pen.disabledColor || pSBC(0.4, pen.iconColor);
  } else {
    fill = pen.iconColor || pen.textColor || pen.color || data.textColor || data.color || options.color;
  }

  ctx.save();
  ctx.font = `${pen.iconWeight || 'normal'} ${size}px ${pen.iconFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pen.iconGradient
    ? createGradient(ctx, rect.x, rect.y, rect.width, rect.height, pen.iconGradient)
    : fill;

  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  ctx.fillText(pen.icon, x, y);
  ctx.restore();
}

/** 探针：上一趟 gif 换帧的时间 */
let lastGifTick = 0;

function animate() {
  if (destoryed) {
    return;
  }

  const now = performance.now();
  const penList: Pen[] = [];
  // 与 calc 动画批次同一套合并（drawMergedAnim）：这一趟所有换帧 gif 的区域并起来只画一次。
  // 原来逐个 gif 各画一遍，每一遍都把压在下面的整页背景、大包围盒的渐变连线重画一次 ——
  // 示例2 有 51 个 gif，这条循环占了 render worker 一半的忙碌时间。animMerge: false 退回逐个画。
  const merge = options.animMerge !== false;
  const mergedPens = new Map<string, Pen>();
  const mergedRects: any[] = [];

  if (now - lastAnimate > options.animateInterval) {
    lastAnimate = now;
    // gif 换帧这条 rAF 循环不经过 onmessage，handle:* 量不到 ⇒ 单独记 gif:loop
    const _tGif = probe.now();
    probe.on && probe.sample('gif:players', Object.keys(gifPlayers).length);
    if (probe.on && lastGifTick) {
      // 两趟之间隔了多久：消息处理把 rAF 挤掉时会变大
      probe.sample('gif:tickGap', now - lastGifTick);
    }
    lastGifTick = now;

    for (const id in gifPlayers) {
      if (!gifPlayers[id].play) {
        continue;
      }

      const player = gifPlayers[id];
      const gifFrames = gifs[player.image];
      if (!gifFrames || !gifFrames.length) {
        continue;
      }

      if (player.duration == undefined) {
        player.duration = gifFrames[player.index].duration;
      }

      if (now - player.lastTime >= player.duration) {
        player.index = (player.index + 1) % gifFrames.length;
        player.duration = gifFrames[player.index].duration;
        player.lastTime = now;

        const item = penBoundarys[id];
        if (item && merge && item.boundary && item.boundary.width > 0) {
          for (const penId of item.penIds) {
            const pen = penMap.get(penId);
            pen && !mergedPens.has(penId) && mergedPens.set(penId, pen);
          }
          mergedRects.push(alignedClipRect(item.boundary));
        } else if (item) {
          penList.length = 0;
          boundary = item.boundary;
          item.penIds.forEach((id: string) => {
            const pen = penMap.get(id);
            pen && penList.push(pen);
          });

          if (penList.length) {
            patchPens = penList;
            renderPens(ctx);
          }
        }
      }
    }

    if (mergedPens.size) {
      drawMergedAnim(
        [...mergedPens.values()].sort((a, b) => a.index - b.index),
        mergedRects,
        'gif',
      );
    }
    probe.on && probe.sample('gif:changed', mergedRects.length);
    probe.time('gif:loop', _tGif);
  }

  // 与 calc 的动画循环同理：新 id 必须记回 animateTimer，否则 cancalAnimation 停不掉这条循环，
  // 下一次 onGifFetched 还会再叠一条。已被取消（null）就不再续排。
  if (animateTimer) {
    animateTimer = requestAnimationFrame(animate);
  }
}

/**
 * 量出文字行与实际文字框（pen.textLines / pen.textBox），并把外溢情况记进 textOutsides，
 * 随下一次 renderPens 发给主线程 / calc（calc 靠它知道文字伸出图元多远，算脏区、找邻居都用）。
 * 调用前 ctx.font 必须已经是这个图元的字体。
 */
function measureTextBox(ctx: OffscreenCanvasRenderingContext2D, pen: Pen) {
  calcTextLines(ctx, pen);

  // 判断文字是否超出pen范围，然后通知pick更新文字范围
  if (pen.textBox.x < pen.x || pen.textBox.y < pen.y || pen.textBox.ex > pen.ex || pen.textBox.ey > pen.ey) {
    pen.textBox.rotate = pen.rotate;
    pen.textBox.pivot = pen.pivot;

    textOutsides[pen.id] = pen.textBox;
  } else {
    textOutsides[pen.id] = { _rect: undefined };
  }
  // 这里是 `pen.textBox` 唯一的产地（calcTextLines 实测出来的）。在此之前 `inkBox`
  // 只能按 text.length × fontSize 估外溢，现在有实测值了，把余量重算一次。
  trackInkPad(pen);
}

export function renderText(ctx: OffscreenCanvasRenderingContext2D, pen: Pen) {
  if (!pen.textShadow) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else {
    ctx.shadowBlur = pen.textShadowBlur || pen.shadowBlur || 0;
    ctx.shadowOffsetX = pen.textShadowOffsetX || pen.shadowOffsetX || 0;
    ctx.shadowOffsetY = pen.textShadowOffsetY || pen.shadowOffsetY || 0;
    ctx.shadowColor = pen.textShadowColor || pen.shadowColor;
  }

  ctx.save();
  ctx.font = getFont(pen, data);
  if (!pen.textLines) {
    measureTextBox(ctx, pen);
  }
  if (!pen.textLines?.length) {
    ctx.restore();
    return;
  }

  // 绘画文字
  let fill: string;
  if (pen.disabled) {
    fill =
      pen.disabledTextColor ||
      pen.disabledColor ||
      pSBC(0.4, pen.textColor || pen.color || data.textColor || data.color || options.color);
  } else if (pen.textHoverColor && pen.id === hoverId) {
    fill = pen.textHoverColor;
  } else if (pen.textActiveColor && activeMap && activeMap[pen.id] > 1) {
    fill = pen.textActiveColor;
  }

  let gradient: CanvasGradient;
  if (!fill) {
    if (pen.textGradient) {
      gradient = createTextGradient(ctx, pen, pen.textGradient);
    } else if (!pen.textColor && !pen.color && data.textGradient) {
      gradient = createTextGradient(ctx, pen, data.textGradient);
    } else {
      fill = pen.textColor || pen.color || data.textColor || data.color || options.color;
    }
  }
  ctx.fillStyle = fill || gradient;
  ctx.strokeStyle =
    pen.textDecorationColor || pen.textColor || pen.color || data.textColor || data.color || options.color;
  ctx.lineWidth = 1;

  const rowHeight = ((pen.fontSize || 12) * (pen.lineHeight || 1.5)) / 2;
  pen.textLines.forEach((item) => {
    // 绘画文字背景
    if (pen.textBackground) {
      ctx.fillStyle = pen.textBackground;
      ctx.fillRect(item.x, item.y - item.textHeight / 2 + rowHeight, item.textWidth, item.textHeight + 0.5);
      ctx.fillStyle = fill || gradient;
    }

    // 绘画文字
    if (pen.letterSpacing) {
      let w = 0;
      for (let i = 0; i < item.text.length; i++) {
        ctx.fillText(item.text[i], item.x + w, item.y + rowHeight);
        w += ctx.measureText(item.text[i]).width + pen.letterSpacing;
      }
    } else {
      ctx.fillText(item.text, item.x, item.y + rowHeight);
    }

    // 下划线或删除线
    if (pen.textDecoration) {
      let y = item.y + rowHeight;
      if (pen.textDecoration === TextDecoration.LineThrough) {
        y -= item.textHeight / 10;
      } else {
        y += item.textHeight / 2 - 3;
      }

      pen.textDecorationDash && ctx.setLineDash(pen.textDecorationDash);
      ctx.beginPath();
      ctx.moveTo(item.x, y);
      ctx.lineTo(item.ex, y);
      ctx.stroke();
    }
  });
  ctx.restore();
}

async function onMagnifier(e: MessageEvent) {
  const { x, y, radius, offsetX, offsetY } = e.data;
  // getImageData 不受变换矩阵影响，需要把 CSS 像素坐标换算为画布实际像素。
  const sourceSize = Math.round(radius * dpr);
  const halfSourceSize = sourceSize / 2;
  const imageData = ctx.getImageData(
    Math.round(offsetX * dpr - halfSourceSize),
    Math.round(offsetY * dpr - halfSourceSize),
    sourceSize,
    sourceSize,
  );
  const bitmap = await createImageBitmap(imageData);
  self.postMessage(
    {
      action: WorkerMessage.Magnifier,
      x,
      y,
      radius,
      imageBitmap: bitmap,
    },
    [bitmap],
  );
}

async function onToPng(e: MessageEvent) {
  const params = e.data.params || { padding: 2 };
  const pens: Pen[] = [];
  const points: Point[] = [];
  if (params.pens?.length) {
    let pen: Pen;
    for (const id of params.pens) {
      pen = penMap.get(id);
      if (!pen) continue;

      pens.push(pen);
      const pts = rectToPoints(pen);
      points.push(...pts);

      if (pen.textBox) {
        const pts = rectToPoints(pen.textBox);
        points.push(...pts);
      }
    }
  } else {
    for (const value of penMap.values()) {
      pens.push(value);
      const pts = rectToPoints(value);
      points.push(...pts);

      if (value.textBox) {
        const pts = rectToPoints(value.textBox);
        points.push(...pts);
      }
    }
  }
  let rect: Rect;
  if (data.width && data.height) {
    // 固定尺寸画布始终导出完整画布，避免鹰眼或下载图片只包含局部图元。
    rect = {
      x: 0,
      y: 0,
      width: data.width,
      height: data.height,
      ex: data.width,
      ey: data.height,
    };
  } else {
    rect = getRectOfPoints(points);
  }
  // padding 沿用原有接口语义，在画布或图元基础区域之外继续扩展。
  expandRect(rect, params.padding);

  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    self.postMessage({
      action: WorkerMessage.ToPng,
      requestId: params.requestId,
      error: '图片导出区域无效。宽高必须是大于0的有限数值',
    });
    return;
  }

  let scale = 1;
  params.maxWidth = params.maxWidth || 1920;
  if (rect.width > params.maxWidth) {
    scale = params.maxWidth / rect.width;
  }
  const width = rect.width * scale;
  const height = rect.height * scale;
  if (width > 32767 || height > 32767 || height * width > 268435456) {
    self.postMessage({
      action: WorkerMessage.ToPng,
      requestId: params.requestId,
      error: '图片尺寸过大。宽高不能超过32767像素，并且宽*高不能超过268435456像素',
    });
    return;
  }

  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');

  matrix = new DOMMatrix().translate(-rect.x, -rect.y).scale(scale);
  ctx.setTransform(matrix);

  // 设置默认选项
  ctx.strokeStyle = options.color;
  if (data.lineWidth) {
    ctx.lineWidth = data.lineWidth / (scale || 1);
  } else {
    ctx.lineWidth = 1 / (scale || 1);
  }
  ctx.textBaseline = 'middle';

  if (params.backgroundImage && data.backgroundImage) {
    const imageBitmap = await fetchImage(data.backgroundImage);
    if (imageBitmap) {
      ctx.drawImage(imageBitmap, rect.x, rect.y, rect.width, rect.height);
    }
  } else if (data.width && data.height && data.backgroundGradient) {
    ctx.fillStyle = createGradient(ctx, rect.x, rect.y, rect.width, rect.height, data.backgroundGradient);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  } else if (data.background) {
    ctx.fillStyle = data.background;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  renderPens(ctx, pens, undefined, e.data.imgMap);

  const blob: Blob = await offscreen.convertToBlob({ type: 'image/png' });
  const buffer: ArrayBuffer = await blob.arrayBuffer();
  self.postMessage({ action: WorkerMessage.ToPng, requestId: params.requestId, buffer }, [buffer]);
}

function onRenderAnimation(e: MessageEvent) {
  try {
    renderAnimationMessage(e);
  } finally {
    // 动画背压：画完（或出错）都要回执，否则 calc 要等 1s 超时才发下一批
    e.data.animSeq != undefined && self.postMessage({ action: WorkerMessage.AnimRendered, seq: e.data.animSeq });
  }
}

function renderAnimationMessage(e: MessageEvent) {
  // M4 第 1 步：一帧合成一条时逐条照原样处理 —— 每条仍按自己的区域重画，与逐条消息完全相同
  if (e.data.batch) {
    const batch = e.data.batch;
    if (probe.on) {
      e.data.sentAt && probe.sample('anim:lag', Date.now() - e.data.sentAt);
      probe.sample('anim:batchItems', batch.length);
    }
    // 有任何一条带图元却没有有效区域（原来的逻辑是不裁剪直接画）⇒ 整批退回逐条
    const mergeable = batch.every((it: any) => !it.penIds?.length || (it.boundary && it.boundary.width > 0));
    // 审计与「要不要合并」无关：只要能合并就能比
    if (mergeable && animAuditLeft > 0) {
      animAuditLeft--;
      auditAnimBatch(batch);
      return;
    }
    // 第四十三轮审计出过不一致 ⇒ 一度默认关；第四十五轮复现后查明差异来自原逐条路径自己的残影 / 空洞，
    // 第四十六轮加第三方参照 T（render 自己的几何扫全部图元、按当前状态画）后，5 帧合并路径 = T 逐像素一致，
    // 原逐条路径 3 帧与 T 不一致 ⇒ 改回默认开。animMerge: false 仍可退回逐条。
    if (mergeable && options.animMerge !== false) {
      const { list, rects } = collectAnimBatch(batch, true);
      drawMergedAnim(list, rects);
      return;
    }
    for (const item of batch) {
      renderAnimationItem(item);
    }
    return;
  }
  renderAnimationItem(e.data);
}

/** 原来的逐条路径：应用这一条的属性，再按这一条自己的区域重画 */
function renderAnimationItem(data: any) {
  const pens = applyAnimationItem(data);
  if (!pens) {
    return;
  }
  patchPens = pens;
  boundary = data.boundary;
  renderPens(ctx);
}

/**
 * 一帧的动画更新合并成一次绘制（M4）。
 * apply = true 时逐条应用属性（与逐条路径同一段代码）；false 时只收集（审计里属性已由逐条路径应用过）。
 * 返回去重、按层级排序后的图元，以及每条更新对齐后的区域。
 */
function collectAnimBatch(batch: any[], apply: boolean) {
  const rects: any[] = [];
  const union = new Map<string, Pen>();
  for (const item of batch) {
    if (!item.penIds?.length) {
      // calc 判在视口外的（cull）：只应用属性，不画
      apply && item.cull && applyAnimationItem(item);
      continue;
    }
    const pens = apply
      ? applyAnimationItem(item)
      : (item.penIds.map((id: string) => penMap.get(id)).filter(Boolean) as Pen[]);
    if (!pens) {
      continue;
    }
    for (const p of pens) {
      union.has(p.id) || union.set(p.id, p);
    }
    rects.push(alignedClipRect(item.boundary));
  }
  const list = [...union.values()].sort((a, b) => a.index - b.index);
  return { list, rects };
}

/**
 * 正确性（推理，由 animAudit 逐像素证实）：逐条画时后一块区域会擦掉并重画与前一块重叠的部分，
 * 而重叠处的图元两块的清单里都有（清单按区域 ±2 查、裁剪只外扩 1 再对齐）⇒ 每个像素的终态都是
 * 「所有碰到它的图元按层级各画一次」—— 与这里一次清空、按层级每个图元画一次相同。
 */
/**
 * 把若干块对齐过的区域（`alignedClipRect` 的结果，取其整数设备像素边界 minX..maxY）
 * 合并成**两两不相交**的设备像素矩形，覆盖的像素集合与原来的并集逐像素相同。
 * 结果平铺在 `out` 里：`[x, y, w, h, ...]`，返回矩形个数。
 *
 * 为什么要合并：缩小时（scale 0.1）几百块脏区在屏幕上大量重叠，原样塞进一条路径再 `clip()`，
 * 得到的是一条自相交的复杂路径 —— Skia 在 GPU 进程里光栅化它非常贵，GPU 主线程跑满，
 * 帧率掉到 40 左右，而 worker 的 JS 并不忙。不相交的整像素矩形裁剪几乎不花钱。
 *
 * 扫描线：按 y 切成水平带，每条带内把盖住它的区域的 x 区间合并；相邻两条带的区间完全相同就纵向并成一块。
 */
const clipEdges: number[] = [];
const clipActive: any[] = [];
const clipSpans: number[] = [];
const clipOpen: number[] = []; // 上一条带还开着的矩形在 out 里的下标（与 clipSpans 一一对应）
let clipPrevSpans: number[] = [];
let clipPrevOpen: number[] = [];

function disjointDevRects(rects: any[], out: number[]): number {
  out.length = 0;
  clipEdges.length = 0;
  for (const r of rects) {
    clipEdges.push(r.minY, r.maxY);
  }
  clipEdges.sort((a, b) => a - b);
  const sorted = rects.slice().sort((a, b) => a.minY - b.minY);
  let next = 0;
  clipActive.length = 0;
  clipPrevSpans.length = 0;
  clipPrevOpen.length = 0;
  let count = 0;
  for (let e = 0; e < clipEdges.length - 1; e++) {
    const y0 = clipEdges[e];
    const y1 = clipEdges[e + 1];
    if (y0 === y1) {
      continue;
    }
    while (next < sorted.length && sorted[next].minY <= y0) {
      clipActive.push(sorted[next++]);
    }
    // 移除已经结束的
    let k = 0;
    for (let i = 0; i < clipActive.length; i++) {
      if (clipActive[i].maxY > y0) {
        clipActive[k++] = clipActive[i];
      }
    }
    clipActive.length = k;

    // 这条带内的 x 区间合并
    clipActive.sort((a, b) => a.minX - b.minX);
    clipSpans.length = 0;
    for (const r of clipActive) {
      const n = clipSpans.length;
      if (n && r.minX <= clipSpans[n - 1]) {
        if (r.maxX > clipSpans[n - 1]) {
          clipSpans[n - 1] = r.maxX;
        }
      } else {
        clipSpans.push(r.minX, r.maxX);
      }
    }

    // 区间与上一条带完全相同（且上下相接）⇒ 纵向延长，否则新开
    clipOpen.length = 0;
    const same =
      clipPrevSpans.length === clipSpans.length &&
      clipPrevOpen.length &&
      out[(clipPrevOpen[0] << 2) + 1] + out[(clipPrevOpen[0] << 2) + 3] === y0 &&
      clipSpans.every((v, i) => v === clipPrevSpans[i]);
    for (let i = 0; i < clipSpans.length; i += 2) {
      if (same) {
        const j = clipPrevOpen[i >> 1];
        out[(j << 2) + 3] = y1 - out[(j << 2) + 1];
        clipOpen.push(j);
      } else {
        out.push(clipSpans[i], y0, clipSpans[i + 1] - clipSpans[i], y1 - y0);
        clipOpen.push(count++);
      }
    }
    clipPrevSpans = clipSpans.slice();
    clipPrevOpen = clipOpen.slice();
  }
  return count;
}

const mergedClipRects: number[] = [];

function drawMergedAnim(list: Pen[], rects: any[], tag = '48m') {
  if (!rects.length) {
    return;
  }
  // 与 Patch 同一套视口裁剪：整块在画布外的块、墨迹整个在画布外的图元画了也被裁掉，CPU 却一分不少
  // （大图只看一角时，一批 715 块里只有 27 块、3879 个图元里只有 137 个在画布里）
  if (options.animViewportCull !== false) {
    const n0 = rects.length;
    rects = visibleClipRects(rects);
    probe.on && probe.count('anim:rectsCulled', n0 - rects.length);
    if (!rects.length) {
      return;
    }
    list = visiblePens(list);
  }
  const _prevTag = renderTag;
  const _prevBoundary = boundary;
  renderTag = tag;
  ctx.save();
  ctx.beginPath();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.width);
    y1 = Math.max(y1, r.y + r.height);
  }
  if (probe.on) {
    // 裁剪后实际要画多少块 / 多少个图元
    probe.sample('merged:' + tag + ':rects', rects.length);
    probe.sample('merged:' + tag + ':pens', list.length);
  }
  // 裁剪路径在设备像素空间里建（边界都是整数），用合并后互不相交的矩形，见 disjointDevRects
  const n = disjointDevRects(rects, mergedClipRects);
  const _ctm = ctx.getTransform();
  ctx.resetTransform();
  for (let i = 0; i < n; i++) {
    const j = i << 2;
    ctx.rect(mergedClipRects[j], mergedClipRects[j + 1], mergedClipRects[j + 2], mergedClipRects[j + 3]);
  }
  ctx.clip();
  ctx.setTransform(_ctm);
  // clearRect 受裁剪约束 ⇒ 一次清掉的正好是 400 块区域的并集
  ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
  boundary = undefined;
  patchPens = list;
  mergedClip = true;
  renderPens(ctx);
  mergedClip = false;
  ctx.restore();
  boundary = _prevBoundary;
  renderTag = _prevTag;
}

/** 把一条动画更新的属性应用到 render 的图元上；返回这一条要重画的图元（无 penIds 返回 undefined） */
function applyAnimationItem(data: any): Pen[] | undefined {
  const { penIds, changedProperties } = data;

  // cull：calc 判这一条整个在视口外，没算重绘区 ⇒ 只把属性应用到图元上（几何要跟上，进视口后才擦得对），不画
  const ids: string[] | undefined = penIds?.length
    ? penIds
    : data.cull && changedProperties
      ? Object.keys(changedProperties)
      : undefined;
  if (!ids) {
    return undefined;
  }

  // 设置需要重绘的区域和图元列表
  const itemPens: Pen[] = [];
  ids.forEach((id: string) => {
    const pen = penMap.get(id);
    if (!pen) return;
    if (changedProperties && changedProperties[id]) {
      // 与 calc 那处同一个坑（第六十四轮）：`x ?? y` 在坐标恰好为 0 时为假 ⇒ 文字框那一帧不跟着走
      if (changedProperties[id].x != undefined || changedProperties[id].y != undefined) {
        if (pen.textBox) {
          const x = (changedProperties[id].x ?? pen.x) - pen.x;
          const y = (changedProperties[id].y ?? pen.y) - pen.y;
          pen.textBox.x += x;
          pen.textBox.y += y;

          const w = (changedProperties[id].width ?? pen.width) - pen.width;
          const h = (changedProperties[id].height ?? pen.height) - pen.height;

          if (w || h) {
            pen.textBox.width += w;
            pen.textBox.height += h;
            Object.assign(pen, changedProperties[id]);
            calcTextRect(pen);
            pen.textLines = null;
          } else {
            pen.textLines.forEach((line) => {
              line.x += x;
              line.y += y;
            });
          }
        }
      }
      if (changedProperties[id].text) {
        pen.textLines = null;
        if (!pen.textRectX || !pen.textRectY) {
          calcTextRect(pen);
        }
      }

      Object.assign(pen, changedProperties[id]);
      // 动画能改 lineWidth / rotate / shadow* / 文字 ⇒ 墨迹余量跟着变。
      // 每帧每个动画图元一次 inkBox（400 个 ≈ 20µs/帧），是 M7a 快路径正确性的租金。
      trackInkPad(pen);
    }
    itemPens.push(pen);
  });
  return penIds?.length ? itemPens : undefined;
}

function onUpdateAnimateState(e: MessageEvent) {
  const { penIds, state } = e.data;
  penIds.forEach((id: string) => {
    const pen = penMap.get(id);
    if (!pen) return;
    pen.play = state;
  });
  // 动画停止后的重绘由 calc 的 onStopAnimate 发 RenderAnimation 完成（带区域，先清后画）。
  // 这里不能直接 renderPens(ctx)：patchPens / boundary 是上一次绘制留下的，boundary 常为空或是别处的区域 ⇒
  // 不清屏叠画，半透明连线变深且整条颜色不一致。
}

function onDestory(e: MessageEvent) {
  ctx = null;
  penDraws = null;
  data = null;
  penMap = null;
  images = null;
  gifs = null;
  penBoundarys = null;
  patchPens = null;
  boundary = null;

  gifPlayers = null;

  lastHoverPens = null;
  lastHoverBoundary = null;
  lastInActivePens = null;
  lastActiveBoundary = null;

  destoryed = true;

  self.close();
}

// ============================================================================
// 逐像素审计（排查画面正确性的工具）
//
// 下面五个函数只在对应开关打开时运行，正常绘制不经过这里：
// - auditPixels：平移快路径 vs 全量重绘（options.pixelAudit，见设计文档 M7a）
// - auditPatch：Patch 局部重绘 vs 按当前状态重画（options.patchAudit）
// - auditAnimBatch / diagnoseAnimAudit：动画合并绘制 vs 逐条绘制（options.animAudit）
// - auditCanvas：整张画布 vs 按当前状态重画（getPerfReport({ canvasAudit: true })）
// 它们读写上面的模块状态，所以留在同一个文件里；放在末尾只是为了不打断主流程。
// ============================================================================

/** 还剩几条视口要审计。`options.pixelAudit` 每次置位都重新装填，见 `onOption`。 */
let auditLeft = 0;

let patchAuditLeft = 0;
let patchAuditSeen = 0;
let patchAuditBad = 0;

let animAuditLeft = 0;
let animAuditLogged = 0;

/**
 * 整张主画布 vs「按当前状态完整重画」逐像素比（getPerfReport({ canvasAudit: true })）：
 * 差异正好落在那块矩形上 ⇒ 它在主画布上（同时报出附近的图元与 render 的悬停 / 选中状态）；整屏一致 ⇒ 它在 hover 层。
 * 比完画布留下完整重画的结果。
 */
function auditCanvas() {
  if (!(width > 0 && height > 0) || !matrix) {
    return { error: 'no canvas' };
  }
  const s = ctx.getImageData(0, 0, width, height).data;
  const inv = matrix.inverse();
  const lx0 = inv.a * 0 + inv.e;
  const ly0 = inv.d * 0 + inv.f;
  const lx1 = inv.a * width + inv.e;
  const ly1 = inv.d * height + inv.f;
  const rect = { x: lx0, y: ly0, width: lx1 - lx0, height: ly1 - ly0, minX: 0, minY: 0, maxX: width, maxY: height };
  const truth: Pen[] = [];
  for (const [, pen] of penMap) {
    inkBox(pen);
    if (!(ink2 < rect.x || ink0 > rect.x + rect.width || ink3 < rect.y || ink1 > rect.y + rect.height)) {
      truth.push(pen);
    }
  }
  truth.sort((p1, p2) => p1.index - p2.index);
  drawMergedAnim(truth, [rect]);
  const t = ctx.getImageData(0, 0, width, height).data;

  // 差异像素：总数、外接框，以及按 32×32 分块聚成的前几块（一块残影通常是一个紧凑的块）
  let px = 0;
  let maxD = 0;
  let wx = -1;
  let wy = -1;
  const cells = new Map<number, number>();
  const cols = Math.ceil(width / 32);
  for (let i = 0, n = 0; i < s.length; i += 4, n++) {
    const d = Math.max(Math.abs(s[i] - t[i]), Math.abs(s[i + 1] - t[i + 1]), Math.abs(s[i + 2] - t[i + 2]), Math.abs(s[i + 3] - t[i + 3]));
    if (!d) {
      continue;
    }
    px++;
    const X = n % width;
    const Y = Math.floor(n / width);
    if (d > maxD) {
      maxD = d;
      wx = X;
      wy = Y;
    }
    const key = Math.floor(Y / 32) * cols + Math.floor(X / 32);
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  const blocks = [...cells.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, n]) => ({ x: (key % cols) * 32, y: Math.floor(key / cols) * 32, px: n }));
  const res: any = {
    px,
    maxD,
    canvas: { w: width, h: height },
    truthPens: truth.length,
    blocks,
    hoverId,
    lastHoverPens: lastHoverPens?.map((p: Pen) => p.id),
    lastHoverBoundary,
    lastActiveBoundary,
    lastInActivePens: lastInActivePens?.map((p: Pen) => p.id),
    dragging,
  };
  if (px) {
    const k = (wy * width + wx) * 4;
    const near: any[] = [];
    for (const pen of truth) {
      inkBox(pen);
      const X0 = ink0 * matrix.a + matrix.e;
      const X1 = ink2 * matrix.a + matrix.e;
      const Y0 = ink1 * matrix.d + matrix.f;
      const Y1 = ink3 * matrix.d + matrix.f;
      if (wx >= X0 - 40 && wx <= X1 + 40 && wy >= Y0 - 40 && wy <= Y1 + 40) {
        near.length < 8 &&
          near.push({
            id: pen.id,
            type: pen.type,
            index: pen.index,
            box: [Math.round(X0), Math.round(Y0), Math.round(X1), Math.round(Y1)],
            hover: pen.id === hoverId,
            active: activeMap ? activeMap[pen.id] : undefined,
            rotate: pen.rotate,
          });
      }
    }
    res.worst = { x: wx, y: wy, onCanvas: [s[k], s[k + 1], s[k + 2], s[k + 3]], truth: [t[k], t[k + 1], t[k + 2], t[k + 3]], nearPens: near };
  }
  console.info('[canvasAudit] ' + JSON.stringify(res));
  return res;
}

/**
 * 像素审计：**快路径画出来的像素 vs 慢路径基准，逐像素比**（`options.pixelAudit`）。
 *
 * 这是 M7a 第 5 步唯一可能的判据。墨迹算少了的后果是几个像素残缺，而**这在所有性能
 * 读数里都是正常的**（`bandPct` / `pens:5b` 单价一切正常，D16 就是这么躲过一整轮的，
 * 结论 27）。第十六轮正是靠它量出「五类墨迹全脏、窄带外占 35%~93%」（结论 34），
 * 第 5 步的 `inkBox` 五条分支与「窄带向内加宽 pad」两件事都是这份读数点的题。
 *
 * 三件事写在这里而不是分开量：
 * - **差异落在重画区内还是重画区外**，是唯一能把两类缺陷分开的信号：
 *   区**内**的差异 = 该画的没画（`inkBox` 漏算 / `selectBandPens` 漏选）；
 *   区**外**的差异 = 要么 pad 不够宽（贴着内边）、要么搬运本身错了（blit 偏移、
 *   CTM 残留、接缝取整），量级完全不同的几个 bug，靠 `audit:oBox*` 的位置分开。
 * - **`skip` 那一档也审计**：它的主张是「像素已经是对的，一笔都不用画」（第 4.5 步）。
 *   这个主张同样只能用像素证。`skip` 的窄带是空的 ⇒ 它的差异全部记在「窄带外」。
 * - **差异的包围盒**：残缺是集中在前沿一条线上（接缝/取整）还是散落在各处（漏选图元），
 *   看一眼盒子的宽高就分得开。
 *
 * ⚠ 四个必须：① 基准那一遍全量重绘用 `renderTag = 'audit'` 单独分群 ——
 * 混进 `render:pens:5` 就把全量单价（D12 的那把标尺）污染了；② 审计**留下正确的画面**，
 * 因为基准是最后画的；③ 三份像素**必须用同一种方式捕获**（都走 `ctx.getImageData` 直读），
 * 否则捕获方式自己的差会被读成被测物的缺陷，而噪声底看不见它 —— 见函数体里 D23 那段；
 * ④ 这函数每条要读三次整屏 ImageData（dpr=2 时 3×26.6MB）+ 重画两遍全量
 * （噪声底非 0 的条再加一遍一读），快慢差两个数量级 ⇒ **不能与任何性能采样同场跑**，
 * `pixelAudit` 默认 0。
 *
 * 读这里的读数有个顺序，别跳：**先看 `audit:selfPx`**（尺子稳不稳），
 * 再看 `audit:selfBlit`（搬运这个原语有没有损），最后才轮到 `audit:diffPx` 那一族。
 * 尺子在抖的时候，被测物的读数一个字都不能信。
 */
function auditPixels() {
  auditLeft--;
  const _t = probe.now();
  const tag = lastFast || 'none';

  // **两路捕获必须走同一条路**（D23，第 5.1 步的读数逼出来的）。
  // 这里原先是 `drawImage(ctx.canvas)` 搬到一张 OffscreenCanvas 上再 `getImageData`，
  // 而基准那两遍是直接 `ctx.getImageData` —— 多出来的那次画布间拷贝对**半透明像素**
  // 不是无损的（画布存的是预乘 alpha 的 8 位值，`getImageData` 要除回去，一来一回
  // 就有 ±1 的双重取整；GPU 上还可能顺带做一次色彩空间转换）。于是「快 vs 慢」里混进了
  // 一份「捕获方式 vs 捕获方式」的差，而第 5.1 步的噪声底 `selfPx` 比的是**慢 vs 慢**、
  // 两份都走直读 ⇒ **它结构上看不见这一项**，只会报 0。
  // 这是一整类错误的第三次重犯（结论 9：每加一个新指标，先手算一个已知答案的样例去对它）：
  // 尺子自己的不对称，先当成了被测物的缺陷。
  // 顺带便宜了一次整屏拷贝 —— `getImageData` 返回的已经是脱离画布的副本。
  const fast = ctx.getImageData(0, 0, width, height).data;

  // ---- 第 5.4 步：**blit 这个原语在真实位移下有损吗**（往返自拷贝）----
  // 第 5.3 步问的是**零位移**自拷贝，手算答案 0、实测也是 0（六类全 0）。但重读之后
  // 发现那个对照组有盲区（结论 36：每个对照组都要说清自己看不见什么）：
  // `drawImage(self, 0, 0)` 是**可以被特判成恒等**的一步 —— 源矩形与目标矩形逐位重合，
  // 驱动/Skia 完全有理由直接跳过采样。它证明的是「恒等变换无损」，而快路径真正做的是
  // `drawImage(self, 192, 144)`：**读写同源、跨整数像素**的一次采样。两者根本不是同一段路。
  //
  // 所以这一步改问**真实位移的往返**：按 `lastSx/lastSy` 搬过去、再原样搬回来，
  // 落回原位的那块区域必须逐位复原。手算答案仍然已知 = **0**（两次都是整数平移，
  // 1:1 无缩放、关掉插值）。若单程损 ±1，往返就读到 ≤ 2 —— 而 rotate 那 4446 个
  // 「alpha 相同、颜色差 1」的 tint 像素正好是这个量级，它是目前唯一还站着的解释。
  // `skip` 档 `lastSx/lastSy` 都是 0 ⇒ 自动退化成第 5.3 步那个零位移测法，读数可比。
  //
  // ⚠ 只能比「两次都没被搬出画布」的那块**内区**：'copy' 模式下第一次就把移出去的
  // 边缘抹成透明了，那圈像素复原不了是定义使然，不是缺陷。内区 = { p : p + s 仍在画布内 }。
  // 回读次数与第 5.3 步持平（仍是三次），不给已经不稳的尺子再加负担。
  blitOnce(lastSx, lastSy);
  blitOnce(-lastSx, -lastSy);
  const rtBlit = ctx.getImageData(0, 0, width, height).data;

  const _prevTag = renderTag;
  renderTag = 'audit';
  fullRepaintView();
  renderTag = _prevTag;
  const slow = ctx.getImageData(0, 0, width, height).data;

  // ---- 第 5.1 步：这把尺子自己的噪声底（**慢路径 vs 慢路径**）----
  // 同一条视口、同一份图元，全量画两遍再比。它是 `diffPx` 能到的下限。
  //
  // 加它时的猜测是「回读把画布踢出 GPU 加速，两遍之间光栅化后端换了，45° 抗锯齿与
  // 高斯模糊最吃后端 ⇒ rotate/shadow 的 5159 / 19302 是后端噪声」，并**预先写明**：
  // 若 `selfPx` 为 0 则该猜测被证伪。第十八轮读数：六类全部 `selfPx = 0`、`selfMax = 0`
  // ⇒ **猜测证伪，光栅化是完全可重复的**。留着这一段不是为了那个死掉的猜测，而是
  // 因为它现在是一条有值的自检：`selfPx > 0` 说明「逐像素相等」这个验收口径本身不可达，
  // 那时候才需要换判据（结论 35）；它 = 0 则任何差异都必须在 M7a 自己身上找原因。
  // ⚠ 它**看不见捕获方式的不对称**（两份都走直读）—— 那一项正是 D23，靠上面那段消除的。
  // 代价：每条审计多一遍全量重绘 + 一次整屏回读。审计本来就只按需开 N 条，值。
  renderTag = 'audit';
  fullRepaintView();
  renderTag = _prevTag;
  const slow2 = ctx.getImageData(0, 0, width, height).data;

  // 分区直接用 `bandRects` —— 就是 clipBand 真的裁了、selectBandPens 真的选了的那几块，
  // 不再在这里重算一遍窄带几何（第 5 步之前这里是第三份拷贝，三份里错一份就读错结论）。
  // `skip` 档 `bandRectCount = 0` ⇒ 全部差异都算在重画区外，正是要的读法。
  const tol = options.pixelAuditTol || 0;
  // 按 32 位整字先比一次「完全相同」—— 绝大多数像素在这一行就过掉了，
  // 逐通道只对真的不同的那些做（整屏 665 万像素，逐通道是 2660 万次比较）
  const fw = new Uint32Array(fast.buffer);
  const sw = new Uint32Array(slow.buffer);
  const sw2 = new Uint32Array(slow2.buffer);
  const bw = new Uint32Array(rtBlit.buffer);
  let diff = 0;
  let inBand = 0;
  let maxDelta = 0;
  // 差异的**方向**（按 alpha 判）。少画 / 多画是两个完全不同的 bug：
  // miss  = 快路径这里比慢路径**空**  ⇒ 漏选，或 pad 不够宽
  // extra = 快路径这里比慢路径**实**  ⇒ 多选（选了基准没画的），或陈迹没擦掉
  // tint  = alpha 一样只是颜色不同    ⇒ 既不是漏也不是多，是同一块墨迹画得不一样
  //         （抗锯齿/模糊的后端差异全落在这一档 ⇒ 它大而 miss/extra 为 0 就是噪声）
  let miss = 0;
  let extra = 0;
  let tint = 0;
  // 第 5.9 步（D28）：方向判据**只看 alpha 的大小关系、不看差多少** —— alpha 差 1 的
  // 抗锯齿像素和整个图元没画（差 255）在 `miss` 这一列里长得一模一样。第二十三轮实测
  // rotate 的 607 个「漏画」整屏最大偏差只有 1、shadow 的 9525 个最大偏差只有 4，
  // 而 line 那 1941 个是 255 —— 两者之间隔着 60 倍，不是一个连续谱。
  // 于是按**幅度**再切一刀：只有大偏差那一档才算「墨迹漏了/多了」。
  // ⚠ 这**不是放宽 tol**（验收口径②禁止）：`tol` 管的是「这个像素算不算有差异」，
  // 一个字没动，`diff` / `maxDelta` 仍按 tol = 0 原样上报；这里管的是「这个差异算哪一类」。
  // 门槛取 128（满量程一半）是因为实测两档之间的空隙是 4 ↔ 255，落在 [8,128] 的任何值
  // 结果都一样 —— 手算已知答案：rotate 0、shadow 0（两者 maxDelta < 128），line ≈ miss。
  const BIG_DELTA = 128;
  let missBig = 0;
  let extraBig = 0;
  // 尺子自己的噪声底：慢 vs 慢，同一条视口、同一份图元，画两遍
  let selfDiff = 0;
  let selfMax = 0;
  // 第 5.4 步：尺子真抖起来之后，第二遍 vs 第三遍。只在 `selfDiff > 0` 时才测，
  // −1 = 没测（区分「没数据」和「数据是 0」，D24 那一类）
  let selfDiff2 = -1;
  let selfMax2 = 0;
  // blit 原语的损耗：真实位移往返前后逐像素比（内区）。> 0 ⇒ 搬一次就损一次
  let blitDiff = 0;
  let blitMax = 0;
  // 往返内区 = { p : p + s 仍在画布内 }，见上面 `rtBlit` 那段的 ⚠
  const rx0 = Math.max(0, -lastSx);
  const rx1 = width - Math.max(0, lastSx);
  const ry0 = Math.max(0, -lastSy);
  const ry1 = height - Math.max(0, lastSy);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  // 重画区外那些差异的包围盒。L 形的整体包围盒是**整屏**（两条腿的并）⇒ 没有信息量；
  // 真正要看的是「漏在重画区外的那一坨在哪」：贴着重画区内边 = pad 不够宽，
  // 散在四处 = 搬运本身错了（D16 那一类）。
  let ox0 = width;
  let oy0 = height;
  let ox1 = -1;
  let oy1 = -1;
  const legDiff = [0, 0, 0, 0];
  for (let i = 0; i < fw.length; i++) {
    // 噪声底与主比较共用这一趟循环（整屏 665 万像素，多走一趟不值）
    if (sw[i] !== sw2[i]) {
      const b2 = i << 2;
      let d2 = 0;
      for (let c = 0; c < 4; c++) {
        const dc = slow[b2 + c] > slow2[b2 + c] ? slow[b2 + c] - slow2[b2 + c] : slow2[b2 + c] - slow[b2 + c];
        if (dc > d2) {
          d2 = dc;
        }
      }
      if (d2 > tol) {
        selfDiff++;
        if (d2 > selfMax) {
          selfMax = d2;
        }
      }
    }
    if (fw[i] === sw[i]) {
      continue;
    }
    const b = i << 2;
    let d = 0;
    for (let c = 0; c < 4; c++) {
      const dc = fast[b + c] > slow[b + c] ? fast[b + c] - slow[b + c] : slow[b + c] - fast[b + c];
      if (dc > d) {
        d = dc;
      }
    }
    if (d <= tol) {
      continue;
    }
    diff++;
    if (fast[b + 3] < slow[b + 3]) {
      miss++;
      if (slow[b + 3] - fast[b + 3] >= BIG_DELTA) {
        missBig++;
      }
    } else if (fast[b + 3] > slow[b + 3]) {
      extra++;
      if (fast[b + 3] - slow[b + 3] >= BIG_DELTA) {
        extraBig++;
      }
    } else {
      tint++;
    }
    if (d > maxDelta) {
      maxDelta = d;
    }
    const x = i % width;
    const y = (i / width) | 0;
    let leg = -1;
    for (let k = 0; k < bandRectCount; k++) {
      const j = k << 2;
      if (x >= bandRects[j] && x < bandRects[j] + bandRects[j + 2] && y >= bandRects[j + 1] && y < bandRects[j + 1] + bandRects[j + 3]) {
        leg = k;
        break;
      }
    }
    if (leg >= 0) {
      inBand++;
      legDiff[leg]++;
    } else {
      if (x < ox0) {
        ox0 = x;
      }
      if (x > ox1) {
        ox1 = x;
      }
      if (y < oy0) {
        oy0 = y;
      }
      if (y > oy1) {
        oy1 = y;
      }
    }
    if (x < x0) {
      x0 = x;
    }
    if (x > x1) {
      x1 = x;
    }
    if (y < y0) {
      y0 = y;
    }
    if (y > y1) {
      y1 = y;
    }
  }

  // 往返自拷贝的比对单独走一趟**内区**，不挤进上面那个整屏循环：内区判定要 x/y，
  // 而整屏循环里 `i % width` 是按需才算的（665 万次取模不是小钱），且内区通常只占一小块。
  for (let y = ry0; y < ry1; y++) {
    const row = y * width;
    for (let x = rx0; x < rx1; x++) {
      const i = row + x;
      if (fw[i] === bw[i]) {
        continue;
      }
      const b3 = i << 2;
      let d3 = 0;
      for (let c = 0; c < 4; c++) {
        const dc = fast[b3 + c] > rtBlit[b3 + c] ? fast[b3 + c] - rtBlit[b3 + c] : rtBlit[b3 + c] - fast[b3 + c];
        if (dc > d3) {
          d3 = dc;
        }
      }
      if (d3 > tol) {
        blitDiff++;
        if (d3 > blitMax) {
          blitMax = d3;
        }
      }
    }
  }

  // ---- 第 5.4 步：尺子自己抖了，先分清是「第一遍特殊」还是「每遍都在抖」----
  // 第十九轮 rotate 的噪声底从 0 变成了「六条里有一条差 8 px、Δ255」，而 `maxDelta`
  // 的峰值同时从 1 跳到 255 —— 尺子不稳的时候，被测物的读数一个字都不能信，
  // 所以这一项排在解释 rotate 之前。
  //
  // 重读排除了两个现成的怀疑：`blitOnce` 是 save/restore 配平的（不会把 'copy'
  // 漏给后面那两遍全量），worker 也不可能在一个消息处理函数中途去处理别的消息
  // （两遍基准是同一次 `onUpdateView` 里背靠背跑的，`Patch`/`TextOutside` 插不进来）。
  // 剩下的形状只有两种，而它们的修法完全相反：
  //   第一遍是异类（slow ≠ slow2 但 slow2 = slow3）⇒ **绘制有首次副作用**
  //     （文本度量/字形缓存这类第一次画才做的事），那么基准应当取 slow2，
  //     而且 `fast` 那一侧同样吃过这一口，比较口径要重新定；
  //   每遍都抖（slow2 ≠ slow3 也成立）⇒ 光栅化真的不可重复，
  //     「逐像素相等」这个验收口径就地作废，换结论 35 那套判据。
  // 只在已经抖了的条上多画一遍 —— 干净的条一分钱不多花。
  if (selfDiff) {
    renderTag = 'audit';
    fullRepaintView();
    renderTag = _prevTag;
    const slow3 = ctx.getImageData(0, 0, width, height).data;
    const sw3 = new Uint32Array(slow3.buffer);
    selfDiff2 = 0;
    for (let i = 0; i < sw2.length; i++) {
      if (sw2[i] === sw3[i]) {
        continue;
      }
      const b4 = i << 2;
      let d4 = 0;
      for (let c = 0; c < 4; c++) {
        const dc = slow2[b4 + c] > slow3[b4 + c] ? slow2[b4 + c] - slow3[b4 + c] : slow3[b4 + c] - slow2[b4 + c];
        if (dc > d4) {
          d4 = dc;
        }
      }
      if (d4 > tol) {
        selfDiff2++;
        if (d4 > selfMax2) {
          selfMax2 = d4;
        }
      }
    }
  }

  // ---- 第 5.5 步：**换个设备位置画同一批图元，像素还一样吗**（平移等变性）----
  // 第二十一轮把搬运这一族彻底判死了：往返自拷贝（真实位移、覆盖窄带里那几千个**新鲜
  // 光栅化**的抗锯齿像素）逐位复原 ⇒ 搬运既不掉精度也不错相位。那么「同一块内容画两遍
  // 得到不同像素」就只剩一个出处：**两遍画的东西本来就不一样**。而两条路之间**可证明
  // 不同**的东西只有一样 —— 图元被光栅化时所处的**绝对设备位置**：
  //   快路径：这个 pen 是在**上一条视口**里画的，落在设备坐标 P，然后整块像素搬到 P − s；
  //   基准：  这个 pen 是在**这一条视口**里画的，直接落在 P − s。
  // 位移 s 是整数 ⇒ 亚像素相位相同 ⇒ 「理应」逐位相等。这正是 M7a 这条快路径的**全部
  // 前提**，而它从来没有被单独量过 —— 它一直藏在「快 vs 慢」这个复合读数里。
  //
  // 这一步把它单独拎出来，**除了位置什么都不变**（同一批 `inViewPenIds`、同一个 ctx、
  // 同一份数据、没有任何 blit 历史）：把 `data.x/y` 退回上一条视口的值重画一遍全量，
  // 再按 `lastSx/lastSy` 搬回来，和这一条视口的基准比。手算答案 = **0**（整数平移下
  // 光栅化应当是平移等变的）。两个结果都有明确读法，而且互斥：
  //   ≈ diffPx ⇒ **光栅化不是平移等变的**，M7a 的前提不成立。那不是 M7a 的缺陷，
  //     而是「搬像素」这个做法的固有限制，验收口径必须改（结论 35 那套判据，不是放宽 tol）；
  //   ≈ 0     ⇒ 位置无辜，差异只能来自**两遍画的图元集合不同** ⇒ 去看下面的 `setDelta`。
  // 只在已经有差异的类上做（干净的类不花这份钱），代价是多两遍全量 + 一次整屏回读。
  let posDiff = -1;
  let posMax = 0;
  // 差异的**方向**，判据与主循环同一套（alpha）。这一项不是给被测物的，是给**尺子自己**的：
  // 单程比对一旦把 blit 之后全空的新暴露带算进窗口，差异会几乎全落在 miss 这一档
  // （快路径空、基准有墨）⇒ `posMiss ≈ posDiff` 就是「先疑窗口，别忙着下结论」的信号（D27）。
  let posMiss = 0;
  // 第 5.8 步：`posShift` 此前只是一个标量，却要拿去和有窄带拆分、有方向拆分的 `diff`
  // 比大小 —— 第二十三轮 shadow 读到 4.27 倍就卡在这里：两个数的**形状**对不上
  // （`diff` 的 tint = 0，`posShift` 的非 miss 占 61%），而形状对不上时比大小没有意义。
  // 这是 D27 那一课的直接推论：要比较的两个读数必须在**同一件事**上算出来。
  // 于是给它同一套拆分 —— 窄带内/外（`diff` 那边 rotate/shadow 的差异 100% 在带外，
  // 带内那部分在快路径上是**重画**出来的、根本不经过搬运，本就不该进这个比较）
  // 与方向（漏 / 多 / 抖色）。
  let posIn = 0;
  let posExtra = 0;
  let posTint = 0;
  // 第 5.10 步：两个实验找到的**是不是同一批像素**。
  // 形状拆分只能说「两堆差异的构成像不像」，说不了「它们是不是同一堆」——
  // 第二十三轮 shadow 的 `posShift` 是自身 `diff` 的 4.27 倍，光看构成永远问不到点子上：
  // 84398 与 19773 完全可以是两拨互不相交的像素，那样「谁解释谁」这个问法本身就不成立。
  // `posBoth` = 这个像素在「快 vs 慢」那一遍里**也**有差异（同一套 tol、同一套判据）。
  // 手算已知答案：line 的 `posDiff` = 0 ⇒ `posBoth` 必须是 0（结构性上界 ≤ min(posDiff, diff)）；
  // rotate 若真由位置解释，`posBoth` 应当 ≈ 两者的较小值（≈ 5159）而不是零星重合。
  let posBoth = 0;
  // 第 5.11 步之一：`posBoth / outBand` 这个比值的**两个域是不是同一个域**。
  // 本来是想修一个以为存在的缺陷 —— `posBoth` 只在单程有效区里数、`outBand` 是整屏的，
  // 看着像是「拿实验看过的那部分去除全部」。动手前手算了一遍，结论相反，而且是**恒等**的：
  //   新暴露带 ⊆ 重画区（不然快路径会在那儿留垃圾）⇒ 带外 ⊆ 画布 − 新暴露带；
  //   单程有效区 = [max(0,s), W+min(0,s)) = 画布 − 新暴露带（逐位就是同一块）。
  // ⇒ **带外像素必然落在有效区内**，两个域本来就重合，比值没有虚高，
  //    第二十三轮 shadow 的 0.376 是**真的**解释不了，不是域错了造成的。
  // 那这个数还留着干什么：它是上面那串推理的**伴随读数**（结论 38）——
  // `outWin` 必须**逐位等于** `outBand`，一旦不等，就说明重画区没盖住新暴露带
  // （真缺陷）或者有效区推错了（D27 那个坑又踩了）。手算已知答案：六类全部相等。
  let outWin = 0;
  // 第 5.11 步之二：2×2 的最后一格 —— **位置不动、换一批图元**。
  // 快路径的带外像素 = 上一条视口用 `inViewPenIds(N−1)` 在位置 N−1 画的，再搬过来；
  // 位置实验 = 用 `inViewPenIds(N)` 在位置 N−1 画的，再搬过来。
  // 两者之差**只剩图元集合**这一个变量 ⇒ 位置实验解释不掉的那部分残差，
  // 头号嫌疑人就是集合（D21：calc 的「在视口内」判定没有墨迹余量，框刚出视口、
  // 墨迹还留在屏上的图元会在窄带之外留下陈迹）。这一格把它从推测变成一个数：
  // 在**当前**位置、用 `prevViewIds` 重画一遍全量，和这一条的基准比。
  // 没有平移 ⇒ 没有几何窗口 ⇒ D27 那个坑在这一路根本不存在；但为了能和
  // `posBoth` 一起记账，仍然**只在同一个有效区内**统计（同域规则）。
  // 盲区（结论 36）：penMap 里的图元数据是**当前**的，只有 id 集合退回上一条 ⇒
  // 这一格量的是「集合变了」，量不到「同一个图元的数据也变了」（纯平移场景下
  // 只有 textOutside 会改框，text 类要单独看）。相邻两条都被审计到才可比，否则报 −1。
  let setDiff = -1;
  let setIn = 0;
  let setBoth = 0;
  let setMax = 0;
  // 残差里被集合解释掉的那部分（带外 ∧ 有效区内 ∧ 快慢有差 ∧ 集合实验也有差 ∧ 位置实验没差）。
  let setRes = 0;
  // 三方都解释不了的那部分。两条恒等式必须同时成立（结论 38 的伴随读数）：
  //   `outWin === outBand`（域重合，见上）与 `outWin === posBoth + setRes + unexp`
  //   （四支互斥且穷尽）。任何一条不成立，先查尺子，不许读结论。
  let unexp = 0;
  // 单程有效区的面积。**它与往返内区 `rtArea` 数值相同**（都是 (W−|sx|)(H−|sy|)），
  // 所以它的用处不是校验窗口对不对 —— 是给 `posShift` 一个分母。
  let posArea = 0;
  if (diff) {
    const ox = data.x || 0;
    const oy = data.y || 0;
    data.x = ox - lastSx / dpr;
    data.y = oy - lastSy / dpr;
    renderTag = 'audit';
    fullRepaintView();
    renderTag = _prevTag;
    blitOnce(lastSx, lastSy);
    const posShift = ctx.getImageData(0, 0, width, height).data;
    // 复位：`fullRepaintView` 会把 `paintedX/Y` 写成它画的那条视口，不重画一遍
    // 就会把错的参照点留给下一条视口（而且屏上留的是上一条视口的画面）。
    data.x = ox;
    data.y = oy;
    renderTag = 'audit';
    fullRepaintView();
    renderTag = _prevTag;

    // 第 5.11 步之二的取样：位置不动，把图元集合退回上一条视口重画一遍。
    // 只有相邻两条都被审计到时才做 —— 否则 `prevViewIds` 不是「一步之内的上一批」，
    // 这一格量出来的东西没有对应的搬运历史（与 `setGone` 同一个前提）。
    let gw: Uint32Array | undefined;
    let setShift: Uint8ClampedArray | undefined;
    if (prevViewSeq === viewSeq - 1) {
      const nowIds = inViewPenIds;
      inViewPenIds = prevViewIds;
      renderTag = 'audit';
      fullRepaintView();
      renderTag = _prevTag;
      setShift = ctx.getImageData(0, 0, width, height).data;
      inViewPenIds = nowIds;
      renderTag = 'audit';
      fullRepaintView();
      renderTag = _prevTag;
      gw = new Uint32Array(setShift.buffer);
    }

    const pw = new Uint32Array(posShift.buffer);
    // ⚠ D27：这里**不能**复用上面那组 `rx0/rx1/ry0/ry1`。那一组是给**往返**推的 ——
    // 往返要求 p 与 p + s 同时落在画布内 ⇒ 内区 = [max(0,−s), W − max(0,s))；
    // 这里是**单程**，目的像素 d 的内容来自 d − s，要求 d − s 落在画布内
    // ⇒ 有效区 = [max(0,s), W + min(0,s))。两个区间贴在**相反的两个角**上，
    // 而且面积**逐位相等**（都是 W − |s|）—— 所以任何面积校验都抓不到这个错。
    // 用错的后果：把 blit 之后全空的那条新暴露带（'copy' 把源外置空）整条算成差异，
    // 读数于是变成「空带里有多少墨」，与平移等变性毫无关系 ——
    // 第二十二轮 rotate 读到 279895（= 自身总差异的 54 倍、posMax 255）就是这么来的。
    // 顺带：有效区内的每个目的像素其来源都在画布内 ⇒ 不含上一条视口边缘被裁掉的图元，
    // 这一路不需要再额外排除什么。
    const qx0 = Math.max(0, lastSx);
    const qx1 = width + Math.min(0, lastSx);
    const qy0 = Math.max(0, lastSy);
    const qy1 = height + Math.min(0, lastSy);
    posArea = Math.max(0, qx1 - qx0) * Math.max(0, qy1 - qy0);
    posDiff = 0;
    if (gw) {
      setDiff = 0;
    }
    for (let y = qy0; y < qy1; y++) {
      const row = y * width;
      for (let x = qx0; x < qx1; x++) {
        const i = row + x;
        const b5 = i << 2;
        // 三份像素各自与**同一份基准**比，判据逐字同一套（Uint32 快筛 → 逐通道取最大差
        // → 同一个 tol）。三个差值必须在同一个像素上同时算出来 —— 否则「它们是不是
        // 同一批像素」这个问题根本问不出来（第 5.10 步那一课）。
        let d5 = 0;
        if (pw[i] !== sw[i]) {
          for (let c = 0; c < 4; c++) {
            const dc = posShift[b5 + c] > slow[b5 + c] ? posShift[b5 + c] - slow[b5 + c] : slow[b5 + c] - posShift[b5 + c];
            if (dc > d5) {
              d5 = dc;
            }
          }
        }
        let d6 = 0;
        if (fw[i] !== sw[i]) {
          for (let c = 0; c < 4; c++) {
            const dc = fast[b5 + c] > slow[b5 + c] ? fast[b5 + c] - slow[b5 + c] : slow[b5 + c] - fast[b5 + c];
            if (dc > d6) {
              d6 = dc;
            }
          }
        }
        let d7 = 0;
        if (gw && setShift && gw[i] !== sw[i]) {
          for (let c = 0; c < 4; c++) {
            const dc = setShift[b5 + c] > slow[b5 + c] ? setShift[b5 + c] - slow[b5 + c] : slow[b5 + c] - setShift[b5 + c];
            if (dc > d7) {
              d7 = dc;
            }
          }
        }
        const posHere = d5 > tol;
        const fastHere = d6 > tol;
        const setHere = d7 > tol;
        if (!posHere && !fastHere && !setHere) {
          continue;
        }
        // 窄带判定与主循环逐字同一段（同一批 `bandRects`），否则又是「两个数不在
        // 同一件事上算」—— 这正是这一步要修的毛病，不能在修它的时候再犯一次。
        let inBandHere = false;
        for (let k = 0; k < bandRectCount; k++) {
          const j = k << 2;
          if (
            x >= bandRects[j] &&
            x < bandRects[j] + bandRects[j + 2] &&
            y >= bandRects[j + 1] &&
            y < bandRects[j + 1] + bandRects[j + 3]
          ) {
            inBandHere = true;
            break;
          }
        }
        if (posHere) {
          posDiff++;
          if (posShift[b5 + 3] < slow[b5 + 3]) {
            posMiss++;
          } else if (posShift[b5 + 3] > slow[b5 + 3]) {
            posExtra++;
          } else {
            posTint++;
          }
          if (inBandHere) {
            posIn++;
          }
          if (d5 > posMax) {
            posMax = d5;
          }
        }
        if (setHere) {
          setDiff++;
          if (inBandHere) {
            setIn++;
          }
          if (d7 > setMax) {
            setMax = d7;
          }
        }
        // 记账只在**带外 ∧ 有效区内 ∧ 快慢确有差异**的像素上做：这是唯一一个
        // 三个实验都看得见、而且那片像素真的经过了搬运的域。下面四支互斥且穷尽 ⇒
        // 恒等式 `outWin === posBoth + setRes + unexp` 必须成立，不成立就是记账写错了。
        if (!inBandHere && fastHere) {
          outWin++;
          if (setHere) {
            setBoth++;
          }
          if (posHere) {
            posBoth++;
          } else if (setHere) {
            setRes++;
          } else {
            unexp++;
          }
        }
      }
    }
  }

  // ---- 第 5.5 步：**两条视口画的图元集合差多少**（上一支的另一半）----
  // 快路径搬过来的那片像素是**上一条视口**用 `inViewPenIds(N−1)` 画的，基准用的是
  // `inViewPenIds(N)`，而 `selectBandPens` 只在窄带里补差。框刚出视口、墨迹还留在屏上的
  // 图元（**D21**：calc 的「在视口内」判定没有墨迹余量）就会在**窄带之外**留下陈迹或缺口。
  // 这里数的是两条视口的 id 集合的对称差 —— 单位是**个数**不是像素（结论 35）。
  // 只有相邻两条都被审计到时才算，否则比的是不相邻的两条、没有意义（报 −1 = 没测）。
  let setGone = -1;
  let setNew = 0;
  if (prevViewSeq === viewSeq - 1) {
    const prevSet = new Set(prevViewIds);
    const nowSet = new Set<string>(inViewPenIds);
    setGone = 0;
    for (const id of prevViewIds) {
      if (!nowSet.has(id)) {
        setGone++;
      }
    }
    for (const id of inViewPenIds) {
      if (!prevSet.has(id)) {
        setNew++;
      }
    }
  }
  prevViewIds = inViewPenIds.slice();
  prevViewSeq = viewSeq;

  // ---- 第 5.1 步：**选取集 vs 基准集**的差集 ----
  // 像素只说「哪里不一样」，说不出「为什么」。这一段直接对上两条路真正画过的图元集合：
  // 慢路径画 `inViewPenIds`（calc 发来的），快路径在重画区里画 `bandPens`。
  // 重画区**之外**画谁都不影响那里的像素 ⇒ 只数「墨迹碰到重画区」的那些，
  // 用的还是 `inkHitsBand()` 这同一段判定（两段等价代码比出来的差可能是判定自己的差）。
  //   selMiss  基准画了、快路径没选 ⇒ 漏选。它 > 0 就直接指认了 inBand 的那些 miss 像素。
  //   selExtra 快路径选了、基准没画 ⇒ 多选。它 > 0 说明两条路的「在视口内」判得不一样
  //            （`inViewPenIds` 是 calc 异步发来的，可能对应**上一条**视口 ⇒ 天然会差）。
  // 这两个数与 `audit:miss` / `audit:extra` 的方向必须对得上，对不上说明还有第三个原因。
  let selMiss = 0;
  let selExtra = 0;
  // 漏选**只可能**出自 `selectBandPens` 的视口过滤那两条子句：`bandPens` 是
  // 「视口过滤 ∧ inkHitsBand」，这里数的是「在 inViewPenIds ∧ inkHitsBand ∧ 不在 bandPens」，
  // 而 `inkHitsBand` 已经是同一段代码 ⇒ 差只能在视口过滤上。所以不去猜是哪一条，直接记：
  //   selMissSize  被 `width/height < 2` 挡下的个数（两条路对「多小算没有」的看法不同）
  //   selMissOut   被矩形越界挡下的个数 —— 那说明两条路手上这个 pen 的矩形**不是同一个**：
  //                calc 会在 `onTextOutside` 里 `Object.assign(pen, _rect)` 改它自己那份
  //                拷贝，Line 的锚点/箭头也可能让 calc 那边的框更大。
  //   selMissGap   越界了多少（世界单位，四边里最深的那个）。量级直接指认成因：
  //                ≈ 箭头/描边的溢出量 ⇒ calc 那份框被放大过；≈ 0 ⇒ 边界取整或异步错位。
  // 两个分开数而不是记「最后一个是哪种」—— 一条视口里可以两种同时发生，
  // 合成一个数就又是一次「把两件事读成一件」。
  let selMissSize = 0;
  let selMissOut = 0;
  let selMissGap = 0;
  // 第 5.3 步：越界**在哪条边**上。第十八轮读到 `selMissGap` 均 3.4 / 峰 4 世界单位 ——
  // 既不是 ≈ 0（取整/异步），也不是 ≈ 24（箭头余量），预注册的两个量级都没对上，
  // 所以还缺一个数。这一位直接把两族原因分开：
  //   四条边里**只脏一条** ⇒ 是**视口本身**差了一点（calc 的 canvasWidth/Height 与
  //     render 的 width/dpr 对不上是唯一能造成单边偏差的东西），配合 `view:fx1/fy1`
  //     与 calc 的 `calc:viewR/viewB` 一减就实锤；
  //   四条边**散着脏** ⇒ 是**每个 pen 的框**两边不一样（calc 改过自己那份拷贝）。
  const selMissEdge = [0, 0, 0, 0]; // L R T B
  if (bandRectCount) {
    const bandSet = new Set<string>();
    for (const pen of bandPens) {
      bandSet.add(pen.id);
    }
    const viewSet = new Set<string>(inViewPenIds);
    for (const id of inViewPenIds) {
      if (bandSet.has(id)) {
        continue;
      }
      const pen = penMap.get(id);
      if (!pen) {
        continue;
      }
      inkBox(pen);
      if (inkHitsBand()) {
        selMiss++;
        if (isTinyPen(pen)) {
          selMissSize++;
        } else {
          selMissOut++;
          const gaps = [
            viewX0 - (pen.ex as number),
            (pen.x as number) - viewX1,
            viewY0 - (pen.ey as number),
            (pen.y as number) - viewY1,
          ];
          for (let k = 0; k < 4; k++) {
            // 越界的边可能不止一条（角上的 pen），四条各自记账
            if (gaps[k] > 0) {
              selMissEdge[k]++;
              if (gaps[k] > selMissGap) {
                selMissGap = gaps[k];
              }
            }
          }
        }
      }
    }
    for (const pen of bandPens) {
      if (!viewSet.has(pen.id)) {
        selExtra++;
      }
    }
  }

  probe.count('audit:views:' + tag);
  probe.sample('audit:diffPx:' + tag, diff);
  probe.sample('audit:diffPpm:' + tag, (diff * 1e6) / (width * height));
  probe.sample('audit:selMiss:' + tag, selMiss);
  probe.sample('audit:selExtra:' + tag, selExtra);
  if (selMiss) {
    probe.sample('audit:selMissSize:' + tag, selMissSize);
    probe.sample('audit:selMissOut:' + tag, selMissOut);
    probe.sample('audit:selMissGap:' + tag, selMissGap);
    probe.sample('audit:selMissL:' + tag, selMissEdge[0]);
    probe.sample('audit:selMissR:' + tag, selMissEdge[1]);
    probe.sample('audit:selMissT:' + tag, selMissEdge[2]);
    probe.sample('audit:selMissB:' + tag, selMissEdge[3]);
  }
  // blit 原语的损耗。**它 = 0 是手算已知的答案**（整数平移往返按定义应逐位复原），
  // 所以这一项非 0 本身就是结论：搬一次损一次，是 M7a 的固有代价。
  // 名字沿用 `selfBlit` 是为了跨轮可比，但语义已换成真实位移的往返（第 5.4 步）——
  // 读第十九轮及以前的读数时记得它那时问的是零位移。
  probe.sample('audit:selfBlit:' + tag, blitDiff);
  probe.sample('audit:selfBlitMax:' + tag, blitMax);
  // 往返内区占了整屏多少 —— 它要是很小，`selfBlit = 0` 的说服力就得打折
  probe.sample('audit:rtArea:' + tag, Math.max(0, rx1 - rx0) * Math.max(0, ry1 - ry0));
  // render 反推出来的画布 CSS 宽高。与 calc 的 `calc:cw1k` / `ch1k` 相减 ⇒ 两条路的视口
  // 到底差不差、差多少（差 ≠ 0 就是 `line` 漏选的直接成因）。报这个常数而不是视口边界，
  // 是因为边界每条视口都在移动、两边采样的条数还不一样 ⇒ 均值相减读不出 3~4 的信号。
  probe.sample('audit:cw1k:' + tag, Math.round((width / dpr) * 1000));
  probe.sample('audit:ch1k:' + tag, Math.round((height / dpr) * 1000));
  // 噪声底：慢 vs 慢。**它是 `diffPx` 的下限** —— `diffPx` 减不到它以下，
  // 「六类全 0 @ tol 0」这个原先的验收口径因此是不可达的（见文档 9.9 的更正）。
  probe.sample('audit:selfPx:' + tag, selfDiff);
  probe.sample('audit:selfMax:' + tag, selfMax);
  // 只在真抖了的条上才有。selfPx2 = 0 ⇒ 只有第一遍是异类（首次绘制的副作用）；
  // selfPx2 > 0 ⇒ 每遍都不一样，光栅化本身不可重复。两者的修法相反，见上面那段。
  if (selfDiff2 >= 0) {
    probe.sample('audit:selfPx2:' + tag, selfDiff2);
    probe.sample('audit:selfMax2:' + tag, selfMax2);
  }
  // 相邻两条视口的图元集合差（个数）。搬过来的那片像素是用**上一条**那批画的。
  // **干净的类也要报** —— plain 的集合变动量与 rotate 一样大却一个像素不差，
  // 那就说明「集合变了」本身不足以造成差异，这一列才有对照意义（结论 35：看集合不看像素）。
  if (setGone >= 0) {
    probe.sample('audit:setGone:' + tag, setGone);
    probe.sample('audit:setNew:' + tag, setNew);
  }
  if (!diff) {
    probe.count('audit:clean:' + tag);
    probe.time('audit:cost', _t);
    return;
  }
  // 第 5.5 步：**平移等变性**。除了「在哪个设备位置光栅化」之外什么都没变，
  // 手算答案 = 0。≈ diffPx ⇒ 光栅化不是平移等变的，M7a 的前提不成立（那是固有限制
  // 不是缺陷，验收口径要改）；≈ 0 ⇒ 位置无辜，去看下面的 setGone/setNew。
  if (posDiff >= 0) {
    probe.sample('audit:posShift:' + tag, posDiff);
    probe.sample('audit:posMax:' + tag, posMax);
    // 窗口取错时这一项会 ≈ posShift（空带被算成「快路径漏画」）—— 先看它再看上面两个
    probe.sample('audit:posMiss:' + tag, posMiss);
    probe.sample('audit:posArea:' + tag, posArea);
    // 与 `diff` 同一套拆分，这样两个读数才**可比**（第 5.8 步）。要对账的是
    // `posOut` ↔ `outBand`：窄带里的像素在快路径上是重画的、不经过搬运，
    // 拿它去问「搬运前后位置变了有没有影响」本来就问错了对象。
    probe.sample('audit:posIn:' + tag, posIn);
    probe.sample('audit:posOut:' + tag, posDiff - posIn);
    probe.sample('audit:posExtra:' + tag, posExtra);
    probe.sample('audit:posTint:' + tag, posTint);
    // 交集与「只有位置实验才看得见」的那一部分。后者大 ⇒ 位置实验在制造自己的差异，
    // 它解释不了 `diff`，比大小就此打住（第 5.10 步）。
    probe.sample('audit:posBoth:' + tag, posBoth);
    probe.sample('audit:posOnly:' + tag, posDiff - posIn - posBoth);
    // 第 5.11 步：`posBoth / outBand` 两个域重合的**自检**（不是新判据）。
    // 手算：新暴露带 ⊆ 重画区 ⇒ 带外 ⊆ 画布 − 新暴露带 = 单程有效区 ⇒
    // `outWin` 必须**逐位等于** `outBand`（结论 9）。不等 ⇒ 重画区没盖住新暴露带，
    // 或者有效区又推错了（D27）—— 两种都得先查尺子再读下面的三方记账。
    probe.sample('audit:outWin:' + tag, outWin);
    // 三方记账：位置解释掉多少（`posBoth`）、集合额外解释掉多少（`setPxRes`）、
    // 谁都解释不了多少（`unexp`）。恒等式 outWin = posBoth + setPxRes + unexp（结论 38）。
    probe.sample('audit:unexp:' + tag, unexp);
    if (setDiff >= 0) {
      probe.sample('audit:setPx:' + tag, setDiff);
      probe.sample('audit:setPxIn:' + tag, setIn);
      probe.sample('audit:setPxOut:' + tag, setDiff - setIn);
      probe.sample('audit:setPxMax:' + tag, setMax);
      probe.sample('audit:setPxBoth:' + tag, setBoth);
      probe.sample('audit:setPxRes:' + tag, setRes);
    }
  }
  probe.sample('audit:inBand:' + tag, inBand);
  probe.sample('audit:outBand:' + tag, diff - inBand);
  probe.sample('audit:maxDelta:' + tag, maxDelta);
  probe.sample('audit:miss:' + tag, miss);
  probe.sample('audit:extra:' + tag, extra);
  probe.sample('audit:tint:' + tag, tint);
  // D28：同样是「漏画」，Δ1 与 Δ255 不是一回事。验收看 Big 这两档，`miss`/`extra`
  // 原样保留 —— 两个数一起看才知道这刀切在哪：`miss` 大而 `missBig` = 0 ⇒ 全是抗锯齿边。
  probe.sample('audit:missBig:' + tag, missBig);
  probe.sample('audit:extraBig:' + tag, extraBig);
  probe.sample('audit:boxX:' + tag, x0);
  probe.sample('audit:boxY:' + tag, y0);
  probe.sample('audit:boxW:' + tag, x1 - x0 + 1);
  probe.sample('audit:boxH:' + tag, y1 - y0 + 1);
  // 逐块（v = 进入侧竖条含 pad，vx = 离开侧竖条，h / hx 同理横向）。
  // 第 5 步的三条分支各自对应哪一块，脏在哪一块就去改哪一段。
  for (let k = 0; k < bandRectCount; k++) {
    probe.sample('audit:leg:' + bandLegs[k] + ':' + tag, legDiff[k]);
  }
  probe.sample('audit:padDev:' + tag, lastPadDev);
  probe.sample('audit:shift:' + tag, Math.abs(lastSx) + Math.abs(lastSy));
  if (diff > inBand) {
    probe.sample('audit:oBoxX:' + tag, ox0);
    probe.sample('audit:oBoxY:' + tag, oy0);
    probe.sample('audit:oBoxW:' + tag, ox1 - ox0 + 1);
    probe.sample('audit:oBoxH:' + tag, oy1 - oy0 + 1);
  }
  probe.time('audit:cost', _t);
}

/**
 * 截图 2（单选旋转后拖动，松手一角残留）/ 3、3-1（多选旋转后拖动两个位置 + 空白块）的取证：
 * 「pivot 过期」的猜测被推翻（patchClone 其实带 pivot，D42）⇒ 不再猜，直接比。
 * P = 这次 Patch 重绘完的画面；T = 在新旧区域的并集里，用 render 自己的 inkBox 扫全部图元、按当前状态按层级重画。
 * P ≠ T 的像素就是 Patch 路径留下的残影（P 有、T 无）或空洞（T 有、P 无）。审计后画布留 T。
 */
function auditPatch(d: any) {
  // 分块脏区：参照也必须只在这些块里重画（不能用外接框 newBoundary，块之间没画的地方本来就不该变）
  const bounds = (d.rects || [d.oldBoundary, d.newBoundary]).filter((b: any) => b && b.width > 0);
  if (!bounds.length) {
    return;
  }
  const rects = bounds.map((b: any) => alignedClipRect(b));
  const dx0 = Math.max(0, Math.min(...rects.map((r: any) => r.minX)));
  const dy0 = Math.max(0, Math.min(...rects.map((r: any) => r.minY)));
  const dx1 = Math.min(width, Math.max(...rects.map((r: any) => r.maxX)));
  const dy1 = Math.min(height, Math.max(...rects.map((r: any) => r.maxY)));
  const w = dx1 - dx0;
  const h = dy1 - dy0;
  if (!(w > 0 && h > 0)) {
    return;
  }
  const pImg = ctx.getImageData(dx0, dy0, w, h).data;
  const truth: Pen[] = [];
  for (const [, pen] of penMap) {
    inkBox(pen);
    for (const r of rects) {
      if (!(ink2 < r.x || ink0 > r.x + r.width || ink3 < r.y || ink1 > r.y + r.height)) {
        truth.push(pen);
        break;
      }
    }
  }
  truth.sort((p1, p2) => p1.index - p2.index);
  drawMergedAnim(truth, rects);
  const tImg = ctx.getImageData(dx0, dy0, w, h).data;
  let px = 0;
  let maxD = 0;
  let wx = -1;
  let wy = -1;
  for (let i = 0, n = 0; i < pImg.length; i += 4, n++) {
    const dd = Math.max(
      Math.abs(pImg[i] - tImg[i]),
      Math.abs(pImg[i + 1] - tImg[i + 1]),
      Math.abs(pImg[i + 2] - tImg[i + 2]),
      Math.abs(pImg[i + 3] - tImg[i + 3]),
    );
    if (dd) {
      px++;
      if (dd > maxD) {
        maxD = dd;
        wx = dx0 + (n % w);
        wy = dy0 + Math.floor(n / w);
      }
    }
  }
  patchAuditSeen++;
  probe.count('audit:patch');
  probe.sample('audit:patchPx', px);
  if (!px) {
    patchAuditSeen % 10 === 0 &&
      console.info(`[patchAudit] 已审 ${patchAuditSeen} 次 Patch，不一致 ${patchAuditBad} 次`);
    return;
  }
  patchAuditBad++;
  if (patchAuditBad > 10) {
    return;
  }
  const k = ((wy - dy0) * w + (wx - dx0)) * 4;
  const inRect = rects.map((r: any) => wx >= r.minX && wx < r.maxX && wy >= r.minY && wy < r.maxY);
  const oldIds = new Set<string>(d.oldPensIds || []);
  const newIds = new Set<string>(d.newPenIds || []);
  const pens: any[] = [];
  for (const pen of truth) {
    inkBox(pen);
    const X0 = ink0 * matrix.a + matrix.e;
    const X1 = ink2 * matrix.a + matrix.e;
    const Y0 = ink1 * matrix.d + matrix.f;
    const Y1 = ink3 * matrix.d + matrix.f;
    if (wx >= Math.floor(X0) - 1 && wx <= Math.ceil(X1) + 1 && wy >= Math.floor(Y0) - 1 && wy <= Math.ceil(Y1) + 1) {
      pens.length < 8 &&
        pens.push({
          id: pen.id,
          type: pen.type,
          index: pen.index,
          rotate: pen.rotate,
          pivot: pen.pivot,
          x: pen.x,
          y: pen.y,
          w: pen.width,
          h: pen.height,
          inOld: oldIds.has(pen.id),
          inNew: newIds.has(pen.id),
          updated: !!d.update?.some((u: any) => u.id === pen.id),
        });
    }
  }
  console.warn(
    '[patchAudit] Patch 重绘与参照 T 不一致 ' +
      JSON.stringify({
        px,
        maxD,
        w,
        h,
        hasOld: !!(d.oldBoundary && d.oldBoundary.width > 0),
        worst: {
          x: wx,
          y: wy,
          P: [pImg[k], pImg[k + 1], pImg[k + 2], pImg[k + 3]],
          T: [tImg[k], tImg[k + 1], tImg[k + 2], tImg[k + 3]],
          inOldRect: bounds.length === 2 ? inRect[0] : false,
          inNewRect: bounds.length === 2 ? inRect[1] : inRect[0],
          pens,
        },
        oldIds: oldIds.size,
        newIds: newIds.size,
        truthPens: truth.length,
        updates: d.update?.length || 0,
      }),
  );
}

/** 合并绘制的逐像素审计：原来的逐条路径 vs 合并路径，同一帧、同一块画布 */
function auditAnimBatch(batch: any[]) {
  let dx0 = Infinity;
  let dy0 = Infinity;
  let dx1 = -Infinity;
  let dy1 = -Infinity;
  for (const it of batch) {
    if (!it.penIds?.length) {
      continue;
    }
    const r = alignedClipRect(it.boundary);
    dx0 = Math.min(dx0, r.minX);
    dy0 = Math.min(dy0, r.minY);
    dx1 = Math.max(dx1, r.maxX);
    dy1 = Math.max(dy1, r.maxY);
  }
  dx0 = Math.max(0, dx0);
  dy0 = Math.max(0, dy0);
  dx1 = Math.min(width, dx1);
  dy1 = Math.min(height, dy1);
  const w = dx1 - dx0;
  const h = dy1 - dy0;
  if (!(w > 0 && h > 0)) {
    for (const item of batch) {
      renderAnimationItem(item);
    }
    return;
  }
  const s0 = ctx.getImageData(dx0, dy0, w, h);
  // A：原来的逐条路径（逐条应用属性 + 逐条画）
  for (const item of batch) {
    renderAnimationItem(item);
  }
  const a = ctx.getImageData(dx0, dy0, w, h).data;
  // B：恢复画布，用合并路径画（属性已由 A 应用过，这里只收集）
  ctx.putImageData(s0, dx0, dy0);
  const { list, rects } = collectAnimBatch(batch, false);
  drawMergedAnim(list, rects);
  const b = ctx.getImageData(dx0, dy0, w, h).data;

  // T：第三方参照（第四十五轮加）—— 不用 calc 的清单、不管属性的应用顺序：
  // 用 render 自己的几何（inkBox）扫全部图元，墨迹碰到任一块区域的都按当前状态、按层级画一遍。
  // 第四十五轮复现出 A ≠ B，而诊断显示差异处的图元都被列进了覆盖区域 ⇒ 怀疑 A（原逐条路径）自己有
  // 「前面的区域用旧状态画了后面才更新的图元」的残影 / 空洞；A 当裁判就不公平，所以另立 T。
  ctx.putImageData(s0, dx0, dy0);
  let ux0 = Infinity;
  let uy0 = Infinity;
  let ux1 = -Infinity;
  let uy1 = -Infinity;
  for (const r of rects) {
    ux0 = Math.min(ux0, r.x);
    uy0 = Math.min(uy0, r.y);
    ux1 = Math.max(ux1, r.x + r.width);
    uy1 = Math.max(uy1, r.y + r.height);
  }
  const truth: Pen[] = [];
  for (const [, pen] of penMap) {
    inkBox(pen);
    if (ink2 < ux0 || ink0 > ux1 || ink3 < uy0 || ink1 > uy1) {
      continue;
    }
    for (const r of rects) {
      if (!(ink2 < r.x || ink0 > r.x + r.width || ink3 < r.y || ink1 > r.y + r.height)) {
        truth.push(pen);
        break;
      }
    }
  }
  truth.sort((p1, p2) => p1.index - p2.index);
  drawMergedAnim(truth, rects);
  const t = ctx.getImageData(dx0, dy0, w, h).data;

  const cmp = (x: Uint8ClampedArray, y: Uint8ClampedArray) => {
    let px = 0;
    let maxD = 0;
    for (let i = 0; i < x.length; i += 4) {
      const d = Math.max(
        Math.abs(x[i] - y[i]),
        Math.abs(x[i + 1] - y[i + 1]),
        Math.abs(x[i + 2] - y[i + 2]),
        Math.abs(x[i + 3] - y[i + 3]),
      );
      if (d) {
        px++;
        d > maxD && (maxD = d);
      }
    }
    return { px, maxD };
  };
  const ab = cmp(a, b);
  const bt = cmp(b, t);
  const at = cmp(a, t);
  probe.count('audit:anim');
  probe.sample('audit:animPx', ab.px);
  probe.sample('audit:animMax', ab.maxD);
  probe.sample('audit:animPxBT', bt.px);
  probe.sample('audit:animPxAT', at.px);
  probe.sample('audit:animArea', w * h);
  const line: any = {
    AvsB: ab,
    BvsT: bt,
    AvsT: at,
    w,
    h,
    rects: rects.length,
    mergedPens: list.length,
    truthPens: truth.length,
  };
  // B ≠ T 才是合并绘制自己的错：用 T 当参照诊断；否则诊断 A ≠ B 看原路径错在哪
  if ((bt.px || ab.px) && animAuditLogged < 5) {
    animAuditLogged++;
    line.diag = bt.px
      ? diagnoseAnimAudit(batch, list, t, b, dx0, dy0, w, h, bt.maxD)
      : diagnoseAnimAudit(batch, list, a, b, dx0, dy0, w, h, ab.maxD);
    line.diagRef = bt.px ? 'T vs B' : 'A vs B';
  }
  const verdict = bt.px ? '⚠ 合并绘制与参照 T 不一致' : ab.px ? '合并 = 参照 T，原逐条路径与 T 不一致' : '三者逐像素一致';
  (bt.px ? console.warn : console.info)('[animAudit] ' + verdict + ' ' + JSON.stringify(line));
}

/**
 * 第四十三轮审计不一致后的诊断（只在审计发现差异时跑）。三个假设各对应一类证据：
 * ① 层级顺序：逐条路径用 calc 排好的 penIds 顺序，合并路径按 render 的 pen.index 排 ⇒ 两者不同、或 index 缺失 / 重复，
 *    重叠处就会差到 255（benchmark 里矩形 / 图片 / 文字三组都从左上角铺开，彼此重叠）；
 * ② 几何不一致：render 画出的墨迹伸进了某块区域，而 calc 的清单没把这个图元列进那块 ⇒ 逐条路径把它擦掉不画回，
 *    合并路径把它画了出来（这时错的是原来的逐条路径）；
 * ③ 边缘浮点误差：对齐矩形转回逻辑坐标再被矩阵乘回来，不一定精确落在整像素 ⇒ 裁剪边上差 1。
 */
function diagnoseAnimAudit(batch: any[], list: Pen[], a: Uint8ClampedArray, b: Uint8ClampedArray, dx0: number, dy0: number, w: number, h: number, maxD: number) {
  const items = batch.filter((it: any) => it.penIds?.length);
  const rects = items.map((it: any) => alignedClipRect(it.boundary));
  // ③ 差异像素的外接框、贴边的个数
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  let onEdge = 0;
  let mx = -1;
  let my = -1;
  for (let i = 0, n = 0; i < a.length; i += 4, n++) {
    const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
    if (!d) {
      continue;
    }
    const X = dx0 + (n % w);
    const Y = dy0 + Math.floor(n / w);
    bx0 = Math.min(bx0, X);
    by0 = Math.min(by0, Y);
    bx1 = Math.max(bx1, X);
    by1 = Math.max(by1, Y);
    if (d === maxD && mx < 0) {
      mx = X;
      my = Y;
    }
    for (const r of rects) {
      if (X >= r.minX && X < r.maxX && Y >= r.minY && Y < r.maxY && (X === r.minX || X === r.maxX - 1 || Y === r.minY || Y === r.maxY - 1)) {
        onEdge++;
        break;
      }
    }
  }
  // ② 差异最大的那个像素：谁盖住它、有没有被每一块覆盖它的区域列进去
  const k = ((my - dy0) * w + (mx - dx0)) * 4;
  const covering: number[] = [];
  rects.forEach((r: any, i: number) => {
    if (mx >= r.minX && mx < r.maxX && my >= r.minY && my < r.maxY) {
      covering.push(i);
    }
  });
  const pens: any[] = [];
  for (const pen of list) {
    inkBox(pen);
    const X0 = ink0 * matrix.a + matrix.e;
    const X1 = ink2 * matrix.a + matrix.e;
    const Y0 = ink1 * matrix.d + matrix.f;
    const Y1 = ink3 * matrix.d + matrix.f;
    if (mx >= Math.floor(X0) - 1 && mx <= Math.ceil(X1) + 1 && my >= Math.floor(Y0) - 1 && my <= Math.ceil(Y1) + 1) {
      const unlistedIn = covering.filter((i) => !items[i].penIds.includes(pen.id)).length;
      pens.length < 8 && pens.push({ id: pen.id, type: pen.type, index: pen.index, unlistedIn });
    }
  }
  // ① 层级顺序
  let orderMismatch = 0;
  for (const it of items) {
    const ps = it.penIds.map((id: string) => penMap.get(id)).filter(Boolean);
    for (let i = 1; i < ps.length; i++) {
      if (!(ps[i - 1].index <= ps[i].index)) {
        orderMismatch++;
        break;
      }
    }
  }
  const seenIdx = new Map<any, number>();
  let noIndex = 0;
  let dupIndex = 0;
  for (const pen of list) {
    if (pen.index == undefined) {
      noIndex++;
      continue;
    }
    const c = (seenIdx.get(pen.index) || 0) + 1;
    seenIdx.set(pen.index, c);
    c === 2 && dupIndex++;
  }
  return {
    diffBox: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 },
    onEdge,
    worst: {
      x: mx,
      y: my,
      A: [a[k], a[k + 1], a[k + 2], a[k + 3]],
      B: [b[k], b[k + 1], b[k + 2], b[k + 3]],
      coveredByRegions: covering.length,
      pens,
    },
    orderMismatchItems: orderMismatch,
    noIndex,
    dupIndex,
  };
}
