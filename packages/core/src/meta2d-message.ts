import { WorkerMessage, AnchorMode, HoverType, Mode, PlayState, InteractionMode } from './types';
import { ResizeCursors, RotateCursors } from './const';
import { clearSvgCache, loadSvgAsImageBitmap } from './workers/utility/svg';
import { Meta2d } from './meta2d';
import { restoreDrawingLineType } from './meta2d-keyevent';
import {
  afterUpdateFns,
  BackgroundType,
  calcLineRect,
  connectLine,
  reconnectLine,
  dealData,
  destroyFns,
  dragoverFns,
  mouseEnterFns,
  mouseLeaveFns,
  EventType,
  patchClone,
  PatchFlag,
  Pen,
  PenCategory,
  planAppendToParent,
  Point,
  Rect,
  getAllChildren,
  updateConnectedLine,
} from './models';
import { s8, setter } from './utils';
import { fetchImage } from './workers/utility/image';
import { DragAnchorType } from './workers/hover/const';
import { dispatchEvent } from './meta2d-event';
import { applyCollaboratePatch, onCollaborateCallback } from './workers/utility/collaborate';
import { probe } from './perf/probe';

const SVG_MAX_SIDE = 8192;

/** 将补丁写回主线程图元，undefined 表示删除该可选属性而不是保留空键。 */
function applyPenPatch(pen: Pen, patch: Pen) {
  const target = pen as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) {
      delete target[key];
    } else {
      target[key] = value;
    }
  }
}

export const messageFns: { [key: number]: Function } = {
  [WorkerMessage.SetConnections]: onRequestVars,
  [WorkerMessage.RegisterPen]: onRegisterPen,
  [WorkerMessage.UpdateView]: onUpdateView,
  [WorkerMessage.DragOver]: onDragOver,
  [WorkerMessage.DragPens]: onDragPens,
  [WorkerMessage.Pick]: onPick,
  [WorkerMessage.PickAnchor]: onPickAnchor,
  [WorkerMessage.PickSize]: onPickSize,
  [WorkerMessage.PickRotate]: onPickRotate,
  [WorkerMessage.PickLinePosition]: onPickLinePosition,
  [WorkerMessage.Active]: onActive,
  [WorkerMessage.Patch]: onPatch,
  [WorkerMessage.ImageFetched]: onImageFetched,
  [WorkerMessage.CalcPenBoundary]: onCalcPenBoundary,
  [WorkerMessage.TextOutside]: onTextOutsize,
  [WorkerMessage.TextAutoSize]: onTextAutoSize,
  [WorkerMessage.DrawingLine]: onDrawingLine,
  [WorkerMessage.MessageCallback]: onMessageCallback,
  [WorkerMessage.ToPng]: onToPng,
  [WorkerMessage.Magnifier]: onMagnifier,
  [WorkerMessage.RenderAnimation]: onRenderAnimation,
  [WorkerMessage.UpdateAnimationElement]: onUpdateAnimationElement,
  [WorkerMessage.NextAnimation]: onNextAnimation,
  [WorkerMessage.PerfReport]: onPerfReport,
  [WorkerMessage.ViewRendered]: onViewRendered,
  [WorkerMessage.PatchRendered]: onPatchRendered,
  [WorkerMessage.DataChunkDone]: onDataChunkDone,
  [WorkerMessage.AnimRendered]: onAnimRendered,
};

/** 性能探针回传的等待者，由 meta2d.getPerfReport() 注册 */
export const perfWaiters = new Map<string, (report: any) => void>();

function onRequestVars(this: Meta2d, e: MessageEvent) {
  const { requestId, keys } = e.data;
  if (typeof requestId !== 'string' || (!requestId.startsWith('iot:') && !requestId.startsWith('sql:'))) return;
  this.utilityWorker.postMessage({
    action: WorkerMessage.SetConnections,
    requestId,
    vars: this.getCommunicationVars(keys),
  });
}

function onPerfReport(this: Meta2d, e: MessageEvent) {
  const fn = perfWaiters.get(e.data.reportId);
  if (fn) {
    perfWaiters.delete(e.data.reportId);
    fn(e.data.report);
  }
}

function onRegisterPen(this: Meta2d, e: MessageEvent) {
  this.execCreateFns();

  // 注册了新图元，需要重绘
  // this.calcWorker.postMessage({
  //   action: WorkerMessage.Data,
  //   data: this.data,
  //   canvasWidth: this.renderCanvas.clientWidth,
  //   canvasHeight: this.renderCanvas.clientHeight,
  // });
  // 改用了Resize，避免多人协作 data.pens没更新问题
  this.calcWorker.postMessage({
    action: WorkerMessage.Resize,
    canvasWidth: this.renderCanvas.clientWidth,
    canvasHeight: this.renderCanvas.clientHeight,
  });
}

/**
 * 视口背压（Phase 1.2）。
 *
 * calc 每帧发一条视口，render 画得比这慢时队列只增不减，画面会落后好几秒（设计文档 §0.5-H2）。
 *
 * 队列本身不可检查，worker 无法知道自己后面还排着多少条；所以把闸门放在**发送方**：
 * render 每画完一条回一个 `ViewRendered`，主线程在收到回执前只保留**最新的一条**待发，
 * 中间那些注定过期的视口在发出之前就被丢弃。
 *
 * ⚠ 这**不减少**任何工作量，只是把「积压」换成「丢帧」；减少每条视口成本的是 M7/M8。
 */
function postView(this: Meta2d, payload: any) {
  if (this.viewInFlight) {
    // 只留最新的一条：旧的那条还没发出去就已经过期了，没有任何理由再发
    // 第 4.8 步：记一笔被替换掉的条数，好让 calc 的回话数配平
    //（第十五轮 calc 回 317 条、render 只收到 143 条，差的 174 条就在这里）
    probe.count('view:dropped');
    // 被替换掉的那条要求整屏重画（内容变了），替它的这条也得重画，否则那次内容变化就丢了
    this.pendingView?.repaint && (payload.repaint = true);
    this.pendingView = payload;
    return;
  }
  this.viewInFlight = true;
  // `Date.now()` 跨线程可比：calc 的 `sentAt` + 这里的 `postedAt` 供 render 把一圈往返切成三截（结论 29）。
  payload.postedAt = Date.now();
  this.renderWorker.postMessage(payload);
}

/**
 * 收到回执就补发攒着的那条视口。`main:ackWait` / `view:pending` / `view:starved` 区分
 * 「主线程被别的消息堵住」和「在空等 calc 的下一条」（设计文档结论 29 / 30）。
 */
