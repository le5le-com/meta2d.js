import { WorkerMessage } from '../../types';
import { penDefines } from '../../diagrams';
import { fillDefaultAnchors } from '../../diagrams/base';
import { getClosestPoint, getFlipRect, patchClone, PatchFlag, Pen, Point, Rect, PenCategory, isTinyPen } from '../../models';
import { deepClone } from '../../utils';
import {
  clearAnimate,
  isAnimating,
  onAnimRendered,
  onPauseAnimate,
  onStartAnimate,
  onStopAnimate,
  rebaseAnimate,
  removeAnimate,
  updateAnimate,
} from './animate';
import {
  add,
  edgeFns,
  getPensInPenBoundary,
  initPickGrid,
  onActive,
  pick,
  remove,
  onActiveAnchor,
  overDock,
  onCalcPenBoundary,
  onTextInputting,
  update,
  markTextBoxsDirty,
  getCells,
  updatePenCell,
  sortCells,
  getPickGridInternals,
  updateBoundingCPs,
  outlineDraws,
  OUTLINE_TYPES,
  PAINT_KEYS,
  getPenRects,
  getPensInRects,
  addPens,
} from './pick';
import { options, paint, penMap, textBoxs, view, viewWorld } from './vars';
import { probe } from '../../perf/probe';
import { reportGrid } from '../../perf/grid-report';

let x: number = 0;
let y: number = 0;
let canvasWidth: number = 0;
let canvasHeight: number = 0;
let scale: number = 1;

/** 把视口（x / y / scale / 画布 CSS 尺寸）换算成世界坐标，写进 vars.viewWorld 给动画循环用 */
function syncViewWorld() {
  viewWorld.ok = canvasWidth > 0 && canvasHeight > 0 && scale > 0;
  viewWorld.x0 = -x / scale;
  viewWorld.y0 = -y / scale;
  viewWorld.x1 = (-x + canvasWidth) / scale;
  viewWorld.y1 = (-y + canvasHeight) / scale;
}

/**
 * 差量 Patch 里 calc 要合并的键 = onPatch 整图元路径里会写进 penMap 的那些：patchClone 的字段
 * （从它的字面量取，跟着它变）+ 它按条件带的几个 + onPatch 单独拷的几个 + PAINT_KEYS。
 */
const PARTIAL_KEYS = new Set<string>([
  ...Object.keys(patchClone({} as Pen)),
  'anchors',
  'connectedLines',
  'pivot',
  'lineIsEdge',
  'lineSmooth',
  'textAutoSize',
  'fromArrowSize',
  'toArrowSize',
  'children',
  'image',
  'parentId',
  'showChild',
  'animations',
  'currentAnimation',
  'play',
  'autoPlay',
  ...PAINT_KEYS,
]);
PARTIAL_KEYS.delete('id');

/**
 * 分块脏区只在这么多图元以内考虑（第 1 步）。再多就是「几乎全改」，块的并集本来就接近整屏，
 * 逐块收集反而比一次并集扫描贵。
 */
const MaxRegionPens = 2000;
/** 块的总面积 ≤ 并集框面积 × 这个比例，才值得分块（散落的点）；挨在一起的点仍走并集框 */
const RegionAreaRatio = 0.5;
/** render 把块合成互不相交矩形再裁剪；块太多时裁剪路径本身变贵，退回并集框 */
const MaxRegionRects = 1000;

/** 第 3 步：改动的图元少于这个数不考虑整屏重画 */
const FullViewMinPens = 1000;
/** 改动图元的外接框盖住视口这么大比例，就整屏重画 */
const FullViewRatio = 0.6;

/**
 * 改动图元（新旧位置）的外接框是否盖住视口 FullViewRatio 以上。只是个粗判：用图元自身矩形，
 * 不含文字外溢 / 描边 —— 判错的代价只是多画或少省一点，正确性由整屏重画 / 原路径各自保证。
 * 旧位置取 penMap（此时还没应用更新，就是旧几何；差量条目不带几何），新位置取带几何的 update 条目。
 */
