import { version } from '../package.json';
import { dispatchEvent } from './meta2d-event';

import {
  Action,
  CollaboratePointer,
  Meta2dData,
  Options,
  GuideLine,
  Datasource,
  DataPoint,
  HttpConfig,
  WorkerMessage,
  AnchorMode,
  AlignType,
  FitViewOrigin,
  HoverType,
  Mode,
  PlayState,
  InteractionMode,
} from './types';
import { RotateCursors, collaboratePageKeys, defaultOptions } from './const';
import { copy, cut, KeydownFns, paste, translatePens } from './meta2d-keyevent';
import { loadImages, messageFns, perfWaiters } from './meta2d-message';
import { PerfReport } from './perf/types';
import { probe } from './perf/probe';
import {
  dragPens,
  magnifier,
  dragPensDone,
  handleMouseDown,
  handleMouseLeave,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  reiszePensDone,
  resizePens,
  rotatePens,
  rotatePensDone,
  selectPens,
  selectPensDone,
  translateCanvas,
  requestTranslate,
  handleTouchstart,
  handleTouchmove,
  handleTouchend,
  handleDrop,
  handleDragover,
  handleDblclick,
  scaleCanvas,
  handleClick,
  InteractionStateMachine,
  HoverTypeHandler,
} from './meta2d-mouse';
import { snapToPen } from './meta2d-service';
import {
  createFns,
  afterUpdateFns,
  beforeUpdateFns,
  changeThemeFns,
  calcLineRect,
  dealData,
  destroyFns,
  dragoverFns,
  defaultAnchorFns,
  dropFns,
  getBoundary,
  mouseDownFns,
  mouseMoveFns,
  mouseUpFns,
  mouseEnterFns,
  mouseLeaveFns,
  inputFns,
  patchClone,
  Pen,
  Point,
  IndexPlan,
  layerParent,
  planGroup,
  planMoveLayer,
  planMoveRelative,
  planNormalizeLayers,
  planToFrontOrBack,
  planAppendToParent,
  Rect,
  toPngFns,
  wheelFns,
  scaleFns,
  calcTextRect,
  calcTextLines,
  getTextLayoutWidth,
  getTextLayoutHeight,
  isTextOverflowAllowed,
  getFont,
  TextAligns,
  TextVerticals,
  TextWrap,
  IValue,
  ValueOptions,
  PatchFlag,
  PatchRectProps,
  BackgroundType,
  InteractiveType,
  TextJustifyContents,
  TextDecoration,
  gradientToCss,
  getAllPens,
  flipPen,
  translatePen,
  Padding,
  PenCategory,
  ConnectLine,
  Animation,
  EventType,
  HandleType,
  InputMode,
} from './models';
import { addPath, getPathBBoxCache, getPathBBoxs } from './workers/utility/svg';
import { getLocalVars, getter, s8 } from './utils';

import { penDefines } from './diagrams';
import { elideDefaultAnchors } from './diagrams/base';
import { baseElementDefines } from './diagrams/base/elements';
import { initializeMeta2d } from './diagrams/initializer';

import { default as mitt, Emitter } from 'mitt';
import { snapdom } from '@zumer/snapdom';
import { executeActions, shouldExecute, isRelated } from './meta2d-event';
import { Dialog } from './component/dialog';
import { MessageBox, MessageOptions, closeAll } from './component/messageBox';
import { ViewMap } from './map';
import { registerSvgDraws } from './utils/svg/registry';
import { themeManager, type ThemeInput } from './utils/theme';
import { loadFonts as loadFontResources } from './workers/utility/fonts';
import { injectIconfontCss } from './workers/utility/iconfont';
import {
  resetCollaborateColors,
  sanitizeCollaborateDatasource,
} from './workers/utility/collaborate';

/** setValue 队列等 render 回执的上限（ms）。正常一批几十到一百多 ms；超过它多半是回执丢了，不再等 */
const QueueAckTimeout = 1000;

/** 分批打开（见 Meta2d.planProgressiveLoad）：少于这么多图元一次发完 */
const ProgressiveMinPens = 20000;
/** 首批的视口外扩（屏幕像素）：盖住文字外溢、粗描边、阴影 */
const ProgressiveMarginPx = 200;
/** 首批超过全部的这个比例就不分批 */
const ProgressiveMaxFirstRatio = 0.6;
/** 后批每批几个图元：主线程克隆一批给两个 worker 约 10ms */
const ProgressiveChunk = 2500;
/** 每个 worker 最多几批没回执 */
const ProgressiveInflight = 2;
/** calc 的首屏回话等不到时，过多久照样开始补后批（ms） */
const ProgressiveStartTimeout = 1500;

/**
 * setValue 队列的差量条目（见 Meta2d.valsToPens 的 partial）。
 * 动几何时要带上 calc 维护网格 / 算脏区用的整套几何：取 patchClone 那组字段里**有值的** ——
 * 没值的不带：calc 收到后自己 patchClone 一遍（缺的照样是 undefined，与原来等价）；render 是
 * Object.assign，带上 undefined 反而会把它自己算出来的字段抹掉。
 */
function partialPatchItem(pen: Pen, val: IValue, geometry: boolean, patchFlag: PatchFlag): Pen {
  let item: Pen;
  if (geometry) {
    item = definedGeometry(pen, patchFlag);
    // calc onPatch 的 Rect 分支要用（原来随整图元快照一起到）
    pen.container && (item.container = pen.container);
    pen.textBox && (item.textBox = pen.textBox);
  } else {
    item = { id: pen.id, type: pen.type, index: pen.index, interactive: pen.interactive, patchFlag } as Pen;
  }
  for (const k in val) {
    if (k.indexOf('.') === -1) {
      item[k] = pen[k];
    } else {
      // 'a.b' 由主线程 onPatch 用 setter 落到图元上（与整图元快照里的 pathVals 同一条路），这里只带本次的
      (item.pathVals ??= {})[k] = val[k];
    }
  }
  // render 只在 update 带 text 时重算文字行 / 文字框（整图元快照恒带 text）：改 fontSize / textAlign 等也要重排
  if (pen.text != undefined) {
    item.text = pen.text;
  }
  return item;
}

/** patchClone 那组字段里有值的（理由见 partialPatchItem） */
function definedGeometry(pen: Pen, patchFlag: PatchFlag): Pen {
  const full = patchClone(pen, { patchFlag });
  const item = {} as Pen;
  for (const k in full) {
    if (full[k] !== undefined) {
      item[k] = full[k];
    }
  }
  return item;
}

/** 插件图元的 beforeUpdate / afterUpdate、DOM 图元的 setElementStyle 一直按整图元快照工作 ⇒ 不走差量 */
function canPartialPatch(pen: Pen) {
  return !beforeUpdateFns[pen.type] && !afterUpdateFns[pen.type] && pen.category !== PenCategory.HtmlElement;
}

const WindowResizeLayoutStyles = ['flex', 'width', 'height', 'box-sizing'] as const;
const WindowResizeDisplayStyles = ['visibility', 'pointer-events'] as const;
type WindowResizeStyleProperty = (typeof WindowResizeLayoutStyles)[number] | (typeof WindowResizeDisplayStyles)[number];
type WindowResizeStyle = { value: string; priority: string };

export class Meta2d extends HTMLElement {
  bottomElement: HTMLElement;
  backgroundCanvas: HTMLCanvasElement;
  renderCanvas: HTMLCanvasElement;
  hoverCanvas: HTMLCanvasElement;
  ruleCanvas: HTMLCanvasElement;
  topElement: HTMLElement;
  inputElement: HTMLElement;

  dialog?: Dialog;
  resizeObserver?: ResizeObserver;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private resizeFrame = 0;
  private pendingViewportWidth = 0;
  private pendingViewportHeight = 0;
  private windowResizeTimer?: number;
  private windowResizeReleaseTimer?: number;
  private windowResizeFrames = new Set<number>();
  private windowResizeReleaseId = 0;
  private windowResizeStyles?: Record<WindowResizeStyleProperty, WindowResizeStyle>;
  private windowResizeViewHandler?: (payload?: { resizeId?: number }) => void;
  private initialized = false;
  private connectionId = 0;
  resizeId = 0;

  dpr = globalThis.devicePixelRatio || 1;
  data: Meta2dData = { x: 0, y: 0, scale: 1, pens: [] };
  options: Options = structuredClone(defaultOptions);

  penMap: Map<string, Pen> = new Map();
  componentElementMap: Map<string, HTMLElement> = new Map();
  componentInstanceMap: Map<string, any> = new Map();
  map?: ViewMap;

  renderWorker: Worker;
  calcWorker: Worker;
  hoverWorker: Worker;
  utilityWorker: Worker;

  mousedown: any;
  mousePos: any = {};
  lastDrag: number;

  /**
   * 拾取请求的帧合并状态（M9 / G3）。
   *
   * mousemove 的频率由鼠标硬件决定（125~1000Hz），与刷新率无关；拾取是纯查询，
   * 一帧内只有最后一个位置的结果会被看见，可以安全合并。
   */
  pickFrame: number;
  pendingPick: { x: number; y: number };
  /** 上一个处理过的 mousemove，用于跳过浏览器在原位置补发的重复事件（见 handleMouseMove） */
  lastMove: { x: number; y: number; offsetX: number; offsetY: number; buttons: number; keys: number };

  /**
   * 平移请求的帧合并状态（M12）。
   *
   * `mode` 区分两类语义，合并方式相反：`abs` 取最新值（拖拽是负反馈回路），
   * `delta` 必须累加（滚轮/触摸是纯增量，丢了就永久丢失）。详见 requestTranslate。
   */
  /** 缩放 / 旋转的 mousemove 按帧合并（见 meta2d-mouse.flushHoverMove） */
  hoverMoveFrame: number;
  pendingHoverMove: { type: HoverType; dx: number; dy: number };
  translateFrame: number;
  pendingTranslate: { mode: 'abs' } | { mode: 'delta'; x: number; y: number };
  modeFns: {
    [key: number]: Function;
  } = {
    [InteractionMode.CanvasTranslate]: requestTranslate,
    [InteractionMode.CanvasSelectPens]: selectPens,
    [InteractionMode.CanvasDragPens]: dragPens,
    [InteractionMode.CanvasMagnifier]: magnifier,
  };
  modeDoneFns: {
    [key: number]: Function;
  } = { [InteractionMode.CanvasSelectPens]: selectPensDone, [InteractionMode.CanvasDragPens]: dragPensDone };

  hoverTypeFns: { [key: number]: Function } = {
    [HoverType.Rotate]: rotatePens,
    [HoverType.Resize]: resizePens,
  };
  hoverTypeDoneFns: {
    [key: number]: Function;
  } = {
    [HoverType.Rotate]: rotatePensDone,
    [HoverType.Resize]: reiszePensDone,
  };

  keydownFns: {
    [key: string]: Function;
  } = KeydownFns;

  // 编辑态 hover 是「选中目标」（编组已换成父图元、锁定已穿透）；hoverTopId 是鼠标下最上层的图元，Alt 直接选中用
  hover: Pen;
  hoverTopId: string;
  // Alt+按下时记下的最上层图元，松开时若没拖动就选中它
  directPenId: string;
  hoverBoundary: Rect;

  hoverType: HoverType;
  hoverAnchor: Point;
  hoverLinePoint?: Point;
  hoverCp: number = 0;
  sizeDirection: number;

  activePens: Pen[] = [];
  activeBoundary: Rect;

  lineType = 'curve';
  /** 当前正在创建或重连的连线类型，避免已有连线被全局 lineType 覆盖。 */
  drawingLineType?: string;
  /** 画线过程中空格切换前的操作线型；一条线结束时清理（见 meta2d-keyevent restoreDrawingLineType） */
  drawingLineTypeBefore?: string;
  /** 按 O 进入正交连线模式前的 lineType；退出连线模式时还原 */
  drawModeLineTypeBefore?: string;
  // 连线绘制期间保存稳定的起点引用，避免 hover 状态变化或 Worker 克隆对象导致连接到错误图元。
  drawingLineFrom?: { penId: string; anchorId: string };
  // 连线绘制期间保存稳定的终点引用，完成连线时据此从 penMap 获取真实图元和锚点。
  drawingLineTo?: { penId: string; anchorId: string };
  draggingAnchor?: boolean;
  editingAnchor: boolean = false;

  actions: Action[] = [];
  actionIndex = -1; // redo的前一个动作，undo直接获取

  draggingPens?: Pen[]; // 属于activePens图元，但是属性完整
  /** 截图 15：主线程发出的 Patch 序号，与每个图元最近一次被发出时的序号（回声去旧用，见 onPatch） */
  patchSeq = 0;
  penPatchSeq = new Map<string, number>();
  /** 每条 Patch 的 beforeUpdate 里各图元的 index，按序号存（calc 回声不带 beforeUpdate，见 patch()） */
  patchBeforeIndex = new Map<number, Map<string, number>>();
  dragCopy?: boolean;
  lastRotate?: number;
  initRotate?: number;
  rotatePovit?: Point;
  lastBeforeUpdate?: Pen[];
  beforeBoundary?: Rect;
  lastActiveBoundary?: Rect;

  imageStates: Record<string, boolean> = {};
  /** render Worker 中已创建播放器的 GIF 图元及其图片地址，用于区分“资源已缓存”和“实例已初始化”。 */
  gifPlayerImages = new Map<string, string>();
  /** 正在下载的 GIF 及等待初始化的图元，避免视口更新期间重复请求同一地址。 */
  gifLoadingPens = new Map<string, Map<string, Pen>>();
  /** SVG 正在栅格化的尺寸（按 URL），防止缩放时同一 URL 多个尺寸同时在飞、小的晚到盖掉大的（loadImages） */
  svgLoading = new Map<string, number>();
  /** hover worker 已拿到（或正在拿）的拖拽预览图尺寸，按 URL；非 SVG 为 Infinity（loadDragImages） */
  hoverImageSizes = new Map<string, number>();
  guideLines: GuideLine[] = [];
  lastMagnifierCall = 0;

  clientRect: DOMRect;

  touchStartTimer?: any;
  touchStart = 0;
  touchCenter?: Point;
  initTouchDis?: number;
  initScale?: number;
  startTouches?: TouchList;
  lastOffsetX?: number;
  lastOffsetY?: number;
  twoFingerTouchStart?: number;
  twoFingerMoved = false;

  addCaches?: Pen[]; // 拖拽到画布上的图元临时缓存
  dragStart?: { x: number; y: number };
  dropPen?: Pen;

  textBoxs: any = {}; // 文字实际的绘画区域。主要用于文字溢出，当文字溢出时，textBoxs将超出textRects

  textInputting?: string; // 不为空表示正在进行文本输入，值为pen的id
  textAdd?: boolean; // 是否新增文本。主要用于连线文字输入

  patchQueue: IValue[] = [];
  private queueTimer: any;
  private queueConsume: any;
  /**
   * setValue 队列的背压（与视口背压 viewInFlight 同一个思路）。
   *
   * 原来队列每 patchQueueDelay 发一批，不管上一批画没画完。一批的代价（主线程克隆 / 序列化、calc 算脏区、
   * render 重画）超过间隔时，worker 的消息队列只增不减：画面越来越落后，最后看上去静止。
   *
   * 改成同一时间只有一批在途：已发出、render 还没回 PatchRendered 的批次序号记在这里，
   * 期间到来的 setValue 继续留在 patchQueue 里，下一批按 id 合并后只发最新值 ⇒ 丢的是中间值，不是画面。
   */
  queueInFlight = new Set<number>();
  /** 上一批发出的时刻。回执丢失（worker 报错等）时的兜底：超过 QueueAckTimeout 就不再等 */
  private queueSentAt = 0;
  /** 已安排了下一次发送（微任务或定时器），见 scheduleQueue */
  private queueScheduled = false;
  /** disconnectedCallback 之后不再发（已排上的微任务照样会跑）；init 时复位 */
  private queueStopped = false;
  /** 队列批次的 update 留在主线程（calc 回声不带它，见 patch() 的 queued） */
  queuedUpdates = new Map<number, Pen[]>();

  /** 第几次 open（分批打开用来认出是不是这一次的回话，见 planProgressiveLoad） */
  private loadSeq = 0;
  /** 分批打开中：还没补给 worker 的后批 */
  private pendingLoad?: {
    seq: number;
    rest: Pen[];
    next: number;
    started: boolean;
    inflight: { render: number; calc: number };
    resolve: () => void;
    timer: any;
  };
  /** 分批打开中，全部到齐时 resolve（见 whenLoaded） */
  private loading?: Promise<void>;

  record?: boolean;
  collaborate?: boolean;
  /** 当前协作会话中各图元最后一次被哪个成员修改。 */
  collaboratePointers: Map<string, CollaboratePointer> = new Map();

  inViewPenIds: string[] = [];
  /**
   * `inViewPenIds` 的 Set 镜像，专供成员判定。
   *
   * 视口集合有上万成员，外层套着 penMap 遍历时用 `includes()` 就是 O(视口内 × 总数)。
   * 数组本身要传给 render worker、也是对外可见状态，所以保留不动，另挂一个 Set 承接查询。
   *
   * ⚠ 两者必须同步更新，写入点只有三处：`onUpdateView`、`addPens`、以及此处初值。
   *
   * **按需建**：平移时每条视口都整体换一次集合，而查询方只有 `setElementStyle`（HTML 组件图元）
   * 和 `snapToPen`（拖拽）—— 纯平移一次都不查（设计文档 9.9au）。
   */
  get inViewPenIdSet(): Set<string> {
    if (!this._inViewPenIdSet) {
      this._inViewPenIdSet = new Set(this.inViewPenIds);
    }
    return this._inViewPenIdSet;
  }
  /** 惰性缓存；undefined = 集合已换、还没人查过 */
  private _inViewPenIdSet: Set<string> | undefined = new Set();

  /** 整体替换视口集合，保持数组与 Set 一致 */
  setInViewPenIds(ids: string[]) {
    this.inViewPenIds = ids || [];
    this._inViewPenIdSet = undefined;
  }

  /**
   * 视口背压状态（见 meta2d-message.postView）。
   * `viewInFlight`：已发给 render、还没收到 `ViewRendered` 回执的那一条。
   * `pendingView`：在此期间产生的最新视口，只留一条，回执到达时立刻补发。
   */
  viewInFlight = false;
  pendingView: any = undefined;

  private toPngRequestId = 0;
  toPngCallbacks: Map<number, (buffer: ArrayBuffer, error?: string) => void> = new Map();

  interactionStateMachine = new InteractionStateMachine();
  hoverTypeHandler = new HoverTypeHandler(this);

  emitter: Emitter<any> = mitt();

  private resolveReady: () => void;
  private rejectReady: (error: unknown) => void;
  /** 挂载后自动初始化宿主资源；打开图纸前可等待此 Promise。 */
  readonly ready = new Promise<void>((resolve, reject) => {
    this.resolveReady = resolve;
    this.rejectReady = reject;
  });

  // 常用属性
  static get observedAttributes() {
    return ['theme', 'rule', 'scroll'];
  }

  onCopy = copy.bind(this);
  onCut = cut.bind(this);
  onPaste = paste.bind(this);