function onViewRendered(this: Meta2d, e?: MessageEvent) {
  // render 画完一条视口（open 之后的第一条就是首屏）。pens = 这一条画了几个图元
  e?.data && this.emitter.emit('viewRendered', { pens: e.data.pens });
  if (probe.on && e?.data?.sentAt) {
    // 回执从 render 发出到主线程真正处理它，中间隔了多久 = 回执在主线程队列里的等待
    probe.sample('main:ackWait', Date.now() - e.data.sentAt);
  }
  this.viewInFlight = false;
  if (this.pendingView) {
    const payload = this.pendingView;
    this.pendingView = undefined;
    probe.count('view:pending');
    postView.call(this, payload);
  } else {
    // 回执到了但手上没有待发的视口 —— 下一条要等 calc 回话
    probe.count('view:starved');
  }
}

async function onUpdateView(this: Meta2d, e: MessageEvent) {
  if (e.data.resizeId && e.data.resizeId !== this.resizeId) {
    return;
  }

  // 第五十七轮（只量不改行为）：`main:handle:5` 拆成三段 —— 转发给 render（出站克隆，被背压留下的那条不付）、
  // 视口 Set 镜像、loadImages（再建一个 Set + 扫 penMap）。后两段每条都付，包括随后被丢掉的。
  let t = probe.now();
  postView.call(this, {
    action: WorkerMessage.UpdateView,
    data: { ...this.data, pens: [] },
    penIds: e.data.penIds,
    width: e.data.width,
    height: e.data.height,
    // calc 发出这一条的时刻（由 calc 盖章）—— 和下面 `postedAt` 一起量 calc→主线程那一截。
    // ⚠ 注意 `data` 是**此刻**的 `this.data` 快照，不是 calc 算这一条时的视口：
    // 第十四轮 42% 的投递视口一动没动，怀疑就出在这个时间差上（§0.5-H18 ⑥）。
    calcSentAt: e.data.sentAt,
    // 内容变了、render 必须整屏重画（见 calc onDataChunk）
    repaint: e.data.repaint,
  });
  probe.time('main:view:post', t);
  // 分批打开：这是这次 open 的首屏视口 ⇒ 首屏已排在 render 队列里，开始补视口外的后批
  // （放在 postView 之后：后批排在首屏后面，不拖首屏）
  e.data.loadSeq != undefined && this.startProgressiveLoad(e.data.loadSeq);

  if (e.data.resizeId) {
    this.emitter.emit('resizeView', {
      resizeId: e.data.resizeId,
      width: e.data.width,
      height: e.data.height,
    });
  }

  // if (this.options.mode) {
  // 同时维护 Set 镜像（惰性，第一次查询时才建），供 setElementStyle / snapToPen 做 O(1) 成员判定
  t = probe.now();
  this.setInViewPenIds(e.data.penIds);
  probe.time('main:view:set', t);
  // }

  t = probe.now();
  // 只看 calc 挑出来的带图片图元；老 calc（没有这个字段）退回全量
  loadImages.call(this, e.data.imagePenIds ?? e.data.penIds);
  probe.time('main:view:images', t);
}

export async function loadImages(this: Meta2d, inViewIds: string[]) {
  // 判断是否需要加载图形
  const images = new Set<string>();
  const imagePens: Pen[] = [];

  const imageMap = {};
  const svgPens: Pen[] = [];
  const svgImages: {
    [key: string]: {
      size: number;
      pens: Pen[];
    };
  } = {};
  const imageStates = this.imageStates as Record<string, boolean | number>;

  const gifs = new Set<string>();
  const gifPens: Pen[] = [];
  const cachedGifPens: Pen[] = [];

  // 第五十七轮：给了 id 列表就直接按 id 查 penMap，不再「建一个 1.37 万项的 Set + 扫全部图元」——
  // 平移时每条视口都走这里，那一建一扫是 `main:view:images` 的主要成本（`main:handle:5` 的 27%）。
  // 调用方传进来的可能是视口集合（onUpdateView），也可能是待加载列表（addPens），两者都是不重复的 id。
  const visit = (pen: Pen) => {
    // 先做最便宜的过滤：本函数只关心带图片的图元，无图场景到此即退
    if (!pen?.image) {
      return;
    }

    // 图元类型不会随图片地址自动变化，SVG 必须优先走主线程栅格化，不能交给动图解码器。
    if (isSvgImage(pen.image)) {
      const size = getSvgBitmapSize.call(this, pen);
      if (!svgImages[pen.image]) {
        svgImages[pen.image] = {
          size,
          pens: [],
        };
      } else {
        svgImages[pen.image].size = Math.max(svgImages[pen.image].size, size);
      }
      // 先只记原图元，克隆推迟到确定这个 URL 要（重新）栅格化之后：
      // 已加载够大的 URL（平移时几乎全是）原来每条视口都给每个 SVG 图元 patchClone 一份再整批丢掉
      svgImages[pen.image].pens.push(pen);
    } else if (pen.type === 'gif') {
      if (pen.autoPlay) {
        pen.play = PlayState.Playing;
      }
      const gifPen = patchClone(pen, { image: pen.image, play: pen.play });
      if (this.imageStates[pen.image]) {
        // GIF 帧按 URL 复用，但播放器按图元 ID 保存。资源命中缓存时仍要为新进入视口的实例初始化播放器。
        if (this.gifPlayerImages.get(pen.id) !== pen.image) {
          this.gifPlayerImages.set(pen.id, pen.image);
          cachedGifPens.push(gifPen);
        }
        return;
      }
      let loadingPens = this.gifLoadingPens.get(pen.image);
      const shouldFetch = !loadingPens;
      if (!loadingPens) {
        loadingPens = new Map<string, Pen>();
        this.gifLoadingPens.set(pen.image, loadingPens);
        gifs.add(pen.image);
      }
      // 下载期间可能有同 URL 的其他图元进入视口，成功后需要一起创建播放器。
      loadingPens.set(pen.id, gifPen);
      if (shouldFetch) {
        gifPens.push(gifPen);
      }
    } else {
      if (this.imageStates[pen.image]) {
        return;
      }
      images.add(pen.image);
      if (pen.backgrounds) {
        for (const bk of pen.backgrounds) {
          if (bk.type === BackgroundType.Image && bk.image) {
            images.add(bk.image);
          }
        }
      }
      imagePens.push(patchClone(pen, { image: pen.image }));
    }
  };

  if (inViewIds) {
    for (const id of inViewIds) {
      visit(this.penMap.get(id));
    }
  } else {
    for (const [, pen] of this.penMap) {
      visit(pen);
    }
  }

  // 克隆必须在第一个 await 之前做完：原来是边收集边克隆，拿到的是此刻的图元状态
  // 「已加载」和「正在加载」的尺寸都要比：缩放时同一个 URL 会有好几个尺寸同时在飞，
  // 只比已加载的话，小图晚回来就把清晰的位图盖回模糊的。
  const svgLoading = this.svgLoading;
  for (const url in svgImages) {
    const item = svgImages[url];
    const loadedSize = imageStates[url];
    const have = Math.max(typeof loadedSize === 'number' ? loadedSize : 0, svgLoading.get(url) || 0);
    if (have >= item.size) {
      delete svgImages[url];
      continue;
    }
    svgLoading.set(url, item.size);
    item.pens = item.pens.map((pen) => patchClone(pen, { image: pen.image }));
  }

  for (const url in svgImages) {
    const item = svgImages[url];

    let imageBitmap: ImageBitmap;
    try {
      imageBitmap = await loadSvgAsImageBitmap(url, item.size);
    } catch (error) {
      console.error('下载或解析SVG错误:', url, error);
      continue;
    } finally {
      // 只清自己那一档；更大的请求已经接手的话不要清掉它
      svgLoading.get(url) === item.size && svgLoading.delete(url);
    }
    const loadedSize = imageStates[url];
    if (typeof loadedSize === 'number' && loadedSize >= item.size) {
      // 等待期间更大的已经先落地了 —— 这张更小，扔掉
      imageBitmap.close?.();
      continue;
    }
    imageMap[url] = imageBitmap;
    svgPens.push(...item.pens);
    imageStates[url] = item.size;
  }

  (imagePens.length || gifPens.length) &&
    this.utilityWorker.postMessage({
      action: WorkerMessage.FetchImage,
      images: Array.from(images),
      imagePens,
      gifs: Array.from(gifs),
      gifPens,
    });

  if (cachedGifPens.length) {
    // render Worker 已持有该 URL 的帧，只补建图元播放器；calc Worker 同步补齐动画局部重绘边界。
    this.renderWorker.postMessage({
      action: WorkerMessage.GifFetched,
      gifPens: cachedGifPens,
    });
    this.calcWorker.postMessage({ action: WorkerMessage.CalcPenBoundary, pens: cachedGifPens, render: true });
  }

  noticeDrawImages.call(this, imageMap, svgPens);
  clearSvgCache(svgPens);
}