function coversView(oldPens: Pen[], newPens: Pen[]) {
  if (!(canvasWidth > 0) || !(canvasHeight > 0) || !(scale > 0)) {
    return false;
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (p: Pen) => {
    if (!p || p.x == undefined || p.y == undefined) {
      return;
    }
    const ex = p.ex ?? p.x + (p.width || 0);
    const ey = p.ey ?? p.y + (p.height || 0);
    p.x < x0 && (x0 = p.x);
    p.y < y0 && (y0 = p.y);
    ex > x1 && (x1 = ex);
    ey > y1 && (y1 = ey);
  };
  for (const p of oldPens) {
    add(penMap.get(p.id) || p);
  }
  for (const p of newPens) {
    p.patchFlag & PatchFlag.Rect && add(p);
  }
  const vx0 = -x / scale;
  const vy0 = -y / scale;
  const vx1 = (-x + canvasWidth) / scale;
  const vy1 = (-y + canvasHeight) / scale;
  const w = Math.min(x1, vx1) - Math.max(x0, vx0);
  const h = Math.min(y1, vy1) - Math.max(y0, vy0);
  return w > 0 && h > 0 && w * h >= (vx1 - vx0) * (vy1 - vy0) * FullViewRatio;
}

/** 分块是否比一个并集框划算（见 RegionAreaRatio） */
function regionsPayOff(rects: Rect[]) {
  if (rects.length < 2 || rects.length > MaxRegionRects) {
    return false;
  }
  let area = 0;
  for (const r of rects) {
    area += r.width * r.height;
  }
  const u = unionRect(rects);
  return area <= u.width * u.height * RegionAreaRatio;
}

function unionRect(rects: Rect[]): Rect {
  let x = Infinity;
  let y = Infinity;
  let ex = -Infinity;
  let ey = -Infinity;
  for (const r of rects) {
    r.x < x && (x = r.x);
    r.y < y && (y = r.y);
    r.ex > ex && (ex = r.ex);
    r.ey > ey && (ey = r.ey);
  }
  return { x, y, ex, ey, width: ex - x, height: ey - y };
}

let dockPen: Pen;

let hoverId: string;
let _topId: string;
let _anchor: Point;
let _cp: number;
let _rotatePoint: Point;
let _sizePoint: Point;

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
  [WorkerMessage.TranslateScale]: onTranslateScale,
  [WorkerMessage.Pick]: onPick,
  [WorkerMessage.PickLinePosition]: onPickLinePosition,
  [WorkerMessage.DragOver]: onDragOver,
  [WorkerMessage.Active]: onActive,
  [WorkerMessage.ActiveAnchor]: onActiveAnchor,
  [WorkerMessage.Patch]: onPatch,
  [WorkerMessage.ImageFetched]: onImageFetched,
  [WorkerMessage.CalcPenBoundary]: onCalcPenBoundary,
  [WorkerMessage.TextOutside]: onTextOutside,
  [WorkerMessage.TextInputting]: onTextInputting,
  [WorkerMessage.StartAnimate]: onStartAnimate,
  [WorkerMessage.PauseAnimate]: onPauseAnimate,
  [WorkerMessage.StopAnimate]: onStopAnimate,
  [WorkerMessage.AnimRendered]: onAnimRendered,
  [WorkerMessage.Destory]: onDestory,
  [WorkerMessage.PerfProbe]: onPerfProbe,
};

self.onmessage = (e: MessageEvent) => {
  if (probe.on) {
    // 按 action 分别统计每类消息的处理耗时与条数，无需逐个 handler 埋点
    const t = probe.now();
    workerFns[e.data.action](e);
    probe.time('handle:' + e.data.action, t);
    probe.count('recv:' + e.data.action);
    return;
  }
  workerFns[e.data.action](e);
};

function registerDefault() {
  for (const item of penDefines) {
    if (item.edgeFn) {
      edgeFns[item.type] = item.edgeFn;
    }
    if (OUTLINE_TYPES.has(item.type)) {
      outlineDraws[item.type] = item.draw;
    }
  }
}
registerDefault();

function onInit(e: MessageEvent) {
  canvasWidth = e.data.canvasWidth;
  canvasHeight = e.data.canvasHeight;
  syncViewWorld();
  probe.hookPostMessage();
  probe.setGridReporter(() => reportGrid(getPickGridInternals(), penMap));
  initPickGrid();
}

function onPerfProbe(e: MessageEvent) {
  // 探针消息在队列里排了多久 = 这个 worker 当前积压了多少（Date.now 跨线程可比）
  e.data.sentAt && probe.sample('probe:lag', Date.now() - e.data.sentAt);
  probe.rawPost({
    action: WorkerMessage.PerfReport,
    reportId: e.data.reportId,
    report: probe.collect('calc', e.data.reset !== false),
  });
}

function onResize(e: MessageEvent) {
  canvasWidth = e.data.canvasWidth;
  canvasHeight = e.data.canvasHeight;
  syncViewWorld();
  const penIds = calcInViewPens();
  self.postMessage({
    action: WorkerMessage.UpdateView,
    penIds,
    imagePenIds: inViewImageIds,
    resizeId: e.data.resizeId,
    width: e.data.width,
    height: e.data.height,
  });
}

function onOption(e: MessageEvent) {
  Object.assign(options, e.data.options);
  probe.setEnabled(options.perfProbe);

  const optionData = e.data.data;
  if (optionData && (optionData.x != undefined || optionData.y != undefined || optionData.scale != undefined)) {
    // Option 可能只携带 lineIntersect 等局部页面配置，未传的视口字段必须保留。
    // 否则开启跨线会把 Calc Worker 的视口重置为 0/0/1，平移后就会漏掉大量图元。
    optionData.x != undefined && (x = optionData.x);
    optionData.y != undefined && (y = optionData.y);
    if (optionData.scale != undefined) {
      scale = optionData.scale;
      view.scale = scale;
    }
    syncViewWorld();
  }
}

async function onRegisterPen(e: MessageEvent) {
  // 注册图元
  const { penDefines } = await import(/* @vite-ignore */ e.data.path);
  for (const item of penDefines) {
    if (item.edgeFn) {
      edgeFns[item.type] = item.edgeFn;
    }
  }
}

function makePen(pen: Pen) {
  // image：calcInViewPens 靠它挑出视口内带图片的图元发给主线程（inViewImageIds）。
  // patchClone 不带这个字段 ⇒ 第六十一轮漏了它，初始加载时一个都挑不出来、图片不加载（用户：拖一下才显示）。
  // parentId / showChild：pick 靠它们找选中目标（resolveSelectTarget）、判父级隐藏与锁定
  let props: any = { children: pen.children, image: pen.image, parentId: pen.parentId, showChild: pen.showChild };
  // 判断图元在某点是否真的画了东西（Alt 选最上层可见图元，见 paintedAt）
  for (const key of PAINT_KEYS) {
    props[key] = pen[key];
  }
  // 不看 mode：运行态打开再切到编辑态不会重发数据，这里不算的话容器就一直缺着（拖入与选中都依赖它）
  if (pen.container && pen.visible !== false) {
    props.container = {
      x: pen.x + pen.width * pen.container.x,
      y: pen.y + pen.height * pen.container.y,
    };
    props.container.ex = props.container.x + pen.width * pen.container.width;
    props.container.ey = props.container.y + pen.height * pen.container.height;
  }

  // 收到的 pen 是这条消息结构化克隆出来的、calc 独占的副本 ⇒ anchors / connectedLines 直接拿来用，
  // 不必让 patchClone 再深拷贝一遍（100 万图元时 cloneAnchors ~0.6s）。
  // 用完要放回去：onPatch 的 add 会原样回传给主线程，主线程拿它当自己的图元
  const anchors = pen.anchors;
  const connectedLines = pen.connectedLines;
  anchors && (pen.anchors = undefined);
  connectedLines && (pen.connectedLines = undefined);
  props = patchClone(pen, props);
  if (anchors) {
    pen.anchors = anchors;
    props.anchors = anchors;
  }
  if (connectedLines) {
    pen.connectedLines = connectedLines;
    props.connectedLines = connectedLines;
  }
  penMap.set(pen.id, props);

  return props;
}