  constructor() {
    super();

    // 声明式使用时也要报告失败，同时保留 ready 的拒绝状态供调用方处理。
    void this.ready.catch((error) => console.warn('画布资源初始化失败：', error));

    this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          border: none;
          outline: none;
          background: none;
        }
        :host > * {
          position: absolute;
          top: 0;
          left: 0;
          border: none;
          outline: none;
          width: 100%;
          height: 100%;
        }
        #input-box {
          position: absolute;
          display: flex;
          top: 0;
          width:0;
          z-index: 100;
          visibility: hidden;
        }
        #input {
          outline: none;
          padding: 0 2px;
          border: 1px solid #1890ff80;
          width:auto;
          height: auto;
          caret-color: #f5222d;
        }
        #input::selection {
          background: #9fffbe;
        }
        #input::-webkit-scrollbar {
          display: none; /* WebKit 内核浏览器隐藏滚动条，滚动能力由 overflow:auto 保留 */
        }
      </style>
      <canvas id="background"></canvas>
      <div id="bottom"></div>
      <canvas id="render"></canvas>
      <canvas id="hover"></canvas>
      <canvas id="rule"></canvas>
      <div id="top" tabindex="0"></div>
      <div id="input-box">
        <div id="input" contenteditable="true"></div>
      </div>
    `;

    themeManager.init(this);

    // this.init();
  }

  init() {
    this.initDom(this.shadowRoot);
    this.createRenderWorker();
    this.createCalcWorker();
    this.createHoverWorker();
    this.createUtilityWorker();
    this.setOptions(this.options);
    this.registerDefault();
    this.topElement.focus();

    this.snapToPen = snapToPen.bind(this);

    // setValue 队列不再用固定间隔的 setInterval 轮询，改为有值进队 / 上一批画完时按需安排（见 scheduleQueue）
    this.queueConsume = this.consumePatchQueue.bind(this);
    this.queueStopped = false;
    this.queueScheduled = false;
    this.queueInFlight.clear();
    this.scheduleQueue();
  }

  private initDom(shadowRoot: ShadowRoot) {
    this.bottomElement = shadowRoot.getElementById('bottom');
    this.backgroundCanvas = shadowRoot.getElementById('background') as HTMLCanvasElement;
    this.renderCanvas = shadowRoot.getElementById('render') as HTMLCanvasElement;
    this.hoverCanvas = shadowRoot.getElementById('hover') as HTMLCanvasElement;
    this.ruleCanvas = shadowRoot.getElementById('rule') as HTMLCanvasElement;
    this.topElement = shadowRoot.getElementById('top');
    this.inputElement = shadowRoot.getElementById('input');

    // 高清屏幕适配:
    this.backgroundCanvas.width = this.backgroundCanvas.clientWidth * this.dpr;
    this.backgroundCanvas.height = this.backgroundCanvas.clientHeight * this.dpr;
    this.renderCanvas.width = this.renderCanvas.clientWidth * this.dpr;
    this.renderCanvas.height = this.renderCanvas.clientHeight * this.dpr;
    this.hoverCanvas.width = this.hoverCanvas.clientWidth * this.dpr;
    this.hoverCanvas.height = this.hoverCanvas.clientHeight * this.dpr;
    this.ruleCanvas.width = this.ruleCanvas.clientWidth * this.dpr;
    this.ruleCanvas.height = this.ruleCanvas.clientHeight * this.dpr;

    this.topElement.oncontextmenu = this.preventEvent;

    this.topElement.onclick = handleClick.bind(this);
    // 按下时捕获指针：mousemove / mouseup 只挂在 topElement 上，拖拽途中鼠标一移到盖在画布上的 DOM
    // （页面浮层、面板）或移出画布，就收不到后续事件 —— 拖动的锚点 / 图元停在边缘不跟手，松手也丢了、拖拽没提交。
    // 捕获后浏览器把这个指针的事件（含兼容的 mouse 事件）都派给 topElement，offsetX / Y 仍相对它，松手自动释放。
    // 只在直接按在 topElement 上时捕获：按在 dom 图元（iframe / video / 输入框）上不能抢它们的事件。
    this.topElement.onpointerdown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.target === this.topElement) {
        this.topElement.setPointerCapture(e.pointerId);
      }
    };
    this.topElement.onmousedown = handleMouseDown.bind(this);
    this.topElement.onmousemove = handleMouseMove.bind(this);
    this.topElement.onmouseup = handleMouseUp.bind(this);
    this.topElement.ondblclick = handleDblclick.bind(this);
    this.topElement.onmouseleave = handleMouseLeave.bind(this);
    this.topElement.onwheel = handleWheel.bind(this);

    // ios
    this.topElement.addEventListener('gesturestart', this.preventEvent);

    this.topElement.ondragover = handleDragover.bind(this);
    this.topElement.ondrop = handleDrop.bind(this);
    this.topElement.ontouchstart = handleTouchstart.bind(this);
    this.topElement.ontouchmove = handleTouchmove.bind(this);
    this.topElement.ontouchend = handleTouchend.bind(this);

    this.inputElement.parentElement.onkeydown = (e) => e.stopPropagation;
    this.inputElement.onblur = this.exitTextInput.bind(this);
    this.inputElement.onkeydown = (e) => e.stopPropagation;
    this.inputElement.oncopy = (e) => e.stopPropagation;
    this.inputElement.oncut = (e) => e.stopPropagation;
    this.inputElement.onpaste = (e) => e.stopPropagation;

    this.topElement.addEventListener('copy', this.onCopy);
    this.topElement.addEventListener('cut', this.onCut);
    this.topElement.addEventListener('paste', this.onPaste);

    this.topElement.addEventListener('keydown', this.onKeyDown);
    this.topElement.addEventListener('keyup', this.onKeyUp);

    this.clientRect = this.topElement.getBoundingClientRect();
  }

  private preventEvent(e: MouseEvent) {
    e.preventDefault();
  }

  private restoreWindowResizeStyles(properties: readonly WindowResizeStyleProperty[]) {
    if (!this.windowResizeStyles) return;
    for (const property of properties) {
      const { value, priority } = this.windowResizeStyles[property];
      value ? this.style.setProperty(property, value, priority) : this.style.removeProperty(property);
    }
  }

  private clearWindowResizeReleaseWork() {
    for (const frame of this.windowResizeFrames) {
      cancelAnimationFrame(frame);
    }
    this.windowResizeFrames.clear();
    if (this.windowResizeReleaseTimer !== undefined) {
      window.clearTimeout(this.windowResizeReleaseTimer);
      this.windowResizeReleaseTimer = undefined;
    }
    if (this.windowResizeViewHandler) {
      this.off('resizeView', this.windowResizeViewHandler);
      this.windowResizeViewHandler = undefined;
    }
  }

  private requestWindowResizeFrame(callback: FrameRequestCallback) {
    const frame = requestAnimationFrame((time) => {
      this.windowResizeFrames.delete(frame);
      callback(time);
    });
    this.windowResizeFrames.add(frame);
  }

  private finishWindowResize(releaseId: number) {
    if (releaseId !== this.windowResizeReleaseId) return;
    this.clearWindowResizeReleaseWork();
    this.requestWindowResizeFrame(() => {
      this.requestWindowResizeFrame(() => {
        if (releaseId !== this.windowResizeReleaseId) return;
        this.restoreWindowResizeStyles(WindowResizeDisplayStyles);
        this.windowResizeStyles = undefined;
      });
    });
  }

  private releaseWindowResize() {
    const releaseId = ++this.windowResizeReleaseId;
    this.clearWindowResizeReleaseWork();
    if (!this.windowResizeStyles) {
      this.resize();
      return;
    }

    // 先隐藏画布并解除固定尺寸，等浏览器完成布局后再同步各 Worker 的视口。
    this.style.setProperty('visibility', 'hidden');
    this.style.setProperty('pointer-events', 'none');
    this.restoreWindowResizeStyles(WindowResizeLayoutStyles);
    this.requestWindowResizeFrame(() => {
      this.requestWindowResizeFrame(() => {
        if (releaseId !== this.windowResizeReleaseId) return;
        const expectedResizeId = this.resizeId + 1;
        this.windowResizeViewHandler = (payload) => {
          if (payload?.resizeId >= expectedResizeId) {
            this.finishWindowResize(releaseId);
          }
        };
        this.on('resizeView', this.windowResizeViewHandler);
        this.resize();
        this.windowResizeReleaseTimer = window.setTimeout(() => this.finishWindowResize(releaseId), 120);
      });
    });
  }

  private handleWindowResize = () => {
    ++this.windowResizeReleaseId;
    this.clearWindowResizeReleaseWork();
    if (!this.windowResizeStyles) {
      const { width, height } = this.getBoundingClientRect();
      if (width && height) {
        const styles = {} as Record<WindowResizeStyleProperty, WindowResizeStyle>;
        for (const property of [...WindowResizeLayoutStyles, ...WindowResizeDisplayStyles]) {
          styles[property] = {
            value: this.style.getPropertyValue(property),
            priority: this.style.getPropertyPriority(property),
          };
        }
        this.windowResizeStyles = styles;
        this.style.setProperty('box-sizing', 'border-box');
        this.style.setProperty('flex', '0 0 auto');
        this.style.setProperty('width', `${width}px`);
        this.style.setProperty('height', `${height}px`);
      }
    }
    if (this.windowResizeTimer !== undefined) {
      window.clearTimeout(this.windowResizeTimer);
    }
    this.windowResizeTimer = window.setTimeout(() => {
      this.windowResizeTimer = undefined;
      this.releaseWindowResize();
    }, 200);
  };

  private clearWindowResize() {
    ++this.windowResizeReleaseId;
    window.removeEventListener('resize', this.handleWindowResize);
    if (this.windowResizeTimer !== undefined) {
      window.clearTimeout(this.windowResizeTimer);
      this.windowResizeTimer = undefined;
    }
    this.clearWindowResizeReleaseWork();
    this.restoreWindowResizeStyles(WindowResizeLayoutStyles);
    this.restoreWindowResizeStyles(WindowResizeDisplayStyles);
    this.windowResizeStyles = undefined;
  }

  resize() {
    const rect = this.getBoundingClientRect();
    const width = rect.width || this.clientWidth || this.renderCanvas.clientWidth;
    const height = rect.height || this.clientHeight || this.renderCanvas.clientHeight;
    if (!width || !height) {
      return;
    }

    const pixelWidth = Math.round(width * this.dpr);
    const pixelHeight = Math.round(height * this.dpr);
    this.pendingViewportWidth = pixelWidth;
    this.pendingViewportHeight = pixelHeight;

    this.clientRect = this.topElement.getBoundingClientRect();

    if (this.resizeFrame) {
      return;
    }

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;

      const nextWidth = this.pendingViewportWidth;
      const nextHeight = this.pendingViewportHeight;
      if (this.viewportWidth === nextWidth && this.viewportHeight === nextHeight) {
        return;
      }

      this.viewportWidth = nextWidth;
      this.viewportHeight = nextHeight;

      const resizeId = ++this.resizeId;

      this.renderWorker.postMessage({
        action: WorkerMessage.Resize,
        width: nextWidth,
        height: nextHeight,
      });

      this.calcWorker.postMessage({
        action: WorkerMessage.Resize,
        resizeId,
        width: nextWidth,
        height: nextHeight,
        canvasWidth: nextWidth / this.dpr,
        canvasHeight: nextHeight / this.dpr,
      });

      this.hoverWorker.postMessage({
        action: WorkerMessage.Resize,
        width: nextWidth,
        height: nextHeight,
      });

      this.utilityWorker.postMessage({
        action: WorkerMessage.Resize,
        width: nextWidth,
        height: nextHeight,
      });

      this.map?.setView();
      this.map?.scheduleRefresh();
    });
  }

  private registerDefault() {
    registerSvgDraws(this, penDefines);
    for (const item of penDefines) {
      if (item.defaultAnchorFn) {
        defaultAnchorFns[item.type] = item.defaultAnchorFn;
      }
      if (item.dragover) {
        dragoverFns[item.type] = item.dragover;
      }
      if (item.drop) {
        dropFns[item.type] = item.drop;
      }
      // 图元生命周期函数
      if (item.create) {
        createFns[item.type] = item.create;
      }
      if (item.beforeUpdate) {
        beforeUpdateFns[item.type] = item.beforeUpdate;
      }
      if (item.afterUpdate) {
        afterUpdateFns[item.type] = item.afterUpdate;
      }
      if (item.mouseDown) {
        mouseDownFns[item.type] = item.mouseDown;
      }
      if (item.mouseMove) {
        mouseMoveFns[item.type] = item.mouseMove;
      }
      if (item.mouseUp) {
        mouseUpFns[item.type] = item.mouseUp;
      }
      if (item.mouseEnter) {
        mouseEnterFns[item.type] = item.mouseEnter;
      }
      if (item.mouseLeave) {
        mouseLeaveFns[item.type] = item.mouseLeave;
      }
      if (item.input) {
        inputFns[item.type] = item.input;
      }
      if (item.wheel) {
        wheelFns[item.type] = item.wheel;
      }
      if (item.scale) {
        scaleFns[item.type] = item.scale;
      }
      if (item.toDataURL) {
        toPngFns[item.type] = item.toDataURL;
      }
      if (item.changeTheme) {
        changeThemeFns[item.type] = item.changeTheme;
      }
      if (item.destroy) {
        destroyFns[item.type] = item.destroy;
      }
    }

    this.registerElement(baseElementDefines);
  }

  async register(filePath: string) {
    try {
      await import(/* @vite-ignore */ filePath);
      const { penDefines } = await import(/* @vite-ignore */ filePath);

      registerSvgDraws(this, penDefines);
      for (const item of penDefines) {
        if (item.defaultAnchorFn) {
          defaultAnchorFns[item.type] = item.defaultAnchorFn;
        }
        if (item.dragover) {
          dragoverFns[item.type] = item.dragover;
        }
        if (item.drop) {
          dropFns[item.type] = item.drop;
        }
        // 图元生命周期函数
        if (item.create) {
          createFns[item.type] = item.create;
        }
        if (item.beforeUpdate) {
          beforeUpdateFns[item.type] = item.beforeUpdate;
        }
        if (item.afterUpdate) {
          afterUpdateFns[item.type] = item.afterUpdate;
        }
        if (item.mouseDown) {
          mouseDownFns[item.type] = item.mouseDown;
        }
        if (item.mouseMove) {
          mouseMoveFns[item.type] = item.mouseMove;
        }
        if (item.mouseUp) {
          mouseUpFns[item.type] = item.mouseUp;
        }
        if (item.mouseEnter) {
          mouseEnterFns[item.type] = item.mouseEnter;
        }
        if (item.mouseLeave) {
          mouseLeaveFns[item.type] = item.mouseLeave;
        }
        if (item.input) {
          inputFns[item.type] = item.input;
        }
        if (item.wheel) {
          wheelFns[item.type] = item.wheel;
        }
        if (item.scale) {
          scaleFns[item.type] = item.scale;
        }
        if (item.toPng) {
          toPngFns[item.type] = item.toPng;
        }
        if (item.changeTheme) {
          changeThemeFns[item.type] = item.changeTheme;
        }
        if (item.destroy) {
          destroyFns[item.type] = item.destroy;
        }
      }

      this.renderWorker.postMessage({
        action: WorkerMessage.RegisterPen,
        path: filePath,
      });

      this.hoverWorker.postMessage({
        action: WorkerMessage.RegisterPen,
        path: filePath,
      });

      if (this.options.mode === Mode.Edit) {
        this.calcWorker.postMessage({
          action: WorkerMessage.RegisterPen,
          path: filePath,
        });
      }

      // 如果已经加载了数据，触发重新渲染以显示新注册的图元
      if (this.penMap.size > 0) {
        const penIds = Array.from(this.penMap.keys());
        this.renderWorker.postMessage({
          action: WorkerMessage.UpdateView,
          penIds,
        });
      }
    } catch (e) {
      console.error('注册图形库错误：', e);
    }
  }

  // 注册HTML Element图元，仅用于不需要离屏canvas线程渲染的外部HTML元素
  registerElement(elemDefines: any[]) {
    for (const item of elemDefines) {
      if (item.defaultAnchorFn) {
        defaultAnchorFns[item.type] = item.defaultAnchorFn;
      }
      if (item.dragover) {
        dragoverFns[item.type] = item.dragover;
      }
      if (item.drop) {
        dropFns[item.type] = item.drop;
      }
      // 图元生命周期函数
      if (item.create) {
        createFns[item.type] = item.create;
      }
      if (item.beforeUpdate) {
        beforeUpdateFns[item.type] = item.beforeUpdate;
      }
      if (item.afterUpdate) {
        afterUpdateFns[item.type] = item.afterUpdate;
      }
      if (item.mouseMove) {
        mouseMoveFns[item.type] = item.mouseMove;
      }
      if (item.mouseUp) {
        mouseUpFns[item.type] = item.mouseUp;
      }
      if (item.scale) {
        scaleFns[item.type] = item.scale;
      }
      if (item.toPng) {
        toPngFns[item.type] = item.toPng;
      }
      if (item.changeTheme) {
        changeThemeFns[item.type] = item.changeTheme;
      }
      if (item.destroy) {
        destroyFns[item.type] = item.destroy;
      }
    }
  }

  registerDatasource(filePath: string) {
    this.utilityWorker.postMessage({ action: WorkerMessage.RegisterConnection, filePath });
  }

  /**
   * 四个 worker 的消息入口，开探针时按 action 记主线程的处理耗时（设计文档结论 29 / 30）：
   * - `main:deser:<action>`：第一次读 `e.data` 时的入站解码（Chrome 惰性解，D47）；
   * - `main:handle:<action>`：处理耗时（µs）。⚠ 单条动画只有几十 µs，落在 100µs 的计时分辨率之下 ⇒
   *   **avg 不是单价（D11）**，但 avg × count 作为总量仍可信。
   */
  private dispatch(e: MessageEvent) {
    if (!probe.on) {
      messageFns[e.data.action].call(this, e);
      return;
    }
    // 第五十七轮：Chrome 在第一次读 e.data 时才反序列化，原来 t 取在 `e.data.action` 之后 ⇒
    // `main:handle:*` 从来不含入站解码（D47）。单独记成 `main:deser:*`。
    const t0 = probe.now();
    const action = e.data.action;
    probe.time('main:deser:' + action, t0);
    const t = probe.now();
    messageFns[action].call(this, e);
    probe.time('main:handle:' + action, t);
  }

  private createRenderWorker() {
    this.renderWorker = new Worker(new URL('./workers/render/index.ts', import.meta.url), {
      type: 'module',
    });
    const Offscreen = this.renderCanvas.transferControlToOffscreen();
    this.renderWorker.postMessage(
      { action: WorkerMessage.Init, canvas: Offscreen, dpr: this.dpr, options: this.options },
      [Offscreen],
    );

    this.renderWorker.onmessage = (e: MessageEvent) => {
      this.dispatch(e);
    };
  }

  private createCalcWorker() {
    this.calcWorker = new Worker(new URL('./workers/calc/index.ts', import.meta.url), {
      type: 'module',
    });

    this.calcWorker.onmessage = (e: MessageEvent) => {
      this.dispatch(e);
    };

    this.calcWorker.postMessage({
      action: WorkerMessage.Init,
      canvasWidth: this.renderCanvas.clientWidth,
      canvasHeight: this.renderCanvas.clientHeight,
    });
  }

  private createHoverWorker() {
    this.hoverWorker = new Worker(new URL('./workers/hover/index.ts', import.meta.url), {
      type: 'module',
    });
    this.hoverWorker.onmessage = (e: MessageEvent) => {
      this.dispatch(e);
    };

    const Offscreen = this.hoverCanvas.transferControlToOffscreen();
    this.hoverWorker.postMessage(
      { action: WorkerMessage.Init, canvas: Offscreen, dpr: this.dpr, options: this.options },
      [Offscreen],
    );
  }

  private createUtilityWorker() {
    this.utilityWorker = new Worker(new URL('./workers/utility/index.ts', import.meta.url), {
      type: 'module',
    });

    this.utilityWorker.onmessage = (e: MessageEvent) => {
      this.dispatch(e);
    };

    const bgOffscreen = this.backgroundCanvas.transferControlToOffscreen();
    const ruleOffscreen = this.ruleCanvas.transferControlToOffscreen();
    this.utilityWorker.postMessage(
      {
        action: WorkerMessage.Init,
        bgOffscreen,
        ruleOffscreen,
        dpr: this.dpr,
        options: this.options,
      },
      [bgOffscreen, ruleOffscreen],
    );
  }

  private setElementBackground() {
    if (this.data.width) {
      this.style.background = 'none';
      return;
    }

    this.style.background = this.data.background || this.options.background || '#fff';
  }

  setIconfonts(iconfonts: string[], broadcast = true) {
    if (!this.data.iconfonts) {
      this.data.iconfonts = [];
    }
    const added = Array.from(new Set(iconfonts)).filter((item) => !this.data.iconfonts.includes(item));
    added.forEach((item) => {
      // DOM 图元依赖主线程中的 CSS 类名和伪元素规则，不能只在 Worker 中加载字体。
      injectIconfontCss(item, this.shadowRoot);
      this.data.iconfonts.push(item);
    });

    if (!added.length) return;

    this.renderWorker.postMessage({
      action: WorkerMessage.IconFetch,
      iconfonts: added,
    });

    this.hoverWorker.postMessage({
      action: WorkerMessage.IconFetch,
      iconfonts: added,
    });

    if (broadcast && this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { documentData: { iconfonts: { add: added } } },
      });
    }
  }

  removeIconfont(url: string, broadcast = true) {
    if (!this.data.iconfonts?.includes(url)) return;
    this.data.iconfonts = this.data.iconfonts.filter((item) => item !== url);

    if (broadcast && this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { documentData: { iconfonts: { remove: [url] } } },
      });
    }
  }

  /**
   * 加载主线程字体，并通知渲染和交互线程在后台加载。
   * Worker 字体不作为画布打开的前置条件。
   */
  loadFonts(fontFaceCss: string): Promise<void> {
    return loadFontResources(this, fontFaceCss);
  }

  open(data?: Meta2dData) {
    // 输入中换数据：先退出输入，否则之后失焦触发的 exitTextInput 会去读已不存在的图元
    this.cancelTextInput();
    this.clearComponentElements();
    this.penMap.clear();
    this.actions = [];
    this.actionIndex = -1;
    this.hover = undefined;
    this.hoverTopId = undefined;
    this.hoverLinePoint = undefined;
    this.hoverBoundary = undefined;
    this.activeBoundary = undefined;
    this.activePens = [];
    this.guideLines = [];
    this.imageStates = {};
    this.gifPlayerImages.clear();
    this.gifLoadingPens.clear();
    // hover 的 onData 会清空它的图片缓存，这里跟着清
    this.hoverImageSizes.clear();
    this.interactionStateMachine.state = InteractionMode.None;
    this.drawingLineFrom = undefined;
    this.drawingLineTo = undefined;
    this.draggingAnchor = undefined;
    this.editingAnchor = false;
    this.collaborate = undefined;
    this.collaboratePointers.clear();
    this.hoverWorker?.postMessage({ action: WorkerMessage.Collaborate, clear: true });

    let anchorMode = this.options?.anchorMode || AnchorMode.Hidden;
    anchorMode &= ~AnchorMode.Drawline;
    anchorMode &= ~AnchorMode.Pencil;
    this.setOptions({ anchorMode });

    // 打开新图纸时保留实例初始化阶段配置的图标字体，避免数据未携带 iconfonts 时覆盖宿主配置。
    const configuredIconfonts = this.data.iconfonts || [];
    const dataIconfonts = data?.iconfonts || [];
    this.data = {
      x: 0,
      y: 0,
      scale: 1,
      pens: [],
      ...data,
      iconfonts: Array.from(new Set([...configuredIconfonts, ...dataIconfonts])),
    };
    // 打开已有图纸时，DOM 图元运行在当前 Shadow DOM 中，需要把图纸声明的字体样式注入主线程。
    // 渲染 Worker 会单独加载 iconfonts，但 Worker 中的字体不会作用到 menuDom 等 DOM 图元。
    for (const cssUrl of this.data.iconfonts || []) {
      injectIconfontCss(cssUrl, this.shadowRoot);
    }
    const theme = themeManager.apply(this, this.data.theme || 'dark');
    if (!this.data.scale) {
      this.data.scale = 1;
    }
    const animatePens = dealData(this.data.pens, this.penMap);
    this.data.paths && getPathBBoxs(this.data.paths);
    // 项目初始化函数
    if (this.data.initJs?.trim()) {
      try {
        const fn = new Function('context', this.data.initJs) as (context?: { meta2d: Meta2d }) => void;
        fn({ meta2d: this });
      } catch (e) {
        console.warn('initJs error', e);
      }
    } else if (this.beforeRender) {
      this.beforeRender();
    }

    // 分批打开（图元多时）：先只发视口里的，其余在首屏画出来之后分批补（见 planProgressiveLoad）
    const load = this.planProgressiveLoad(animatePens);
    const firstData = load ? { ...this.data, pens: load.first } : this.data;

    // 默认锚点不发，worker 自己算（见 elideDefaultAnchors）；两条 postMessage 之间同步，发完立刻放回
    const elided = elideDefaultAnchors(firstData.pens || []);
    try {
      this.renderWorker.postMessage({
        action: WorkerMessage.Data,
        data: firstData,
        pathBBoxs: getPathBBoxCache(),
        defaultAnchors: elided.mask,
      });

      this.calcWorker.postMessage({
        action: WorkerMessage.Data,
        data: firstData,
        canvasWidth: this.renderCanvas.clientWidth,
        canvasHeight: this.renderCanvas.clientHeight,
        progressive: load && { loadSeq: load.seq, total: load.total, bounds: load.bounds },
        defaultAnchors: elided.mask,
      });
    } finally {
      elided.restore();
    }

    this.hoverWorker.postMessage({
      action: WorkerMessage.Data,
      data: {
        x: this.data.x,
        y: this.data.y,
        scale: this.data.scale,
        background: this.data.background,
        color: this.data.color,
        lineGradient: this.data.lineGradient,
        penBackground: this.data.penBackground,
        penGradient: this.data.penGradient,
        textColor: this.data.textColor,
        textGradient: this.data.textGradient,
        fontSize: this.data.fontSize,
        iconfonts: this.data.iconfonts,
        paths: this.options.mode === Mode.Edit ? data.paths : undefined,
      },
      canvasWidth: this.hoverCanvas.clientWidth,
      canvasHeight: this.hoverCanvas.clientHeight,
      pathBBoxs: this.options.mode === Mode.Edit ? getPathBBoxCache() : undefined,
    });

    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: {
        scale: this.data.scale,
        x: this.data.x,
        y: this.data.y,
        width: this.data.width,
        height: this.data.height,
        background: this.data.background,
        backgroundGradient: this.data.backgroundGradient,
        backgroundImage: this.data.backgroundImage,
        grid: this.data.grid,
        rule: this.data.rule,
        messageNormalizer: this.data.messageNormalizer || '',
        vars: this.data.vars,
        mock: this.data.mock,
        // 仅把模拟所需字段传入 utility worker，避免传递完整图元中的运行时对象。
        pens: this.getMockPens(),
      },
      guideLines: this.guideLines,
    });

    this.execCreateFns();
    themeManager.notify(this, theme);

    // this.penMap是实时最新数据；this.data.pens是旧数据，为避免错用，将清理掉
    setTimeout(() => {
      this.data.pens = [];
    }, 1000);

    this.setElementBackground();

    this.calcBoundDataPoints();

    this.startConnections(true);

    if (animatePens.length) {
      this.startAnimate(animatePens);
    }
    this.emitter.emit('opened');
  }

  /**
   * 分批打开：图元多时 open() 先只把「视口里的 + 有动画的」发给 render / calc，首屏画出来之后再分批补其余的。
   *
   * 原来一次把全部图元结构化克隆给两个 worker：100 万图元时主线程克隆 ~7s，calc 解析、建网格 ~7.6s，
   * 都做完 render 才画第一帧（黑屏 ~8s）。而视口里通常只有几千个。
   *
   * 首批：视口（外扩 ProgressiveMarginPx，盖住文字外溢、描边、阴影；旋转的再按半对角线外扩）里的图元、
   * 带动画的（open 末尾就 startAnimate，calc 得认得它们）、以及这些图元的祖先（render 判可见性要查父图元）。
   * 网格要按全部图元的范围和数量建（否则后补的全进溢出桶、格子过密），所以首批带上 total / bounds。
   *
   * 后批（视口外的）在 calc 回首屏视口（UpdateView 带回 loadSeq）后开始补：每批 ProgressiveChunk 个，
   * 两个 worker 各自最多 ProgressiveInflight 批没回执，回执到了再发 —— 主线程每次只忙十几 ms，
   * worker 也不会被一长串消息堵住（期间的悬停、平移、setValue 照常插队处理）。
   * 每批取的是图元**此刻**的对象：首屏之后、补发之前的 setValue 已经改在图元上，跟着这一批一起到。
   *
   * @returns 不分批时 undefined
   */
  private planProgressiveLoad(animatePens: Pen[]) {
    this.cancelProgressiveLoad();
    const seq = ++this.loadSeq;
    const pens = this.data.pens;
    if (this.options.progressiveLoad === false || !pens || pens.length < ProgressiveMinPens) {
      return undefined;
    }
    const scale = this.data.scale || 1;
    const w = this.renderCanvas.clientWidth;
    const h = this.renderCanvas.clientHeight;
    if (!(w > 0 && h > 0)) {
      return undefined;
    }
    const m = ProgressiveMarginPx / scale;
    const vx0 = -(this.data.x || 0) / scale - m;
    const vy0 = -(this.data.y || 0) / scale - m;
    const vx1 = (-(this.data.x || 0) + w) / scale + m;
    const vy1 = (-(this.data.y || 0) + h) / scale + m;

    // 与 calc onData 量网格范围的口径相同（x / y 的最小、ex / ey 的最大）
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const firstIds = new Set<string>();
    for (const pen of pens) {
      pen.x < minX && (minX = pen.x);
      pen.y < minY && (minY = pen.y);
      pen.ex > maxX && (maxX = pen.ex);
      pen.ey > maxY && (maxY = pen.ey);
      const pad = pen.rotate ? Math.max(pen.width || 0, pen.height || 0) / 2 : 0;
      if (
        (pen.ex + pad > vx0 && pen.x - pad < vx1 && pen.ey + pad > vy0 && pen.y - pad < vy1) ||
        pen.animations?.length
      ) {
        firstIds.add(pen.id);
      }
    }
    for (const pen of animatePens) {
      firstIds.add(pen.id);
    }
    // 祖先跟着进首批
    for (const id of Array.from(firstIds)) {
      let parentId = this.penMap.get(id)?.parentId;
      while (parentId && !firstIds.has(parentId)) {
        firstIds.add(parentId);
        parentId = this.penMap.get(parentId)?.parentId;
      }
    }
    if (firstIds.size > pens.length * ProgressiveMaxFirstRatio) {
      // 大半都在视口里：分批省不了什么，还多一轮往返
      return undefined;
    }
    // pens 本来就按 index 排（dealData 按顺序编号）⇒ 两批各自也是 index 序，calc 的格子不用重排
    const first: Pen[] = [];
    const rest: Pen[] = [];
    for (const pen of pens) {
      (firstIds.has(pen.id) ? first : rest).push(pen);
    }

    let resolve: () => void;
    this.loading = new Promise<void>((r) => (resolve = r));
    this.pendingLoad = {
      seq,
      rest,
      next: 0,
      started: false,
      inflight: { render: 0, calc: 0 },
      resolve,
      // 兜底：calc 的首屏回话没等到（比如画布不可见、视口消息被背压挡着）也要补完
      timer: setTimeout(() => this.startProgressiveLoad(seq), ProgressiveStartTimeout),
    };
    probe.sample('open:firstPens', first.length);
    return { seq, first, total: pens.length, bounds: { minX, minY, maxX, maxY } };
  }

  /** calc 回了这次 open 的首屏视口（见 meta2d-message.onUpdateView），开始补后批 */
  startProgressiveLoad(seq: number) {
    const L = this.pendingLoad;
    if (!L || L.seq !== seq || L.started) {
      return;
    }
    L.started = true;
    clearTimeout(L.timer);
    this.pumpProgressiveLoad();
  }

  private pumpProgressiveLoad() {
    const L = this.pendingLoad;
    if (!L || this.queueStopped) {
      return;
    }
    while (
      L.next < L.rest.length &&
      L.inflight.render < ProgressiveInflight &&
      L.inflight.calc < ProgressiveInflight
    ) {
      const pens = L.rest.slice(L.next, L.next + ProgressiveChunk);
      L.next += pens.length;
      // 默认锚点不发（见 elideDefaultAnchors）；每批现判 —— 首屏之后被 setValue 挪过的图元，锚点就不再是默认的了
      const elided = elideDefaultAnchors(pens);
      const msg = { action: WorkerMessage.DataChunk, pens, loadSeq: L.seq, defaultAnchors: elided.mask };
      try {
        // 先 render 后 calc：calc 因这批里有视口内图元而发的 UpdateView 绕主线程到 render 时，这批一定已在 render 手里
        this.renderWorker.postMessage(msg);
        this.calcWorker.postMessage(msg);
      } finally {
        elided.restore();
      }
      L.inflight.render++;
      L.inflight.calc++;
    }
  }

  /** render / calc 处理完一批 DataChunk（见 meta2d-message.onDataChunkDone） */
  onDataChunkDone(from: 'render' | 'calc', seq: number) {
    const L = this.pendingLoad;
    if (!L || L.seq !== seq) {
      return;
    }
    L.inflight[from]--;
    if (L.next >= L.rest.length && !L.inflight.render && !L.inflight.calc) {
      this.pendingLoad = undefined;
      this.loading = undefined;
      L.resolve();
      this.emitter.emit('loaded');
      return;
    }
    this.pumpProgressiveLoad();
  }

  /** 换数据 / 销毁时：还没补的后批不再补，等着的照样放行 */
  private cancelProgressiveLoad() {
    const L = this.pendingLoad;
    if (!L) {
      return;
    }
    clearTimeout(L.timer);
    this.pendingLoad = undefined;
    this.loading = undefined;
    L.resolve();
  }

  /**
   * 分批打开时，等全部图元都到了 worker（见 planProgressiveLoad）；不在分批中立即返回。
   * 依赖 worker 里有全部图元的操作（如导出图片）先等它。
   */
  whenLoaded(): Promise<void> {
    return this.loading || Promise.resolve();
  }

  private clearComponentElements() {
    for (const pen of this.penMap.values()) {
      try {
        destroyFns[pen.type]?.call(this, pen);
      } catch (e) {
        console.warn('销毁 HTML 图元失败：', pen, e);
      }
    }

    // 先释放残留实例，再移除残留 DOM，避免第三方实例销毁时仍需要访问容器。
    this.componentInstanceMap.forEach((instance, id) => {
      try {
        if (typeof instance?.dispose === 'function') {
          instance.dispose();
        } else if (typeof instance?.destroy === 'function') {
          instance.destroy();
        }
      } catch (e) {
        console.warn('销毁 HTML 图元实例失败：', id, e);
      }
    });
    this.componentInstanceMap.clear();

    this.componentElementMap.forEach((elem) => {
      elem?.remove();
    });
    this.componentElementMap.clear();
  }

  execCreateFns() {
    const elems = new Map();
    for (const pen of this.penMap.values()) {
      if (!createFns[pen.type]) {
        continue;
      }
      const elem = createFns[pen.type].call(this, pen);
      if (elem) {
        elems.set(pen, elem);
      }
    }

    setTimeout(() => {
      for (const [pen, elem] of elems) {
        this.setElementStyle(elem, pen);
      }
    }, 300);
  }

  /** 通过已有变量机制读取最新值，只发给通信线程，不写入画布。 */
  getCommunicationVars(keys: string[] = []) {
    // 合并宿主变量与本地变量，同名时以本地变量为准。
    const values = { ...getLocalVars(), ...globalThis.getVars?.() };
    for (const key of keys) {
      const root = key.split('.')[0];
      if (values[root] === undefined && globalThis[root] !== undefined && typeof globalThis[root] !== 'function') {
        values[root] = globalThis[root];
      }
    }
    return values;
  }

  private getBindings() {
    return Array.from(this.penMap.values()).flatMap(
      (pen) => pen.properties?.flatMap((prop) => (prop.bind?.id ? [prop.bind] : [])) || [],
    );
  }

  // 打开图纸时启动通信连接。stopAll 用于先取消上一张图纸的运行态连接。
  startConnections(stopAll?: boolean) {
    if (stopAll) {
      this.collaborate = undefined;
    }

    this.utilityWorker.postMessage({
      action: WorkerMessage.SetConnections,
      datasources: this.data.datasources,
      boundDataPoints: this.data.boundDataPoints,
      bindings: this.getBindings(),
      vars: this.getCommunicationVars(),
      stopAll,
    });
  }

  /**
   * 开启全局数据模拟，并把当前图元的模拟配置同步到 utility worker。
   */
  startDataMock() {
    this.data.mock = true;
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: {
        mock: true,
        pens: this.getMockPens(),
      },
    });
  }

  /**
   * 关闭全局数据模拟，并清理 utility worker 中的模拟定时器。
   */
  stopDataMock() {
    this.data.mock = false;
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: {
        mock: false,
        pens: this.getMockPens(),
      },
    });
  }

  private getMockPens() {
    // utility 的模拟数据只看带 properties 的图元（见 communications/mock 的 pushMockData）。
    // 原来每个图元都发一个 {id, properties: undefined}：100 万图元时光克隆就要几百 ms
    const pens: { id: string; properties: Pen['properties'] }[] = [];
    for (const pen of this.penMap.values()) {
      pen.properties?.length && pens.push({ id: pen.id, properties: pen.properties });
    }
    return pens;
  }

  // 重新计算绑定数据点，既this.boundDataPoints
  calcBoundDataPoints() {
    // ...
    this.data.boundDataPoints = {};
    const pens = Array.from(this.penMap.values());
    pens.forEach((pen) => {
      pen.properties?.forEach((prop) => {
        if (prop.bind?.id) {
          if (!this.data.boundDataPoints[prop.bind.id]) {
            this.data.boundDataPoints[prop.bind.id] = [];
          }
          this.data.boundDataPoints[prop.bind.id].push({
            id: pen.id,
            key: prop.key,
          });
        }
      });
    });

    this.utilityWorker.postMessage({
      action: WorkerMessage.SetConnections,
      boundDataPoints: this.data.boundDataPoints,
    });
  }

  // 添加或更新数据源。已有 SQL 查询立即刷新，其他数据源在下次打开图纸时生效。
  addOrUpdateDatasource(datasource: Datasource, broadcast = true) {
    if (datasource.collaborator) {
      this.collaborate = true;
    } else {
      this.data.datasources = this.data.datasources || [];

      if (datasource.id) {
        const ds = this.data.datasources.find((d) => d.id === datasource.id);
        if (ds) {
          Object.assign(ds, datasource);
          datasource = ds;
        } else {
          this.data.datasources.push(datasource);
        }
      } else {
        datasource.id = s8();
        datasource.key = datasource.id;
        this.data.datasources.push(datasource);
      }
    }
    if (datasource.enable === false) {
      this.stopConnect(datasource.id);
    } else if (datasource.type === 'SQL') {
      // 画布配置可能包含 Vue Proxy，发送纯数据快照，避免 DataCloneError。
      this.utilityWorker.postMessage({
        action: WorkerMessage.AddOrUpdateConnect,
        datasource: JSON.parse(JSON.stringify(datasource)),
      });
    }

    if (broadcast && this.collaborate && !datasource.collaborator) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: {
          documentData: {
            datasources: { upsert: [sanitizeCollaborateDatasource(datasource)] },
          },
        },
      });
    }
  }

  joinRoom(url: string, readonly?: boolean) {
    resetCollaborateColors();
    this.collaboratePointers.clear();
    this.hoverWorker?.postMessage({ action: WorkerMessage.Collaborate, clear: true });
    this.collaborate = true;
    this.utilityWorker.postMessage({ action: WorkerMessage.JoinRoom, url, readonly });
  }

  deleteDatasource(id: string, broadcast = true) {
    const datasource = this.data.datasources?.find((item) => item.id === id);
    this.data.datasources = (this.data.datasources || []).filter((d) => d.id !== id);
    this.utilityWorker.postMessage({ action: WorkerMessage.StopConnect, id });

    if (broadcast && this.collaborate && datasource && !datasource.collaborator) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { documentData: { datasources: { remove: [id] } } },
      });
    }
  }

  // 连接统一在打开图纸时建立。保留此方法以兼容旧调用，但不在运行期间创建连接。
  startConnect(id: string) {
    void id;
  }

  // 断开数据源连接。如果id为空，表示断开所有连接
  stopConnect(id?: string) {
    if (id) {
      const datasource = this.data.datasources.find((d) => d.id === id);
      if (datasource?.collaborator) {
        this.collaborate = false;
      }
    }

    this.utilityWorker.postMessage({ action: WorkerMessage.StopConnect, id });
  }

  // 执行一个http请求命令。主要用于提交表单、执行SQL等场景
  // 如果dataPoints不为空，则用dataPoints的json对象值作为body参数；否则，使用http自带body参数
  execConnect(http: HttpConfig | string, dataPoints?: DataPoint[]) {
    // ...
    // xxx
  }

  // 使用现有数据源连接发送数据
  sendData(id: string, dataPoints: DataPoint[]) {
    this.utilityWorker.postMessage({ action: WorkerMessage.SendData, id, dataPoints });
  }

  addOrUpdateDataPoint(id: string, dataPoint: DataPoint) {
    const datasource = this.data.datasources.find((d) => d.id === id);
    if (!datasource) {
      return;
    }
    if (!datasource.dataPoints) {
      datasource.dataPoints = [];
    }

    const dp = datasource.dataPoints.find((item) => item.key === dataPoint.key);
    if (dp) {
      Object.assign(dp, dataPoint);
    } else {
      datasource.dataPoints.push(dataPoint);
    }
  }

  deleteDataPoints(id: string, keys: string[]) {
    const datasource = this.data.datasources.find((d) => d.id === id);
    if (!datasource || !datasource.dataPoints) {
      return;
    }

    datasource.dataPoints = datasource.dataPoints.filter((d) => {
      return !keys.includes(d.key);
    });
  }

  getData() {
    const data = structuredClone(this.data);
    const pens = Array.from(this.penMap.values()).sort((a, b) => a.index - b.index);
    for (const pen of pens) {
      // 克隆图元对象，避免修改 penMap 中的原始数据
      const clonedPen = structuredClone(pen);
      delete clonedPen.index;

      // 其他清理
      // ...

      data.pens.push(clonedPen);
    }
    data.version = version;
    return data;
  }

  // 设置当前页面文件配置（页面个性化设置），不包含pens
  setPageConfig(data: Partial<Meta2dData>, broadcast = true) {
    const pageData = { ...data };
    delete pageData.pens;

    const pageSet: Record<string, unknown> = {};
    const pageUnset: string[] = [];
    for (const key of collaboratePageKeys) {
      if (!Object.prototype.hasOwnProperty.call(pageData, key)) continue;
      if (pageData[key] === undefined) pageUnset.push(key);
      else pageSet[key] = pageData[key];
    }

    if (Object.prototype.hasOwnProperty.call(pageData, 'theme')) {
      this.setTheme(pageData.theme || 'dark');
      delete pageData.theme;
    }
    Object.assign(this.data, pageData);
    for (const key of Object.keys(pageData) as (keyof Meta2dData)[]) {
      if (pageData[key] === undefined) delete this.data[key];
    }

    this.setElementBackground();

    this.calcWorker.postMessage({
      action: WorkerMessage.Option,
      data: pageData,
    });
    this.hoverWorker.postMessage({
      action: WorkerMessage.Option,
      data: pageData,
    });
    this.renderWorker.postMessage({
      action: WorkerMessage.Option,
      data: pageData,
    });
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: pageData,
      ...(Object.prototype.hasOwnProperty.call(pageData, 'vars') ? { vars: this.data.vars } : {}),
    });

    if (broadcast && this.collaborate && (Object.keys(pageSet).length || pageUnset.length)) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: {
          documentData: {
            page: {
              ...(Object.keys(pageSet).length ? { set: pageSet } : {}),
              ...(pageUnset.length ? { unset: pageUnset } : {}),
            },
          },
        },
      });
    }
  }

  setMode(mode: Mode) {
    this.setOptions({ mode });
  }

  /** 注册当前画布实例可用的自定义主题。 */
  registerTheme(name: string, input: ThemeInput) {
    return themeManager.register(this, name, input);
  }

  /** 切换当前画布主题，并同步所有渲染线程和图元生命周期。 */
  setTheme(name: string) {
    return themeManager.set(this, name);
  }

  /**
   * 取回各 worker 的性能探针数据。需要先 setOptions({ perfProbe: true })。
   * 默认取回后清空采样窗口，便于「操作一段时间 → 取一次」的测量方式。
   *
   * @example
   *   meta2d.setOptions({ perfProbe: true });
   *   // ...鼠标匀速划过 3 秒...
   *   const r = await meta2d.getPerfReport();
   *   console.table(r.calc.grid);    // 拾取网格体检
   *   console.table(r.calc.timing);  // 各消息处理耗时（微秒）
   *   console.log(r.calc.message);   // 每帧 postMessage 条数
   */
  getPerfReport(opt?: { reset?: boolean; timeout?: number; canvasAudit?: boolean }): Promise<{
    calc?: PerfReport;
    hover?: PerfReport;
    render?: PerfReport;
    main?: PerfReport;
  }> {
    const reset = opt ? opt.reset !== false : true;
    // 原来是 3000ms：平移缩放时 render worker 积压了几秒的队列，探针消息排在最后面，
    // 报告必然超时 ——「没数据」被误读成「没开探针」。放大到 20s 让报告能回来，
    // 积压本身由 worker 侧的 probe:lag（Date.now() - sentAt）量出来。
    const timeout = (opt && opt.timeout) || 20000;

    const ask = (worker: Worker): Promise<PerfReport | undefined> => {
      const reportId = Math.random().toString(36).slice(2);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          perfWaiters.delete(reportId);
          resolve(undefined); // 该 worker 未响应（多半没开 perfProbe），不阻塞其余
        }, timeout);
        perfWaiters.set(reportId, (report: PerfReport) => {
          clearTimeout(timer);
          resolve(report);
        });
        // canvasAudit：让 render 在出报告前把整张画布与「按当前状态完整重画」逐像素比一次（见 render 的 auditCanvas）。
        // 走探针消息而不是 setOptions，是因为 setOptions 会 resetRender 清屏 —— 要查的残影会先被擦掉。
        worker.postMessage({
          action: WorkerMessage.PerfProbe,
          reportId,
          reset,
          sentAt: Date.now(),
          canvasAudit: opt?.canvasAudit,
        });
      });
    };

    return Promise.all([ask(this.calcWorker), ask(this.hoverWorker), ask(this.renderWorker)]).then(
      ([calc, hover, render]) => ({
        calc,
        hover,
        render,
        // 主线程这一份是**同步取**的，没有消息往返 ⇒ 没有 probe:lag 可言，
        // 也没有 `message`（主线程发消息用 `worker.postMessage`，不经过
        // `probe.hookPostMessage` 钩的 `self.postMessage`）⇒ **窗口长度得由调用方给**，
        // 面板用采集时长。取报告自身的三条回执会出现在 `main:handle:60`（3 条），
        // 量级可忽略且看得见。
        main: probe.collect('main', reset),
      }),
    );
  }

  // 设置编辑器配置
  setOptions(o: Options) {
    if (o) {
      if (o.anchorMode == null) {
        delete o.anchorMode;
      }
      Object.assign(this.options, o);
    }

    // 主线程也有一份探针（第 4.8 步）。三个 worker 各自在 onOption 里开，
    // 这里是主线程自己那一份 —— 见 dispatch()。
    probe.setEnabled(this.options.perfProbe);

    this.setElementBackground();

    if (o.mode !== undefined) {
      this.componentElementMap.forEach((elem, id) => {
        this.setElementStyle(elem, this.penMap.get(id));
      });
    }

    this.calcWorker.postMessage({
      action: WorkerMessage.Option,
      options: o,
    });
    this.hoverWorker.postMessage({
      action: WorkerMessage.Option,
      options: o,
    });
    this.renderWorker.postMessage({
      action: WorkerMessage.Option,
      options: o,
    });
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      options: o,
    });

    if (o.anchorMode & AnchorMode.Drawline) {
      this.topElement.style.cursor = `crosshair`;
    } else if (o.anchorMode & AnchorMode.Pencil) {
      this.topElement.style.cursor = `url('pencil.svg') 4 20, pointer`;
    } else {
      this.topElement.style.cursor = `default`;
    }
  }

  toggleAnchorEdit(enabled = !this.editingAnchor) {
    if (enabled === this.editingAnchor) {
      return enabled;
    }

    if (enabled) {
      this.editingAnchor = true;
      this.setOptions({ anchorMode: AnchorMode.Hover });
      this.topElement.style.cursor = 'pointer';
    } else {
      this.editingAnchor = false;
      this.hoverLinePoint = undefined;
      this.setOptions({ anchorMode: AnchorMode.Hidden });
    }

    this.hoverWorker.postMessage({
      action: WorkerMessage.Hover,
      pen: this.hover,
      boundary: this.hoverBoundary,
      editingAnchor: null,
    });

    return enabled;
  }

  setLineType(lineType: string) {
    this.lineType = lineType;

    // 更新当前选中连线的类型
    // ...
  }

  async addPens(pens: Pen[], mode?: Mode, parentId?: string) {
    dealData(pens, this.penMap);
    if (!mode && this.beforeAdd && !(await this.beforeAdd(pens))) {
      return;
    }

    let beforeUpdate: Pen[];
    let update: Pen[];

    let parent: Pen;
    if (parentId) {
      parent = this.penMap.get(parentId);
      // children 复制一份：下面会往 parent.children 里 push，快照若引用同一个数组，撤销时就还原不了
      beforeUpdate = [patchClone(parent, { children: parent.children && [...parent.children] })];

      if (!parent.children) {
        parent.children = [];
      }

      // dealData 把新图元放在全局最上层；挂到父图元下的要放进父图元块的末尾（.docs/pen-layer-order.md §5.7）。
      // pens 是先序（粘贴、Alt 拖拽复制都来自 getAllPens），按数组顺序分配即可
      const plan = planAppendToParent(this.penMap, parent, pens);
      pens.forEach((pen) => plan.has(pen.id) && (pen.index = plan.get(pen.id)));
    }

    let paths: any;
    if (!this.inViewPenIds) {
      this.inViewPenIds = [];
    }

    pens.forEach((pen, i) => {
      if (parentId && !pen.parentId) {
        pen.parentId = parentId;
        parent.children.push(pen.id);
      }
      if (pen.path) {
        if (!paths) {
          paths = {};
        }
        if (!this.data.paths) {
          this.data.paths = {};
        }
        const { id, rect } = addPath(this.data.paths, pen.path);
        pen.pathId = id;
        paths[id] = { path: pen.path, rect };
        delete pen.path;
      }

      this.inViewPenIds.push(pen.id);
      // 已建好的 Set 跟着加；还没建的，第一次查询时会从数组建出来，不用管
      this._inViewPenIdSet?.add(pen.id);
    });
    if (mode) {
      // 防止patch时重绘了错误的旧数据
      this.activePens = [];

      if (parent) {
        update = [patchClone(parent, { children: parent.children })];
      }

      this.pushAction({
        add: pens,
        boundary: getBoundary(pens, this.textBoxs),
        beforeUpdate,
        update,
      });

      if (this.collaborate) {
        const referencedPaths = Object.fromEntries(
          pens
            .map((pen) => pen.pathId)
            .filter((id): id is string => Boolean(id && this.data.paths?.[id]))
            .map((id) => [id, this.data.paths[id]]),
        );
        const patch = {
          add: pens,
          beforeUpdate,
          update,
          ...(Object.keys(referencedPaths).length
            ? { documentData: { paths: { upsert: referencedPaths } } }
            : {}),
        };
        this.utilityWorker.postMessage({
          action: WorkerMessage.Patch,
          patch,
        });
      }

      // 延时一下，等textBoxs计算完成。主要防止有文字溢出的情况
      setTimeout(() => {
        this.active(pens);
      }, 5);

      setTimeout(() => {
        // 重新局部重绘包围盒，主要是文字溢出时
        this.active();
      }, 50);

      this.topElement.focus();
    }
    this.patch(pens, undefined, beforeUpdate, update);

    if (paths) {
      this.renderWorker.postMessage({
        action: WorkerMessage.AddPath,
        paths,
      });

      if (this.options.mode) {
        this.hoverWorker.postMessage({
          action: WorkerMessage.AddPath,
          paths,
        });
      }
    }

    const gifPens: Pen[] = [];
    const needLoadImages: string[] = [];
    for (const pen of pens) {
      if (pen.image) {
        if (pen.type === 'gif') {
          if (pen.autoPlay) {
            pen.play = PlayState.Playing;
          }
          if (this.imageStates[pen.image]) {
            gifPens.push(patchClone(pen, { image: pen.image, play: pen.play }));
          } else {
            needLoadImages.push(pen.id);
          }
        } else {
          needLoadImages.push(pen.id);
        }
      }

      if (pen.backgrounds) {
        pen.backgrounds.forEach((bg) => {
          bg.type === BackgroundType.Image && bg.image && needLoadImages.push(pen.id);
        });
      }
    }

    if (gifPens.length) {
      for (const pen of gifPens) {
        this.gifPlayerImages.set(pen.id, pen.image);
      }
      this.renderWorker.postMessage({
        action: WorkerMessage.GifFetched,
        gifPens,
      });
    }

    // 同一图元可能因为 image 和 background 被推进去两次；loadImages 按 id 逐个处理，这里去重
    loadImages.call(this, Array.from(new Set(needLoadImages)));
  }

  async deletePens(pens: Pen[], mode?: Mode) {
    if (!mode && this.beforeDelete && !(await this.beforeDelete(pens))) {
      return;
    }

    pens.forEach((pen) => {
      !pen.id && (pen.id = s8());
      if (!pen.ex) {
        pen.ex = pen.x + pen.width;
        pen.ey = pen.y + pen.height;
      }
    });

    const remove = getAllPens(this.penMap, pens);
    const removeIds = new Set(remove.map((pen) => pen.id));
    const beforeUpdateMap = new Map<string, Pen>();
    const changedPens = new Map<string, Pen>();

    const recordBeforeUpdate = (pen: Pen) => {
      if (beforeUpdateMap.has(pen.id)) {
        return;
      }

      // 删除操作可能同时修改父子关系和连线反向引用，必须合并为同一份原始快照，保证撤销可完整恢复。
      beforeUpdateMap.set(
        pen.id,
        patchClone(pen, {
          children: pen.children ? [...pen.children] : undefined,
          connectedLines: pen.connectedLines ? structuredClone(pen.connectedLines) : undefined,
        }),
      );
    };

    for (const pen of pens) {
      if (pen.parentId) {
        const parent = this.penMap.get(pen.parentId);
        if (!parent || removeIds.has(parent.id)) {
          continue;
        }

        recordBeforeUpdate(parent);
        parent.children = parent.children?.filter((item) => item !== pen.id);
        changedPens.set(parent.id, parent);
      }
    }

    // connectedLines 是节点到连线的反向引用。删除连线时同步清理，否则移动节点会读取到不存在的连线。
    for (const pen of this.penMap.values()) {
      if (removeIds.has(pen.id) || !pen.connectedLines?.some((item) => removeIds.has(item.penId))) {
        continue;
      }

      recordBeforeUpdate(pen);
      pen.connectedLines = pen.connectedLines.filter((item) => !removeIds.has(item.penId));
      changedPens.set(pen.id, pen);
    }

    // 删除节点时，清理所有连线的正向引用（connectedPen/connectedAnchor）。
    // 否则连线锚点会保留指向已删除节点的悬空引用，导致 updateConnectedLine 等函数读取到不存在的节点。
    for (const pen of this.penMap.values()) {
      if (removeIds.has(pen.id) || !pen.anchors?.length) {
        continue;
      }

      let needUpdate = false;
      for (const anchor of pen.anchors) {
        if (anchor.connectedPen && removeIds.has(anchor.connectedPen)) {
          if (!needUpdate) {
            recordBeforeUpdate(pen);
            needUpdate = true;
          }
          delete anchor.connectedPen;
          delete anchor.connectedAnchor;
        }
      }

      if (needUpdate) {
        changedPens.set(pen.id, pen);
      }
    }

    const beforeUpdate = beforeUpdateMap.size ? Array.from(beforeUpdateMap.values()) : undefined;
    const update = changedPens.size
      ? Array.from(changedPens.values()).map((pen) =>
          patchClone(pen, {
            children: pen.children ? [...pen.children] : undefined,
            connectedLines: pen.connectedLines ? structuredClone(pen.connectedLines) : undefined,
          }),
        )
      : undefined;

    if (mode) {
      this.pushAction({
        remove,
        beforeBoundary: getBoundary(remove, this.textBoxs),
        beforeUpdate,
        update,
      });

      if (this.collaborate) {
        this.utilityWorker.postMessage({
          action: WorkerMessage.Patch,
          patch: { remove, beforeUpdate, update },
        });
      }
    }

    this.patch(undefined, remove, beforeUpdate, update);

    this.clearActive();
  }

  // 清空多人协作room历史。用于保存数据后，调用此函数，清空远程协作历史，避免新进入room的人看到旧的脏数据
  clearCollaborateActions() {
    if (this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
      });
    }
  }

  getUndoAction() {
    if (this.actionIndex >= 0) {
      return this.actions[this.actionIndex--];
    }
  }

  getRedoAction() {
    if (this.actionIndex < this.actions.length - 1) {
      return this.actions[++this.actionIndex];
    }
  }

  pushAction(action: Action) {
    if (this.actionIndex >= -1 && this.actionIndex < this.actions.length - 1) {
      this.actions.splice(this.actionIndex + 1);
    }
    this.actions.push(structuredClone(action));
    ++this.actionIndex;
  }

  undo() {
    const action = this.getUndoAction();
    if (action) {
      this.patch(action.remove, action.add, action.update, action.beforeUpdate);

      if (this.options.mode && this.collaborate) {
        this.utilityWorker.postMessage({
          action: WorkerMessage.Patch,
          patch: { add: action.remove, remove: action.add, beforeUpdate: action.update, update: action.beforeUpdate },
        });
      }

      if (this.options.mode === Mode.Edit) {
        let pens = [...(action.remove || []), ...(action.beforeUpdate || [])];
        if (action.activeIds?.length) {
          const activeIds = new Set(action.activeIds);
          pens = pens.filter((pen) => activeIds.has(pen.id));
        }
        if (pens.length) {
          this.active(pens, action.beforeBoundary);
        } else if (action.add) {
          this.clearActive();
        }

        this.hoverWorker.postMessage({
          action: WorkerMessage.Hover,
          clear: true,
        });
      }
    }
  }

  redo() {
    const action = this.getRedoAction();
    if (action) {
      this.patch(action.add, action.remove, action.beforeUpdate, action.update);

      if (this.options.mode && this.collaborate) {
        this.utilityWorker.postMessage({
          action: WorkerMessage.Patch,
          patch: { add: action.add, remove: action.remove, beforeUpdate: action.beforeUpdate, update: action.update },
        });
      }

      if (this.options.mode === Mode.Edit) {
        let pens = [...(action.add || []), ...(action.update || [])];
        if (action.activeIds?.length) {
          const activeIds = new Set(action.activeIds);
          pens = pens.filter((pen) => activeIds.has(pen.id));
        }
        if (pens.length) {
          this.active(pens, action.boundary);
        } else if (action.remove) {
          this.clearActive();
        }

        this.hoverWorker.postMessage({
          action: WorkerMessage.Hover,
          clear: true,
        });
      }
    }
  }

  translateCanvas(x: number, y: number) {
    translateCanvas.call(this, { x, y });
  }

  /**
   * 平移画布，将指定图元定位到画布中心。
   */
  gotoView(pen: Pen) {
    const boundary = getBoundary([pen], this.textBoxs);
    const rect = boundary.box || boundary;
    const penCenterX = rect.x + rect.width / 2;
    const penCenterY = rect.y + rect.height / 2;

    this.setViewPosition(
      this.renderCanvas.clientWidth / 2 - penCenterX * this.data.scale,
      this.renderCanvas.clientHeight / 2 - penCenterY * this.data.scale,
    );
  }

  /**
   * 设置画布的绝对平移位置，并同步所有 Worker 和外部 HTML 图元。
   * 鹰眼地图拖动视口框时使用该方法，避免把地图坐标误当成图元坐标。
   */
  setViewPosition(x: number, y: number) {
    this.data.x = x;
    this.data.y = y;

    this.componentElementMap.forEach((elem, id) => {
      this.setElementStyle(elem, this.penMap.get(id));
    });

    this.calcWorker.postMessage({
      action: WorkerMessage.TranslateScale,
      x,
      y,
    });
    this.hoverWorker.postMessage({
      action: WorkerMessage.TranslateScale,
      x,
      y,
    });
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: { x, y },
    });
    this.emitter.emit('translate', { x, y });
  }

  showMap() {
    if (!this.map) {
      this.map = new ViewMap(this);
    }
    this.map.show();
  }

  hideMap() {
    this.map?.hide();
  }

  toggleRule(enabled = !(this.data.rule?.enable ?? this.options.rule?.enable)) {
    this.data.rule = {
      ...this.options.rule,
      ...this.data.rule,
      enable: enabled,
    };
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: this.data,
    });
    return enabled;
  }

  fitView(fitContent: boolean | number = true, padding: number = 0, origin: FitViewOrigin = FitViewOrigin.Center) {
    const canvasWidth = this.renderCanvas.clientWidth;
    const canvasHeight = this.renderCanvas.clientHeight;
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }

    let contentLogicalWidth: number = this.data.width;
    let contentLogicalHeight: number = this.data.height;
    let contentLogicalX: number = 0;
    let contentLogicalY: number = 0;

    if (!contentLogicalWidth || !contentLogicalHeight) {
      const pens = Array.from(this.penMap.values()).filter((pen) => !pen.parentId && pen.visible !== false);
      if (pens.length === 0) {
        translateCanvas.call(this, {
          x: -this.data.x,
          y: -this.data.y,
        });
        scaleCanvas.call(this, 1, {
          x: this.clientRect.left,
          y: this.clientRect.top,
        });
        return;
      }

      const boundary = getBoundary(pens, this.textBoxs);
      const rect = boundary.box || boundary;

      contentLogicalX = rect.x;
      contentLogicalY = rect.y;
      contentLogicalWidth = rect.width || (rect.ex !== undefined ? rect.ex - rect.x : 0);
      contentLogicalHeight = rect.height || (rect.ey !== undefined ? rect.ey - rect.y : 0);
    }

    if (contentLogicalWidth <= 0 || contentLogicalHeight <= 0) {
      scaleCanvas.call(this, 1, {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
      });
      return;
    }

    let contentCenterLogicalX = contentLogicalX + contentLogicalWidth / 2;
    let contentCenterLogicalY = contentLogicalY + contentLogicalHeight / 2;
    let screenCenterLogicalX = (canvasWidth / 2 - this.data.x) / this.data.scale;
    let screenCenterLogicalY = (canvasHeight / 2 - this.data.y) / this.data.scale;
    let scaleAnchorX = canvasWidth / 2 + this.clientRect.left;
    let scaleAnchorY = canvasHeight / 2 + this.clientRect.top;

    if (origin === FitViewOrigin.Left) {
      contentCenterLogicalX = contentLogicalX;
      contentCenterLogicalY = contentLogicalY;
      screenCenterLogicalX = (padding - this.data.x) / this.data.scale;
      screenCenterLogicalY = (padding - this.data.y) / this.data.scale;
      scaleAnchorX = this.clientRect.left + padding;
      scaleAnchorY = this.clientRect.top + padding;
    }

    const dxLogical = screenCenterLogicalX - contentCenterLogicalX;
    const dyLogical = screenCenterLogicalY - contentCenterLogicalY;

    translateCanvas.call(this, {
      x: dxLogical,
      y: dyLogical,
    });

    let scale = fitContent;
    if (typeof fitContent === 'boolean') {
      contentLogicalWidth += padding * 2;
      contentLogicalHeight += padding * 2;
      const scaleX = canvasWidth / contentLogicalWidth;
      const scaleY = canvasHeight / contentLogicalHeight;
      scale = fitContent ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
    }

    scaleCanvas.call(this, scale, {
      x: scaleAnchorX,
      y: scaleAnchorY,
    });
  }

  scale(scale: number, center?: Point) {
    if (!center) {
      const rect = this.topElement.getBoundingClientRect();
      center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
    scaleCanvas.call(this, scale, center);
  }

  // remove, beforeUpdate, update尽可能去掉不必要的属性。必须包含x,y,ex,ey,width,height用于计算局部重绘
  /**
   * @param queued 仅 consumePatchQueue 使用。
   *   - queued.partial：update 里不改几何的条目只带改动的键（见 valsToPens 的 partial），calc 按键合并；
   *   - 回声不带 update（主线程这份就是最新的，见 queuedUpdates），render 画完回 PatchRendered（背压）。
   */
  patch(add: Pen[], remove?: Pen[], beforeUpdate?: Pen[], update?: Pen[], queued?: { partial?: boolean }) {
    if (add) {
      for (const pen of add) {
        if (!createFns[pen.type]) {
          continue;
        }
        const elem = createFns[pen.type].call(this, pen);
        if (elem) {
          this.setElementStyle(elem, pen);
        }
      }
    }

    if (beforeUpdate?.length) {
      for (const pen of beforeUpdate) {
        // 计算线程里面保留的时最新的文字区域，没有文字的历史区域。文字区域实时计算性能差
        if (!pen.textBox && pen.patchFlag & PatchFlag.Rect && this.textBoxs[pen.id]) {
          pen.textBox = this.textBoxs[pen.id];
        }
      }
    }
    if (update?.length) {
      for (let i = update.length - 1; i >= 0; i--) {
        const pen = update[i];
        if (beforeUpdateFns[pen.type] && beforeUpdateFns[pen.type].call(this, pen, this.penMap.get(pen.id)) == false) {
          update.splice(i, 1);
        }
        delete pen.__val;
        delete this.penMap.get(pen.id)?.__val;
      }
    }
    // calc 会把这条 Patch 原样发回主线程（onPatch 里回写）。连续操作时回声晚到一两步，会把已经转得更远的
    // 图元写回旧值（D45：多选旋转后控制框与图元差几度）。给每条 Patch 一个序号，记下每个图元最近一次
    // 被发出时的序号；回声的序号比它旧就不回写（后面那条更新的回声会带回新数据）。
    const seq = ++this.patchSeq;
    update?.forEach((pen) => this.penPatchSeq.set(pen.id, seq));
    // 第六十九轮：calc 的回声不再带 beforeUpdate（主线程只用它的 index 判断图层是否变化，见 onPatch）⇒ 这里按序号留一份。
    // 多选 300 个图元缩放 / 旋转时，回声解码 main:deser:7 每步 ~2.4ms、约一半是这份 beforeUpdate。
    if (beforeUpdate?.length) {
      this.patchBeforeIndex.set(seq, new Map(beforeUpdate.map((p): [string, number] => [p.id, p.index])));
      // 回声总会回来（calc onPatch 没有提前返回）；兜底防泄漏：只留最近 256 条
      this.patchBeforeIndex.delete(seq - 256);
    }
    if (queued) {
      this.queuedUpdates.set(seq, update);
      this.queuedUpdates.delete(seq - 256);
      this.queueInFlight.add(seq);
      this.queueSentAt = Date.now();
    }
    this.calcWorker.postMessage({
      action: WorkerMessage.Patch,
      add,
      remove,
      beforeUpdate,
      update,
      seq,
      queued: !!queued,
      partial: !!queued?.partial,
    });

    // 如果 locked 属性被修改，且该图元在 activePens 中，需要通知 hoverWorker 更新
    if (this.options.mode && this.activePens?.length) {
      const LockedUpdate = this.activePens.some((pen) => pen.patchFlag & PatchFlag.Lock);
      if (LockedUpdate) {
        this.hoverWorker.postMessage({
          action: WorkerMessage.Active,
          activePens: this.activePens,
          activeBoundary: this.activeBoundary,
        });
      }
    }
    this.emitter.emit('patch', { add, remove, beforeUpdate, update });
  }

  setValue(val: IValue | IValue[], options?: ValueOptions) {
    if (!Array.isArray(val)) {
      val = [val];
    }

    if (!options || !options.preventEvent) {
      // 即时通知变化。动态逻辑要快速响应
      this.emitter.emit('valueUpdate', val);
    }

    const preventEvent = options?.preventEvent === true;
    const patchVals = (val as IValue[]).map((item) => ({
      ...item,
      __preventEvent: preventEvent,
    }));

    // 可批量显示变化。可优化逻辑造成的覆盖更新时的显示性能
    if (!options || (!options.render && !options.mode)) {
      this.patchQueue.push(...patchVals);
      this.scheduleQueue();
      return;
    }

    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    this.valsToPens(patchVals, beforeUpdate, update);

    if (!beforeUpdate.length) {
      return;
    }

    this.patch(undefined, undefined, beforeUpdate, update);

    if (options?.mode) {
      if (options?.record) {
        const beforeBoundary = structuredClone(this.activeBoundary);
        setTimeout(() => {
          const boundary = structuredClone(this.activeBoundary);
          this.pushAction({ beforeUpdate, update, beforeBoundary, boundary });
        });
      }

      if (this.collaborate) {
        this.utilityWorker.postMessage({
          action: WorkerMessage.Patch,
          patch: { beforeUpdate, update },
        });
      }
    } else if (this.record || options?.record) {
      this.pushAction({ beforeUpdate, update });
    }
  }

  /** 收到 render 的 PatchRendered（见 meta2d-message.onPatchRendered） */
  onQueuePatchRendered(seqs: number[]) {
    for (const seq of seqs) {
      this.queueInFlight.delete(seq);
    }
    if (this.queueInFlight.size) {
      return;
    }
    // 在途期间排上的是「回执丢失」的兜底定时器（1 秒后）⇒ 撤掉，按最小间隔重排。
    // 已排上的微任务撤不掉也不必撤：它跑起来照样会发。
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = undefined;
      this.queueScheduled = false;
    }
    // 上一批画完 ⇒ 攒着的值按最小间隔尽快发（间隔已满就是马上）
    this.scheduleQueue();
  }

  /**
   * 安排下一批 setValue 的发送时机。原来是固定的 setInterval(patchQueueDelay)：值到了也要等下一个 tick，
   * 平均多等半个间隔。现在由「有值进队」和「上一批画完」两件事驱动，满足两个条件就发：
   *   ① 没有在途的批次（背压，见 queueInFlight）；
   *   ② 离上一批发出已满 patchQueueDelay（最小发送间隔；0 = 不限，只受 render 画一批的速度约束）。
   * 间隔已满时用微任务发，同一段同步代码里连续的 setValue（比如一次推来 8000 个点）仍然合成一批。
   */
  private scheduleQueue() {
    if (this.queueScheduled || !this.patchQueue.length || this.queueStopped) {
      return;
    }
    const now = Date.now();
    let wait: number;
    if (this.queueInFlight.size) {
      // 回执到了会再调这里；只留一个兜底：回执丢了（worker 报错等）就到点不再等
      wait = this.queueSentAt + QueueAckTimeout - now;
    } else {
      wait = this.queueSentAt + (this.options.patchQueueDelay || 0) - now;
    }
    this.queueScheduled = true;
    if (wait <= 0) {
      queueMicrotask(this.queueConsume);
    } else {
      this.queueTimer = setTimeout(this.queueConsume, wait);
    }
  }

  private consumePatchQueue() {
    this.queueScheduled = false;
    this.queueTimer = undefined;
    if (!this.patchQueue.length || this.queueStopped) {
      return;
    }
    if (this.queueInFlight.size) {
      // 上一批还没画完 ⇒ 这一批的值留在队列里，回执到了（或兜底超时）再按 id 合并发出
      if (Date.now() - this.queueSentAt < QueueAckTimeout) {
        probe.count('queue:held');
        this.scheduleQueue();
        return;
      }
      probe.count('queue:ackTimeout');
      this.queueInFlight.clear();
    }

    let vals = this.patchQueue.slice();
    this.patchQueue.length = 0;
    // 先合并数据；同一目标只要有一次未明确阻止事件，最终就允许触发事件。
    const map: Record<string, IValue> = {};
    vals.forEach((item) => {
      const key = item.id || item.tag;
      if (key) {
        const previous = map[key];
        map[key] = {
          ...previous,
          ...item,
          __preventEvent:
            (previous?.__preventEvent ?? true) && item.__preventEvent === true,
        };
      }
    });
    vals = Object.values(map);

    const beforePens: Pen[] = [];
    const updatePens: Pen[] = [];
    const partial = { beforeUpdate: [] as Pen[], update: [] as Pen[] };
    this.valsToPens(vals, beforePens, updatePens, partial);
    // 两种格式的条目分两条 Patch 发：calc 按消息上的 partial 标记决定怎么合并
    if (partial.update.length) {
      this.patch(undefined, undefined, partial.beforeUpdate, partial.update, { partial: true });
    }
    if (updatePens.length) {
      this.patch(undefined, undefined, beforePens, updatePens, {});
    }
  }

  // 把vals: IValue[]转化成pens
  //
  // partial（仅 setValue 队列传）：能走差量的图元放进这里，而不是 beforePens / updatePens。
  //
  // 原来每个图元都发 patchClone 快照 + structuredClone(pen) 整图元：8000 个文本每批要在主线程上
  // 深拷贝 8000 次，再序列化给 calc、反序列化 calc 的回声、序列化转给 render ⇒ 主线程一批 ~100ms+。
  // 其实 calc / render 手里都有完整图元，只缺这次改了的键：
  //   - 不动几何（patchFlag 无 Rect）：只发 {id, type, index, interactive, patchFlag, text, 改动的键}；
  //   - 动几何（x / y / width / height / rotate / scale / flip）：calc 要用整套几何维护网格、算新旧脏区，
  //     发 patchClone 那组几何字段（只带有值的）+ 改动的键。
  // 任意属性都适用；不走差量的只有：插件图元（beforeUpdate / afterUpdate 钩子拿的一直是整图元）、
  // DOM 图元（setElementStyle 按快照设样式）、组合翻转（flipPen 自己生成快照）。
  // 队列路径不记撤销、不走协作，这两处要的完整快照不受影响。
  private valsToPens(
    vals: IValue[],
    beforePens: Pen[],
    updatePens: Pen[],
    partial?: { beforeUpdate: Pen[]; update: Pen[] },
  ) {
    let oldPenMap: Map<Pen, IValue> = new Map();
    const preventEventByPen = new Map<Pen, boolean>();
    for (const val of vals) {
      const currentPreventEvent = val.__preventEvent === true;
      delete val.__preventEvent;
      if (val.tag && !val.id) {
        // 通过tag批量更新
        for (const [, p] of this.penMap) {
          if (p.tags?.includes(val.tag)) {
            const penValue = oldPenMap.get(p);
            if (penValue) {
              Object.assign(penValue, val); // 合并属性
            } else {
              oldPenMap.set(p, val);
            }
            preventEventByPen.set(p, (preventEventByPen.get(p) ?? true) && currentPreventEvent);
          }
        }
      } else {
        const p = this.penMap.get(val.id);
        if (p) {
          const penValue = oldPenMap.get(p);
          if (penValue) {
            Object.assign(penValue, val); // 合并属性
          } else {
            oldPenMap.set(p, val);
          }
          preventEventByPen.set(p, (preventEventByPen.get(p) ?? true) && currentPreventEvent);
        }
      }
    }
    if (!oldPenMap.size) {
      return;
    }

    // setValue 修改组合图元的 flipX/flipY 时，组合节点本身不会绘制，必须把
    // 镜像变换递归应用到全部子孙。这里先完成几何变换并记录完整补丁，再让
    // 下面的通用属性处理流程补齐事件、activePens 和撤销记录。
    const recursiveFlipIds = new Set<string>();
    const hasFlipValue = vals.some(
      (val) =>
        (Object.prototype.hasOwnProperty.call(val, 'flipX') && val.flipX !== undefined) ||
        (Object.prototype.hasOwnProperty.call(val, 'flipY') && val.flipY !== undefined),
    );
    if (hasFlipValue) {
      const initialFlipValues = Array.from(oldPenMap.entries());
      for (const [pen, val] of initialFlipValues) {
        if (!pen.children?.length) {
          continue;
        }

        const hasFlipX = Object.prototype.hasOwnProperty.call(val, 'flipX') && val.flipX !== undefined;
        const hasFlipY = Object.prototype.hasOwnProperty.call(val, 'flipY') && val.flipY !== undefined;
        const shouldFlipX = hasFlipX && Boolean(val.flipX) !== Boolean(pen.flipX);
        const shouldFlipY = hasFlipY && Boolean(val.flipY) !== Boolean(pen.flipY);
        if (!shouldFlipX && !shouldFlipY) {
          continue;
        }

        const affectedPens = getAllPens(this.penMap, [pen]);
        // 同一批 setValue 同时修改子图元时，保留原有的逐图元语义，避免同一
        // 个子孙被组合变换和显式变换重复处理。
        if (affectedPens.some((item) => item !== pen && oldPenMap.has(item))) {
          continue;
        }

        const pivot = pen.pivot || {
          x: pen.x + pen.width / 2,
          y: pen.y + pen.height / 2,
        };
        flipPen(this.penMap, pen, shouldFlipX, shouldFlipY, pivot, beforePens, updatePens, PatchFlag.Rect);

        for (const affected of affectedPens) {
          recursiveFlipIds.add(affected.id);
          if (affected !== pen) {
            if (!preventEventByPen.has(affected)) {
              // 递归翻转产生的子图元更新继承父图元的事件策略。
              preventEventByPen.set(affected, preventEventByPen.get(pen) === true);
            }
            // 子孙没有显式 setValue 时，补一条仅包含翻转状态的值，使其进入
            // 同一 patch 流程并同步到 calc/render/hover Worker。
            oldPenMap.set(affected, {
              id: affected.id,
              flipX: affected.flipX,
              flipY: affected.flipY,
            });
          }
        }
      }
    }

    // 按图层排序
    const oldPens = Array.from(oldPenMap.keys());

    oldPens.sort((a, b) => {
      return a.index - b.index;
    });

    // activePens 的 id → 下标。原来是在下面的循环里对每个 pen 做一次
    // activePens 线性扫描，2000 个 val × 2000 个选中图元 = 4e6 次比较。
    const activeIndexById = new Map<string, number>();
    if (this.activePens) {
      for (let i = 0; i < this.activePens.length; i++) {
        activeIndexById.set(this.activePens[i].id, i);
      }
    }

    for (const pen of oldPens) {
      // oldPenMap 的键就是 pen，值就是（tag 合并后的）val，直接取。
      // 原来这里是 vals.find(v => v.id === pen.id || ...)：每个 pen 扫一遍 vals，
      // 2000 个文本 setValue 就是 4e6 次比较；而且 tag 批量更新时 oldPenMap
      // 已经把多个 val 合并过了，find 只能拿到第一个匹配的，本身也是错的。
      const val = oldPenMap.get(pen);

      // patchFlag 描述「这次改了什么」，所以必须看 val 的键，不能看 pen 自己的属性。
      //
      // 看 pen 自己的属性的话，任何图元都有 x/y/width/height ⇒ Rect / Index 恒为真，
      // 纯文本 setValue 也会让 calc 做完整的网格维护（设计文档 M10）。
      //
      // 文本变化不动几何（文本框尺寸由 TextOutside 单独回传），不置 Rect 是正确的。
      let patchFlag: PatchFlag = PatchFlag.None;
      for (const key of PatchRectProps) {
        if (val && val[key] != undefined) {
          patchFlag |= PatchFlag.Rect;
          break;
        }
      }
      if (val && (val as any).index != undefined) {
        patchFlag |= PatchFlag.Index;
      }

      // 在 locked 把 patchFlag 改写成 Lock 之前记下：差量条目的格式看的是「几何改没改」
      const geometry = (patchFlag & PatchFlag.Rect) !== 0;
      const usePartial = !!partial && canPartialPatch(pen) && !recursiveFlipIds.has(pen.id);
      // 差量的旧值：不动几何时只要改动键的旧值（下面键循环里填）+ index（主线程判断图层是否变化）；
      // calc 算旧脏区时会用自己手里的完整图元补齐（getCompletePens）
      const oldPen: Pen = !usePartial
        ? patchClone(pen, { patchFlag })
        : geometry
          ? definedGeometry(pen, patchFlag)
          : ({ id: pen.id, type: pen.type, index: pen.index, patchFlag } as Pen);
      pen.__val = val;
      let style: boolean;
      let interactive: InteractiveType;
      for (const k in val) {
        if (k.indexOf('.') === -1) {
          oldPen[k] = pen[k];
          pen[k] = val[k];
          if (
            k === 'hoverColor' ||
            k === 'hoverBackground' ||
            k === 'activeColor' ||
            k === 'activeBackground' ||
            k === 'textHoverColor' ||
            k === 'textActiveColor'
          ) {
            style = true;
            if (pen[k]) {
              interactive |= InteractiveType.Style;
            }
          }

          if (k === 'locked') {
            patchFlag = PatchFlag.Lock;
          }
          continue;
        }

        if (!oldPen.pathVals) {
          oldPen.pathVals = {};
        }
        if (!pen.pathVals) {
          pen.pathVals = {};
        }
        oldPen.pathVals[k] = getter(pen, k);
        pen.pathVals[k] = val[k];
      }

      if (
        geometry &&
        pen.category === PenCategory.Line &&
        Array.isArray(val?.anchors) &&
        pen.anchors?.length >= 2
      ) {
        calcLineRect(pen);
      }

      // 必须无条件写，即使是 PatchFlag.None。
      // 原来这里是 `if (patchFlag) { ... }` 写在键循环内 —— 那时 patchFlag 恒为
      // Rect|Index、永远真，所以看不出问题。现在纯属性更新会算出 None，一旦跳过
      // 赋值，pen 上就会残留上一次 patch 的 flag，并被下面的 structuredClone
      // 原样送进 worker（worker 就会以为几何变了，索引白维护一轮）。
      oldPen.patchFlag = patchFlag;
      pen.patchFlag = patchFlag;

      if (partial && geometry && ('x' in val || 'y' in val || 'width' in val || 'height' in val)) {
        // 原来由 calc 算好、随回声写回主线程；队列批次的回声不带 update（见 patch 的 queued）⇒
        // 主线程自己算，公式同 calc onPatch
        pen.ex = pen.x + pen.width;
        pen.ey = pen.y + pen.height;
      }

      const shouldPreventEvent = preventEventByPen.get(pen) === true;
      if (!shouldPreventEvent && this.options.mode === Mode.Run) {
        const p = this.penMap.get(pen.id);
        if (p.triggers) {
          for (const trigger of p.triggers) {
            for (const event of trigger.events) {
              // 判断k是否被监听，条件是否成立
              if (event.conditions?.length && !isRelated(event.conditions, Object.keys(val))) {
                break;
              }
              if (shouldExecute.call(this, pen, event)) {
                executeActions.call(this, pen, event.actions);
                break;
              }
            }
          }
        }
      }

      if (style) {
        if (interactive & InteractiveType.Style) {
          pen.interactive |= InteractiveType.Style;
        } else if (!pen.hoverColor && !pen.hoverBackground && !pen.activeColor && !pen.activeBackground) {
          pen.interactive &= ~InteractiveType.Style;
        }
      }

      // 直接更新activePens，避免其他地方再次全局查找替换
      const activeIndex = activeIndexById.get(pen.id);
      if (activeIndex !== undefined) {
        this.activePens[activeIndex] = pen;
      }

      if (recursiveFlipIds.has(pen.id)) {
        // flipPen 已经记录了变换前后的快照；若本条值还包含其他属性，
        // 用当前图元替换 update 快照，避免丢失同一条 setValue 的其他修改。
        const updateIndex = updatePens.findIndex((item) => item.id === pen.id);
        const updatedPen = patchClone(pen, { container: pen.container, textBox: pen.textBox, patchFlag });
        if (updateIndex >= 0) {
          updatePens[updateIndex] = updatedPen;
        } else {
          updatePens.push(updatedPen);
        }
      } else if (usePartial) {
        partial.beforeUpdate.push(oldPen);
        partial.update.push(partialPatchItem(pen, val, geometry, patchFlag));
      } else {
        beforePens.push(oldPen);
        updatePens.push(structuredClone(pen));
      }
    }
  }

  toLogicalMouse(e: MouseEvent) {
    return {
      x: Math.round((e.offsetX - this.data.x) / this.data.scale),
      y: Math.round((e.offsetY - this.data.y) / this.data.scale),
      ctrlKey: e.ctrlKey || e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      button: e.button,
    };
  }

  alignPensToPage(alignType: AlignType, whole: boolean = true) {
    if (!this.activePens.length) {
      return;
    }

    const referenceBoundary: Rect = {
      width: this.data.width,
      height: this.data.height,
      ex: this.data.width, // 0 + this.data.width
      ey: this.data.height,
    };

    if (!whole) {
      const beforeUpdate: Pen[] = [];
      const update: Pen[] = [];
      const noAlignPens: Pen[] = [];

      for (const pen of this.activePens) {
        const penBoundary = getBoundary([pen], this.textBoxs);
        const penRect = penBoundary.box || penBoundary;
        let offsetX = 0;
        let offsetY = 0;

        switch (alignType) {
          case AlignType.Left:
            offsetX = -penRect.x;
            break;
          case AlignType.Right:
            offsetX = referenceBoundary.ex - penRect.ex;
            break;
          case AlignType.Center:
            offsetX = referenceBoundary.width / 2 - (penRect.x + penRect.width / 2);
            break;
          case AlignType.Top:
            offsetY = -penRect.y;
            break;
          case AlignType.Bottom:
            offsetY = referenceBoundary.ey - penRect.ey;
            break;
          case AlignType.Middle:
            offsetY = referenceBoundary.height / 2 - (penRect.y + penRect.height / 2);
            break;
          default:
            return;
        }

        if (Math.abs(offsetX) <= Number.MIN_VALUE && Math.abs(offsetY) <= Number.MIN_VALUE) {
          noAlignPens.push(patchClone(pen, { container: pen.container, textBox: pen.textBox }));
          continue;
        }

        translatePen(this.penMap, pen, offsetX, offsetY, beforeUpdate, update);
      }

      if (!update.length) {
        return;
      }

      const beforeBoundary = structuredClone(this.activeBoundary);
      this.patch(undefined, undefined, beforeUpdate, update);
      this.calcWorker.postMessage({
        action: WorkerMessage.Active,
        pens: update.concat(noAlignPens),
      });
      setTimeout(() => {
        const boundary = structuredClone(this.activeBoundary);
        this.pushAction({
          beforeUpdate: beforeUpdate.concat(noAlignPens),
          update: update.concat(noAlignPens),
          beforeBoundary,
          boundary,
        });
      }, 100);
      return;
    }

    const currentBox = this.activeBoundary.box || this.activeBoundary;
    let offsetX = 0;
    let offsetY = 0;

    switch (alignType) {
      case AlignType.Left:
        offsetX = -currentBox.x;
        break;
      case AlignType.Right:
        offsetX = referenceBoundary.ex - currentBox.ex;
        break;
      case AlignType.Center:
        offsetX = referenceBoundary.width / 2 - (currentBox.x + currentBox.width / 2);
        break;
      case AlignType.Top:
        offsetY = -currentBox.y;
        break;
      case AlignType.Bottom:
        offsetY = referenceBoundary.ey - currentBox.ey;
        break;
      case AlignType.Middle:
        offsetY = referenceBoundary.height / 2 - (currentBox.y + currentBox.height / 2);
        break;
      default:
        return;
    }

    if (Math.abs(offsetX) <= Number.MIN_VALUE && Math.abs(offsetY) <= Number.MIN_VALUE) {
      return;
    }
    translatePens.call(this, offsetX, offsetY, true);
  }

  alignPens(alignType: AlignType, last: boolean = false) {
    if (!this.activePens.length) {
      return;
    }

    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    let referenceRect: Rect = this.activeBoundary.box || this.activeBoundary;
    if (last) {
      const penBoundary = getBoundary([this.activePens[this.activePens.length - 1]], this.textBoxs);
      referenceRect = penBoundary.box || penBoundary;
    }
    const noAlignPens: Pen[] = []; // 不需要对齐的图元
    for (const pen of this.activePens) {
      const penBoundary = getBoundary([pen], this.textBoxs);
      const penRect = penBoundary.box || penBoundary;
      let offsetX = 0;
      let offsetY = 0;

      switch (alignType) {
        case AlignType.Left:
          offsetX = referenceRect.x - penRect.x;
          break;
        case AlignType.Right:
          offsetX = referenceRect.ex - penRect.ex;
          break;
        case AlignType.Center:
          offsetX = referenceRect.x + referenceRect.width / 2 - penRect.x - penRect.width / 2;
          break;
        case AlignType.Top:
          offsetY = referenceRect.y - penRect.y;
          break;
        case AlignType.Bottom:
          offsetY = referenceRect.ey - penRect.ey;
          break;
        case AlignType.Middle:
          offsetY = referenceRect.y + referenceRect.height / 2 - penRect.y - penRect.height / 2;
          break;
        default:
          continue;
      }

      if (Math.abs(offsetX) <= Number.MIN_VALUE && Math.abs(offsetY) <= Number.MIN_VALUE) {
        noAlignPens.push(patchClone(pen, { container: pen.container, textBox: pen.textBox }));
        continue;
      }
      translatePen(this.penMap, pen, offsetX, offsetY, beforeUpdate, update);
    }

    const beforeBoundary = structuredClone(this.activeBoundary);
    this.patch(undefined, undefined, beforeUpdate, update);
    this.calcWorker.postMessage({
      action: WorkerMessage.Active,
      pens: update.concat(noAlignPens),
    });
    setTimeout(() => {
      const boundary = structuredClone(this.activeBoundary);
      this.pushAction({
        beforeUpdate: beforeUpdate.concat(noAlignPens),
        update: update.concat(noAlignPens),
        beforeBoundary,
        boundary,
      });
    }, 100);
  }

  distributePensEvenly(direction: AlignType.HorizontalDistribute | AlignType.VerticalDistribute) {
    if (
      !this.activePens.length ||
      this.activePens.length < 2 ||
      (direction !== AlignType.HorizontalDistribute && direction !== AlignType.VerticalDistribute)
    ) {
      return;
    }
    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];

    const referenceRect: Rect = this.activeBoundary.box || this.activeBoundary;
    const penInfos: Array<{ pen: Pen; position: number; size: number }> = [];
    let totalSize = 0;
    for (const pen of this.activePens) {
      const penBoundary = getBoundary([pen], this.textBoxs);
      const penRect = penBoundary.box || penBoundary;

      let position = penRect.x;
      let size = penRect.width;
      if (direction === AlignType.VerticalDistribute) {
        position = penRect.y;
        size = penRect.height;
      }

      penInfos.push({ pen, position, size });
      totalSize += size;
    }
    penInfos.sort((a, b) => a.position - b.position);

    let startPos = referenceRect.x;
    let totalRange = referenceRect.width;
    if (direction === AlignType.VerticalDistribute) {
      startPos = referenceRect.y;
      totalRange = referenceRect.height;
    }
    const averageSpacing = (totalRange - totalSize) / (penInfos.length - 1);

    const noDistributePens: Pen[] = [];
    for (const { pen, position, size } of penInfos) {
      const offset = startPos - position;
      startPos += size + averageSpacing;

      if (Math.abs(offset) <= Number.MIN_VALUE) {
        noDistributePens.push(patchClone(pen, { container: pen.container, textBox: pen.textBox }));
        continue;
      }

      const offsetX = direction === AlignType.HorizontalDistribute ? offset : 0;
      const offsetY = direction === AlignType.VerticalDistribute ? offset : 0;
      translatePen(this.penMap, pen, offsetX, offsetY, beforeUpdate, update);
    }

    if (update.length === 0) {
      return;
    }

    const boundary = structuredClone(this.activeBoundary);
    this.patch(undefined, undefined, beforeUpdate, update);
    this.pushAction({
      beforeUpdate: beforeUpdate.concat(noDistributePens),
      update: update.concat(noDistributePens),
      beforeBoundary: boundary,
      boundary,
    });
  }

  /**
   * 把层级规划（图元 id → 新 index，见 models/pen/layer.ts）落地：立即写进主线程 penMap
   * （连续快速操作时下一次规划要读到新值，不能等 calc 回声），发一条 patch，记一条撤销。
   */
  private applyIndexPlan(plan: IndexPlan, elementLayer?: { isBottom: boolean; penIds: Set<string> }) {
    if (!plan.size) {
      return false;
    }
    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    for (const [id, index] of plan) {
      const pen = this.penMap.get(id);
      if (!pen) {
        continue;
      }
      const indexChanged = pen.index !== index;
      const elementLayerChanged =
        elementLayer?.penIds.has(id) && pen.category === PenCategory.HtmlElement && pen.isBottom !== elementLayer.isBottom;
      if (!indexChanged && !elementLayerChanged) {
        continue;
      }

      const patchFlag = indexChanged ? PatchFlag.Index : PatchFlag.None;
      const beforeProps: Partial<Pen> = { index: pen.index, patchFlag };
      const updateProps: Partial<Pen> = { index, patchFlag };
      if (elementLayerChanged) {
        beforeProps.isBottom = pen.isBottom;
        updateProps.isBottom = elementLayer.isBottom;
        pen.isBottom = elementLayer.isBottom;
      }
      beforeUpdate.push(patchClone(pen, beforeProps));
      pen.index = index;
      update.push(patchClone(pen, updateProps));
    }
    if (!update.length) {
      return false;
    }

    if (elementLayer) {
      // appendChild 会同时完成跨容器迁移，并按新的图元层级重建 DOM 兄弟顺序。
      const target = elementLayer.isBottom ? this.bottomElement : this.topElement;
      [...elementLayer.penIds]
        .map((id) => this.penMap.get(id))
        .filter((pen) => pen?.category === PenCategory.HtmlElement)
        .sort((a, b) => a.index - b.index)
        .forEach((pen) => {
          const elem = this.componentElementMap.get(pen.id);
          elem && target.appendChild(elem);
        });
    }

    this.patch(undefined, undefined, beforeUpdate, update);
    this.pushAction({ beforeUpdate, update });
    return true;
  }

  /** 上移 / 下移一层：在同一父图元的兄弟间整块（连同子孙）移动一格 */
  moveLayer(isForward: boolean) {
    if (!this.activePens.length) {
      return;
    }
    this.applyIndexPlan(planMoveLayer(this.penMap, this.activePens, isForward));
  }

  /** 置顶 / 置底：整块移到父图元范围的最后 / 最前（顶层即全局最上 / 最下） */
  toFrontOrBack(toTop: boolean) {
    if (!this.activePens.length) {
      return;
    }
    const elementPenIds = new Set<string>();
    const visited = new Set<string>();
    const collectElementPens = (pen: Pen) => {
      if (!pen || visited.has(pen.id)) {
        return;
      }
      visited.add(pen.id);
      if (pen.category === PenCategory.HtmlElement) {
        elementPenIds.add(pen.id);
      }
      pen.children?.forEach((id) => {
        const child = this.penMap.get(id);
        child && collectElementPens(child);
      });
    };
    this.activePens.forEach(collectElementPens);

    this.applyIndexPlan(planToFrontOrBack(this.penMap, this.activePens, toTop), {
      isBottom: !toTop,
      penIds: elementPenIds,
    });
  }

  /**
   * 将一个图元移动到目标图元前面，即渲染层级高于目标图元一层。
   * 仅处理同一父级下的图元，避免组合内外图层顺序被打乱。
   */
  movePenToFrontOf(penOrId: Pen | string, targetPenOrId: Pen | string): boolean {
    return this.movePenRelativeTo(penOrId, targetPenOrId, true);
  }

  /**
   * 将一个图元移动到目标图元后面，即渲染层级低于目标图元一层。
   * 仅处理同一父级下的图元，避免组合内外图层顺序被打乱。
   */
  movePenToBackOf(penOrId: Pen | string, targetPenOrId: Pen | string): boolean {
    return this.movePenRelativeTo(penOrId, targetPenOrId, false);
  }

  private movePenRelativeTo(penOrId: Pen | string, targetPenOrId: Pen | string, toFront: boolean): boolean {
    const penId = typeof penOrId === 'string' ? penOrId : penOrId?.id;
    const targetPenId = typeof targetPenOrId === 'string' ? targetPenOrId : targetPenOrId?.id;
    if (!penId || !targetPenId || penId === targetPenId) {
      return false;
    }

    const pen = this.penMap.get(penId);
    const targetPen = this.penMap.get(targetPenId);
    if (!pen || !targetPen || layerParent(this.penMap, pen) !== layerParent(this.penMap, targetPen)) {
      return false;
    }

    return this.applyIndexPlan(planMoveRelative(this.penMap, pen, targetPen, toFront));
  }

  /**
   * 把整份数据的层级整理成「图元连同子孙占连续一段、父在前」（.docs/pen-layer-order.md §5.9）。
   * 有组外图元夹在组内的数据，整理后画面会变；不自动执行，由调用方显式调用。可撤销。
   * 交错严重时可能改动接近全部图元（10 万图元约 2 秒级），属一次性维护操作。
   */
  normalizeLayers(): { changed: number } {
    const plan = planNormalizeLayers(this.penMap);
    this.applyIndexPlan(plan);
    return { changed: plan.size };
  }

  group(pens?: Pen[], showChild?: number) {
    let targets = pens?.length ? pens : this.activePens;
    targets = targets?.filter((pen) => !pen.parentId && !pen.locked && pen.visible !== false);
    if (!targets?.length || targets.length < 2) {
      console.warn('组合至少需要两个未锁定的图元');
      return;
    }

    const boundary = getBoundary(targets, this.textBoxs);
    const beforeBoundary = structuredClone(this.activeBoundary);

    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    const childIds = [];
    const groupId = s8();
    // children 保持调用方给的顺序：showChild 是按这个顺序的下标；层级顺序由 planGroup 单独决定
    for (const pen of targets) {
      childIds.push(pen.id);
    }

    const groupPen: Pen = {
      id: groupId,
      name: 'Group',
      type: 'group',
      category: PenCategory.Node,
      rotate: 0,
      x: boundary.x,
      y: boundary.y,
      width: boundary.width,
      height: boundary.height,
      ex: boundary.ex,
      ey: boundary.ey,
      pivot: {
        x: boundary.x + boundary.width / 2,
        y: boundary.y + boundary.height / 2,
      },
      children: childIds,
      showChild: showChild,
    };

    // 层级：group 在前、成员块随后，收拢到最上层成员所在的位置（.docs/pen-layer-order.md §5.5）
    const plan = planGroup(this.penMap, groupPen, targets);
    groupPen.index = plan.get(groupId);
    const memberIds = new Set(childIds);
    for (const [id, index] of plan) {
      const pen = this.penMap.get(id);
      if (!pen) {
        continue;
      }
      const isMember = memberIds.has(id);
      beforeUpdate.push(patchClone(pen, { parentId: pen.parentId, index: pen.index, patchFlag: PatchFlag.Index }));
      pen.index = index;
      isMember && (pen.parentId = groupId);
      update.push(patchClone(pen, { parentId: pen.parentId, index, patchFlag: PatchFlag.Index }));
    }

    this.patch([groupPen], undefined, beforeUpdate, update);

    this.pushAction({
      add: [structuredClone(groupPen)],
      beforeUpdate,
      update,
      beforeBoundary,
      boundary: boundary,
    });

    if (this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { add: [groupPen], beforeUpdate, update },
      });
    }

    this.active([groupPen], boundary);
  }

  ungroup(pens?: Pen[]) {
    let targets = pens?.length ? pens : this.activePens;
    const groupPens: Pen[] = targets?.filter(
      (pen) => pen.type === 'group' && !pen.parentId && !pen.locked && pen.visible !== false,
    );
    if (!groupPens?.length) {
      console.warn('没有可解组的组合');
      return;
    }

    const beforeBoundary = structuredClone(this.activeBoundary);
    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    const remove: Pen[] = [];
    const childPens: Pen[] = [];

    for (const pen of groupPens) {
      for (const childId of pen.children) {
        const childPen = this.penMap.get(childId);
        if (childPen) {
          beforeUpdate.push(patchClone(childPen));
          update.push(patchClone(childPen, { parentId: undefined }));
          childPens.push(childPen);
        }
      }
      remove.push(pen);
    }

    this.patch(undefined, remove, beforeUpdate, update);

    this.pushAction({
      remove,
      beforeUpdate,
      update,
      beforeBoundary,
      boundary: this.activeBoundary,
    });

    if (this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { remove, beforeUpdate, update },
      });
    }

    this.clearActive();
  }

  toComponent(pens?: Pen[]): Pen[] {
    const sourcePens = pens ?? Array.from(this.penMap.values());
    const sourcePenMap = new Map(this.penMap);
    for (const pen of sourcePens) {
      pen.id && sourcePenMap.set(pen.id, pen);
    }

    const targets = sourcePens.filter((pen) => !pen.parentId);
    if (!targets.length) {
      return [];
    }

    // 组合组件需要包含所有后代图元，并与画布中的原始数据完全隔离。
    const componentPens = getAllPens(sourcePenMap, targets).map((pen) => structuredClone(pen));
    if (targets.length === 1 && targets[0].type === 'group') {
      return componentPens;
    }

    const boundary = getBoundary(targets, this.textBoxs);
    const groupId = s8();
    const targetIds = new Set(targets.map((pen) => pen.id));
    for (const pen of componentPens) {
      if (targetIds.has(pen.id)) {
        pen.parentId = groupId;
      }
    }

    const groupPen: Pen = {
      id: groupId,
      name: 'Group',
      type: 'group',
      category: PenCategory.Node,
      rotate: 0,
      x: boundary.x,
      y: boundary.y,
      width: boundary.width,
      height: boundary.height,
      ex: boundary.ex,
      ey: boundary.ey,
      pivot: {
        x: boundary.x + boundary.width / 2,
        y: boundary.y + boundary.height / 2,
      },
      children: componentPens.filter((pen) => pen.parentId === groupId).map((pen) => pen.id),
      index: this.penMap.size + 1,
    };

    return [groupPen, ...componentPens];
  }

  active(pens?: Pen[], activeBoundary?: Rect) {
    if (!pens?.length && !this.activePens?.length) {
      return;
    }

    pens = pens?.filter((pen) => !pen.locked && pen.visible !== false);

    if (pens) {
      if (pens.length === 1) {
        this.activePens = pens;
      } else {
        // 移除子图元
        this.activePens = [];
        for (const p of pens) {
          const pen = this.penMap.get(p.id);
          if (pen && !pen.parentId) {
            this.activePens.push(pen);
          }
        }
      }
    } else if (!activeBoundary) {
      // 未传pens且未传activeBoundary，表示重新计算当前activePens的包围盒
      activeBoundary = this.activeBoundary;
    }

    this.calcWorker.postMessage({
      action: WorkerMessage.Active,
      calcBoundary: !pens, // 场景1：调用此函数不传pens表示需要重新算包围盒。
      //  - 如果存在activeBoundary参数，表示不希望改变当前控制框，但是局部重绘的box需要重计算。主要用于设置多选图元的属性，不想改变多选控制框
      //  - 如果不存在activeBoundary参数，表示重新计算包围盒的controller
      pens: this.activePens, // 场景2：传pens、并且不传activeBoundary，表示根据pens计算activeBoundary
      activeBoundary,
    });
  }

  selectAll(invert = false) {
    const allPens = Array.from(this.penMap.values());
    if (!invert) {
      this.active(allPens);
      return;
    }

    const activeIds = new Set(this.activePens.map((pen) => pen.id));
    const unselectedPens = allPens.filter((pen) => !activeIds.has(pen.id));
    unselectedPens.length ? this.active(unselectedPens) : this.clearActive();
  }

  setAnchorHandleType(handleType?: HandleType) {
    const line = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
    const anchorId = this.hoverAnchor?.id;
    if (!line || line.locked || line.category !== PenCategory.Line || !anchorId) {
      return false;
    }

    const anchors = structuredClone(line.anchors || []);
    const index = anchors.findIndex((anchor) => anchor.id === anchorId);
    if (index < 0) {
      return false;
    }

    const anchor = anchors[index];
    if (handleType === undefined) {
      delete anchor.cp1;
      delete anchor.cp2;
      delete anchor.handleType;
      return this.updateLineAnchors(line, anchors, line.type);
    }

    const previous = index > 0 ? anchors[index - 1] : line.close ? anchors[anchors.length - 1] : undefined;
    const next = index < anchors.length - 1 ? anchors[index + 1] : line.close ? anchors[0] : undefined;
    let dx = (next?.x ?? anchor.x) - (previous?.x ?? anchor.x);
    let dy = (next?.y ?? anchor.y) - (previous?.y ?? anchor.y);
    if (!dx && !dy && next) {
      dx = next.x - anchor.x;
      dy = next.y - anchor.y;
    } else if (!dx && !dy && previous) {
      dx = anchor.x - previous.x;
      dy = anchor.y - previous.y;
    }

    const distance = Math.hypot(dx, dy) || 1;
    // 新建手柄时沿相邻锚点的切线方向放置，长度限制为较短相邻线段的三分之一。
    const adjacentLengths = [previous, next]
      .filter(Boolean)
      .map((item) => Math.hypot(item.x - anchor.x, item.y - anchor.y))
      .filter((item) => item > 0);
    const defaultLength = (adjacentLengths.length ? Math.min(...adjacentLengths) : 60) / 3;
    const unitX = dx / distance;
    const unitY = dy / distance;

    anchor.cp1 ||= { x: anchor.x + unitX * defaultLength, y: anchor.y + unitY * defaultLength };
    anchor.cp2 ||= { x: anchor.x - unitX * defaultLength, y: anchor.y - unitY * defaultLength };

    if (handleType !== HandleType.Free) {
      const cp1Length = Math.hypot(anchor.cp1.x - anchor.x, anchor.cp1.y - anchor.y) || defaultLength;
      const cp2Length =
        handleType === HandleType.Mirror
          ? cp1Length
          : Math.hypot(anchor.cp2.x - anchor.x, anchor.cp2.y - anchor.y) || defaultLength;
      const cpDirectionX = (anchor.cp1.x - anchor.x) / cp1Length;
      const cpDirectionY = (anchor.cp1.y - anchor.y) / cp1Length;
      anchor.cp1.x = anchor.x + cpDirectionX * cp1Length;
      anchor.cp1.y = anchor.y + cpDirectionY * cp1Length;
      anchor.cp2.x = anchor.x - cpDirectionX * cp2Length;
      anchor.cp2.y = anchor.y - cpDirectionY * cp2Length;
    }

    anchor.handleType = handleType;
    anchor.cp1.handleType = handleType;
    anchor.cp2.handleType = handleType;
    return this.updateLineAnchors(line, anchors, 'curve');
  }

  updateLineAnchors(
    line: Pen,
    anchors: Point[],
    type: string,
    relatedBeforeUpdate: Pen[] = [],
    relatedUpdate: Pen[] = [],
  ) {
    const beforeBoundary = structuredClone(this.activeBoundary);
    const beforeUpdate = [patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }), ...relatedBeforeUpdate];
    const updatedLine = patchClone(line, {
      anchors,
      type,
      patchFlag: PatchFlag.Active | PatchFlag.Rect,
    });
    updatedLine.anchors = anchors;
    updatedLine.type = type;

    const boundary = calcLineRect(updatedLine);

    const update = [updatedLine, ...relatedUpdate];
    // 连线和关联图元必须进入同一次补丁和历史记录，保证撤销时连接关系完整恢复。
    this.patch(undefined, undefined, beforeUpdate, update);
    this.pushAction({ beforeUpdate, update, beforeBoundary, boundary });
    if (this.options.mode && this.collaborate) {
      this.utilityWorker.postMessage({
        action: WorkerMessage.Patch,
        patch: { beforeUpdate, update },
      });
    }
    this.hover = updatedLine;
    this.hoverLinePoint = undefined;
    this.hoverAnchor = undefined;
    this.hoverType = HoverType.None;
    this.active([updatedLine], boundary);
    this.hoverWorker.postMessage({
      action: WorkerMessage.Hover,
      pen: updatedLine,
      boundary,
      editingAnchor: null,
    });
    return true;
  }

  clearActive() {
    if (this.options.mode === Mode.Run && this.activePens) {
      for (const pen of this.activePens) {
        dispatchEvent.call(this, pen, EventType.Inactive);
      }
    }

    this.activePens.forEach((pen) => (pen.active = false));
    this.activePens = [];
    this.renderWorker.postMessage({
      action: WorkerMessage.Active,
    });
    this.hoverWorker.postMessage({
      action: WorkerMessage.Active,
    });
    this.calcWorker.postMessage({
      action: WorkerMessage.Active,
    });

    this.emitter.emit('active', this.activePens);
  }

  /**
   * 开启或关闭画布放大镜。
   * 开启后由画布鼠标移动事件持续刷新放大区域，关闭时清理 hover 层残留。
   */
  showMagnifier(enabled: boolean): boolean {
    const currentState = this.interactionStateMachine.state;

    if (enabled) {
      if (currentState !== InteractionMode.None && currentState !== InteractionMode.CanvasMagnifier) {
        return false;
      }

      this.topElement.focus();
      this.topElement.style.cursor = 'zoom-in';
      return this.interactionStateMachine.transition(InteractionMode.CanvasMagnifier);
    }

    if (currentState !== InteractionMode.CanvasMagnifier) {
      return currentState === InteractionMode.None;
    }

    const result = this.interactionStateMachine.transition(InteractionMode.None);
    this.topElement.style.cursor = 'default';
    this.hoverWorker.postMessage({ action: WorkerMessage.Magnifier, clear: true });
    return result;
  }

  updateController() {
    if (this.options.mode === Mode.Edit) {
      if (this.activePens.length) {
        this.hoverWorker.postMessage({
          action: WorkerMessage.Active,
          activePens: this.activePens,
          activeBoundary: this.activeBoundary,
          hover: null,
        });
      } else {
        this.hoverWorker.postMessage({
          action: WorkerMessage.Active,
        });
      }
    }
  }

  dragEnd() {
    this.hoverWorker.postMessage({ action: WorkerMessage.DragPens });
    this.addCaches = undefined;
  }

  // 全局生命周期函数
  beforeRender?(): void;
  beforeAdd?(pens: Pen[]): boolean | Promise<boolean>;
  beforeDelete?(pens: Pen[]): boolean | Promise<boolean>;
  beforeConnectLine?(line: Pen, from?: Pen, to?: Pen): boolean | Promise<boolean>;

  on: any = this.emitter.on;
  off: any = this.emitter.off;

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.options.mode === Mode.Run) {
      // 执行active pen的

      // 不是运行模式能执行的快捷键直接返回
      if (e.key != ' ') return;
    }

    if (e.isTrusted && this.options.ignoreHotkeys?.includes(e.key)) {
      return;
    }

    e.preventDefault();
    // e.stopPropagation();

    this.keydownFns[e.key] && this.keydownFns[e.key].call(this, e);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 放大镜采用按键切换模式，松开 Z 时继续保持当前状态。
    if (this.interactionStateMachine.state === InteractionMode.CanvasMagnifier) {
      return;
    }

    // 这里的复位是给「按住空格平移画布」松开用的。画线是多次点击的过程，
    // 画线中按的任何键（空格切正交、Shift 锁水平…）松开时都不能把它复位掉。
    if (this.interactionStateMachine.state === InteractionMode.DrawingLine) {
      return;
    }

    this.interactionStateMachine.transition(InteractionMode.None);
  };

  enterTextInput(p: Pen) {
    let pen = this.penMap.get(p.id);
    if (pen.disableInput) {
      return;
    }
    this.textInputting = pen.id;

    const numberInput = pen.input === InputMode.Number;
    // 数字输入允许负号和小数点，但始终只保留一个负号（开头）和一个小数点。
    const normalizeNumberInput = (value: string) => {
      const source = value.replace(/[\r\n]/g, '');
      const negative = source.trimStart().startsWith('-');
      const unsigned = source.replace(/[^\d.]/g, '');
      const dotIndex = unsigned.indexOf('.');
      const normalized =
        dotIndex < 0 ? unsigned : `${unsigned.slice(0, dotIndex)}.${unsigned.slice(dotIndex + 1).replace(/\./g, '')}`;
      return `${negative ? '-' : ''}${normalized}`;
    };
    this.inputElement.setAttribute('inputmode', numberInput ? 'decimal' : 'text');
    this.inputElement.oninput = numberInput
      ? () => {
          const normalized = normalizeNumberInput(this.inputElement.innerText);
          if (normalized !== this.inputElement.innerText) {
            this.inputElement.innerText = normalized;
          }
        }
      : null;
    this.inputElement.onpaste = numberInput
      ? (e: ClipboardEvent) => {
          e.stopPropagation();
          e.preventDefault();
          const text = normalizeNumberInput(e.clipboardData?.getData('text') || '');
          document.execCommand('insertText', false, text);
        }
      : (e: ClipboardEvent) => e.stopPropagation();

    this.hoverWorker.postMessage({
      action: WorkerMessage.TextInputting,
      textInputting: true,
    });
    // 隐藏文字
    this.calcWorker.postMessage({
      action: WorkerMessage.CalcPenBoundary,
      pens: this.activePens,
      render: true,
      inputtingPen: pen.id,
    });

    if (pen.textRectWidth == undefined) {
      calcTextRect(pen);
    }

    const scale = this.data.scale || 1;
    let textRectX = pen.textRectX;
    let textRectY = pen.textRectY;
    let textWidth = getTextLayoutWidth(pen) || pen.width;
    let textHeight = getTextLayoutHeight(pen) || pen.ey - textRectY;

    // 受边界约束的图元（非文字图元、非连线），输入框也必须钳制在图元边界内，
    // 与渲染阶段的文字边界规则保持一致，避免编辑框画出图形外。
    if (!isTextOverflowAllowed(pen)) {
      const ix0 = Math.max(textRectX, pen.x);
      const iy0 = Math.max(textRectY, pen.y);
      const ix1 = Math.min(textRectX + textWidth, pen.ex);
      const iy1 = Math.min(textRectY + textHeight, pen.ey);
      if (ix1 > ix0 && iy1 > iy0) {
        textRectX = ix0;
        textRectY = iy0;
        textWidth = ix1 - ix0;
        textHeight = iy1 - iy0;
      } else {
        // 极端情况（图元压成线/点）退回整个图元矩形，保证输入框仍可见可点。
        textRectX = pen.x;
        textRectY = pen.y;
        textWidth = pen.width;
        textHeight = pen.height;
      }
    }

    const inputBox = this.inputElement.parentElement;

    // Canvas 使用“画布平移 + 逻辑坐标缩放”的变换，DOM 输入框需要转换到相同的屏幕坐标系。
    inputBox.style.left = `${textRectX * scale + this.data.x}px`;
    inputBox.style.top = `${(textRectY - 1.5) * scale + this.data.y}px`;
    inputBox.style.width = `${textWidth * scale}px`;
    inputBox.style.height = `${textHeight * scale}px`;

    if (pen.rotate) {
      const pivot = pen.pivot || {
        x: pen.x + pen.width / 2,
        y: pen.y + pen.height / 2,
      };
      inputBox.style.transform = `rotate(${pen.rotate}deg)`;
      // transform-origin 相对于输入框自身，而不是相对于整个图元。
      inputBox.style.transformOrigin = `${(pivot.x - textRectX) * scale}px ${(pivot.y - textRectY) * scale}px`;
    } else {
      inputBox.style.transform = '';
      inputBox.style.transformOrigin = '';
    }

    this.inputElement.style.textAlign = `${TextAligns[pen.textAlign || 2]}`;
    inputBox.style.justifyContent = `${TextJustifyContents[pen.textAlign || 2]}`;
    inputBox.style.alignItems = `${TextVerticals[pen.textVertical || 2]}`;

    const textData = this.data as Meta2dData &
      Pick<Pen, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'lineHeight'>;
    this.inputElement.style.fontFamily = pen.fontFamily ?? textData.fontFamily ?? 'Arial';
    this.inputElement.style.fontSize = `${(pen.fontSize ?? textData.fontSize ?? 12) * scale}px`;

    const textGradient = pen.textGradient || (!pen.textColor && !pen.color ? this.data.textGradient : undefined);
    if (textGradient) {
      this.inputElement.style.color = 'transparent';
      this.inputElement.style.background = gradientToCss(textGradient);
      this.inputElement.style.backgroundClip = 'text';
    } else {
      this.inputElement.style.color = `${pen.textColor || pen.color || this.data.textColor || this.data.color}`;
      this.inputElement.style.background = '';
      this.inputElement.style.backgroundClip = '';
    }

    this.inputElement.style.lineHeight = `${pen.lineHeight ?? textData.lineHeight ?? 1.5}`;

    this.inputElement.style.fontWeight = pen.fontWeight ?? textData.fontWeight ?? 'normal';
    this.inputElement.style.fontStyle = pen.fontStyle ?? textData.fontStyle ?? 'normal';
    if (pen.letterSpacing) {
      this.inputElement.style.letterSpacing = pen.letterSpacing * scale + 'px';
    } else {
      this.inputElement.style.letterSpacing = '';
    }
    if (pen.textDecoration) {
      if (pen.textDecoration === TextDecoration.LineThrough) {
        this.inputElement.style.textDecorationLine = 'line-through';
      } else {
        this.inputElement.style.textDecorationLine = 'underline';
      }

      if (pen.textDecorationColor) {
        this.inputElement.style.textDecorationColor = pen.textDecorationColor;
      } else {
        this.inputElement.style.textDecorationColor = `${
          pen.textDecorationColor || pen.textColor || this.data.textColor || this.data.color
        }`;
      }

      if (pen.textDecorationDash) {
        this.inputElement.style.textDecorationStyle = 'dashed';
      } else {
        this.inputElement.style.textDecorationStyle = 'solid';
      }
      this.inputElement.style.textDecorationThickness = '1px';
    } else {
      this.inputElement.style.textDecoration = '';
    }

    // 文字宽度自适应或按\n换行
    // 受边界约束的图元：渲染侧 wrapLineByWord 对超出边界的长英文单词/数字串做逐字符兜底，
    // 输入框必须用 CSS 对齐同一行为，否则 contentEditable 里的连续英文/数字作为整体
    // 不会被断行，会横向撑出图元边界（中文每个字符都是断行点所以没有这个问题）。
    if (!isTextOverflowAllowed(pen)) {
      this.inputElement.style.wordBreak = 'break-all';
      this.inputElement.style.overflowWrap = 'anywhere';
      // 内层 #input 默认 width/height:auto，行数增多时 contentEditable 会自己长高，
      // 撑出 input-box 也就撑出图元边界。这里让它铺满被钳制过的 box，内容超出时
      // 在框内滚动（配合滚轮 stopPropagation，不会触发画布缩放），
      // 可视内容始终限制在图元边界内。
      this.inputElement.style.width = '100%';
      this.inputElement.style.height = '100%';
      this.inputElement.style.overflow = 'auto';
      // 可滚动但不显示滚动条（新版浏览器 scrollbar-width，旧版 WebKit 伪元素兜底）。
      this.inputElement.style.scrollbarWidth = 'none';
      this.inputElement.style.setProperty('-ms-overflow-style', 'none');
    } else {
      this.inputElement.style.wordBreak = '';
      this.inputElement.style.overflowWrap = '';
      this.inputElement.style.width = '';
      this.inputElement.style.height = '';
      this.inputElement.style.overflow = '';
    }

    // 输入内容超出输入框后，鼠标滚轮用于在框内滚动查看，不能冒泡到画布触发缩放/平移。
    this.inputElement.onwheel = (e: WheelEvent) => e.stopPropagation();
    if (!getTextLayoutWidth(pen) || pen.textWrap === TextWrap.Line) {
      this.inputElement.style.whiteSpace = 'pre';
    } else if (pen.textWrap === TextWrap.Nowrap) {
      this.inputElement.style.whiteSpace = 'nowrap';
    } else {
      this.inputElement.style.whiteSpace = 'pre-wrap';
    }

    if (pen.text) {
      this.inputElement.style.border = '1px solid #1890ff80';
    } else {
      this.inputElement.style.border = 'none';
    }

    const initialText = pen.text || '';
    this.inputElement.innerText = numberInput
      ? normalizeNumberInput(initialText)
      : pen.textWrap === TextWrap.Nowrap
        ? initialText.replace(/[\r\n]/g, '')
        : initialText;
    this.inputElement.parentElement.style.visibility = 'visible';
    this.inputElement.focus();
    setTimeout(() => {
      let range = document.createRange();
      let sel = window.getSelection();

      // 找最后一个文本节点
      function getLastTextNode(node) {
        if (node.nodeType === 3) return node; // 文本节点
        if (!node.hasChildNodes()) return null;
        return getLastTextNode(node.lastChild);
      }

      let lastTextNode = getLastTextNode(this.inputElement);

      if (lastTextNode) {
        range.setStart(lastTextNode, lastTextNode.textContent.length);
      } else {
        // 没有文本节点，光标放元素开始
        range.setStart(this.inputElement, 0);
      }

      range.collapse(true);

      sel.removeAllRanges();
      sel.addRange(range);
    }, 10);
  }

  private calcTextAutoSizeAfterInput(pen: Pen | undefined, text: string): Rect | undefined {
    if (!pen?.textAutoSize || !text) {
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // 使用渲染阶段相同的字体和排版算法，确保输入完成后的尺寸与实际绘制结果一致。
    const textPen = structuredClone(pen);
    textPen.text = text;
    delete textPen.textLines;
    delete textPen.textBox;
    calcTextRect(textPen);
    ctx.font = getFont(textPen, this.data);
    calcTextLines(ctx, textPen);

    const textBox = textPen.textBox;
    if (
      !textBox ||
      !Number.isFinite(textBox.x) ||
      !Number.isFinite(textBox.y) ||
      !Number.isFinite(textBox.ex) ||
      !Number.isFinite(textBox.ey)
    ) {
      return;
    }

    const rect: Rect = {
      x: Math.round(textBox.x),
      y: Math.round(textBox.y),
      ex: Math.round(textBox.ex),
      ey: Math.round(textBox.ey),
    };
    rect.width = rect.ex - rect.x;
    rect.height = rect.ey - rect.y;
    return rect;
  }

  exitTextInput() {
    if (!this.textInputting) {
      return;
    }

    const pen = this.penMap.get(this.textInputting);
    if (!pen) {
      // 输入中的图元已经不在了（输入时 open 了新数据、协同删除等）：只退出输入状态，没有可提交的
      this.cancelTextInput();
      return;
    }
    const text = pen.textWrap === TextWrap.Nowrap
      ? this.inputElement.innerText.replace(/[\r\n]/g, '')
      : this.inputElement.innerText;
    const val = { id: this.textInputting, text };
    const autoSizeRect = this.calcTextAutoSizeAfterInput(pen, val.text);
    autoSizeRect && Object.assign(val, autoSizeRect);

    this.setValue(val);

    this.hoverWorker.postMessage({
      action: WorkerMessage.TextInputting,
    });

    const pens = this.activePens;

    // 等待textbox计算完成再刷新文字
    setTimeout(() => {
      this.calcWorker.postMessage({
        action: WorkerMessage.CalcPenBoundary,
        pens: getAllPens(this.penMap, pens),
        render: true,
      });
    }, 30);
    setTimeout(() => {
      this.calcWorker.postMessage({
        action: WorkerMessage.CalcPenBoundary,
        pens: getAllPens(this.penMap, pens),
        render: true,
      });
    }, 150);

    let add: Pen[];
    const beforeUpdate: Pen[] = [];
    const update: Pen[] = [];
    if (this.textAdd) {
      // 更新父图元的文字区域
      const parent = this.penMap.get(pen.parentId);
      beforeUpdate.push(
        patchClone(parent, {
          children: parent.children.filter((id) => id !== this.textInputting),
        }),
      );
      update.push(patchClone(parent, { children: parent.children }));

      const p = structuredClone(pen);
      delete p.textBox;
      delete p.textLines;
      p.text = val.text;
      autoSizeRect && Object.assign(p, autoSizeRect);
      add = [p];
    } else {
      beforeUpdate.push(patchClone(pens[0], { text: pens[0].text || '' }));

      update.push(patchClone(pens[0], { text: val.text, ...autoSizeRect }));
    }

    this.pushAction({ add, beforeUpdate, update });

    this.resetTextInput();
  }

  /** 放弃当前文字输入（不提交）：隐藏输入框，并清掉各线程的输入标记（calc 在输入中不做拾取） */
  private cancelTextInput() {
    if (!this.textInputting) {
      return;
    }
    this.hoverWorker.postMessage({ action: WorkerMessage.TextInputting });
    this.calcWorker.postMessage({ action: WorkerMessage.TextInputting });
    this.resetTextInput();
  }

  private resetTextInput() {
    this.textInputting = '';
    this.textAdd = false;
    this.inputElement.oninput = null;
    this.inputElement.onpaste = (e: ClipboardEvent) => e.stopPropagation();
    this.inputElement.removeAttribute('inputmode');
    this.inputElement.parentElement.style.visibility = 'hidden';
  }

  onContextMenu?(e: MouseEvent, show: boolean): void;
  uploadFn?: (file: File) => Promise<string>;
  getMeta2dData?: (id: string) => Promise<Meta2dData>;
  // 拖拽图元吸附到其他图元边缘或中心等参考点
  snapToPen?: (
    this: Meta2d,
    x: number,
    y: number,
  ) => {
    offsetX?: number; // 吸附后的x的偏移坐标
    offsetY?: number; // 吸附后的y的偏移坐标
    xLine?: Pen; // 吸附的x轴参考线。线的端点为{x,y}和{ex,ey}
    yLine?: Pen; // 吸附的y轴参考线。线的端点为{x,y}和{ex,ey}
  };

  setRotateCursors(cursors: string[]) {
    if (cursors?.length === 4) {
      RotateCursors.length = 0;
      RotateCursors.push(...cursors);
    }
  }

  async toPng(
    params: {
      pens?: Pen[];
      padding?: Padding;
      backgroundImage?: boolean;
      maxWidth?: number;
    } = {},
    callback?: (buffer: ArrayBuffer, error?: string) => void,
  ) {
    // 分批打开还没补完时，render 手里还缺视口外的图元，导出的图会缺一块
    await this.whenLoaded();
    const pens: any[] = [];
    const imgMap: { [key: string]: ImageBitmap } = {};
    const imageBitmaps: ImageBitmap[] = [];
    if (!params.pens) {
      params.pens = [];
      for (const pen of this.penMap.values()) {
        params.pens.push(pen);
      }
    }
    if (params.pens) {
      for (const pen of params.pens) {
        pens.push(pen.id);

        if (pen.category === PenCategory.HtmlElement) {
          let imageBitmap: ImageBitmap | undefined;
          if (toPngFns[pen.type]) {
            imageBitmap = await toPngFns[pen.type].call(this, pen);
          } else {
            const blob = await snapdom.toBlob(this.componentElementMap.get(pen.id), { type: 'png' });
            imageBitmap = await createImageBitmap(blob);
          }

          // DOM 图元允许导出失败并返回空结果，不能把 undefined 放入 Worker 的传输列表。
          if (!imageBitmap) {
            continue;
          }
          imgMap[pen.id] = imageBitmap;
          imageBitmaps.push(imageBitmap);
        }
      }
    }

    const requestId = ++this.toPngRequestId;
    const requestParams = { ...params, requestId };
    requestParams.pens = pens.length ? pens : undefined;
    if (callback) {
      this.toPngCallbacks.set(requestId, callback);
    }
    this.renderWorker.postMessage({ action: WorkerMessage.ToPng, params: requestParams, imgMap }, imageBitmaps);
  }

  async toSvg(defs?: string[]): Promise<void> {
    const { exportToSvg } = await import('./utils/svg/export');
    await exportToSvg(this, defs);
  }

  setElementStyle(elem: HTMLElement, val?: Pen) {
    if (!elem || !val) {
      return;
    }
    // 由 setViewPosition 对每个 HTML 图元逐个调用，必须是 O(1) 判定
    if (!this.inViewPenIdSet?.has(val.id) || val.visible === false) {
      elem.style.visibility = 'hidden';
      return;
    }
    elem.style.position = 'absolute';
    elem.style.outline = 'none';
    if (val.opacity) {
      elem.style.opacity = val.opacity.toString();
    }
    const scale = this.data.scale || 1;
    if (val.x != undefined) {
      elem.style.left = `${val.x * scale + this.data.x}px`;
      elem.style.top = `${val.y * scale + this.data.y}px`;
      elem.style.width = `${val.width * scale}px`;
      elem.style.height = `${val.height * scale}px`;
    }
    if (val.rotate) {
      elem.style.transform = `rotate(${val.rotate}deg)`;
    } else {
      if (val.flipX) {
        elem.style.transform = `rotateY(180deg)`;
      }
      if (val.flipY) {
        elem.style.transform = `rotateX(180deg)`;
      }
      if (val.flipX && val.flipY) {
        elem.style.transform = `rotateZ(180deg)`;
      }
    }
    if (val.zIndex !== undefined) {
      elem.style.zIndex = val.zIndex.toString();
    }
    if (val.locked || this.options.mode === Mode.Run) {
      elem.style.userSelect = 'initial';
      elem.style.pointerEvents = 'initial';
      if (val.name === 'gif') {
        elem.style.userSelect = 'none';
        elem.style.pointerEvents = 'none';
      }
    } else {
      elem.style.userSelect = 'none';
      elem.style.pointerEvents = 'none';
    }
    if (val.className) {
      elem.className = val.className;
    }
    if (val.styles) {
      for (let key in val.styles) {
        elem.style[key] = val.styles[key];
      }
    }

    elem.style.visibility = 'visible';
  }

  find(idOrTag: string): Pen[] {
    const pen = this.penMap.get(idOrTag);
    if (pen) {
      return [pen];
    }

    const pens = [];
    this.penMap.forEach((pen) => {
      if (pen.tags && pen.tags.includes(idOrTag)) {
        pens.push(pen);
      }
    });

    return pens;
  }

  findOne(idOrTag: string): Pen | undefined {
    return this.find(idOrTag)[0];
  }

  startAnimate(
    idOrTagOrPens: string | Pen[],
    options?: { stop?: boolean; pause?: boolean; name?: string; currentAnimation?: number },
  ) {
    let pens: Pen[];
    if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else if (Array.isArray(idOrTagOrPens)) {
      pens = idOrTagOrPens;
    }

    if (!pens) {
      // 如果没有指定图元，获取所有设置了 autoPlay: true 的图元
      pens = Array.from(this.penMap.values()).filter(pen => pen.autoPlay);
      if (!pens.length) {
        return;
      }
    }

    const penIds = [];
    const animationMap: { [penId: string]: Animation } = {};
    const connectedLines: { [peiId: string]: ConnectLine[] } = {};
    for (const pen of pens) {
      if (!pen.animations) {
        continue;
      }

      penIds.push(pen.id);
      if (options?.currentAnimation != undefined) {
        animationMap[pen.id] = pen.animations[options.currentAnimation];
        pen.currentAnimation = options.currentAnimation;
      } else if (options?.name) {
        animationMap[pen.id] = pen.animations.find((a) => a.name === options.name);
        pen.currentAnimation = pen.animations.findIndex((a) => a.name === options.name);
      } else {
        animationMap[pen.id] = pen.animations[pen.currentAnimation ?? 0];
      }

      if (pen.connectedLines) {
        connectedLines[pen.id] = pen.connectedLines;
      }
    }

    let action = WorkerMessage.StartAnimate;
    if (options?.pause) {
      action = WorkerMessage.PauseAnimate;
    } else if (options?.stop) {
      action = WorkerMessage.StopAnimate;
    }

    let state = PlayState.Playing;
    if (options?.pause) {
      state = PlayState.Paused;
    } else if (options?.stop) {
      state = PlayState.None;
    }

    if (options) {
      options.pause = undefined;
      options.stop = undefined;
    }

    this.renderWorker.postMessage({ action: WorkerMessage.UpdateAnimateState, penIds, state });
    this.calcWorker.postMessage({ action, penIds, animationMap, connectedLines });
  }

  pauseAnimate(idOrTagOrPens: string | Pen[]) {
    this.startAnimate(idOrTagOrPens, { pause: true });
  }

  stopAnimate(idOrTagOrPens: string | Pen[]) {
    this.startAnimate(idOrTagOrPens, { stop: true });
  }

  startVideo(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[];
    if (!idOrTagOrPens) {
      pens = Array.from(this.penMap.values());
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else if (Array.isArray(idOrTagOrPens)) {
      pens = idOrTagOrPens;
    }

    if (!pens) {
      return;
    }
    pens.forEach((pen) => {
      const player = this.componentElementMap.get(pen.id);
      if (player) {
        const media = player.getElementsByTagName('video')[0];
        media?.play();
      }
    });
  }

  pauseVideo(idOrTagOrPens: string | Pen[]) {
    let pens: Pen[];
    if (!idOrTagOrPens) {
      pens = Array.from(this.penMap.values());
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else if (Array.isArray(idOrTagOrPens)) {
      pens = idOrTagOrPens;
    }

    if (!pens) {
      return;
    }
    pens.forEach((pen) => {
      const player = this.componentElementMap.get(pen.id);
      if (player) {
        const media = player.getElementsByTagName('video')[0];
        media?.pause();
      }
    });
  }

  stopVideo(idOrTagOrPens: string | Pen[]) {
    let pens: Pen[];
    if (!idOrTagOrPens) {
      pens = Array.from(this.penMap.values());
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else if (Array.isArray(idOrTagOrPens)) {
      pens = idOrTagOrPens;
    }

    if (!pens) {
      return;
    }
    pens.forEach((pen) => {
      const player = this.componentElementMap.get(pen.id);
      if (player) {
        const media = player.getElementsByTagName('video')[0];
        media.currentTime = 0;
        media?.pause();
      }
    });
  }

  messageBox(options: MessageOptions) {
    const message = new MessageBox(this, options);
    message.init();
  }

  closeAllMessageBox() {
    closeAll();
  }

  // Web组件函数
  connectedCallback() {
    ++this.connectionId;
    themeManager.ensureStyle(this);
    if (this.initialized) {
      window.addEventListener('resize', this.handleWindowResize);
      this.resize();
      return;
    }
    this.init();
    this.initialized = true;
    window.addEventListener('resize', this.handleWindowResize);
    // 必须等 DOM 和各 Worker 建立后再执行宿主钩子，异步完成前由 ready 阻止过早打开图纸。
    void Promise.resolve()
      .then(() => initializeMeta2d(this))
      .then(this.resolveReady, this.rejectReady);
  }

  attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    switch (name) {
      case 'theme':
        if (newValue && newValue !== oldValue) {
          this.setTheme(newValue);
        }
        break;
      case 'rule':
        break;
      case 'scroll':
        break;
      default:
        break;
    }
  }
  // 当元素从文档中移除时调用，需要清理自定义资源（如定时器、外部事件监听器等）
  disconnectedCallback() {
    this.clearWindowResize();
    const connectionId = ++this.connectionId;
    // appendChild 调整 DOM 图元层级时会同步断开并重连子画布；等本轮移动结束再决定是否销毁 Worker。
    queueMicrotask(() => {
      if (this.isConnected || connectionId !== this.connectionId) return;
      this.dispose();
    });
  }

  private dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.resizeFrame && cancelAnimationFrame(this.resizeFrame);
    this.pickFrame && cancelAnimationFrame(this.pickFrame);
    this.translateFrame && cancelAnimationFrame(this.translateFrame);
    this.hoverMoveFrame && cancelAnimationFrame(this.hoverMoveFrame);
    this.map?.destroy();
    this.map = undefined;
    this.toPngCallbacks.clear();
    this.renderWorker.postMessage({ action: WorkerMessage.Destory });
    this.calcWorker.postMessage({ action: WorkerMessage.Destory });
    this.hoverWorker.postMessage({ action: WorkerMessage.Destory });
    this.utilityWorker.postMessage({ action: WorkerMessage.Destory });

    clearTimeout(this.queueTimer);
    this.queueTimer = undefined;
    this.queueStopped = true;
    this.cancelProgressiveLoad();
    this.clearComponentElements();
    themeManager.destroyStyle(this);
    this.initialized = false;
  }

  getVersion() {
    return version;
  }
}

export function createMeta2d(name = 'le5le-meta2d') {
  if (!customElements.get(name)) {
    customElements.define(name, Meta2d);
  }
}