export async function loadDragImages(this: Meta2d, pens: Pen[]) {
  // 判断是否需要加载图形
  const images = new Set<string>();

  const imageMap = {};
  const imageBitmaps = [];
  // 第五十八轮：dragPens 每个 mousemove 都调这里，原来没有任何缓存 ⇒ 拖着图片时每一步都重新请求、
  // 重新解码一遍（用户：拖拽图片过程中不断重复请求图片）。按 URL 记下 hover 已有（或正在要）的尺寸，
  // 非 SVG 记 Infinity（只要一次）；SVG 仍按当前缩放要，更大时才重新栅格化。
  const hoverSizes = this.hoverImageSizes;

  for (const pen of pens) {
    if (!pen.image || images.has(pen.image)) {
      continue;
    }
    images.add(pen.image);
    const svg = isSvgImage(pen.image);
    const size = svg ? getSvgBitmapSize.call(this, pen) : Infinity;
    if ((hoverSizes.get(pen.image) || 0) >= size) {
      continue;
    }
    const prev = hoverSizes.get(pen.image);
    hoverSizes.set(pen.image, size);
    let imageBitmap: ImageBitmap;
    try {
      if (svg) {
        imageBitmap = await loadSvgAsImageBitmap(pen.image, size);
      } else {
        imageBitmap = await fetchImage(pen.image);
      }
    } catch (error) {
      console.error('下载或解析拖拽图片错误:', pen.image, error);
      // 失败了退回原来的尺寸，下次还会再试
      hoverSizes.get(pen.image) === size && (prev ? hoverSizes.set(pen.image, prev) : hoverSizes.delete(pen.image));
      continue;
    }
    if (!imageBitmap) {
      hoverSizes.get(pen.image) === size && (prev ? hoverSizes.set(pen.image, prev) : hoverSizes.delete(pen.image));
      continue;
    }
    if (hoverSizes.get(pen.image) !== size) {
      // 等待期间有更大的请求接手了 —— 这张更小，不发
      continue;
    }
    imageMap[pen.image] = imageBitmap;
    imageBitmaps.push(imageBitmap);
  }

  if (!imageBitmaps.length) {
    return;
  }

  this.hoverWorker.postMessage(
    {
      action: WorkerMessage.ImageFetched,
      imageMap,
    },
    imageBitmaps,
  );
}

function isSvgImage(url: string) {
  return /\.svg(?:[?#]|$)/i.test(url) || /^data:image\/svg\+xml[;,]/i.test(url);
}

function getSvgBitmapSize(this: Meta2d, pen: Pen) {
  const scale = this.data?.scale || 1;
  const dpr = this.dpr || 1;
  const side = Math.max(pen.width || 1, pen.height || 1) * scale * dpr;

  return Math.min(SVG_MAX_SIDE, nextPowerOfTwo(Math.ceil(side)));
}

function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) {
    size *= 2;
  }

  return size;
}

function onDragOver(this: Meta2d, e: MessageEvent) {
  this.dropPen = e.data.pen;
  let rect: Rect;
  if (this.dropPen) {
    if (dragoverFns[this.dropPen.type]) {
      rect = dragoverFns[this.dropPen.type](this.dropPen, e.data.x, e.data.y);
    } else {
      rect = this.dropPen.container;
    }

    rect.rotate = this.dropPen.rotate;
    rect.pivot = this.dropPen.pivot;
  }

  this.hoverWorker.postMessage({
    action: WorkerMessage.DragOver,
    rect,
  });

  if (!this.options.mode || this.options.mode === Mode.Edit) {
    delete e.data.pen?.container;
    this.hover = e.data.pen;
    this.hoverBoundary = rect;
    this.hoverCp = undefined;
  }
}

