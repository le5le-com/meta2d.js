import { CollaboratePointer, Mode, Options, WorkerMessage } from '../../types';
import { penDefines } from '../../diagrams';
import { renderLineGradientPath } from '../../diagrams/line/gradient';
import {
  Rect,
  Point,
  Pen,
  flipRender,
  rotateRender,
  expandRect,
  translateRect,
  getMirrorPoint,
  getDirection,
  PenCategory,
  getLineSegmentsLength,
  simplifyOrthogonalPoints,
  getCurveSegmentPoints,
  getRectOfPoints,
  dragOrthogonalPoint,
  HandleType,
  getOrthogonalPoint,
  getBoundingCPs,
  getFont,
  createGradient,
  calcIconRect,
  calcImageRect,
  createTextGradient,
  TextDecoration,
  calcTextLines,
  calcTextRect,
  ControlPointType,
  setBackground,
  setBackgrounds,
  simplify,
  smoothLine,
  getSegmentPointByPosition,
  updateMindControlPoints,
  updateConnectedLines,
  updateLineTextPosition,
} from '../../models';
import { deepClone, pSBC, rgba, s8 } from '../../utils';
import { loadIconfonts } from '../utility/iconfont';
import { loadFontFaceCss } from '../utility/fonts';
import { DragAnchorType } from './const';
import { probe } from '../../perf/probe';

let options: Options = {};

let dpr = 1;
let ctx: CanvasRenderingContext2D;
let width: number = 0;
let height: number = 0;
let data: any = { x: 0, y: 0, scale: 1 };
let pathBBoxs = {}; // {pathId: Rect}

let dockRect: Rect;

let hover: Pen;
let hoverBoundary: Rect;
let hoverAnchor: Point;
let hoverCp: number;
let editingAnchor: Point;

let activePens: Pen[];
let activeBoundary: Rect;
let sizeCPs: Point[];

let selectRect: Rect;

let draggingPens: Pen[];
let drawingLine: Pen;
/**
 * 画线过程中用户**点过**的点（起点 + 每次落下的拐点），与 drawingLine.anchors 分开记：
 * 正交线会在两次点击之间自动补拐点，切换线型时要按这份原始点重算，切回去才能还原（见 onSwitchDrawingLineType）。
 * 只在从空白处新画一条线时维护；拖端点重连（dragAnchorType）时不记，也不允许切换。
 */
let drawingClicks: Point[] | undefined;
let connectedLines: Pen[];
let lineTexts: Pen[];
let dragLine: Pen;
let dragAnchorType: DragAnchorType; // 是否拖拽连线锚点。1 - 起点， 2 - 终点
let dragAnchorIndex: number;
let activeLine: Pen;
let activeAnchor: Point;
let draggingAnchor: Point;
const collaboratePointers = new Map<string, CollaboratePointer>();
let dragRedrawLine: boolean;
let snap: {
  offsetX?: number; // 吸附后的x的偏移坐标
  offsetY?: number; // 吸附后的y的偏移坐标
  xLine?: Pen; // 吸附的x轴参考线。线的端点为{x,y}和{ex,ey}
  yLine?: Pen; // 吸附的y轴参考线。线的端点为{x,y}和{ex,ey}
};

let images = {};

let textInputting: boolean;

let penDraws: {
  [key: string]: (ctx: CanvasRenderingContext2D, pen: Pen, path?: string, pathRect?: Rect) => any;
} = {};

if (typeof structuredClone === 'undefined') {
  globalThis.structuredClone = deepClone;
}

const workerFns: { [key: number]: Function } = {
  [WorkerMessage.Init]: onInit,
  [WorkerMessage.Resize]: onResize,
  [WorkerMessage.Option]: onOption,
  [WorkerMessage.RegisterPen]: onRegisterPen,
  [WorkerMessage.Data]: onData,
  [WorkerMessage.AddPath]: onAddPath,
  [WorkerMessage.DragOver]: onDragOver,
  [WorkerMessage.TranslateScale]: onTranslateScale,
  [WorkerMessage.Hover]: onHover,
  [WorkerMessage.PickAnchor]: onPickAnchor,
  [WorkerMessage.Active]: onActive,
  [WorkerMessage.ActiveAnchor]: onActiveAnchor,
  [WorkerMessage.SelectPens]: onSelectPens,
  [WorkerMessage.DragPens]: onDragPens,
  [WorkerMessage.ImageFetched]: onImageFetched,
  [WorkerMessage.IconFetch]: onIconFetch,
  [WorkerMessage.DrawingLine]: onDrawingLine,
  [WorkerMessage.DragLineFrom]: onDragLineFrom,
  [WorkerMessage.DragLineTo]: onDragLineTo,
  [WorkerMessage.DragLineAnchor]: onDragLineAnchor,
  [WorkerMessage.DragLineAnchorCp1]: onDragLineAnchorCp1,
  [WorkerMessage.DragLineAnchorCp2]: onDragLineAnchorCp2,
  [WorkerMessage.DrawingPencil]: onDrawingPencil,
  [WorkerMessage.TextInputting]: onTextInputting,
  [WorkerMessage.RenderAnimation]: onRenderAnimation,
  [WorkerMessage.Magnifier]: onMagnifier,
  [WorkerMessage.Esc]: onEsc,
  [WorkerMessage.Destory]: onDestory,
  [WorkerMessage.FontLoad]: onFontLoad,
  [WorkerMessage.Collaborate]: onCollaborate,
  [WorkerMessage.PerfProbe]: onPerfProbe,
  [WorkerMessage.SwitchDrawingLineType]: onSwitchDrawingLineType,
};

self.onmessage = (e: MessageEvent) => {
  if (probe.on) {
    const t = probe.now();
    workerFns[e.data.action](e);
    probe.time('handle:' + e.data.action, t);
    probe.count('recv:' + e.data.action);
    return;
  }
  workerFns[e.data.action](e);
};

function onPerfProbe(e: MessageEvent) {
  // 探针消息在队列里排了多久 = 这个 worker 当前积压了多少（Date.now 跨线程可比）
  e.data.sentAt && probe.sample('probe:lag', Date.now() - e.data.sentAt);
  const report: any = probe.collect('hover', e.data.reset !== false);
  // 截图 12：拖动动画图元后，hover 层在原位置留下一块淡橙色菱形，且每帧都被重画（动画期间 hover 每秒整屏重画 ~40 次，
  // 画上去不擦的残影活不下来）⇒ hover 手里还攥着某个状态。随 canvasAudit 一起把会画出整块图元的状态吐出来对位置。
  if (e.data.canvasAudit) {
    const brief = (p: any) =>
      p && { id: p.id, x: p.x, y: p.y, w: p.width, h: p.height, rotate: p.rotate, pivot: p.pivot, category: p.category };
    report.hoverState = {
      draggingPens: draggingPens?.map(brief),
      hover: brief(hover),
      hoverBoundary,
      activeBoundary,
      activePens: activePens?.map(brief),
      dockRect,
      selectRect,
      mode: options.mode,
    };
  }
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
  width = e.data.canvas.width;
  height = e.data.canvas.height;
  dpr = e.data.dpr || 1;
  ctx = e.data.canvas.getContext('2d');
  options = e.data.options || {};
  render();
}

function onResize(e: MessageEvent) {
  width = e.data.width;
  height = e.data.height;
  ctx.canvas.width = width;
  ctx.canvas.height = height;
  render();
}

function onOption(e: MessageEvent) {
  Object.assign(options, e.data.options);
  probe.setEnabled(options.perfProbe);
  probe.hookPostMessage();
  Object.assign(data, e.data.data);
  render();
}

async function onRegisterPen(e: MessageEvent) {
  // 注册图元
  const { penDefines } = await import(/* @vite-ignore */ e.data.path);
  for (const item of penDefines) {
    if (item.draw) {
      penDraws[item.type] = item.draw;
    }
  }
}