function onData(e: MessageEvent) {
  penMap.clear();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let offsetX = 0;
  let offsetY = 0;

  clearAnimate();
  paint.penFill = !!(e.data.data.penBackground || e.data.data.penGradient);
  // 分批打开：这里只有首批（视口里的），网格按主线程量好的全部范围、全部图元数建
  const prog = e.data.progressive;

  if (e.data.data.pens) {
    // 主线程没发的默认锚点（见 elideDefaultAnchors）
    fillDefaultAnchors(e.data.data.pens, e.data.defaultAnchors);
    for (const pen of e.data.data.pens) {
      // 设了画布大小也要量：图元常常越出画布区域，网格只覆盖画布的话它们全进溢出桶（见下）
      if (pen.x < minX) {
        minX = pen.x;
      }
      if (pen.y < minY) {
        minY = pen.y;
      }
      if (pen.ex > maxX) {
        maxX = pen.ex;
      }
      if (pen.ey > maxY) {
        maxY = pen.ey;
      }

      makePen(pen);
    }
  }

  if (prog?.bounds) {
    ({ minX, minY, maxX, maxY } = prog.bounds);
  }

  x = e.data.data.x || 0;
  y = e.data.data.y || 0;
  scale = e.data.data.scale || 1;
  view.scale = scale;
  canvasWidth = e.data.canvasWidth;
  canvasHeight = e.data.canvasHeight;
  syncViewWorld();

  let gridWidth = e.data.data.width;
  let gridHeight = e.data.data.height;
  if (gridWidth == undefined && maxX > 0) {
    gridWidth = maxX - minX;
    gridHeight = maxY - minY;
    offsetX = minX;
    offsetY = minY;
  } else if (gridWidth != undefined && maxX > -Infinity) {
    // 设了画布大小：网格取「画布区域 ∪ 图元实际范围」。只按画布区域分格时，画布外的图元全部落进
    // 溢出桶，而任何碰到网格边的查询都要线性扫一遍溢出桶 —— 示例1/2 有一半以上图元在画布外，
    // 每个动画图元每帧查脏区都要扫几百个。
    offsetX = Math.min(0, minX);
    offsetY = Math.min(0, minY);
    gridWidth = Math.max(gridWidth, maxX) - offsetX;
    gridHeight = Math.max(gridHeight, maxY) - offsetY;
  }
  initPickGrid(gridWidth, gridHeight, offsetX, offsetY, prog?.total);

  const penIds = calcInViewPens();
  self.postMessage({
    action: WorkerMessage.UpdateView,
    penIds,
    imagePenIds: inViewImageIds,
    // 分批打开：主线程收到这条（首屏视口）才开始补后批（见 Meta2d.startProgressiveLoad）
    loadSeq: prog?.loadSeq,
  });
}

/**
 * 分批打开的后批（见主线程 Meta2d.planProgressiveLoad）：登记图元、进网格。
 * 首批覆盖了打开时的视口，后批原则上都在视口外；但补的过程中用户可能已经平移 / 缩放到它们那里，
 * 这批里有落在当前视口里的就重算一次视口（render 那边这批已经到了，见主线程发送顺序）。
 */
function onDataChunk(e: MessageEvent) {
  fillDefaultAnchors(e.data.pens, e.data.defaultAnchors);
  const pens: Pen[] = [];
  for (const pen of e.data.pens) {
    pens.push(makePen(pen));
  }
  addPens(pens);

  const viewLeft = -x / scale;
  const viewTop = -y / scale;
  const viewRight = (-x + canvasWidth) / scale;
  const viewBottom = (-y + canvasHeight) / scale;
  // 与 calcInViewPens 同一个判定
  const touchesView = pens.some(
    (pen) => !isTinyPen(pen) && pen.ex > viewLeft && pen.x < viewRight && pen.ey > viewTop && pen.y < viewBottom,
  );
  if (touchesView) {
    self.postMessage({
      action: WorkerMessage.UpdateView,
      penIds: calcInViewPens(),
      imagePenIds: inViewImageIds,
      // 视口没动、内容多了 ⇒ render 必须整屏重画。不带它的话 render 的平移快路径判「位移为零」一笔不画
      // （见 render tryPanBlit 的 view:skip），补进来的图元要等下一次平移才出现
      repaint: true,
    });
  }
  self.postMessage({ action: WorkerMessage.DataChunkDone, from: 'calc', loadSeq: e.data.loadSeq });
}