function onDragPens(this: Meta2d, e: MessageEvent) {
  if (e.data.pens) {
    // ⚠ 截图 14：render 的这份回复（拖动开始时 sync 请求的完整图元）在它忙时可能松手之后才到。
    // 原来照收 ⇒ 松手后 draggingPens 又被设上旧数据 ⇒ 下一次拖动不再发 sync，render 不进拖动状态，
    // 被拖图元一直画在原位置、预览也用上一次的旧数据。只在确实处于拖动状态时才收。
    const dragging = this.interactionStateMachine.state === InteractionMode.CanvasDragPens;
    const firstSync = dragging && !this.draggingPens?.length;
    if (dragging) {
      this.draggingPens = e.data.pens;

      // 首次同步只清理拖动前的旧区域，避免 render Worker 为此整屏重绘。
      // 关联关系可能记录在分组子图元上，因此从完整拖动图元中收集连接线。
      if (firstSync) {
        const affectedPens = [...e.data.pens];
        const affectedIds = new Set(affectedPens.map((pen: Pen) => pen.id));
        for (const pen of e.data.pens as Pen[]) {
          for (const item of pen.connectedLines || []) {
            const line = this.penMap.get(item.penId);
            if (!line) {
              continue;
            }
            if (affectedIds.has(line.id)) {
              continue;
            }
            affectedIds.add(line.id);
            affectedPens.push(line, ...getAllChildren(this.penMap, line));
          }
        }

        this.calcWorker.postMessage({
          action: WorkerMessage.CalcPenBoundary,
          pens: affectedPens,
          render: true,
        });
      }
    }
  }

  if (e.data.elementPens) {
    for (const pen of e.data.elementPens) {
      const elem = this.componentElementMap.get(pen.id);
      this.setElementStyle(elem, pen);
    }
  }

  if (e.data.finish) {
    // 拖拽完成 更新连线
    if (e.data.connectedLines?.length) {
      const beforeUpdate = [];
      const update = [];
      for (const line of e.data.connectedLines) {
        const pen = this.penMap.get(line.id);
        pen && beforeUpdate.push(patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
        update.push(patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
      }
      if (e.data.texts) {
        for (const textPen of e.data.texts) {
          const p = this.penMap.get(textPen.id);
          p && beforeUpdate.push(patchClone(p, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
          update.push(patchClone(textPen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
        }
      }
      this.patch(undefined, undefined, beforeUpdate, update);
    }
  }
}

function onPick(this: Meta2d, e: MessageEvent) {
  this.hoverTopId = e.data.topId;
  if (e.data.topOnly) {
    return;
  }
  const lastHover = this.hover;
  // 鼠标在同一条连线上移动时，calc 每次都重发一条 Pick（带新的 linePoint），但不带 boundary / penIds
  // （只在换了图元时才算）。原来照样把 hoverBoundary 清成 undefined ⇒ hover worker 画悬停效果要求有 boundary，
  // 连线的悬停阴影刚出现就被擦掉，停在线上也不再出现。同一图元时保留原来的区域，进入事件也只在换图元时触发。
  const sameHover = !!lastHover && !!e.data.hover && e.data.hover.id === lastHover.id;
  this.hover = e.data.hover;
  this.hoverLinePoint = e.data.linePoint;
  this.hoverAnchor = undefined;
  this.hoverType = HoverType.None;
  this.hoverBoundary = e.data.boundary ?? (sameHover ? this.hoverBoundary : undefined);
  this.hoverCp = undefined;

  if (lastHover && (!this.hover || this.hover.id !== lastHover.id)) {
    const pen = this.penMap.get(lastHover.id);
    mouseLeaveFns[pen.type] && mouseLeaveFns[pen.type].call(this, pen);
  }
  if (this.options.mode === Mode.Run && lastHover && (!this.hover || this.hover.id !== lastHover.id)) {
    const pen = this.penMap.get(lastHover.id);
    dispatchEvent.call(this, pen, EventType.Leave);
  }

  if (this.hover && sameHover) {
    delete this.hover.container;
  } else if (this.hover) {
    delete this.hover.container;
    if (this.hover.interactive) {
      this.renderWorker.postMessage({
        action: WorkerMessage.Hover,
        hoverId: this.hover.id,
        boundary: e.data.boundary,
        penIds: e.data.penIds,
      });

      if (this.options.anchorMode < AnchorMode.Drawline) {
        this.topElement.style.cursor = 'pointer';
      }
    } else if (lastHover?.interactive) {
      // 从可交互图元移到普通图元时，render Worker 仍保留旧 hoverId，必须显式清除。
      this.renderWorker.postMessage({ action: WorkerMessage.Hover });
    }
    const pen = this.penMap.get(this.hover.id);
    mouseEnterFns[pen.type] && mouseEnterFns[pen.type].call(this, pen);

    if (this.options.mode === Mode.Run) {
      const pen = this.penMap.get(this.hover.id);
      dispatchEvent.call(this, pen, EventType.Enter);
    }
  } else {
    this.renderWorker.postMessage({ action: WorkerMessage.Hover });

    if (this.options.anchorMode < AnchorMode.Drawline) {
      this.topElement.style.cursor = 'default';
    }

    this.hoverType = HoverType.None;
  }

  if (this.options.mode) {
    const message: Record<string, unknown> = {
      action: WorkerMessage.Hover,
      pen: this.hover,
      boundary: this.hoverBoundary,
    };
    if (this.editingAnchor && (!this.hover || this.hover.category === PenCategory.Line)) {
      message.editingAnchor = this.hoverLinePoint || null;
    }
    this.hoverWorker.postMessage(message);
  }

  if (this.editingAnchor) {
    this.topElement.style.cursor =
      this.hover && !this.hover.locked && !this.hover.disableAnchor
        ? this.hover.category === PenCategory.Line
          ? this.hoverLinePoint
            ? 'pointer'
            : 'default'
          : 'pointer'
        : 'default';
  }
}

function onPickAnchor(this: Meta2d, e: MessageEvent) {
  if ('topId' in e.data) {
    this.hoverTopId = e.data.topId;
  }
  this.hoverCp = e.data.cp;
  this.hoverLinePoint = e.data.linePoint;

  const lastHover = this.hover;
  if (e.data.hover && (!this.hover || this.hover.id !== e.data.hover.id)) {
    delete e.data.hover.container;
    this.hover = e.data.hover;
    this.hoverBoundary = e.data.boundary;

    if (e.data.hover.interactive) {
      this.renderWorker.postMessage({
        action: WorkerMessage.Hover,
        hoverId: e.data.hover.id,
        boundary: e.data.boundary,
        penIds: e.data.penIds,
      });
    } else if (lastHover?.interactive) {
      // 锚点命中切换到普通图元时，同样需要清理 render Worker 中的旧 hover 状态。
      this.renderWorker.postMessage({ action: WorkerMessage.Hover });
    }
  }

  if (e.data.anchor) {
    this.hoverType =
      this.hover.category === PenCategory.Line
        ? this.hoverCp
          ? HoverType.LineAnchor + this.hoverCp
          : HoverType.LineAnchor
        : HoverType.NodeAnchor;

    const isExistingAnchor = this.editingAnchor && this.hover.anchors?.some((anchor) => anchor.id === e.data.anchor.id);
    if (isExistingAnchor) {
      this.topElement.style.cursor = 'vertical-text';
    } else if (this.editingAnchor) {
      this.topElement.style.cursor = 'pointer';
    } else if (this.options.anchorMode < AnchorMode.Drawline) {
      // 连线状态
      if (this.hover.category !== PenCategory.Line || this.options.anchorMode & AnchorMode.Drawline) {
        this.topElement.style.cursor = 'crosshair';
      } else if (this.hover.category === PenCategory.Line) {
        // 选中单个连线，然后再选中其锚点时，认为是编辑连线
        if (this.activePens?.length === 1 && this.activePens[0].id === this.hover.id) {
          this.topElement.style.cursor = 'move';
        } else {
          // 进入连线状态
          this.topElement.style.cursor = 'crosshair';
        }
      }
    }

    this.hoverAnchor = isExistingAnchor || !this.editingAnchor ? e.data.anchor : undefined;
    this.hoverWorker.postMessage({
      action: WorkerMessage.PickAnchor,
      pen: e.data.hover,
      anchor: this.hoverAnchor,
      cp: e.data.cp,
      // 普通显示锚点模式只更新 hoverAnchor，必须清空编辑预览点。
      // 否则 edgeFn 生成的点会被 editingAnchor 再绘制一次，离开边界后仍然残留。
      editingAnchor:
        !this.editingAnchor || isExistingAnchor
          ? null
          : this.hover.category === PenCategory.Line
            ? e.data.linePoint
            : e.data.anchor,
    });

    return;
  }

  if (this.hoverAnchor) {
    this.hoverAnchor = undefined;
    this.hoverLinePoint = undefined;
    if (this.editingAnchor) {
      this.topElement.style.cursor =
        this.hover && !this.hover.locked && !this.hover.disableAnchor
          ? this.hover.category === PenCategory.Line
            ? this.hoverLinePoint
              ? 'pointer'
              : 'default'
            : 'pointer'
          : 'default';
    } else if (this.options.anchorMode < AnchorMode.Drawline) {
      this.topElement.style.cursor = 'pointer';
    }
    this.hoverType = HoverType.None;
    this.hoverWorker.postMessage({ action: WorkerMessage.PickAnchor });
  }
}

function onPickSize(this: Meta2d, e: MessageEvent) {
  if (e.data.sizePoint && this.activeBoundary) {
    this.hoverType = HoverType.Resize;
    this.sizeDirection = e.data.sizeDirection;
    this.topElement.style.cursor = getSizeCursor(e.data.sizeDirection, this.activeBoundary.rotate);
  } else if (this.topElement.style.cursor !== 'default') {
    this.topElement.style.cursor = 'default';
    this.hoverType = HoverType.None;
  }
}

function onPickRotate(this: Meta2d, e: MessageEvent) {
  if (e.data.rotatePoint) {
    this.hoverType = HoverType.Rotate;
    this.topElement.style.cursor = getRotateCursor(e.data.rotatePoint.rotate, this.activeBoundary.rotate);
  } else if (this.topElement.style.cursor !== 'default') {
    this.topElement.style.cursor = 'default';
    this.hoverType = HoverType.None;
  }
}

function onPickLinePosition(this: Meta2d, e: MessageEvent) {
  if (!e.data.point) {
    this.textInputting = undefined;
    return;
  }
  // 双击连线进入文本输入状态
  if (this.textInputting) {
    this.textAdd = true;
    // 添加子文字图元作为连线的图元
    const textPen: Pen = {
      id: this.textInputting,
      parentId: e.data.id,
      type: 'text',
      x: e.data.point.x - 25,
      y: e.data.point.y - 10,
      width: 50,
      height: 20,
      text: navigator.language === 'zh-CN' ? '文字' : 'Text',
      textAutoSize: true,
      backgrounds: [{ color: this.options.lineTextBackground }],
      segment: e.data.point.segment,
      position: e.data.point.position,
    };
    dealData([textPen], this.penMap);

    let line = this.penMap.get(e.data.id);
    // 连线文字放进连线块的末尾：置顶 / 置底 / 移动连线时文字跟着走（.docs/pen-layer-order.md §5.7）
    textPen.index = planAppendToParent(this.penMap, line, [textPen]).get(textPen.id) ?? textPen.index;
    if (!line.children) {
      line.children = [];
    }
    line.children.push(textPen.id);
    this.patch([textPen], undefined, [patchClone(line, { children: line.children })], [line]);
    this.enterTextInput(textPen);
    return;
  }
}

function onActive(this: Meta2d, e: MessageEvent) {
  const lastActivePens = this.activePens;

  e.data.boundary && (this.activeBoundary = e.data.boundary);
  e.data.box && (this.activeBoundary.box = e.data.box);

  const activeMap: any = {};
  this.activePens.forEach((pen) => {
    activeMap[pen.id] = 2;
  });

  e.data.penIds.forEach((id: string) => {
    if (activeMap[id]) {
      return;
    }

    activeMap[id] = 0;
  });

  e.data.activeIds.forEach((id: string) => {
    if (activeMap[id]) {
      return;
    }

    activeMap[id] = 1;
  });

  this.renderWorker.postMessage({
    action: WorkerMessage.Active,
    activeMap,
    activeBoundary: this.activeBoundary,
    render: true,
  });

  if (this.options.mode) {
    this.hoverWorker.postMessage({
      action: WorkerMessage.Active,
      activePens: this.activePens,
      activeBoundary: this.activeBoundary,
    });
  }

  this.interactionStateMachine.state = InteractionMode.None;

  if (e.data.boundary && !e.data.update) {
    if (this.options.mode === Mode.Run) {
      for (const pen of this.activePens) {
        dispatchEvent.call(this, pen, EventType.Active);
      }
    }
    this.activePens.forEach((pen) => (pen.active = true));
    this.emitter.emit('active', this.activePens);
  }
}

function onPatch(this: Meta2d, e: MessageEvent) {
  // setValue 队列的批次：回声不带 update，用主线程发出时留的那份（见 Meta2d.patch 的 queued）
  let update: Pen[] = e.data.update;
  if (e.data.queued) {
    update = this.queuedUpdates.get(e.data.seq);
    this.queuedUpdates.delete(e.data.seq);
  }
  // 带序号的回声不带 beforeUpdate（见 Meta2d.patch），index 从主线程自己留的那份取
  let beforeIndexMap: Map<string, number | undefined> = e.data.seq != undefined ? this.patchBeforeIndex.get(e.data.seq) : undefined;
  if (beforeIndexMap) {
    this.patchBeforeIndex.delete(e.data.seq);
  } else {
    beforeIndexMap = new Map<string, number | undefined>(
      (e.data.beforeUpdate || []).map((item: Pen): [string, number | undefined] => [item.id, item.index]),
    );
  }
  // PatchFlag.Index 可能只是计算线程的处理标记，只有层级值真实变化时才刷新图层树。
  const layerUpdated =
    Boolean(e.data.add?.length || e.data.remove?.length) ||
    (update || []).some(
      (item: Pen) => beforeIndexMap.has(item.id) && beforeIndexMap.get(item.id) !== item.index,
    );

  // 更新数据
  if (e.data.remove) {
    for (const item of e.data.remove) {
      this.penMap.delete(item.id);
      this.gifPlayerImages.delete(item.id);

      destroyFns[item.type] && destroyFns[item.type].call(this, item);
    }

    if (this.activePens.length) {
      this.activePens = this.activePens.filter((item) => !e.data.remove.some((item2) => item.id === item2.id));
    }

    this.hover = undefined;
    this.hoverTopId = undefined;
    this.hoverBoundary = undefined;
    this.hoverType = HoverType.None;

    this.hoverWorker.postMessage({
      action: WorkerMessage.Hover,
      // 必须显式带上 pen 字段：hover worker 的 onHover 只在 `'pen' in e.data` 时才换掉手里的 hover。
      // 不带的话被删图元仍攥在 hover worker 里，下次进连线模式（P）会把它的锚点画出来。
      pen: undefined,
    });
  }

  const gifPens = [];
  const svgResized: string[] = [];
  let hoverGeometryChanged = false;
  update?.forEach((item: Pen) => {
    const pen = this.penMap.get(item.id) || this.penMap.get(item.oldId);
    if (!pen) {
      return;
    }
    const pathVals = item.pathVals;
    delete item.pathVals;
    // 过期回声：这个图元在这条 Patch 之后又被主线程发出过更新 ⇒ 主线程手里的更新，不回写
    // （否则连续旋转时会把已经转得更远的图元写回一两步前的角度，见 Meta2d.patch）。
    const stale = e.data.seq != undefined && (this.penPatchSeq.get(item.id) ?? 0) > e.data.seq;
    if (!stale) {
      applyPenPatch(pen, item);
    }
    if (item.anchors && pen.calculative) {
      delete pen.calculative.lineSegments;
      delete pen.calculative.gradientSegments;
    }
    if (
      this.hover?.id === pen.id &&
      (item.anchors || 'lineSmooth' in item || ((item.patchFlag || 0) & PatchFlag.Rect))
    ) {
      // hover 保存的是拾取时的结构化克隆。几何更新后继续使用会在 Hover 画布重绘旧路径，形成残影。
      hoverGeometryChanged = true;
    }
    const activeIndex = this.activePens.findIndex((activePen) => activePen.id === pen.id);
    if (activeIndex >= 0) {
      // 撤销时单选图元会暂时使用历史快照；补丁落地后必须重新绑定 penMap 真实对象。
      // 否则下一次拖拽只会移动快照，连线重算读取到的节点坐标仍停留在撤销位置。
      this.activePens[activeIndex] = pen;
    }
    if (pathVals && !stale) {
      for (const key in pathVals) {
        setter(pen, key, pathVals[key]);
      }
    }
    pen.patchFlag = undefined;

    if (pen.category === PenCategory.HtmlElement) {
      const elem = this.componentElementMap.get(pen.id);
      if (elem && 'isBottom' in item) {
        const target = pen.isBottom ? this.bottomElement : this.topElement;
        if (elem.parentElement !== target) {
          target.appendChild(elem);
        }
      }
      this.setElementStyle(elem, item);
    }
    afterUpdateFns[pen.type] && afterUpdateFns[pen.type].call(this, pen, item);

    if (
      pen.type === 'gif' &&
      pen.image &&
      this.imageStates[pen.image] &&
      (item.x !== undefined || item.y !== undefined || item.width !== undefined || item.height !== undefined)
    ) {
      gifPens.push(pen);
    }
    // 第五十九轮（用户：拖控制点把 SVG 图元拉大后模糊，拖动预览却清晰）：SVG 按「图元边长 × 缩放 × dpr」栅格化，
    // 而这里改了尺寸从来不重新要 ⇒ render 一直拿着拉大前那张 64px 的。loadImages 自己会比已有 / 在飞的尺寸，够大就什么都不做。
    if (pen.image && isSvgImage(pen.image) && (item.width !== undefined || item.height !== undefined)) {
      svgResized.push(pen.id);
    }
  });
  if (hoverGeometryChanged) {
    this.hover = undefined;
    this.hoverTopId = undefined;
    this.hoverLinePoint = undefined;
    this.hoverAnchor = undefined;
    this.hoverBoundary = undefined;
    this.hoverType = HoverType.None;
    this.hoverCp = undefined;
    this.hoverWorker.postMessage({ action: WorkerMessage.Hover, pen: undefined });
    this.renderWorker.postMessage({ action: WorkerMessage.Hover });
  }
  if (e.data.add) {
    for (const pen of e.data.add) {
      pen.patchFlag = undefined;
      this.penMap.set(pen.id, pen);

      if (pen.type === 'gif' && pen.image && this.imageStates[pen.image]) {
        gifPens.push(pen);
      }
    }
  }

  // 更新gif渲染区域
  if (gifPens.length) {
    this.calcWorker.postMessage({ action: WorkerMessage.CalcPenBoundary, pens: gifPens });
  }
  svgResized.length && loadImages.call(this, svgResized);

  // 等主线程 penMap 写入最新层级后再通知界面，避免图层树读取到旧顺序。
  if (layerUpdated) {
    this.emitter.emit('layer');
  }

  // 发送（局部）重绘
  this.renderWorker.postMessage({
    action: WorkerMessage.Patch,
    newPenIds: e.data.newPenIds,
    newBoundary: e.data.newBoundary,
    oldPensIds: e.data.oldPensIds,
    oldBoundary: e.data.oldBoundary,
    // 分块脏区（calc 的 getPenRects）：有它时 render 逐块裁剪，newBoundary 只是外接框
    rects: e.data.rects,
    // 整屏重画（calc 判定改动铺满视口）；fullMoved = 动了几何的图元，可能从视口外挪进来
    full: e.data.full,
    fullMoved: e.data.fullMoved,
    fullChanged: e.data.fullChanged,
    add: e.data.add,
    remove: e.data.remove,
    update,
    // 队列批次：render 画完回 PatchRendered（背压，见 Meta2d.consumePatchQueue）
    ackSeq: e.data.queued ? e.data.seq : undefined,
  });
  this.map?.scheduleRefresh();
}

/** render 画完一批动画 ⇒ 转给 calc，它才发下一批（动画背压，见 calc/animate.ts 的 animInFlight） */
function onAnimRendered(this: Meta2d, e: MessageEvent) {
  this.calcWorker.postMessage(e.data);
}

function onPatchRendered(this: Meta2d, e: MessageEvent) {
  this.onQueuePatchRendered(e.data.seqs);
}

function onDataChunkDone(this: Meta2d, e: MessageEvent) {
  this.onDataChunkDone(e.data.from, e.data.loadSeq);
}

function onImageFetched(this: Meta2d, e: MessageEvent) {
  if (e.data.imageMap && e.data.imagePens?.length) {
    noticeDrawImages.call(this, e.data.imageMap, e.data.imagePens);
  }

  if (e.data.gifMap && e.data.gifPens?.length) {
    noticePlayGif.call(this, e.data.gifMap, e.data.gifPens);
  }

  for (const url of e.data.gifFailed || []) {
    this.gifLoadingPens.delete(url);
  }

  this.map?.scheduleRefresh();
}

function onCalcPenBoundary(this: Meta2d, e: MessageEvent) {
  this.renderWorker.postMessage({
    action: WorkerMessage.CalcPenBoundary,
    boundarys: e.data.boundarys,
    drawingLine: e.data.drawingLine,
    render: e.data.render,
    inputtingPen: e.data.inputtingPen,
  });
}

function onTextOutsize(this: Meta2d, e: MessageEvent) {
  for (const id in e.data.textOutsides) {
    if (e.data.textOutsides[id].x) {
      this.textBoxs[id] = e.data.textOutsides[id];
    } else {
      delete this.textBoxs[id];
    }

    if (!e.data.textOutsides[id]._rect) {
      continue;
    }

    const pen = this.penMap.get(id);
    pen && Object.assign(pen, e.data.textOutsides[id]._rect);
  }
  this.calcWorker.postMessage({
    action: WorkerMessage.TextOutside,
    textBoxs: e.data.textOutsides,
  });
}

function onTextAutoSize(this: Meta2d, e: MessageEvent) {
  if (this.addCaches?.length) {
    const pens: Pen[] = e.data.pens;
    for (const pen of this.addCaches) {
      const p = pens.find((p) => p.id === pen.id);
      p && Object.assign(pen, { x: p.x, y: p.y, width: p.width, height: p.height });
    }

    return;
  }
}

// 连线绘画完成回调消息
async function onDrawingLine(this: Meta2d, e: MessageEvent) {
  // 一条线结束（完成、点数不够被取消、被 beforeConnectLine 拒绝都走这里）⇒ 撤销画线中空格切的线型
  restoreDrawingLineType.call(this);
  const line = e.data.pen;
  if (!line) {
    this.interactionStateMachine.state = InteractionMode.None;
    this.drawingLineFrom = undefined;
    this.drawingLineTo = undefined;
    return;
  }

  const fromPen = this.drawingLineFrom ? this.penMap.get(this.drawingLineFrom.penId) : undefined;
  const toPen = this.drawingLineTo ? this.penMap.get(this.drawingLineTo.penId) : undefined;
  // 生命周期回调传入真实起终点图元，调用方可基于连接双方决定是否允许建立连线。
  if (!e.data.rollback && this.beforeConnectLine && !(await this.beforeConnectLine(line, fromPen, toPen))) {
    this.hoverWorker.postMessage({ action: WorkerMessage.DrawingLine, esc: true });
    this.interactionStateMachine.state = InteractionMode.None;
    this.drawingLineFrom = undefined;
    this.drawingLineTo = undefined;
    return;
  }

  let add: Pen[];
  let beforeUpdate: Pen[];
  let update: Pen[];

  const getLineRect = (): Rect => ({
    x: line.x,
    y: line.y,
    ex: line.ex,
    ey: line.ey,
    width: line.width,
    height: line.height,
  });
  const changedPens = new Map<string, Pen>();
  const beforeChangedPens = new Map<string, Pen>();
  const isNewLine = !line.id;

  /**
   * 根据稳定 ID 从 penMap 获取真实对象并建立连接关系。
   * 使用 Map 合并同一图元的快照，支持起终点落在同一图元上的自环连线。
   */
  const connectByRef = (ref: { penId: string; anchorId: string } | undefined, lineAnchor: Point | undefined) => {
    if (!ref || !lineAnchor || ref.penId === line.id) {
      return;
    }

    const pen = this.penMap.get(ref.penId);
    const anchor = pen?.anchors?.find((item) => item.id === ref.anchorId);
    if (!pen || !anchor) {
      return;
    }

    if (!beforeChangedPens.has(pen.id)) {
      // 必须在首次修改前保留快照，撤销时才能完整恢复 connectedLines。
      beforeChangedPens.set(pen.id, patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
    }
    connectLine(pen, anchor, line, lineAnchor);
    changedPens.set(pen.id, patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
  };

  if (line.id) {
    const beforeUpdateMap = new Map<string, Pen>();
    const recordBeforeUpdate = (pen: Pen) => {
      if (!beforeUpdateMap.has(pen.id)) {
        beforeUpdateMap.set(pen.id, patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
      }
    };
    const storedLine = this.penMap.get(line.id);
    storedLine && recordBeforeUpdate(storedLine);

    const dragAnchorType = e.data.dragAnchorType;
    // 只有明确拖动首端或尾端时才重建连接关系。普通拐点 / 控制点拖动没有端点方向，
    // 不能默认按尾端处理，否则会把尾端的连接关系错误地改写或清除。
    const isDragEndpoint = dragAnchorType === DragAnchorType.From || dragAnchorType === DragAnchorType.To;
    const previousAnchor =
      dragAnchorType === DragAnchorType.From
        ? storedLine?.anchors?.[0]
        : dragAnchorType === DragAnchorType.To
          ? storedLine?.anchors?.at(-1)
          : undefined;
    const lineAnchor =
      dragAnchorType === DragAnchorType.From
        ? line.anchors?.[0]
        : dragAnchorType === DragAnchorType.To
          ? line.anchors?.at(-1)
          : undefined;
    const changedNodes = isDragEndpoint && lineAnchor
      ? reconnectLine(this.penMap, line, lineAnchor, previousAnchor, this.drawingLineTo, recordBeforeUpdate)
      : [];

    beforeUpdate = Array.from(beforeUpdateMap.values());
    update = changedNodes.map((pen) => patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
    update.push(patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));

    if (e.data.texts) {
      for (const textPen of e.data.texts) {
        const p = this.penMap.get(textPen.id);
        p && beforeUpdate.push(patchClone(p, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
        update.push(patchClone(textPen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
      }
    }

    this.setOptions({ anchorMode: AnchorMode.Hidden });
  } else {
    line.id = s8();

    connectByRef(this.drawingLineFrom, line.anchors[0]);
    connectByRef(this.drawingLineTo, line.anchors[line.anchors.length - 1]);
    beforeUpdate = [...beforeChangedPens.values()];
    update = [...changedPens.values()];

    line.index = this.penMap.size;
  }

  // 连接关系落地后再按节点方向生成 mind 控制柄；其他连线沿用 Worker 返回的几何。
  if (line.type === 'mind') {
    updateConnectedLine(line, this.penMap);
  }

  // reconnectLine 可能在 Hover Worker 计算边界后再次改变端点，必须按最终锚点重算。
  const rect = line.anchors?.length >= 2 ? calcLineRect(line) : getLineRect();
  if (isNewLine) {
    add = [Object.assign(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect })];
  }
  this.activeBoundary = rect;
  this.activePens = [line];

  // 添加的data中
  this.patch(add, undefined, beforeUpdate, update);
  this.pushAction({
    add,
    beforeUpdate,
    update,
    beforeBoundary: structuredClone(this.activeBoundary),
    boundary: rect,
  });
  if (this.options.mode && this.collaborate) {
    // 连线与两端图元关系作为同一协作补丁发送，避免远端出现只有线、没有连接关系的中间状态。
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { add, beforeUpdate, update },
    });
  }

  this.interactionStateMachine.state = InteractionMode.None;
  // 本次连线已经完成，清理仅供交互过程使用的起终点引用。
  this.drawingLineFrom = undefined;
  this.drawingLineTo = undefined;

  this.calcWorker.postMessage({
    action: WorkerMessage.Active,
    pens: [line],
  });
}

function noticeDrawImages(this: Meta2d, imageMap: any, pens: Pen[]) {
  const imageBitmaps = [];
  const imageStates = this.imageStates as Record<string, boolean | number>;
  for (const url in imageMap) {
    imageBitmaps.push(imageMap[url]);
    if (typeof imageStates[url] !== 'number') {
      imageStates[url] = true;
    }
  }

  if (!pens || !pens.length) {
    return;
  }

  // 发送图片给渲染线程
  this.renderWorker.postMessage(
    {
      action: WorkerMessage.ImageFetched,
      imageMap,
    },
    imageBitmaps,
  );

  // 发送图片局部渲染区域计算
  this.calcWorker.postMessage({ action: WorkerMessage.ImageFetched, pens });
}

function noticePlayGif(this: Meta2d, gifMap: any, pens: Pen[]) {
  const imageBitmaps = [];
  const pendingPens = new Map<string, Pen>();
  for (const url in gifMap) {
    for (const frame of gifMap[url]) {
      imageBitmaps.push(frame.imageBitmap);
    }
    this.imageStates[url] = true;
    for (const pen of this.gifLoadingPens.get(url)?.values() || []) {
      pendingPens.set(pen.id, pen);
    }
    this.gifLoadingPens.delete(url);
  }

  for (const pen of pens || []) {
    pendingPens.set(pen.id, pen);
  }

  const currentPens: Pen[] = [];
  for (const pen of pendingPens.values()) {
    const current = this.penMap.get(pen.id);
    if (current?.type === 'gif' && current.image === pen.image) {
      this.gifPlayerImages.set(pen.id, pen.image);
      currentPens.push(pen);
    }
  }

  // 发送图片给渲染线程
  currentPens.length &&
    this.renderWorker.postMessage(
      {
        action: WorkerMessage.GifFetched,
        gifMap,
        gifPens: currentPens,
      },
      imageBitmaps,
    );

  // 发送图片局部渲染区域计算
  this.calcWorker.postMessage({ action: WorkerMessage.CalcPenBoundary, pens: currentPens, render: true });
}

function onMessageCallback(this: Meta2d, e: MessageEvent) {
  if (e.data.type === 'collaborater') {
    onCollaborateCallback.call(this, e);
    return;
  }
  // 多人协作实时数据
  if (e.data.patch) {
    if (!applyCollaboratePatch.call(this, e.data.patch)) {
      this.emitter.emit('collaborate', {
        type: 'reload',
        data: { ...e.data, reason: 'invalidPatch' },
      });
      return;
    }

    if (this.activePens?.length) {
      this.calcWorker.postMessage({
        action: WorkerMessage.Active,
        pens: this.activePens,
      });
    }

    delete e.data.action;
    e.data.timestamp = Date.now();
    this.emitter.emit('collaborate', e.data);
    return;
  }

  // 多人协作历史数据
  if (e.data.patchs) {
    for (const item of e.data.patchs) {
      if (!applyCollaboratePatch.call(this, item.patch)) {
        this.emitter.emit('collaborate', {
          type: 'reload',
          data: { ...e.data, reason: 'invalidPatch' },
        });
        return;
      }
    }

    this.emitter.emit('collaborate', e.data.patchs);

    return;
  }

  if (this.options.mode === Mode.Edit) {
    return;
  }

  this.setValue(e.data.values, e.data.options);
}

function onMagnifier(this: Meta2d, e: MessageEvent) {
  const { x, y, imageBitmap, radius } = e.data;
  this.hoverWorker.postMessage(
    {
      action: WorkerMessage.Magnifier,
      x,
      y,
      radius,
      imageBitmap,
    },
    [imageBitmap],
  );
}

function onToPng(this: Meta2d, e: MessageEvent) {
  const callback = e.data.requestId ? this.toPngCallbacks.get(e.data.requestId) : undefined;
  if (e.data.requestId) {
    this.toPngCallbacks.delete(e.data.requestId);
  }
  if (e.data.error) {
    if (callback) {
      callback(new ArrayBuffer(0), e.data.error);
    }
    this.emitter.emit('error', e.data.error);
    return;
  }

  if (callback) {
    callback(e.data.buffer);
    return;
  }

  const blob = new Blob([e.data.buffer], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (this.data.name || 'meta2d') + '.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

/**
 * 动画消息的中转：转发给 render + hover，再回写图元（M4 之后一帧一条 batch）。
 *
 * `main:handle:48` 是整条的总时间，两个
 * `main:fwd:*` 是两次结构化克隆各自的份额，`main:setValue:48` 是回写图元那部分。
 * ⚠ 单次都在 `performance.now()` 的 100µs 分辨率之下 ⇒ **avg 不是单价（D11）**，
 * 只能看 avg × count 的总量。
 */
function onRenderAnimation(this: Meta2d, e: MessageEvent) {
  // M4 第 1 步：一帧合成一条（batch）时，逐条摘下 updatedPens，整批转发一次，再一次性 setValue
  if (e.data.batch) {
    let all: any[] | undefined;
    for (const item of e.data.batch) {
      if (item.updatedPens?.length) {
        (all || (all = [])).push(...item.updatedPens);
      }
      item.updatedPens = undefined;
    }
    const _tR = probe.now();
    this.renderWorker.postMessage(e.data);
    probe.time('main:fwd:render', _tR);
    const _tH = probe.now();
    this.hoverWorker.postMessage(e.data);
    probe.time('main:fwd:hover', _tH);
    if (all?.length) {
      const _tV = probe.now();
      this.setValue(all);
      probe.time('main:setValue:48', _tV);
    }
    return;
  }

  const { updatedPens } = e.data;

  e.data.updatedPens = undefined;
  const _tR = probe.now();
  this.renderWorker.postMessage(e.data);
  probe.time('main:fwd:render', _tR);
  const _tH = probe.now();
  this.hoverWorker.postMessage(e.data);
  probe.time('main:fwd:hover', _tH);

  if (updatedPens?.length) {
    const _tV = probe.now();
    this.setValue(updatedPens);
    probe.time('main:setValue:48', _tV);
  }
}

function onUpdateAnimationElement(this: Meta2d, e: MessageEvent) {
  //更新图元
  const { positions, angles, targetType, target, lineID } = e.data;
  const pens = this.find(target);
  const vals = [];
  pens.forEach((pen, index) => {
    let position = positions[index];
    let angle = angles[index];
    if (positions.length === 1 && index > 0) {
      position = positions[0];
      angle = angles[0];
    }
    const x = position.x - pen.width / 2;
    const y = position.y - pen.height / 2;
    vals.push({ id: pen.id, x, y, pivot: position, rotate: (angle / Math.PI) * 180 });
  });
  this.setValue(vals);
}

function onNextAnimation(this: Meta2d, e: MessageEvent) {
  const { idorTag, currentAnimation } = e.data;
  this.startAnimate(idorTag, { currentAnimation });
}

function getSizeCursor(index: number, rotate = 0) {
  if (!rotate) {
    return ResizeCursors[index];
  }

  // 计算旋转了多少个step（45°）
  const offset = ((Math.round(rotate / 45) % 8) + 8) % 8;
  return ResizeCursors[(index + offset) % 8];
}

function getRotateCursor(index: number, rotate = 0) {
  --index;
  if (!rotate) {
    return RotateCursors[index];
  }

  // 每90°，角落“顺时针”移动一次
  let offset = Math.round(rotate / 90) % 4;
  // 计算实际使用的角落光标
  return RotateCursors[(index + offset) % 4];
}