function onData(e: MessageEvent) {
  hover = undefined;
  hoverAnchor = undefined;
  editingAnchor = undefined;
  activePens = undefined;
  activeBoundary = undefined;
  activeAnchor = undefined;
  sizeCPs = undefined;
  selectRect = undefined;
  draggingPens = undefined;
  drawingLine = undefined;
  lineTexts = undefined;
  activeLine = undefined;
  images = {};

  Object.assign(data, e.data.data);
  pathBBoxs = e.data.pathBBoxs;
  loadIconfontsAndRedraw(data.iconfonts);
  render();
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

function onDragOver(e: MessageEvent) {
  dockRect = e.data.rect;

  render();
}

function onTranslateScale(e: MessageEvent) {
  if (e.data.x != undefined) {
    data.x = e.data.x;
    data.y = e.data.y;
  }

  if (e.data.scale != undefined) {
    data.scale = e.data.scale;
  }

  render();
}

function onHover(e: MessageEvent) {
  if ('editingAnchor' in e.data) {
    editingAnchor = e.data.editingAnchor || undefined;
  }
  if ('pen' in e.data) {
    hover = e.data.pen;
    hoverBoundary = e.data.boundary;
    hoverAnchor = null;
    hoverCp = 0;
  }

  if (e.data.clear) {
    activeAnchor = undefined;
  }

  render();
}

function onPickAnchor(e: MessageEvent) {
  if (e.data.pen) {
    hover = e.data.pen;
  }
  if ('editingAnchor' in e.data) {
    editingAnchor = e.data.editingAnchor || undefined;
  }
  hoverAnchor = e.data.anchor;
  hoverCp = e.data.cp;

  render();
}

function onActive(e: MessageEvent) {
  if (e.data.hover !== undefined) {
    hover = e.data.hover;
  }

  selectRect = undefined;
  draggingPens = undefined;
  activeLine = undefined;
  activeBoundary = e.data.activeBoundary;

  // 避免拖拽连线锚点过程中，发送active消息导致活动锚点丢失
  if (
    e.data.activePens?.length !== 1 ||
    activePens?.length !== 1 ||
    activePens[0].category !== PenCategory.Line ||
    (activePens[0].id && activePens[0].id !== e.data.activePens[0].id)
  ) {
    activeAnchor = undefined;
  }

  activePens = e.data.activePens;

  if (activePens?.length === 1) {
    if (activePens[0].category === PenCategory.Line) {
      activeLine = activePens[0];
      activeBoundary = undefined;
      render();
      return;
    }
  }

  if (activeBoundary) {
    activeBoundary.x -= 1.5;
    activeBoundary.y -= 1.5;
    activeBoundary.ex += 1;
    activeBoundary.ey += 1;
    activeBoundary.width += 2;
    activeBoundary.height += 2;
    sizeCPs = getBoundingCPs(activeBoundary, ControlPointType.Size);
  }
  render();
}

function onActiveAnchor(e: MessageEvent) {
  if (hover) {
    activeLine = hover;
  }
  activeAnchor = hoverAnchor;
  render();
}

function onSelectPens(e: MessageEvent) {
  if (e.data.x == undefined) {
    selectRect = undefined;
  } else {
    selectRect = {
      x: Math.min(e.data.x, e.data.ex),
      y: Math.min(e.data.y, e.data.ey),
      width: Math.abs(e.data.x - e.data.ex),
      height: Math.abs(e.data.y - e.data.ey),
    };
  }

  render();
}

function onDragPens(e: MessageEvent) {
  snap = e.data.snap;
  const textAutoSizes = [];
  const elementPens = [];
  if (!e.data.finish) {
    connectedLines = e.data.lines;
  }
  if (e.data.x != undefined) {
    e.data.pens && (draggingPens = e.data.pens);
    if (hover && draggingPens?.some((pen) => pen.id === hover.id)) {
      // 拖动预览已经绘制最新几何，不能再叠画拾取时保存的旧 hover 连线。
      hover = undefined;
      hoverBoundary = undefined;
      hoverAnchor = undefined;
      hoverCp = 0;
    }
    draggingPens?.forEach((pen: Pen) => {
      const dx = e.data.x;
      const dy = e.data.y;
      const shouldInitText = pen.text && pen.visible !== false && pen.textVisible !== false && !pen.textLines;
      const hasPosition = pen.x != undefined && pen.y != undefined;
      if (shouldInitText) {
        ctx.font = getFont(pen, data);
        if (hasPosition) {
          // 素材图元已有相对鼠标的初始坐标，需要先生成对应的文本绘制区域。
          calcTextRect(pen);
        }
        calcTextLines(ctx, pen);
        if (!hasPosition) {
          pen.x = dx - pen.textRectWidth / 2;
          pen.y = dy - pen.textRectHeight / 2;

          if (pen.textAutoSize) {
            pen.width = pen.textRectWidth + 8;
            pen.height = pen.textRectHeight;
            textAutoSizes.push(pen);
          }
          calcTextRect(pen);
          calcTextLines(ctx, pen);
        }
      }

      // 已有相对坐标的图元在首帧也必须平移，否则带文字的流程图会停留在画布原点附近。
      if (!shouldInitText || hasPosition) {
        translateRect(pen, dx, dy);
        // 圆角折线的路径段缓存（lineSegments / gradientSegments）存的是**拐角处新算出来的点**，
        // translateRect 只挪锚点、不挪它们 ⇒ 预览里只有首尾（直接引用锚点的那两段）跟着走，
        // 中间的圆角全停在原地；松手后主线程重算才恢复。挪完必须清掉。
        clearLinePathCache(pen);
        pen.textRectX += dx;
        pen.textRectY += dy;
        if (pen.textLines) {
          pen.textLines.forEach((line) => {
            line.x += dx;
            line.y += dy;
            line.ex += dx;
            line.ey += dy;
          });
        }
      }

      if (pen.category === PenCategory.HtmlElement) {
        elementPens.push(pen);
      }
    });

    if (connectedLines?.length) {
      const nodeMap = new Map<string, Pen>();
      for (const node of e.data.lineNodes || []) {
        node?.id && nodeMap.set(node.id, node);
      }
      // 拖动中的图元必须覆盖主线程传入的原始图元，确保预览使用最新坐标。
      for (const node of draggingPens || []) {
        node?.id && nodeMap.set(node.id, node);
      }
      updateConnectedLines(connectedLines, Array.from(nodeMap.values()));

      if (e.data.texts) {
        lineTexts = e.data.texts;
        for (const text of lineTexts) {
          const line = connectedLines.find((item) => item.id === text.parentId);
          line && updateLineTextPosition(line, text);
        }
      }
    }
  } else if (activeLine && draggingPens) {
    activeLine = draggingPens.find((item) => item.id === activeLine.id);
    activeAnchor && (activeAnchor = activeLine.anchors.find((item) => item.id === activeAnchor.id));
  } else {
    draggingPens = undefined;
  }

  if (e.data.finish) {
    dockRect = undefined;
    activeBoundary = undefined;

    hover = undefined;
    hoverBoundary = undefined;
    // 最终数据由主线程 translatePens 统一提交，Worker 这里只清理预览状态。
    connectedLines = [];
    lineTexts = undefined;
  }

  render();

  // 新增图元时，图元大小根据文本内容自动计算
  if (textAutoSizes.length) {
    self.postMessage({
      action: WorkerMessage.TextAutoSize,
      pens: textAutoSizes,
    });
  }

  if (elementPens.length) {
    self.postMessage({
      action: WorkerMessage.DragPens,
      elementPens,
    });
  }
}

function onImageFetched(e: MessageEvent) {
  Object.assign(images, e.data.imageMap);
}

function onIconFetch(e: MessageEvent) {
  const { iconfonts } = e.data;
  if (iconfonts?.length) {
    loadIconfontsAndRedraw(iconfonts);
  }
}

/** 字体加载完成后重绘交互层，避免首帧使用回退字体后一直不刷新。 */
function loadIconfontsAndRedraw(iconfonts?: string[]) {
  if (!iconfonts?.length) {
    return;
  }

  void loadIconfonts(iconfonts).then(() => {
    if (ctx) {
      render();
    }
  });
}

function onCollaborate(e: MessageEvent) {
  if (e.data.clear) {
    collaboratePointers.clear();
  } else if (Array.isArray(e.data.pointers)) {
    collaboratePointers.clear();
    for (const pointer of e.data.pointers as CollaboratePointer[]) {
      if (pointer?.id && pointer.color) {
        collaboratePointers.set(pointer.uid, pointer);
      }
    }
  }
  render();
}

async function onFontLoad(e: MessageEvent) {
  const { fontFaceCss } = e.data;
  try {
    await loadFontFaceCss(fontFaceCss);
    redrawHoverTextAfterFontsReady();
  } catch (error) {
    console.warn('交互线程字体加载失败，已使用回退字体', error);
  }
}

function redrawHoverTextAfterFontsReady() {
  const pens = new Set<Pen | undefined>([
    hover,
    drawingLine,
    dragLine,
    activeLine,
    ...(activePens || []),
    ...(draggingPens || []),
    ...(connectedLines || []),
    ...(lineTexts || []),
  ]);

  for (const pen of pens) {
    if (!pen) {
      continue;
    }
    pen.textLines = undefined;
    pen.textBox = undefined;
  }
  render();
}

function clearLinePathCache(pen: Pen) {
  if (!pen.calculative) {
    return;
  }

  delete pen.calculative.lineSegments;
  delete pen.calculative.gradientSegments;
}

function onDrawingLine(e: MessageEvent) {
  let anchors: Point[] = [];

  if (e.data.esc) {
    // beforeConnectLine 拒绝连接时复用统一取消逻辑，清理 Worker 内的临时连线状态。
    onEsc(e);
    return;
  }

  if (hoverAnchor && e.data.point) {
    e.data.point.host = hover;

    let x = hoverAnchor.x;
    let y = hoverAnchor.y;
    // 锚点持久化的是翻转前坐标，绘制连线端点前需要还原到实际画布位置。
    if (hover.flipX) {
      x = hover.x + hover.ex - x;
    }
    if (hover.flipY) {
      y = hover.y + hover.ey - y;
    }
    if (hover.rotate) {
      const a = (hover.rotate * Math.PI) / 180;
      const dx = x - hover.pivot.x;
      const dy = y - hover.pivot.y;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      x = dx * cos - dy * sin + hover.pivot.x;
      y = dx * sin + dy * cos + hover.pivot.y;
    }
    e.data.point.x = Math.round(x);
    e.data.point.y = Math.round(y);
    if (e.data.lineType === 'curve') {
      e.data.point.cp2 = getMirrorPoint(
        {
          x: hover.x + hover.width / 2,
          y: hover.y + hover.height / 2,
        },
        e.data.point,
      );
    } else if (e.data.lineType === 'mind') {
      // 1.0 的 mind 根据起点锚点方向确定出线方向，预览阶段先保存该方向。
      e.data.point.direction = hoverAnchor.direction;
    } else if (e.data.lineType === 'orthogonal') {
      e.data.point.direction = getDirection(
        {
          x: hover.x + hover.width / 2,
          y: hover.y + hover.height / 2,
        },
        e.data.point,
      );
    }
  }
  if (!drawingLine) {
    e.data.point.id = s8();
    e.data.point.cp1 = e.data.point.cp2;
    e.data.point.cp2 = undefined;
    drawingLine = {
      ...options.drawingLineOptions,
      category: PenCategory.Line,
      type: e.data.lineType,
      anchors: [e.data.point],
      lineWidth: options.drawingLineOptions?.lineWidth ?? data.lineWidth ?? 1,
      fromArrow: options.drawingLineOptions?.fromArrow ?? data.fromArrow ?? options.fromArrow,
      toArrow: options.drawingLineOptions?.toArrow ?? data.toArrow ?? options.toArrow,
    };

    activeAnchor = e.data.point;
    drawingClicks = dragAnchorType ? undefined : [e.data.point];
    return;
  }

  for (const pt of drawingLine.anchors) {
    if (pt.temp) {
      continue;
    }

    anchors.push(pt);
  }

  let to: any = anchors[anchors.length - 1];
  if (e.data.point) {
    let constrainedPoint = { ...e.data.point };
    if (anchors.length > 0) {
      const lastAnchor = anchors[anchors.length - 1];
      if (e.data.shift) {
        constrainedPoint.y = lastAnchor.y;
      } else if (e.data.ctrl) {
        constrainedPoint.x = lastAnchor.x;
      }
    }
    to = constrainedPoint;
  } else if (anchors.length < 2) {
    onEsc(e);
    self.postMessage({
      action: WorkerMessage.DrawingLine,
    });
    return;
  }

  if (anchors.length > 1) {
    if (dragAnchorType === DragAnchorType.From) {
      anchors[0].direction = getDirection(anchors[1], anchors[0]);
    } else {
      const pt1 = anchors[anchors.length - 2];
      const pt2 = anchors[anchors.length - 1];
      pt2.direction = getDirection(pt1, pt2);
    }
  }
  drawingLine.type = e.data.lineType;

  if (e.data.point) {
    if (dragAnchorType === DragAnchorType.From) {
      if (!dragRedrawLine && drawingLine.type === 'curve' && to.down) {
        const from = anchors[0];
        from.cp2 = { x: to.x, y: to.y };
        const len = getLineSegmentsLength([from.cp2, from]);
        from.cp1 = getMirrorPoint(from.cp2, from, len);
      } else {
        to.cp1 = to.cp2;
        to.cp2 = undefined;
        const pts = getDrawingLineTo(anchors[0], to);
        pts.reverse();
        anchors.unshift(...pts);
      }
    } else {
      if (!dragRedrawLine && drawingLine.type === 'curve' && to.down) {
        const last = anchors[anchors.length - 1];
        last.cp1 = { x: to.x, y: to.y };
        const len = getLineSegmentsLength([last.cp1, last]);
        last.cp2 = getMirrorPoint(last.cp1, last, len);
      } else {
        anchors.push(...getDrawingLineTo(anchors[anchors.length - 1], to));
      }
    }
  }

  if (drawingLine.type === 'orthogonal') {
    drawingLine.anchors = simplifyOrthogonalPoints(anchors);
  } else if (drawingLine.type === 'mind') {
    // mind 是固定两点连线，临时预览和最终结果都只保留起点与终点。
    drawingLine.anchors = anchors.length > 1 ? [anchors[0], anchors[anchors.length - 1]] : anchors;
    updateMindControlPoints(drawingLine, drawingLine.anchors[0]?.host);
  } else {
    drawingLine.anchors = anchors;
  }

  // 拖画时锚点会持续变化，必须清除上一帧的平滑路径缓存。
  clearLinePathCache(drawingLine);

  if (!to.temp && e.data.point) {
    activeAnchor = to;
    dragRedrawLine = false;
    // 落下一个拐点：记下用户点的位置（曲线拖出控制柄那一下 to.down 不是新拐点，只改上一个点）
    if (drawingClicks && !(drawingLine.type === 'curve' && to.down)) {
      drawingClicks.push({ x: to.x, y: to.y, host: to.host, direction: to.direction, id: to.id });
    }
  }

  lineTexts && calcLineText();

  if (e.data.finish) {
    if (drawingLine.anchors.length > 2) {
      activeLine = drawingLine;
    } else if (drawingLine.anchors.length === 2) {
      const dx = drawingLine.anchors[0].x - drawingLine.anchors[1].x;
      const dy = drawingLine.anchors[0].y - drawingLine.anchors[1].y;

      // 短距离的两个点组成的连线无效
      if (dx * dx + dy * dy > 20) {
        activeLine = drawingLine;
      }
    }

    if (activeLine) {
      activeLine.close = e.data.close;
      restoreDragEndpointIds(activeLine);
      const points = getCurveSegmentPoints(activeLine);
      activeLine.length = getLineSegmentsLength(points);
      const rect = getRectOfPoints(points);
      if (activeLine.lineWidth >= 2 || activeLine.fromArrow || activeLine.toArrow) {
        const size = Math.max(
          Math.round(activeLine.lineWidth / 2),
          activeLine.fromArrowSize || 0,
          activeLine.toArrowSize || 0,
          10,
        );
        expandRect(rect, size);
      }
      Object.assign(activeLine, rect);
      self.postMessage({
        action: WorkerMessage.DrawingLine,
        pen: activeLine,
        texts: lineTexts,
        dragAnchorType,
      });
    }

    activePens = activeLine ? [activeLine] : undefined;
    drawingLine = undefined;
    drawingClicks = undefined;
    lineTexts = undefined;
    dragAnchorType = undefined;
    dragLine = undefined;
  }

  render();
}

function calcLineText() {
  for (const text of lineTexts) {
    if (!text.textLines) {
      ctx.font = getFont(text, data);
      calcTextRect(text);
      calcTextLines(ctx, text);
      text._rect = { x: text.x, y: text.y };
    }

    const pt = getSegmentPointByPosition(drawingLine.anchors.slice(text.segment, text.segment + 2), text.position);
    text.x = Math.round(pt.x - text.width / 2);
    text.y = Math.round(pt.y - text.height / 2);
    text.ex = text.x + text.width;
    text.ey = text.y + text.height;
    for (const line of text.textLines) {
      line.x += text.x - text._rect.x;
      line.y += text.y - text._rect.y;
      line.ex += text.x - text._rect.x;
      line.ey += text.y - text._rect.y;
      text._rect.x = text.x;
      text._rect.y = text.y;
    }
  }
}

function calcConnectedLinesText() {
  for (const text of lineTexts) {
    if (!text.textLines) {
      ctx.font = getFont(text, data);
      calcTextRect(text);
      calcTextLines(ctx, text);
      text._rect = { x: text.x, y: text.y };
    }
    const cline = connectedLines.find((item) => item.id === text.parentId);
    const pt = getSegmentPointByPosition(cline.anchors.slice(text.segment, text.segment + 2), text.position);
    text.x = Math.round(pt.x - text.width / 2);
    text.y = Math.round(pt.y - text.height / 2);
    text.ex = text.x + text.width;
    text.ey = text.y + text.height;
    for (const line of text.textLines) {
      line.x += text.x - text._rect.x;
      line.y += text.y - text._rect.y;
      line.ex += text.x - text._rect.x;
      line.ey += text.y - text._rect.y;
      text._rect.x = text.x;
      text._rect.y = text.y;
    }
  }
}

function onDragLineFrom(e: MessageEvent) {
  dragRedrawLine = true;
  dragLine = structuredClone(hover);
  dragAnchorType = DragAnchorType.From;
  drawingLine = hover;
  drawingLine.anchors.shift();

  if (drawingLine.anchors.length > 1 && hover.type === 'orthogonal') {
    drawingLine.anchors.shift();
  }
  activeLine = undefined;
  hoverAnchor = undefined;
  activeAnchor = undefined;

  lineTexts = e.data.texts;

  onDrawingLine(e);
}

function onDragLineTo(e: MessageEvent) {
  dragRedrawLine = true;
  dragLine = structuredClone(hover);
  dragAnchorType = DragAnchorType.To;
  drawingLine = hover;
  drawingLine.anchors.pop();

  if (drawingLine.anchors.length > 1 && hover.type === 'orthogonal') {
    drawingLine.anchors.pop();
  }
  activeLine = undefined;
  hoverAnchor = undefined;
  activeAnchor = undefined;

  lineTexts = e.data.texts;

  onDrawingLine(e);
}

/**
 * 正交线首 / 尾那一段（端点 → 相邻锚点）是不是横段。传入的是拖动开始时的锚点（dragLine），整个拖动中不变。
 * 两点重合（旧数据里有）时看下一段：正交线相邻两段互相垂直。实在看不出来返回 undefined，由 dragOrthogonalPoint 自己推断。
 */
function getEndHorizontal(anchors: Point[], endIdx: number): boolean | undefined {
  const first = endIdx === 0;
  const end = anchors[endIdx];
  const nb = anchors[first ? 1 : endIdx - 1];
  if (!nb) {
    return undefined;
  }
  if (end.x !== nb.x || end.y !== nb.y) {
    return end.y === nb.y;
  }
  const nb2 = anchors[first ? 2 : endIdx - 2];
  if (nb2 && (nb2.x !== nb.x || nb2.y !== nb.y)) {
    return nb2.x === nb.x;
  }
  return undefined;
}

let lastDragLineAnchorShift: boolean;
let dragAnchorLockPos: number | undefined;

/**
 * 正交线重算时可能会用新生成的拐点替换首尾点。首尾点是连接关系的身份载体，
 * 只能更新坐标，不能因为重新布线路由而更换其 id。
 */
function restoreDragEndpointIds(line: Pen): void {
  if (!dragLine?.anchors?.length || !line.anchors?.length) {
    return;
  }

  const firstId = dragLine.anchors[0]?.id;
  const lastId = dragLine.anchors[dragLine.anchors.length - 1]?.id;
  firstId && (line.anchors[0].id = firstId);
  lastId && (line.anchors[line.anchors.length - 1].id = lastId);
}

function onDragLineAnchor(e: MessageEvent) {
  if (e.data.dragAnchorType !== undefined) {
    // 主线程在按下时已经确定首端 / 尾端；后续消息不能再根据当前 hover 推断，
    // 否则拖首端时完成消息会被误当成拖尾端。
    dragAnchorType = e.data.dragAnchorType;
  }

  if (e.data.texts) {
    lineTexts = e.data.texts;
    return;
  }

  if (!drawingLine) {
    if (!activeLine) {
      console.warn('是否鼠标抖动引起active失效');
      return;
    }
    drawingLine = activeLine;
    drawingLine.type = e.data.lineType;
    dragLine = structuredClone(activeLine);
    dragAnchorIndex = activeLine.anchors.findIndex((item) => item.id === hoverAnchor.id);
    hoverAnchor = drawingLine.anchors[dragAnchorIndex];
    activeAnchor = hoverAnchor;
    if (hover?.id === drawingLine.id) {
      // 锚点拖动期间由 drawingLine 绘制实时路径，清掉拖动前的 hover 快照。
      hover = undefined;
      hoverBoundary = undefined;
      hoverCp = 0;
    }
  }

  let constrainedPoint = { ...e.data.point };
  if (e.data.shift) {
    if (dragAnchorLockPos === undefined) {
      dragAnchorLockPos = e.data.point.y;
    }
    constrainedPoint.y = dragAnchorLockPos;
  } else if (e.data.ctrl) {
    if (dragAnchorLockPos === undefined) {
      dragAnchorLockPos = e.data.point.x;
    }
    constrainedPoint.x = dragAnchorLockPos;
  } else {
    dragAnchorLockPos = undefined;
  }

  if (drawingLine.type === 'orthogonal') {
    if (lastDragLineAnchorShift && !e.data.shift) {
      activeLine = structuredClone(dragLine);
      drawingLine = activeLine;
      dragAnchorIndex = activeLine.anchors.findIndex((item) => item.id === hoverAnchor.id);
      hoverAnchor = drawingLine.anchors[dragAnchorIndex];
      activeAnchor = hoverAnchor;
    }
    lastDragLineAnchorShift = e.data.shift;
    // 首尾锚点跟手：不再锁成只沿一个轴滑（原来按鼠标离起点哪个方向更远锁住另一维，手稍一斜端点就离开鼠标），
    // 由 dragOrthogonalPoint 挪相邻锚点保持正交。第一段的横 / 竖按拖动开始时的连线算，见 getEndHorizontal。
    const endIdx = dragLine.anchors.findIndex((item) => item.id === activeAnchor.id);
    const endHorizontal =
      endIdx === 0 || endIdx === dragLine.anchors.length - 1 ? getEndHorizontal(dragLine.anchors, endIdx) : undefined;
    drawingLine.anchors = dragOrthogonalPoint(
      drawingLine.anchors,
      activeAnchor,
      constrainedPoint,
      e.data.shift,
      endHorizontal,
    );
  } else {
    // 如果是曲线或直线，直接修改锚点坐标
    if (activeAnchor.cp1 || activeAnchor.cp2) {
      const dx = constrainedPoint.x - activeAnchor.x;
      const dy = constrainedPoint.y - activeAnchor.y;
      if (activeAnchor.cp1) {
        activeAnchor.cp1.x += dx;
        activeAnchor.cp1.y += dy;
      }
      if (activeAnchor.cp2) {
        activeAnchor.cp2.x += dx;
        activeAnchor.cp2.y += dy;
      }
    }
    activeAnchor.x = constrainedPoint.x;
    activeAnchor.y = constrainedPoint.y;
  }

  clearLinePathCache(drawingLine);

  lineTexts && calcLineText();

  if (e.data.finish) {
    for (const pt of drawingLine.anchors) {
      delete pt.temp;
    }
    if (drawingLine.type === 'orthogonal') {
      drawingLine.anchors = simplifyOrthogonalPoints(drawingLine.anchors);
    }

    activeLine = drawingLine;
    restoreDragEndpointIds(activeLine);
    const points = getCurveSegmentPoints(activeLine);
    activeLine.length = getLineSegmentsLength(points);
    const rect = getRectOfPoints(points);
    if (activeLine.lineWidth >= 2 || activeLine.fromArrow || activeLine.toArrow) {
      const size = Math.max(
        Math.round(activeLine.lineWidth / 2),
        activeLine.fromArrowSize || 0,
        activeLine.toArrowSize || 0,
        10,
      );
      expandRect(rect, size);
    }
    Object.assign(activeLine, rect);
    self.postMessage({
      action: WorkerMessage.DrawingLine,
      pen: activeLine,
      texts: lineTexts,
      dragAnchorType,
    });

    drawingLine = undefined;
    lineTexts = undefined;
    dragLine = undefined;
    lastDragLineAnchorShift = undefined;
    dragAnchorLockPos = undefined;
    draggingAnchor = undefined;
  } else {
    draggingAnchor = constrainedPoint;
    draggingAnchor.cp1 = activeAnchor.cp1;
    draggingAnchor.cp2 = activeAnchor.cp2;
  }

  render();
}

function onDragLineAnchorCp1(e: MessageEvent) {
  if (!drawingLine) {
    if (!activeLine) {
      console.warn('是否鼠标抖动引起active失效');
      return;
    }
    drawingLine = activeLine;
  }

  if (drawingLine.type === 'curve') {
    activeAnchor.cp1.x = e.data.point.x;
    activeAnchor.cp1.y = e.data.point.y;

    if (!activeAnchor.cp1.handleType) {
      const len = getLineSegmentsLength([activeAnchor.cp1, activeAnchor]);
      activeAnchor.cp2 = getMirrorPoint(activeAnchor.cp1, activeAnchor, len);
    } else if (activeAnchor.cp1.handleType === HandleType.Smooth) {
      const len = getLineSegmentsLength([activeAnchor.cp2, activeAnchor]);
      activeAnchor.cp2 = getMirrorPoint(activeAnchor.cp1, activeAnchor, len);
    }
  }
  clearLinePathCache(drawingLine);

  if (e.data.finish) {
    activeLine = drawingLine;
    const points = getCurveSegmentPoints(activeLine);
    activeLine.length = getLineSegmentsLength(points);
    const rect = getRectOfPoints(points);
    if (activeLine.lineWidth >= 2 || activeLine.fromArrow || activeLine.toArrow) {
      const size = Math.max(
        Math.round(activeLine.lineWidth / 2),
        activeLine.fromArrowSize || 0,
        activeLine.toArrowSize || 0,
        10,
      );
      expandRect(rect, size);
    }
    Object.assign(activeLine, rect);
    self.postMessage({
      action: WorkerMessage.DrawingLine,
      pen: activeLine,
    });

    drawingLine = undefined;
    lineTexts = undefined;
  }

  render();
}

function onDragLineAnchorCp2(e: MessageEvent) {
  if (!drawingLine) {
    if (!activeLine) {
      console.warn('是否鼠标抖动引起active失效');
      return;
    }
    drawingLine = activeLine;
  }

  if (drawingLine.type === 'curve') {
    activeAnchor.cp2.x = e.data.point.x;
    activeAnchor.cp2.y = e.data.point.y;

    if (!activeAnchor.cp2.handleType) {
      const len = getLineSegmentsLength([activeAnchor.cp2, activeAnchor]);
      activeAnchor.cp1 = getMirrorPoint(activeAnchor.cp2, activeAnchor, len);
    } else if (activeAnchor.cp1.handleType === HandleType.Smooth) {
      const len = getLineSegmentsLength([activeAnchor.cp1, activeAnchor]);
      activeAnchor.cp1 = getMirrorPoint(activeAnchor.cp2, activeAnchor, len);
    }
  }
  clearLinePathCache(drawingLine);

  if (e.data.finish) {
    activeLine = drawingLine;
    const points = getCurveSegmentPoints(activeLine);
    activeLine.length = getLineSegmentsLength(points);
    const rect = getRectOfPoints(points);
    if (activeLine.lineWidth >= 2 || activeLine.fromArrow || activeLine.toArrow) {
      const size = Math.max(
        Math.round(activeLine.lineWidth / 2),
        activeLine.fromArrowSize || 0,
        activeLine.toArrowSize || 0,
        10,
      );
      expandRect(rect, size);
    }
    Object.assign(activeLine, rect);
    self.postMessage({
      action: WorkerMessage.DrawingLine,
      pen: activeLine,
    });

    drawingLine = undefined;
    lineTexts = undefined;
  }

  render();
}

function onDrawingPencil(e: MessageEvent) {
  if (!drawingLine) {
    activeLine = undefined;
    drawingLine = {
      category: PenCategory.Line,
      type: 'curve',
      anchors: [e.data.point],
      lineWidth: data.lineWidth || 1,
    };
    // 从 options 中应用箭头配置
    if (options.fromArrow) {
      drawingLine.fromArrow = options.fromArrow;
    }
    if (options.toArrow) {
      drawingLine.toArrow = options.toArrow;
    }
    return;
  }

  if (e.data.point) {
    drawingLine.anchors.push(e.data.point);
  } else if (drawingLine.anchors.length < 2) {
    onEsc(e);
    return;
  }

  if (e.data.finish) {
    if (drawingLine.anchors.length > 2) {
      activeLine = drawingLine;
    } else if (drawingLine.anchors.length === 2) {
      const dx = drawingLine.anchors[0].x - drawingLine.anchors[1].x;
      const dy = drawingLine.anchors[0].y - drawingLine.anchors[1].y;

      // 短距离的两个点组成的连线无效
      if (dx * dx + dy * dy > 20) {
        activeLine = drawingLine;
      }
    }

    if (activeLine) {
      // 优化减少点的数量
      let points = simplify(activeLine.anchors, options.pencilTolerance);
      points = smoothLine(points);
      let i = 0;
      for (const pt of points) {
        pt.id = (++i).toString();
        // 待优化：是否需要立即赋值penId，还是按需赋值
      }
      activeLine.anchors = points;
      activeLine.length = getLineSegmentsLength(points);
      const rect = getRectOfPoints(points);
      if (activeLine.lineWidth >= 2 || activeLine.fromArrow || activeLine.toArrow) {
        const size = Math.max(
          Math.round(activeLine.lineWidth / 2),
          activeLine.fromArrowSize || 0,
          activeLine.toArrowSize || 0,
          10,
        );
        expandRect(rect, size);
      }
      Object.assign(activeLine, rect);
      self.postMessage({
        action: WorkerMessage.DrawingLine,
        pen: activeLine,
      });
    }

    activePens = activeLine ? [activeLine] : undefined;
    drawingLine = undefined;
    lineTexts = undefined;
    dragAnchorType = undefined;
  }

  render();
}

function onRenderAnimation(e: MessageEvent) {
  // M4 第 1 步：一帧合成一条时，整批属性应用完**只整屏重绘一次**（原来每条消息一次 —— M5 记过的浪费）
  if (e.data.batch) {
    let any = false;
    for (const item of e.data.batch) {
      any = applyAnimationItem(item) || any;
    }
    any && render();
    return;
  }
  applyAnimationItem(e.data) && render();
}

/** 把一条动画更新应用到 hover / 活动图元上；返回是否需要重绘（与原来「无 penIds 直接 return」一致） */
function applyAnimationItem(data: any): boolean {
  const { penIds, boundary: _boundary, changedProperties } = data;

  // cull：calc 判这一条整个在视口外 ⇒ 悬停 / 选中的是它时属性照样要跟上（平移回来框才在对的位置），
  // 但只有碰到悬停 / 选中图元时才需要重绘
  if (!penIds?.length && !data.cull) {
    return false;
  }
  let touched = !data.cull;

  for (const penId in changedProperties) {
    if (hover?.id === penId) {
      touched = true;
      Object.assign(hover, changedProperties[penId]);
      // ⚠ 截图 5-3（悬停在旋转的动画图元上，hover 边框没跟着转）：这里原来每帧重建成 {x, y, width, height}，
      // 丢了 rotate / pivot；画边框的代码按 hoverBoundary.rotate / pivot 转 ⇒ 动画图元的悬停框被摆正。
      // 不动的图元不经过这里，悬停框来自 calc 的 boundary（带 rotate），所以只有动画图元会这样。
      hoverBoundary = {
        x: hover.x,
        y: hover.y,
        width: hover.width,
        height: hover.height,
        rotate: hover.rotate,
        pivot: hover.pivot,
      };
      hoverBoundary.ex = hoverBoundary.x + hoverBoundary.width;
      hoverBoundary.ey = hoverBoundary.y + hoverBoundary.height;
    }

    // 更新activeBoundary
    if (activePens?.length) {
      let needUpdateBoundary = false;
      for (const pen of activePens) {
        if (pen.id === penId) {
          const changed = changedProperties[penId];
          Object.assign(pen, changed);
          // 颜色、透明度、linePosition 等动画属性不会改变选中框。
          // 只有几何属性变化时才重算，避免连线动画每帧触发多选边界收缩。
          needUpdateBoundary ||=
            changed.x !== undefined ||
            changed.y !== undefined ||
            changed.width !== undefined ||
            changed.height !== undefined ||
            changed.rotate !== undefined ||
            changed.scale !== undefined ||
            changed.anchors !== undefined ||
            changed.textBox !== undefined;
          touched = true;
        }
      }

      if (needUpdateBoundary && activePens.length === 1 && activePens[0].category !== PenCategory.Line) {
        // 单个非连线图元，直接使用其边界
        const pen = activePens[0];
        activeBoundary = {
          x: pen.x - 1.5,
          y: pen.y - 1.5,
          width: pen.width + 2,
          height: pen.height + 2,
          ex: pen.x + pen.width + 1,
          ey: pen.y + pen.height + 1,
          rotate: pen.rotate,
          pivot: pen.pivot,
        };
        sizeCPs = getBoundingCPs(activeBoundary, ControlPointType.Size);
      } else if (needUpdateBoundary && activePens.length > 1) {
        // 多个图元，计算包围盒
        const points: Point[] = [];
        for (const pen of activePens) {
          // 活动框的初始边界包含全部选中图元，动画帧重算时也必须保留连线范围。
          points.push({ x: pen.x, y: pen.y });
          points.push({ x: pen.x + pen.width, y: pen.y });
          points.push({ x: pen.x + pen.width, y: pen.y + pen.height });
          points.push({ x: pen.x, y: pen.y + pen.height });
        }

        if (points.length > 0) {
          const rect = getRectOfPoints(points);
          activeBoundary = {
            x: rect.x - 1.5,
            y: rect.y - 1.5,
            width: rect.width + 2,
            height: rect.height + 2,
            ex: rect.x + rect.width + 1,
            ey: rect.y + rect.height + 1,
          };
          sizeCPs = getBoundingCPs(activeBoundary, ControlPointType.Size);
        }
      }
    }
  }

  return touched;
}

function render() {
  probe.count('hoverFullRender'); // 每次调用都是整屏 clearRect，用调用次数衡量浪费
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);

  // 平移原点对齐到整设备像素（与 render worker 的 applyTransform 一致）：dpr 非整数（1.25 / 1.5）时
  // dpr·data.x 的小数部分随每次平移变化，细线的亚像素位置跟着变，一会儿实一会儿虚，平移时明暗闪烁
  const matrix = new DOMMatrix()
    .scale(dpr)
    .translate(Math.round(dpr * (data.x || 0)) / dpr, Math.round(dpr * (data.y || 0)) / dpr)
    .scale(data.scale || 1);
  ctx.setTransform(matrix);

  ctx.lineWidth = 1 / data.scale;

  ctx.textBaseline = 'middle';

  // 绘制拖拽中的pens
  draggingPens && renderDraggingPens();

  // 绘制连线
  drawingLine && renderDrawingLine();

  // 绘制连接线
  connectedLines?.length && renderConnectedLines();

  const isDrawingHoveredLine = !!drawingLine?.id && drawingLine.id === hover?.id;
  if (options.mode === Mode.Edit && !textInputting) {
    if (!draggingPens && !isDrawingHoveredLine && hover && hoverBoundary) {
      if (hover.category === PenCategory.Line) {
        renderHoverLine();
      } else {
        renderHoverRect();
      }
    }

    // 绘画大小和旋转控制器
    !draggingPens && activeBoundary && renderController();

    // 绘画动态范围范围框选
    selectRect && renderSelectRect();

    // 绘画拖拽到pen的container区域
    dockRect && renderDockRect();
  }

  !draggingPens && activeLine && renderActiveLine();

  // 绘画hover图元
  options.anchorMode && hover && !draggingPens && !isDrawingHoveredLine && !textInputting && renderHoverAnchors();

  snap && renderSnap();
  renderCollaboratePointers();
}