function onTranslateScale(e: MessageEvent) {
  if (e.data.x != undefined) {
    x = e.data.x;
    y = e.data.y;
  }
  if (e.data.scale != undefined) {
    scale = e.data.scale;
    view.scale = scale;
    // 旋转控制点离角的距离按屏幕像素算，缩放变了要跟着挪
    updateBoundingCPs();
  }
  syncViewWorld();
  const penIds = calcInViewPens();
  self.postMessage({
    action: WorkerMessage.UpdateView,
    penIds,
    imagePenIds: inViewImageIds,
    // 第 4.6 步（只量不改行为）：盖一个跨线程可比的时间戳，
    // 让 render 侧能把「一圈往返」里 calc→主线程的那一截单独量出来（结论 29）。
    sentAt: probe.on ? Date.now() : undefined,
  });
}

function onPick(e: MessageEvent) {
  options.performance && console.time('pick');

  const _tPick = probe.now();
  const { pen, anchor, linePoint, cp, rotatePoint, sizePoint, sizeDirection, top } =
    pick(e.data.x, e.data.y) || {};
  probe.time('pick', _tPick);
  // 最上层命中（Alt 直接选中用）。选中目标没变、只是在同一编组的子图元间移动时，单独补一条轻量消息
  const topId = top?.id;
  if (topId !== _topId) {
    _topId = topId;
    if (pen ? pen.id === hoverId && !anchor && pen.category !== PenCategory.Line : !hoverId) {
      self.postMessage({ action: WorkerMessage.Pick, topOnly: true, topId });
    }
  }
  if (pen) {
    if (pen.id === hoverId) {
      if (anchor) {
        // 移入新锚点
        if (
          !_anchor ||
          anchor.id !== _anchor.id ||
          anchor.x !== _anchor.x ||
          anchor.y !== _anchor.y ||
          cp !== _cp
        ) {
          _anchor = anchor;
          _cp = cp;
          self.postMessage({ hover: pen, action: WorkerMessage.PickAnchor, anchor, linePoint, cp, topId });
        }
      } else if (pen.category === PenCategory.Line) {
        _anchor = undefined;
        _cp = undefined;
        self.postMessage({
          action: WorkerMessage.Pick,
          hover: pen,
          linePoint,
          topId,
        });
      } else if (_anchor) {
        _anchor = undefined;
        _cp = undefined;
        self.postMessage({ action: WorkerMessage.PickAnchor });
      }
    } else {
      hoverId = pen.id;
      // 计算图元覆盖了多少个其他图元，需要一起重绘
      const { penIds, boundary } = getPensInPenBoundary(pen);
      if (anchor) {
        // 移入新锚点
        if (!_anchor || anchor.x !== _anchor.x || anchor.y !== _anchor.y) {
          _anchor = anchor;
          self.postMessage({
            action: WorkerMessage.PickAnchor,
            hover: pen,
            boundary,
            penIds,
            anchor,
            linePoint,
            cp,
            topId,
          });
        }
      } else {
        self.postMessage({
          action: WorkerMessage.Pick,
          hover: pen,
          boundary,
          penIds,
          linePoint,
          topId,
        });
      }
    }
  } else if (hoverId) {
    hoverId = undefined;
    _anchor = undefined;
    self.postMessage({ action: WorkerMessage.Pick, topId });
  }

  if (sizePoint) {
    if (!_sizePoint || sizePoint.x !== _sizePoint.x || sizePoint.y !== _sizePoint.y) {
      _sizePoint = sizePoint;
      self.postMessage({
        action: WorkerMessage.PickSize,
        sizePoint,
        sizeDirection,
      });
    }
  } else if (_sizePoint) {
    _sizePoint = undefined;
    self.postMessage({
      action: WorkerMessage.PickSize,
    });
  } else {
    if (rotatePoint) {
      if (!_rotatePoint || rotatePoint.x !== _rotatePoint.x || rotatePoint.y !== _rotatePoint.y) {
        _rotatePoint = rotatePoint;
        self.postMessage({
          action: WorkerMessage.PickRotate,
          rotatePoint,
        });
      }
    } else if (_rotatePoint) {
      _rotatePoint = undefined;
      self.postMessage({
        action: WorkerMessage.PickRotate,
      });
    }
  }

  options.performance && console.timeEnd('pick');
}

function onPickLinePosition(e: MessageEvent) {
  const line = penMap.get(e.data.id);
  if (!line || !line.anchors || line.anchors.length < 2) {
    self.postMessage({
      action: WorkerMessage.PickLinePosition,
    });
    return;
  }

  // 只有鼠标悬停在这条线上时才会发来（双击连线），不再按距离过滤：缩放很小时拾取容差本来就大于 5 个世界单位
  const point = getClosestPoint(e.data.x, e.data.y, line, undefined, Infinity);
  self.postMessage({ action: WorkerMessage.PickLinePosition, id: e.data.id, point });
}

function onDragOver(e: MessageEvent) {
  if (e.data.x == undefined) {
    dockPen = undefined;
    return;
  }

  // 是否经过其他图元
  let pen = overDock(e.data.x, e.data.y);
  if (pen !== dockPen) {
    // 不能拖拽到自己里面
    if (pen && e.data.pens) {
      const i = e.data.pens.findIndex((p) => p.id === pen.id);
      if (i > -1) {
        pen = undefined;
      }
    }

    dockPen = pen;
    self.postMessage({
      action: WorkerMessage.DragOver,
      pen,
      x: e.data.x,
      y: e.data.y,
    });
  }
}