function renderCollaboratePointers() {
  if (!collaboratePointers.size) {
    return;
  }

  ctx.save();
  const pointerWidth = 24;
  const fontSize = 14;
  const paddingX = 12;
  const labelHeight = 28;
  const labelMinWidth = 48;
  ctx.font = `${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';

  for (const pointer of collaboratePointers.values()) {
    if (
      !Number.isFinite(pointer.x) ||
      !Number.isFinite(pointer.y) ||
      !Number.isFinite(pointer.width) ||
      !Number.isFinite(pointer.height)
    ) {
      continue;
    }

    const centerX = pointer.x + pointer.width / 2;
    const centerY = pointer.y + pointer.height / 2;
    const username = typeof pointer.username === 'string' && pointer.username ? pointer.username : pointer.uid;
    const labelWidth = Math.max(ctx.measureText(username).width + paddingX * 2, labelMinWidth);
    const labelX = centerX + 16;
    const labelY = centerY + 34;
    const radius = 6;

    // 绘制带白色描边的鼠标指针，尖端指向当前操作者修改的图元中心。
    ctx.fillStyle = pointer.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + 0.742 * pointerWidth, centerY + pointerWidth * 0.6188);
    ctx.lineTo(centerX + pointerWidth * 0.3525, centerY + pointerWidth * 0.6835);
    ctx.lineTo(centerX + pointerWidth * 0.0872, centerY + pointerWidth * 0.9962);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制位于指针下方偏右的圆角用户名标签。
    ctx.fillStyle = pointer.color;
    ctx.beginPath();
    ctx.moveTo(labelX + radius, labelY);
    ctx.lineTo(labelX + labelWidth - radius, labelY);
    ctx.quadraticCurveTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + radius);
    ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
    ctx.quadraticCurveTo(labelX + labelWidth, labelY + labelHeight, labelX + labelWidth - radius, labelY + labelHeight);
    ctx.lineTo(labelX + radius, labelY + labelHeight);
    ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - radius);
    ctx.lineTo(labelX, labelY + radius);
    ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(username, labelX + paddingX, labelY + labelHeight / 2);
  }

  ctx.restore();
}

function renderDraggingPens() {
  ctx.save();

  for (const pen of draggingPens) {
    // Group 只是逻辑容器，主渲染不会绘制，拖拽预览也应保持一致。
    if (pen.type === 'group') {
      continue;
    }

    ctx.save();
    ctx.strokeStyle = pen.activeColor || pen.color || data.color || options.color;
    if (pen.lineWidth) {
      ctx.lineWidth = pen.lineWidth <= 1 ? 1 / data.scale : pen.lineWidth;
    } else if (pen.lineWidth === 0) {
      ctx.strokeStyle = 'transparent';
    }
    if (pen.lineCap) {
      ctx.lineCap = pen.lineCap;
    }
    if (pen.opacity !== undefined) {
      ctx.globalAlpha = pen.opacity ?? 1;
    }
    if (pen.flipX || pen.flipY) {
      flipRender(ctx, pen);
    }

    if (pen.rotate) {
      rotateRender(ctx, pen);
    }
    if (pen.backgrounds) {
      setBackgrounds(ctx, pen, images);
    } else if (pen.background || pen.gradient) {
      setBackground(ctx, pen, images);
    }
    translateRect(pen, -0.5, -0.5); // 为了更好的1像素对齐
    if (penDraws[pen.type]) {
      if (pen.pathId) {
        penDraws[pen.type](ctx, pen, data.paths[pen.pathId], pathBBoxs[pen.pathId]);
      } else {
        penDraws[pen.type](ctx, pen);
      }
    } else if (pen.fillStyles?.length) {
      for (const bg of pen.fillStyles) {
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.rect(pen.x, pen.y, pen.width, pen.height);
        ctx.fill();
      }
    } else if (pen.category === PenCategory.HtmlElement) {
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = pen.activeColor || options.activeColor;
      ctx.beginPath();
      ctx.rect(pen.x, pen.y, pen.width, pen.height);
      ctx.stroke();
    } else if (!pen.text && !pen.icon && !pen.image) {
      ctx.fillStyle = data.unknowBackground || '#d9d9d960';
      ctx.beginPath();
      ctx.rect(pen.x, pen.y, pen.width, pen.height);
      ctx.fill();
    }

    if (pen.image) {
      ctx.beginPath();
      ctx.rect(pen.x, pen.y, pen.width, pen.height);
      ctx.stroke();

      if (images[pen.image]) {
        renderImage(ctx, pen, images[pen.image]);
      }
    }

    if (pen.icon) {
      renderIcon(ctx, pen);
    }

    if (pen.textVisible != false && pen.text) {
      renderText(ctx, pen);
    }
    translateRect(pen, 0.5, 0.5);

    ctx.restore();
  }

  // 绘画对齐参考线和参考目标
  // ...

  ctx.restore();
}

function renderConnectedLines() {
  ctx.save();
  for (const line of connectedLines) {
    ctx.strokeStyle = line.activeColor || line.color || data.activeColor || data.color;
    ctx.lineWidth = line.lineWidth / data.scale;
    penDraws[line.type](ctx, line);

    if (lineTexts) {
      for (const text of lineTexts) {
        if (text.hoverBackground) {
          text.fillStyles = [text.hoverBackground];
        } else if (text.activeBackground) {
          text.fillStyles = [text.activeBackground];
        } else if (text.backgrounds) {
          setBackgrounds(ctx, text, images);
        }

        if (text.fillStyles?.length) {
          for (const bg of text.fillStyles) {
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.rect(text.x, text.y, text.width, text.height);
            ctx.fill();
          }
        }
        renderText(ctx, text);
      }
    }
  }
  ctx.restore();
}

function renderDrawingLine() {
  ctx.save();

  const anchor = draggingAnchor || activeAnchor;

  // 绘画手柄
  if (anchor) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = pSBC(0.2, options.activeColor);
    if (anchor.cp1) {
      ctx.lineWidth = 1 / data.scale;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(anchor.cp1.x, anchor.cp1.y);
      ctx.stroke();

      ctx.lineWidth = 2 / data.scale;
      ctx.beginPath();
      ctx.arc(anchor.cp1.x, anchor.cp1.y, 3 / data.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    if (anchor.cp2) {
      ctx.lineWidth = 1 / data.scale;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(anchor.cp2.x, anchor.cp2.y);
      ctx.stroke();

      ctx.lineWidth = 2 / data.scale;
      ctx.beginPath();
      ctx.arc(anchor.cp2.x, anchor.cp2.y, 3 / data.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    // 绘画连线锚点
    ctx.lineWidth = 2 / data.scale;
    ctx.strokeStyle = options.activeColor;
    ctx.fillStyle = options.activeColor;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3 / data.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  } else {
  }

  if (drawingLine.lineWidth !== 0) {
    const useGradientLine = !!drawingLine.lineGradient?.colorStops?.length;
    ctx.lineWidth = !drawingLine.lineWidth || drawingLine.lineWidth <= 1 ? 1 / data.scale : drawingLine.lineWidth;
    if (!useGradientLine || !renderLineGradientPath(ctx, drawingLine)) {
      ctx.strokeStyle = drawingLine.activeColor || drawingLine.color || data.activeColor || data.color;
      ctx.lineCap = drawingLine.lineCap || 'square';
      ctx.lineJoin = drawingLine.lineJoin || 'round';
      ctx.globalAlpha = drawingLine.opacity ?? 1;
      ctx.setLineDash(drawingLine.lineDash || []);
      ctx.lineDashOffset = drawingLine.lineDashOffset || 0;
      penDraws[drawingLine.type](ctx, drawingLine);
    }
  }

  if (lineTexts) {
    for (const text of lineTexts) {
      if (text.hoverBackground) {
        text.fillStyles = [text.hoverBackground];
      } else if (text.activeBackground) {
        text.fillStyles = [text.activeBackground];
      } else if (text.backgrounds) {
        setBackgrounds(ctx, text, images);
      }

      if (text.fillStyles?.length) {
        for (const bg of text.fillStyles) {
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.rect(text.x, text.y, text.width, text.height);
          ctx.fill();
        }
      }
      renderText(ctx, text);
    }
  }

  ctx.restore();
}

function renderActiveLine() {
  ctx.save();
  ctx.translate(-0.5, -0.5);

  // 绘画手柄
  ctx.globalAlpha = 1;
  if (activeAnchor) {
    if (activeAnchor.cp1) {
      ctx.strokeStyle = pSBC(0.2, options.activeColor);
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1 / data.scale;
      ctx.beginPath();
      ctx.moveTo(activeAnchor.x, activeAnchor.y);
      ctx.lineTo(activeAnchor.cp1.x, activeAnchor.cp1.y);
      ctx.stroke();

      if (hoverCp === 1) {
        ctx.strokeStyle = options.hoverAnchorColor;
        ctx.fillStyle = options.hoverAnchorColor;
      }
      ctx.lineWidth = 2 / data.scale;
      ctx.beginPath();
      ctx.arc(activeAnchor.cp1.x, activeAnchor.cp1.y, 3 / data.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    if (activeAnchor.cp2) {
      ctx.strokeStyle = pSBC(0.2, options.activeColor);
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = 1 / data.scale;
      ctx.beginPath();
      ctx.moveTo(activeAnchor.x, activeAnchor.y);
      ctx.lineTo(activeAnchor.cp2.x, activeAnchor.cp2.y);
      ctx.stroke();

      if (hoverCp === 2) {
        ctx.strokeStyle = options.hoverAnchorColor;
        ctx.fillStyle = options.hoverAnchorColor;
      }
      ctx.lineWidth = 2 / data.scale;
      ctx.beginPath();
      ctx.arc(activeAnchor.cp2.x, activeAnchor.cp2.y, 3 / data.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }
  }

  // 绘画连线锚点
  ctx.lineWidth = 2 / data.scale;
  ctx.strokeStyle = options.activeColor;
  ctx.fillStyle = '#ffffff';
  for (const anchor of activeLine.anchors) {
    if (anchor.visible === false || anchor.disabled) {
      continue;
    }
    if (anchor.id === hoverAnchor?.id && !hoverCp) {
      ctx.save();
      ctx.fillStyle = options.hoverAnchorColor;
      ctx.strokeStyle = options.hoverAnchorColor;
    } else if (anchor.id === activeAnchor?.id) {
      ctx.save();
      ctx.fillStyle = options.activeColor;
      ctx.strokeStyle = options.activeColor;
    }
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 3 / data.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    if (anchor.id === activeAnchor?.id || anchor.id === hoverAnchor?.id) {
      ctx.restore();
    }
  }

  ctx.restore();
}

function renderController() {
  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = options.activeBoxColor;

  const center = {
    x: activeBoundary.x + activeBoundary.width / 2,
    y: activeBoundary.y + activeBoundary.height / 2,
  };
  const pivot = activeBoundary.pivot || center;
  if (activeBoundary.rotate) {
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate((activeBoundary.rotate * Math.PI) / 180);
    ctx.translate(-pivot.x, -pivot.y);
  }

  // 绘画边界盒子
  ctx.strokeRect(activeBoundary.x, activeBoundary.y, activeBoundary.width, activeBoundary.height);

  // 检查是否所有选中的图元都被锁定，框选会过滤掉锁定图元
  const allLocked = activePens?.every((pen) => pen.locked);

  ctx.fillStyle = '#ffffff';
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  // 绘画大小控制点
  let disableSize = options.disableSize || allLocked;
  if (activePens.length === 1 && activePens[0].type === 'text' && activePens[0].textAutoSize) {
    disableSize = true;
  }
  if (!disableSize) {
    sizeCPs.forEach((pt) => {
      ctx.beginPath();
      ctx.fillRect(pt.x - 3.5 / data.scale, pt.y - 3.5 / data.scale, 7 / data.scale, 7 / data.scale);
      ctx.strokeRect(pt.x - 4 / data.scale, pt.y - 4 / data.scale, 8 / data.scale, 8 / data.scale);
    });
  }

  // 绘画旋转支点（locked 或禁用旋转的图元不显示）
  if (options.editPivot && !allLocked) {
    if (!activeBoundary.pivot) {
      activeBoundary.pivot = {
        x: activeBoundary.x + activeBoundary.width / 2,
        y: activeBoundary.y + activeBoundary.height / 2,
      };
    }
    ctx.beginPath();
    ctx.fillStyle = options.anchorColor;
    ctx.arc(activeBoundary.pivot.x, activeBoundary.pivot.y, 3 / data.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderHoverRect() {
  ctx.save();
  ctx.strokeStyle = options.hoverBoxColor;
  ctx.lineWidth = 0.5;

  const center = {
    x: hoverBoundary.x + hoverBoundary.width / 2,
    y: hoverBoundary.y + hoverBoundary.height / 2,
  };
  const pivot = hoverBoundary.pivot || center;
  if (hoverBoundary.rotate) {
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate((hoverBoundary.rotate * Math.PI) / 180);
    ctx.translate(-pivot.x, -pivot.y);
  }

  ctx.beginPath();
  ctx.rect(hoverBoundary.x - 1.5, hoverBoundary.y - 1.5, hoverBoundary.width + 2, hoverBoundary.height + 2);
  ctx.stroke();

  ctx.restore();
}

function renderHoverLine() {
  ctx.save();
  ctx.translate(-0.5, -0.5);

  ctx.strokeStyle = rgba(options.hoverBoxColor, 0.3);
  ctx.lineWidth = (hover.lineWidth + 3) / data.scale;

  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 15;
  penDraws[hover.type](ctx, hover);

  ctx.restore();
}

function renderHoverAnchors() {
  ctx.save();
  // 与主渲染保持相同的“先翻转、后旋转”变换顺序，保证锚点和图形边缘重合。
  if (hover.flipX || hover.flipY) {
    flipRender(ctx, hover);
  }
  if (hover.rotate) {
    rotateRender(ctx, hover);
  }

  const found = activePens?.findIndex((item) => item.id === hover.id);
  if (found > -1 && !editingAnchor) {
    if (hoverAnchor) {
      ctx.strokeStyle = options.hoverAnchorColor;
      ctx.fillStyle = options.hoverAnchorColor;
      ctx.beginPath();
      let size = (hoverAnchor.radius || options.anchorRadius) / data.scale;
      ctx.arc(hoverAnchor.x, hoverAnchor.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  ctx.lineWidth = 1 / data.scale;
  ctx.strokeStyle = options.anchorColor;
  ctx.fillStyle = options.anchorBackground;

  const anchors = hover.disableAnchor ? [] : hover.anchors || [];
  anchors.forEach((anchor) => {
    if (anchor.visible === false || anchor.disabled) {
      return;
    }

    if (hoverAnchor && anchor.id === hoverAnchor.id) {
      return;
    }

    if (ctx.strokeStyle !== options.anchorColor) {
      ctx.strokeStyle = options.anchorColor;
      ctx.fillStyle = options.anchorBackground;
    }

    ctx.beginPath();
    let size = (anchor.radius || options.anchorRadius) / data.scale;
    ctx.arc(anchor.x, anchor.y, size, 0, Math.PI * 2);

    ctx.fill();
    ctx.stroke();
  });

  if (hoverAnchor) {
    ctx.strokeStyle = options.hoverAnchorColor;
    ctx.fillStyle = options.hoverAnchorColor;
    ctx.beginPath();
    let size = (hoverAnchor.radius || options.anchorRadius) / data.scale;
    ctx.arc(hoverAnchor.x, hoverAnchor.y, size, 0, Math.PI * 2);

    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();

  const deletingAnchor = hoverAnchor?.id && hover.anchors?.some((anchor) => anchor.id === hoverAnchor.id);
  if (editingAnchor && !deletingAnchor) {
    // 预览点使用画布坐标，不参与图元旋转和翻转，确保始终紧跟鼠标位置。
    ctx.save();
    ctx.lineWidth = 1 / data.scale;
    ctx.strokeStyle = options.anchorColor;
    ctx.fillStyle = options.anchorBackground;
    ctx.beginPath();
    const size = (editingAnchor.radius || options.anchorRadius) / data.scale;
    ctx.arc(editingAnchor.x, editingAnchor.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function renderSelectRect() {
  ctx.save();
  ctx.fillStyle = rgba(options.dragSelectionColor, 0.2);
  ctx.strokeStyle = options.dragSelectionColor;
  ctx.beginPath();
  ctx.strokeRect(selectRect.x, selectRect.y, selectRect.width, selectRect.height);
  ctx.fillRect(selectRect.x, selectRect.y, selectRect.width, selectRect.height);
  ctx.restore();
}

function renderDockRect() {
  if (!dockRect.width) {
    dockRect.width = dockRect.ex - dockRect.x;
    dockRect.height = dockRect.ey - dockRect.y;
  }

  ctx.save();
  if (dockRect.rotate) {
    ctx.translate(dockRect.pivot.x, dockRect.pivot.y);
    ctx.rotate((dockRect.rotate * Math.PI) / 180);
    ctx.translate(-dockRect.pivot.x, -dockRect.pivot.y);
  }

  ctx.fillStyle = options.dockColor;
  ctx.beginPath();
  ctx.fillRect(dockRect.x, dockRect.y, dockRect.width, dockRect.height);
  ctx.restore();
}

function getDrawingLineTo(prev: Point, curr: Point) {
  let pts: Point[] = [];
  // mind 与 curve 共用路径绘制逻辑，交互阶段同样需要保留当前终点。
  if (drawingLine.type === 'line' || drawingLine.type === 'curve' || drawingLine.type === 'mind') {
    curr.id = s8();
    pts.push(curr);
    return pts;
  }

  if (drawingLine.type === 'orthogonal') {
    return getOrthogonalPoint(prev, curr);
  }

  return pts;
}

function onTextInputting(e: MessageEvent) {
  textInputting = e.data.textInputting;
  render();
}

function onMagnifier(e: MessageEvent) {
  if (e.data.clear) {
    render();
    return;
  }

  const { x, y, radius, imageBitmap } = e.data;
  render();
  const realRadius = radius / data.scale;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, realRadius, 0, 2 * Math.PI);
  ctx.clip();

  ctx.beginPath();
  ctx.arc(x, y, realRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgb(200, 200, 200)';
  ctx.lineWidth = 5 / data.scale;
  ctx.fillStyle = data.background || '#fff';
  ctx.fill();
  ctx.stroke();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, x - realRadius, y - realRadius, realRadius * 2, realRadius * 2);
  ctx.restore();
  imageBitmap.close?.();
}

/**
 * 画线过程中换线型（主线程空格键）：整条线按用户点过的拐点、用新线型重算，末段跟到当前鼠标。
 * 正交线自动补的拐点不在 drawingClicks 里 ⇒ 切回直线 / 曲线时它们自然消失，还原成原来的折线。
 */
function onSwitchDrawingLineType(e: MessageEvent) {
  if (!drawingLine || !drawingClicks?.length) {
    return;
  }
  drawingLine.type = e.data.lineType;

  const anchors: Point[] = [];
  const first = drawingClicks[0];
  anchors.push({ ...first, id: first.id || s8(), cp1: undefined, cp2: undefined });
  for (let i = 1; i < drawingClicks.length; i++) {
    const pt: Point = { ...drawingClicks[i], cp1: undefined, cp2: undefined };
    anchors.push(...getDrawingLineTo(anchors[anchors.length - 1], pt));
  }
  // 末段：跟到当前鼠标位置的临时点，与 onDrawingLine 的临时点同一形状
  if (e.data.point) {
    const to: Point = { ...e.data.point, temp: true };
    const tail = getDrawingLineTo(anchors[anchors.length - 1], to);
    for (const pt of tail) {
      pt.temp = true;
    }
    anchors.push(...tail);
  }

  if (drawingLine.type === 'orthogonal') {
    drawingLine.anchors = simplifyOrthogonalPoints(anchors);
  } else if (drawingLine.type === 'mind') {
    drawingLine.anchors = anchors.length > 1 ? [anchors[0], anchors[anchors.length - 1]] : anchors;
    updateMindControlPoints(drawingLine, drawingLine.anchors[0]?.host);
    drawingClicks = drawingLine.anchors.filter((point) => !point.temp);
  } else {
    drawingLine.anchors = anchors;
  }
  activeAnchor = drawingLine.anchors.filter((pt) => !pt.temp).pop();
  clearLinePathCache(drawingLine);
  render();
}

function onEsc(e: MessageEvent) {
  draggingPens = undefined;

  if (dragLine?.id) {
    activeLine = dragLine;

    self.postMessage({
      action: WorkerMessage.DrawingLine,
      pen: activeLine,
      rollback: true,
    });
  } else {
    activeLine = undefined;
  }

  drawingLine = undefined;
  drawingClicks = undefined;
  lineTexts = undefined;
  dragAnchorType = undefined;
  dragLine = undefined;
  activeAnchor = undefined;

  render();
}

function clipRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
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

function renderImage(ctx: CanvasRenderingContext2D, pen: Pen, image: CanvasImageSource) {
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

export function renderIcon(ctx: CanvasRenderingContext2D, pen: Pen) {
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

function renderText(ctx: CanvasRenderingContext2D, pen: Pen) {
  if (!pen.textLines?.length) {
    return;
  }

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

  // 绘画文字
  let fill: string;
  if (pen.disabled) {
    fill = pen.disabledTextColor || pen.disabledColor || pSBC(0.4, pen.textColor || data.textColor || data.color);
  } else if (pen.textActiveColor) {
    fill = pen.textActiveColor;
  }

  let gradient: CanvasGradient;
  if (!fill) {
    if (pen.textGradient) {
      gradient = createTextGradient(ctx, pen);
    } else {
      fill = pen.textColor || data.textColor || data.color || options.color;
    }
  }
  ctx.fillStyle = fill || gradient;

  ctx.strokeStyle = pen.textDecorationColor || fill;
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

function renderSnap() {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = options.activeColor;
  ctx.setLineDash([6, 3]);
  if (snap.xLine) {
    ctx.beginPath();
    ctx.moveTo(snap.xLine.x, snap.xLine.y);
    ctx.lineTo(snap.xLine.ex, snap.xLine.ey);
    ctx.stroke();
  }
  if (snap.yLine) {
    ctx.beginPath();
    ctx.moveTo(snap.yLine.x, snap.yLine.y);
    ctx.lineTo(snap.yLine.ex, snap.yLine.ey);
    ctx.stroke();
  }
  ctx.restore();
}

function onDestory(e: MessageEvent) {
  ctx = null;
  data = null;
  hover = null;
  self.close();
}