function onPatch(e: MessageEvent) {
  // 分批打开时，还没补到这里的图元（视口外）被 setValue 了：主线程已经改在图元上，它那一批到的时候带的就是新值。
  // 这里不认得它 —— 差量条目没有几何，算脏区只会得到 NaN ⇒ 直接跳过，不参与这一批
  if (e.data.update?.length) {
    const known = (p: Pen) => penMap.has(p.id) || (p.oldId && penMap.has(p.oldId));
    if (!e.data.update.every(known)) {
      e.data.update = e.data.update.filter(known);
      e.data.beforeUpdate = e.data.beforeUpdate?.filter(known);
    }
  }
  const newPens: Pen[] = [];
  const oldPens: Pen[] = [];
  // 只有增删、拖动几何或调整层级才会改变 GIF 的覆盖关系。
  // 普通颜色、文本、事件等属性更新无需重新计算 GIF 覆盖图元列表。
  const coverageChanged =
    Boolean(e.data.add?.length || e.data.remove?.length) ||
    (e.data.beforeUpdate || []).some((pen: Pen) => pen.patchFlag & (PatchFlag.Rect | PatchFlag.Index)) ||
    (e.data.update || []).some((pen: Pen) => pen.patchFlag & (PatchFlag.Rect | PatchFlag.Index));
  // GIF 换帧时需要按当前层级重绘其覆盖区域内的全部图元。
  // 图元在 GIF 加载完成后新增、删除或移动时，原有缓存不会自动更新，
  // 下一帧清屏就可能把后来覆盖在 GIF 上面的图元一起擦掉。
  const gifBoundaryIds = new Set<string>();
  const collectGifBoundaryIds = (penIds?: string[]) => {
    penIds?.forEach((id) => {
      if (penMap.get(id)?.type === 'gif') {
        gifBoundaryIds.add(id);
      }
    });
  };
  if (e.data.add) {
    for (const pen of e.data.add) {
      add(makePen(pen));
    }
    newPens.push(...e.data.add);
  }
  if (e.data.update) {
    newPens.push(...e.data.update);
  }
  if (e.data.remove) {
    for (const pen of e.data.remove) {
      penMap.delete(pen.id);
      removeAnimate(pen.id);
    }
    oldPens.push(...e.data.remove);
  }
  if (e.data.beforeUpdate) {
    for (const item of e.data.beforeUpdate) {
      if (item.flipX != undefined || item.flipY != undefined) {
        item.textBox = getFlipRect(textBoxs[item.id], item.flipX, item.flipY);
      }
      oldPens.push(item);
    }
  }

  let newPenIds: string[];
  let newBoundary: Rect;
  let oldPensIds: string[];
  let oldBoundary: Rect;

  /**
   * 新旧脏区能不能共用一次计算。
   *
   * `getPensInPenBoundary` 对一批图元求**并集**包围盒 —— 2000 个文本散布全场景时
   * 并集就是整个世界，于是退化成扫遍所有格子（实测 23698 次 rectInRect），再
   * 对结果排序、去重。onPatch 对 oldPens 和 newPens 各调一次，等于扫两遍。
   *
   * 没有增删、也没有图元置 Rect / Index 时，beforeUpdate 与 update 是同一批图元的
   * 同一套几何、同一套层级，两次的结果逐位相同 ⇒ 算一次就够。
   *
   * Index 也要排除：penIds 是按 index 排序后输出的，render worker 按这个顺序
   * 重绘，层级变了顺序就不一样，不能复用。
   *
   * （把并集换成按图元分组的脏区合并是 M2/DirtyRegion 的事，不在这里做。）
   */
  // beforeUpdate 来自主线程，主线程不应用动画 ⇒ 它是**基准位置**；而 render 此刻把这个图元画在
  // **跳动中的位置**。只按 beforeUpdate 擦，跳动位置上的旧图就留下来（截图 5-2：一层层窄条）。
  // ⇒ 动画中的图元，旧区再并上 calc penMap 里它当前的动画几何（上一帧 Object.assign(reg, p) 写入的，
  //   也就是 render 画它的地方）。不带几何的 Patch 同样要：render 收到后会把它挪回基准位置。
  const animOld: Pen[] = [];
  for (const p of oldPens) {
    if (!isAnimating(p.id)) {
      continue;
    }
    const reg = penMap.get(p.id);
    reg &&
      animOld.push({
        id: reg.id,
        x: reg.x,
        y: reg.y,
        width: reg.width,
        height: reg.height,
        ex: reg.ex,
        ey: reg.ey,
        rotate: reg.rotate,
        pivot: reg.pivot,
        lineWidth: reg.lineWidth,
      } as Pen);
  }

  const keepsRegion = (pen: Pen) => !(pen.patchFlag & (PatchFlag.Rect | PatchFlag.Index));
  const reuseOldRegion =
    !e.data.add?.length &&
    !e.data.remove?.length &&
    !animOld.length && // 旧区多了动画几何 ⇒ 新旧不再相同，不能共用
    oldPens.length > 0 &&
    oldPens.every(keepsRegion) &&
    (!e.data.update || e.data.update.every(keepsRegion));

  if (probe.on) {
    // M10 的验收要能区分「数字变小了」和「机制生效了」：
    // rectPens/indexPens 是本批里真正改了几何/层级的图元数 —— 改 patchFlag 来源之前
    // 它恒等于 pens（Rect|Index 恒为真），之后纯属性更新应该是 0。
    probe.count('patch:calls');
    probe.sample('patch:pens', oldPens.length + newPens.length);
    let rectPens = 0;
    let indexPens = 0;
    for (const p of oldPens) {
      if (p.patchFlag & PatchFlag.Rect) {
        rectPens++;
      }
      if (p.patchFlag & PatchFlag.Index) {
        indexPens++;
      }
    }
    probe.sample('patch:rectPens', rectPens);
    probe.sample('patch:indexPens', indexPens);
    reuseOldRegion && probe.count('patch:reuseRegion');
  }

  // 第 3 步：脏区差不多铺满视口（8000 个数据点全改）时，不再扫格子求「碰到脏区的图元」——
  // 那个清单 ≈ 视口里的全部图元，求它要扫一遍网格 + 文字索引，再把上万个 id 经主线程转给 render 两次。
  // 改为只发一个 full 标记，render 用它手里的视口图元（inViewPenIds）整屏重画。
  // 只看图元多的批次：图元少时分块 / 并集框本来就便宜，没必要拿整屏去换。
  let fullView = false;
  if (
    options.patchFullView !== false &&
    !e.data.add?.length &&
    !e.data.remove?.length &&
    oldPens.length >= FullViewMinPens &&
    !newPens.some((p) => p.id === hoverId && p.patchFlag & PatchFlag.Rect) &&
    coversView(oldPens, newPens)
  ) {
    fullView = true;
    probe.count('patch:fullView');
  }

  // 第 1 步：分块脏区。只改已有图元（没有增删）时先按图元逐个算块；块的总面积明显小于它们的并集框
  // （散落的数据点），就不再用并集框，改为「每块各自收集图元、render 用多块裁剪一次画完」（见 getPensInRects）。
  // 旧块必须在下面应用更新之前算：getCompletePens 要拿 penMap 里的旧几何补齐差量条目。
  let rects: Rect[];
  if (
    !fullView &&
    options.patchRegions !== false &&
    !e.data.add?.length &&
    !e.data.remove?.length &&
    oldPens.length &&
    oldPens.length <= MaxRegionPens
  ) {
    const _tR = probe.now();
    const oldRects = getPenRects(animOld.length ? oldPens.concat(animOld) : oldPens);
    if (regionsPayOff(oldRects)) {
      rects = oldRects;
    }
    probe.time('patch:regions', _tR);
  }

  if (oldPens.length && !rects && !fullView) {
    const _tB = probe.now();
    const { penIds, boundary } = getPensInPenBoundary(animOld.length ? oldPens.concat(animOld) : oldPens);
    probe.time('getPensInPenBoundary', _tB);
    probe.count('boundaryScan');
    coverageChanged && collectGifBoundaryIds(penIds);
    oldPensIds = penIds;
    oldBoundary = boundary;
  }

  e.data.remove?.forEach((pen: Pen) => {
    if (pen.id === hoverId) {
      hoverId = undefined;
    }
    if (pen.id === _topId) {
      _topId = undefined;
    }
    remove(pen);
  });

  // ⚠ 这里原来是一个被反复覆盖的 `let oldCells`：beforeUpdate 里每个带 Rect 的
  // 图元都往同一个变量上写，循环结束后只剩**最后一个**图元的旧格子；下面
  // update 循环却拿它去给**每一个**图元调 updatePenCell。后果是最后那个图元的
  // 旧桶被 splice 多次（删掉别的 pen），其余图元的旧桶一个都没清 —— 多选拖拽
  // 时就会触发。改成按 id 存。
  const oldCellsMap: Map<string, any[]> = new Map();
  let cellSet: Set<Pen[]> = new Set();
  e.data.beforeUpdate?.forEach((pen: Pen) => {
    if (pen.patchFlag & PatchFlag.Rect) {
      oldCellsMap.set(pen.id, getCells(pen));
    }
  });

  // M10 验收实测 handle:Patch = 17.0ms，其中 getPensInPenBoundary 只占 4.9ms ⇒
  // 剩下 12ms 在别处。拆成 apply / post 两段来定位，否则只能猜。
  const _tApply = probe.now();
  const partialPatch = e.data.partial === true;

  // 第 5.28 步：正在播放动画的图元被用户改了几何 ⇒ 动画以新位置 / 新尺寸为基准继续（见 rebaseAnimate）
  const beforeById = new Map<string, Pen>();
  e.data.beforeUpdate?.forEach((pen: Pen) => beforeById.set(pen.id, pen));

  e.data.update?.forEach((pen: Pen) => {
    if (pen.patchFlag & PatchFlag.Rect) {
      rebaseAnimate(beforeById.get(pen.id), pen);
    }
    // newCells 也必须每个图元重置：原来它在循环外声明，上一个图元留下的值会被
    // 下面 `if (!newCells)` 当成本图元的格子用。
    let newCells: any[];
    const _pen = penMap.get(pen.id);
    if (!_pen) {
      return;
    }
    // setValue 队列的差量条目（主线程 valsToPens 的 partial）：不动几何的只带改动的键 ⇒ 只合并 calc 存着的那些。
    // 下面整套 patchClone 会把缺的几何写成 undefined、把图元抹掉。动几何的条目带着整套几何，照原路走。
    if (partialPatch && !(pen.patchFlag & PatchFlag.Rect)) {
      for (const key in pen) {
        if (PARTIAL_KEYS.has(key)) {
          _pen[key] = pen[key];
        }
      }
      if ('animations' in pen || 'currentAnimation' in pen) {
        updateAnimate(_pen);
      }
      if (pen.patchFlag & PatchFlag.Index) {
        for (const item of getCells(_pen)) {
          cellSet.add(item.cell);
        }
      }
      return;
    }
    if (pen.x || pen.y || pen.width || pen.height) {
      pen.ex = pen.x + pen.width;
      pen.ey = pen.y + pen.height;
    }
    // 仅保存必须属性
    const p = patchClone(pen);
    if (pen.children) {
      p.children = pen.children;
    }
    // 换图 / 去图也要跟上（见 makePen 的 image）；没带这个字段的更新不动它
    if ('image' in pen) {
      p.image = pen.image;
    }
    // 父子关系变化（编组 / 解组 / 拖入拖出容器）与 showChild 切换都要跟上，pick 依赖它们
    if ('parentId' in pen) {
      p.parentId = pen.parentId;
    }
    if ('showChild' in pen) {
      p.showChild = pen.showChild;
    }
    for (const key of PAINT_KEYS) {
      if (key in pen) {
        p[key] = pen[key];
      }
    }
    Object.assign(_pen, p);
    // patchClone 只保留几何和绘制字段，动画配置需要单独同步到 calc Worker。
    if ('animations' in pen) {
      _pen.animations = pen.animations;
    }
    if ('currentAnimation' in pen) {
      _pen.currentAnimation = pen.currentAnimation;
    }
    if ('animations' in pen || 'currentAnimation' in pen) {
      updateAnimate(_pen);
    }
    if ('lineSmooth' in pen || pen.anchors) {
      if (_pen.calculative) {
        // 拾取过程会缓存连线路径。锚点变化后若不失效，旧路径仍会被命中并重新发送给 Hover Worker。
        delete _pen.calculative.lineSegments;
        delete _pen.calculative.gradientSegments;
      }
      if (hoverId === _pen.id) {
        // 主线程已经丢弃旧 hover；Calc 也必须按下一次命中重新计算边界并发送完整 Pick。
        hoverId = undefined;
        _anchor = undefined;
        _cp = undefined;
      }
    }
    if (pen.textBox) {
      textBoxs[pen.id] = pen.textBox;
      textBoxs[pen.id].index = pen.index;
      markTextBoxsDirty();
    }

    if (pen.patchFlag & PatchFlag.Rect) {
      if (pen.container && pen.visible !== false) {
        const container: Rect = {
          x: _pen.x + _pen.width * pen.container.x,
          y: _pen.y + _pen.height * pen.container.y,
        };
        container.ex = container.x + _pen.width * pen.container.width;
        container.ey = container.y + _pen.height * pen.container.height;
        _pen.container = container;
      }
      // beforeUpdate 与 update 是成对生成的（见 valsToPens），正常路径一定取得到。
      // `|| []` 是兜底：传 undefined 会让 updatePenCell 抛错打挂 worker；
      // 它的插入不依赖旧格子，传空数组也会正确登记到新格子。
      newCells = updatePenCell(_pen, oldCellsMap.get(pen.id) || []);
    }

    // 统计更改了层级的cell，后面统一排序
    if (pen.patchFlag & PatchFlag.Index) {
      if (!newCells) {
        newCells = getCells(_pen);
      }
      for (const item of newCells) {
        cellSet.add(item.cell);
      }
    }
  });

  probe.time('patch:apply', _tApply);

  if (cellSet.size) {
    // 是否需要采用生产者消费者模式
    // 目前初步认为修改层级操作不常见，不过度设计
    sortCells(cellSet);
  }

  if (fullView) {
    // 整屏重画不需要脏区，也不需要图元清单（render 用自己的 inViewPenIds）
  } else if (rects) {
    // 新块：动了几何的图元新位置也要画；不动几何的新块与旧块逐位相同，不再重复
    const _tR = probe.now();
    if (!reuseOldRegion) {
      rects = rects.concat(getPenRects(newPens));
    }
    newPenIds = getPensInRects(rects);
    newBoundary = unionRect(rects);
    probe.time('patch:regions', _tR);
    probe.count('patch:regionsUsed');
    probe.sample('patch:regionRects', rects.length);
  } else if (newPens.length) {
    if (reuseOldRegion) {
      // 纯属性更新：新旧脏区逐位相同，省掉第二次全量扫描。
      newPenIds = oldPensIds;
      newBoundary = oldBoundary;
    } else {
      const _tB = probe.now();
      const { penIds, boundary } = getPensInPenBoundary(newPens);
      probe.time('getPensInPenBoundary', _tB);
      probe.count('boundaryScan');
      coverageChanged && collectGifBoundaryIds(penIds);
      newPenIds = penIds;
      newBoundary = boundary;
    }
  }

  // 重新计算受本次补丁影响的 GIF 覆盖区域。这里使用补丁完成后的网格，
  // 因此新增到 GIF 上方的图元也会被纳入下一帧的重绘列表。
  if (coverageChanged && gifBoundaryIds.size) {
    const boundarys: Record<string, { penIds: string[]; boundary: Rect }> = {};
    for (const id of gifBoundaryIds) {
      const gif = penMap.get(id);
      if (!gif) {
        continue;
      }
      const result = getPensInPenBoundary(gif);
      boundarys[id] = { penIds: result.penIds, boundary: result.boundary };
    }
    if (Object.keys(boundarys).length) {
      // 与 Patch 保持同一 worker 消息顺序，render worker 会先更新 GIF 缓存，
      // 再应用图元补丁，避免中间帧继续使用旧的覆盖列表。
      self.postMessage({ action: WorkerMessage.CalcPenBoundary, boundarys });
    }
  }

  // Phase 1.0a：新旧脏区完全相同时，别让 render 画两遍。
  //
  // render 的 onPatch 是「先按 oldBoundary 重绘一遍，再按 newBoundary 重绘一遍」，
  // 但它的 `update.forEach(Object.assign(pen, item))` **跑在这两遍之前** ⇒ 第一遍画的
  // 已经是新数据。reuseOldRegion 命中时两遍的图元集合与包围盒逐位相同，第一遍的输出
  // 被第二遍逐像素覆盖，纯属白画。
  //
  // 为什么在 calc 这边关掉而不是在 render 那边判：render 只能靠数组引用相等去猜，
  // 而「新旧是否等价」是 calc 算出来的事实，让知道答案的一方说话。
  const skipOldPass = reuseOldRegion && newPenIds !== undefined;
  if (skipOldPass) {
    probe.count('patch:skipOldPass');
  }

  // 结构化克隆的成本算在发送方。这条消息带着 newPenIds（脏区内的全部图元 id，
  // 2000 文本散布全场景时 ≈ 全部 2 万个）和 add/remove/update/beforeUpdate 四个
  // 图元数组 ⇒ 序列化本身可能就是 onPatch 的大头。M3（协议 v2）的依据在这个数上。
  const _tPost = probe.now();
  self.postMessage({
    action: WorkerMessage.Patch,
    newPenIds,
    oldPensIds: skipOldPass ? undefined : oldPensIds,
    // 分块脏区时 newBoundary 只是各块的外接框（悬停跟随等仍要一个框），render 按 rects 逐块裁剪
    newBoundary,
    oldBoundary: skipOldPass ? undefined : oldBoundary,
    rects,
    // 第 3 步：render 整屏重画（此时 newPenIds / boundary 都不带）。
    // 动了几何的图元另外带上：render 的 inViewPenIds 是上一条视口算的，从视口外挪进来的图元不在里面
    full: fullView || undefined,
    fullMoved: fullView ? newPens.filter((p) => p.patchFlag & PatchFlag.Rect).map((p) => p.id) : undefined,
    // 改了的图元全部 id：render 只画视口里的，没画到的要补量文字框（见 render 的 repaintFullView）
    fullChanged: fullView ? newPens.map((p) => p.id) : undefined,
    add: e.data.add,
    remove: e.data.remove,
    // setValue 队列的批次：主线程自己留着 update（见 Meta2d.patch 的 queued），不必再传一遍回去
    update: e.data.queued ? undefined : e.data.update,
    queued: e.data.queued,
    // 第六十九轮：主线程对 beforeUpdate 只用 index，而且带序号的 Patch 主线程自己留了一份（Meta2d.patchBeforeIndex）⇒ 不回传
    beforeUpdate: e.data.seq != undefined ? undefined : e.data.beforeUpdate,
    // 主线程据此丢掉过期的回声（见 Meta2d.patch）
    seq: e.data.seq,
  });
  probe.time('patch:post', _tPost);
  probe.sample('patch:penIds', newPenIds ? newPenIds.length : 0);
}

function onImageFetched(e: MessageEvent) {
  let { penIds, boundary } = getPensInPenBoundary(e.data.pens);
  self.postMessage({
    action: WorkerMessage.Patch,
    newPenIds: penIds,
    newBoundary: boundary,
  });
}

function onTextOutside(e: MessageEvent) {
  for (const id in e.data.textBoxs) {
    let pen: Pen;
    if (e.data.textBoxs[id].x) {
      pen = penMap.get(id);
      textBoxs[id] = e.data.textBoxs[id];
      textBoxs[id].index = pen.index;
    } else {
      delete textBoxs[id];
    }
    markTextBoxsDirty();

    if (!e.data.textBoxs[id]._rect) {
      continue;
    }

    if (!pen) {
      pen = penMap.get(id);
    }

    Object.assign(pen, e.data.textBoxs[id]._rect);
    update(pen);
  }
}

/**
 * 最近一次 calcInViewPens 里带图片的那部分 id，随 UpdateView 一起发（`imagePenIds`）。
 * 主线程 loadImages 只关心带图片的那几百个，逐个查 1.37 万个刚反序列化出来的 id 要 ~3ms/条（第一次哈希字符串）
 * ⇒ 让已经在逐个看图元的 calc 顺手挑出来（设计文档 9.9aw ~ 9.9ba）。
 */
let inViewImageIds: string[] = [];

function calcInViewPens() {
  const _tView = probe.now();
  const penList = [];

  const viewLeft = -x / scale;
  const viewTop = -y / scale;
  const viewRight = (-x + canvasWidth) / scale;
  const viewBottom = (-y + canvasHeight) / scale;
  // 与 render 的 `audit:cw1k` / `ch1k` 相减 ⇒ 两条路的视口差多少（CSS 像素 × 1000）。
  // M7a 的窄带选取在 render 里逐字复刻了下面这个判定，而 render 手上只有画布的**设备**
  // 像素数（除以 dpr 反推 CSS 宽高），calc 拿的是 `renderCanvas.clientWidth/Height`
  // —— 两者对不上的话，窄带就会漏选本该画的图元（只有连线箭头这类墨迹伸出很多的看得见）。
  // ⚠ 报的是 `canvasWidth/Height` 而不是 `viewRight/Bottom`：后者每条视口都在移动
  // （每步 −96），两边采到的视口条数又不一样（calc 每条都采、render 只在审计条上采），
  // 两个均值相减会被视口自己的移动盖掉；而 `viewRight − fx1 = (canvasWidth − width/dpr)/scale`
  // 与视口位置**无关**，所以直接对账这个常数。
  probe.sample('calc:cw1k', Math.round(canvasWidth * 1000));
  probe.sample('calc:ch1k', Math.round(canvasHeight * 1000));

  for (const [, pen] of penMap) {
    if (pen.ex == undefined) {
      pen.ex = pen.x + pen.width;
      pen.ey = pen.y + pen.height;
    }

    if (isTinyPen(pen)) {
      continue;
    }

    if (pen.ex > viewLeft && pen.x < viewRight && pen.ey > viewTop && pen.y < viewBottom) {
      penList.push(pen);
    }
  }

  penList.sort((a, b) => {
    return a.index - b.index;
  });
  const penIds = [];
  // 第六十一轮：顺手挑出带图片的（主线程 loadImages 只关心这些，见 inViewImageIds）
  const imageIds = [];
  for (const pen of penList) {
    penIds.push(pen.id);
    pen.image && imageIds.push(pen.id);
  }
  inViewImageIds = imageIds;

  probe.time('calcInViewPens', _tView);
  probe.sample('inViewCount', penIds.length);
  return penIds;
}

function onDestory(e: MessageEvent) {
  self.close();
}
