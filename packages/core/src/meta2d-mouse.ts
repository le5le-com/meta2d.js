import { probe } from './perf/probe';
import { WorkerMessage, AnchorMode, HoverType, Mode, PlayState, RuleStyle, InteractionMode } from './types';
import { RuleStyleConfigs, RuleGapConfigs, VALID_TRANSITIONS } from './const';
import { Meta2d } from './meta2d';
import { translatePens } from './meta2d-keyevent';
import { loadDragImages } from './meta2d-message';
import { dispatchEvent } from './meta2d-event';
import {
  calcRotate,
  dropFns,
  EventType,
  getAllChildren,
  getAllPens,
  inputFns,
  InputMode,
  isTinyPen,
  makePensId,
  mouseDownFns,
  mouseMoveFns,
  mouseUpFns,
  outermostPens,
  patchClone,
  PatchFlag,
  Pen,
  PenCategory,
  Point,
  pointInRect,
  resizePen,
  resizeRect,
  rotatePoint,
  rotatePen,
  scaleFns,
  translatePen,
  translateRect,
  updateConnectedLines,
  updateLineTextPosition,
  wheelFns,
} from './models';
import { fileToBase64, s8, uploadFile } from './utils';
import { DragAnchorType } from './workers/hover/const';

/**
 * 交互状态机
 * 管理所有状态转换和验证
 */
export class InteractionStateMachine {
  state: InteractionMode = InteractionMode.None;

  canTransition(to: InteractionMode): boolean {
    return VALID_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: InteractionMode): boolean {
    if (this.state === to) {
      return true;
    }

    if (!this.canTransition(to)) {
      console.info(`Invalid transition: ${this.state} -> ${to}`);
      return false;
    }
    this.state = to;
    return true;
  }

  isTouchGesture(): boolean {
    return this.state === InteractionMode.TouchScaling || this.state === InteractionMode.TouchMoving;
  }
}

/**
 * HoverType 处理器
 * 统一管理各 hoverType 的生命周期
 */
export class HoverTypeHandler {
  parent: Meta2d;

  constructor(parent: Meta2d) {
    this.parent = parent;
  }

  onMouseDown(hoverType: HoverType): boolean {
    if (!hoverType) return false;

    switch (hoverType) {
      case HoverType.Rotate:
        return this.handleRotateDown();
      case HoverType.Resize:
        return this.handleResizeDown();
      case HoverType.NodeAnchor:
        return this.handleNodeAnchorDown();
      case HoverType.LineAnchor:
      case HoverType.LineAnchorCp1:
      case HoverType.LineAnchorCp2:
        return this.handleLineAnchorDown();
    }
    return false;
  }

  onMouseMove(hoverType: HoverType): void {
    if (!hoverType) return;

    switch (hoverType) {
      case HoverType.Rotate:
      case HoverType.Resize:
        this.parent.hoverTypeFns[hoverType]?.call(this.parent);
        break;
    }
  }

  onMouseUp(hoverType: HoverType, context: any, point: any, e: MouseEvent): void {
    if (!hoverType) return;

    switch (hoverType) {
      case HoverType.Rotate:
      case HoverType.Resize:
        this.parent.hoverTypeDoneFns[hoverType]?.call(context, point);
        break;
    }
  }

  private handleRotateDown(): boolean {
    if (hasDisableRotatePen(this.parent.activePens)) {
      return true;
    }

    this.parent.beforeBoundary = structuredClone(this.parent.activeBoundary);
    this.parent.lastRotate = this.parent.activeBoundary.rotate || 0;

    if (this.parent.activePens.length > 1) {
      this.parent.rotatePovit = {
        x: this.parent.activeBoundary.x + this.parent.activeBoundary.width / 2,
        y: this.parent.activeBoundary.y + this.parent.activeBoundary.height / 2,
      };
    } else {
      this.parent.rotatePovit = this.parent.activePens[0].pivot ||
        this.parent.activeBoundary.pivot || {
          x: this.parent.activeBoundary.x + this.parent.activeBoundary.width / 2,
          y: this.parent.activeBoundary.y + this.parent.activeBoundary.height / 2,
        };
    }

    this.parent.initRotate = calcRotate(this.parent.mousedown, this.parent.rotatePovit) - this.parent.lastRotate;
    return true;
  }

  private handleResizeDown(): boolean {
    if (hasDisableSizePen(this.parent.activePens)) {
      return true;
    }
    this.parent.beforeBoundary = structuredClone(this.parent.activeBoundary);
    return true;
  }

  private handleNodeAnchorDown(): boolean {
    return startDrawingLineFromHoverAnchor.call(this.parent);
  }

  private handleLineAnchorDown(): boolean {
    if (!this.parent.options.mode) return false;

    this.parent.hoverWorker.postMessage({ action: WorkerMessage.ActiveAnchor, cp: this.parent.hoverCp });
    this.parent.calcWorker.postMessage({ action: WorkerMessage.ActiveAnchor });

    if (this.parent.activePens?.length === 1 && this.parent.activePens[0].id === this.parent.hover.id) {
      const line = this.parent.hover;
      const anchor = this.parent.hoverAnchor;
      // 记录本次手势的源锚点；后续拾取目标图元时 hoverAnchor 会发生变化。
      this.parent.mousedown.lineAnchorId = anchor.id;
      this.parent.mousedown.lineAnchorCp = this.parent.hoverCp;
      // 正交线没连接图元的首尾：当普通锚点拖（端点跟手、相邻锚点跟着调整保持正交，不重画连线、不新增锚点），
      // 见 dragOrthogonalPoint。连着图元的首尾仍走「从这一端重新连线」，这样才能改连到别的图元上。
      const freeOrthogonalEnd =
        line.type === 'orthogonal' &&
        !line.close &&
        !anchor.connectedPen &&
        this.parent.hoverType <= HoverType.LineAnchor &&
        (anchor.id === line.anchors[0].id || anchor.id === line.anchors[line.anchors.length - 1].id);
      // 拖拽连线锚点或锚点控制点
      if (freeOrthogonalEnd) {
        this.parent.interactionStateMachine.transition(InteractionMode.DrawingLineDragAnchorReady);
      } else if (
        !this.parent.hover.close &&
        this.parent.hoverAnchor.id === this.parent.hover.anchors[0].id &&
        this.parent.hoverType <= HoverType.LineAnchor
      ) {
        this.parent.interactionStateMachine.transition(InteractionMode.DrawingLineDragFrom);
      } else if (
        !this.parent.hover.close &&
        this.parent.hoverAnchor.id === this.parent.hover.anchors[this.parent.hover.anchors.length - 1].id &&
        this.parent.hoverType <= HoverType.LineAnchor
      ) {
        this.parent.interactionStateMachine.transition(InteractionMode.DrawingLineDragTo);
      } else {
        this.parent.interactionStateMachine.transition(InteractionMode.DrawingLineDragAnchorReady);
      }

      return true;
    }

    // 从连线的锚点处开始连线
    return startDrawingLineFromHoverAnchor.call(this.parent);
  }
}

export function handleMouseDown(this: Meta2d, e: MouseEvent) {
  // 避免鼠标拖拽过程中移到外部导致事件中断等错误
  e.preventDefault();
  // 按下前把合并中的拾取请求冲刷出去，避免 hover 比合并之前更旧（见 flushPick）
  flushPick.call(this);
  window.getSelection().removeAllRanges();
  this.topElement.focus();

  if (e.button === 0 && this.onContextMenu) {
    this.onContextMenu(e, false);
  }

  if (this.interactionStateMachine.state === InteractionMode.CanvasMagnifier) {
    return;
  }

  this.mousedown = this.toLogicalMouse(e);
  this.directPenId = undefined;
  this.mousedown.button = e.button;
  this.mousedown.offsetX = e.offsetX;
  this.mousedown.offsetY = e.offsetY;

  // 1. 连线中鼠标按下：新增锚点、完成连线等
  if (handleDrawingLineDown.call(this)) {
    return;
  }

  // 2. 是否进入连线
  if (handleDrawinglineReady.call(this)) {
    return;
  }

  // 3. 添加/删除锚点。
  if (handleEditAnchorDown.call(this)) {
    return;
  }

  // 4. 处理 hoverType 交互
  if (this.hoverType && this.hoverTypeHandler.onMouseDown(this.hoverType)) {
    return;
  }

  // 5. 处理右键
  if (e.button === 2) {
    handleRightClickDown.call(this);
    return;
  }

  // 6. 处理图元选择
  handlePenSelection.call(this);

  // dom图元点击事件冲突
  if (e.target !== this.topElement) {
    return;
  }

  // 7. 处理参考线
  handleGuidelineMouseDown.call(this);
}

function handleEditAnchorDown(this: Meta2d): boolean {
  if (!this.editingAnchor || this.mousedown.button !== 0) {
    return false;
  }

  const pen = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
  if (!pen || pen.locked || pen.disableAnchor) {
    return true;
  }

  if (pen.category === PenCategory.Line) {
    return handleLineAnchorEdit.call(this, pen);
  }

  const anchorIndex = this.hoverAnchor?.id
    ? (pen.anchors?.findIndex((anchor) => anchor.id === this.hoverAnchor.id) ?? -1)
    : -1;
  const beforeUpdate: Pen[] = [
    patchClone(pen, {
      anchors: structuredClone(pen.anchors || []),
      connectedLines: structuredClone(pen.connectedLines || []),
      patchFlag: PatchFlag.Active | PatchFlag.Rect,
    }),
  ];
  const update: Pen[] = [];

  if (anchorIndex >= 0) {
    const anchor = pen.anchors[anchorIndex];
    const removedConnections = (pen.connectedLines || []).filter((item) => item.anchor === anchor.id);
    const connectionsByLine = new Map<string, Set<string>>();

    for (const connection of removedConnections) {
      const anchorIds = connectionsByLine.get(connection.penId) || new Set<string>();
      anchorIds.add(connection.penAnchor);
      connectionsByLine.set(connection.penId, anchorIds);
    }

    for (const [lineId, anchorIds] of connectionsByLine) {
      const line = this.penMap.get(lineId);
      if (!line) continue;
      beforeUpdate.push(patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));

      for (const lineAnchor of line.anchors || []) {
        if (anchorIds.has(lineAnchor.id)) {
          delete lineAnchor.connectedPen;
          delete lineAnchor.connectedAnchor;
        }
      }
      update.push(patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
    }

    pen.anchors.splice(anchorIndex, 1);
    pen.connectedLines = (pen.connectedLines || []).filter((item) => item.anchor !== anchor.id);
  } else {
    pen.anchors = [...(pen.anchors || []), getAnchorPoint(pen, this.mousedown)];
  }

  update.unshift(patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
  this.patch(undefined, undefined, beforeUpdate, update);
  this.pushAction({ beforeUpdate, update });

  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
  }

  this.hover = structuredClone(pen);
  this.hoverAnchor = undefined;
  this.hoverType = HoverType.None;
  this.hoverWorker.postMessage({
    action: WorkerMessage.Hover,
    pen: this.hover,
    boundary: this.hoverBoundary,
  });
  this.activePens.some((item) => item.id === pen.id) && this.updateController();
  this.topElement.style.cursor = 'pointer';
  return true;
}

/** 连线在 A 状态下按下：命中锚点删除，否则按路径投影插入。 */
function handleLineAnchorEdit(this: Meta2d, line: Pen): boolean {
  const anchors = structuredClone(line.anchors || []);
  if (anchors.length < 2) return true;

  const anchorIndex = this.hoverAnchor?.id ? anchors.findIndex((anchor) => anchor.id === this.hoverAnchor.id) : -1;
  const relatedBeforeUpdate: Pen[] = [];
  const relatedUpdate: Pen[] = [];

  if (anchorIndex >= 0) {
    if (anchors.length <= 2) return true;
    const removed = anchors[anchorIndex];
    if (removed.connectedPen) {
      const node = this.penMap.get(removed.connectedPen);
      if (node) {
        relatedBeforeUpdate.push(patchClone(node, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
        node.connectedLines = (node.connectedLines || []).filter(
          (item) => !(item.penId === line.id && item.penAnchor === removed.id),
        );
        relatedUpdate.push(patchClone(node, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
      }
    }
    anchors.splice(anchorIndex, 1);
  } else {
    const point = this.hoverLinePoint;
    if (!point || point.segment === undefined) return true;
    insertLineAnchor(line, anchors, point);
  }

  this.updateLineAnchors(line, anchors, line.type, relatedBeforeUpdate, relatedUpdate);
  return true;
}

function insertLineAnchor(line: Pen, anchors: Point[], point: Point) {
  const index = Math.max(0, Math.min(anchors.length - 1, point.segment as number));
  const nextIndex = (index + 1) % anchors.length;
  const from = anchors[index];
  const to = anchors[nextIndex];
  const t = Math.max(0, Math.min(1, point.position ?? 0.5));
  const created: Point = { id: s8(), x: point.x, y: point.y };

  if ((line.type === 'curve' || line.type === 'mind') && from.cp1 && to.cp2) {
    const p0 = from;
    const p1 = from.cp1 || from;
    const p2 = to.cp2 || to;
    const p3 = to;
    const lerp = (a: Point, b: Point, ratio: number): Point => ({
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
    });
    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);
    created.x = s.x;
    created.y = s.y;
    created.cp2 = r0;
    created.cp1 = r1;
    from.cp1 = q0;
    to.cp2 = q2;
  } else if ((line.type === 'curve' || line.type === 'mind') && (from.cp1 || to.cp2)) {
    const control = from.cp1 || to.cp2;
    const q0 = lerpPoint(from, control, t);
    const q1 = lerpPoint(control, to, t);
    const s = lerpPoint(q0, q1, t);
    created.x = s.x;
    created.y = s.y;
    if (from.cp1) {
      from.cp1 = q0;
      created.cp1 = q1;
    } else {
      created.cp2 = q0;
      to.cp2 = q1;
    }
  }

  const insertIndex = line.close && index === anchors.length - 1 ? anchors.length : index + 1;
  anchors.splice(insertIndex, 0, created);
}

function lerpPoint(from: Point, to: Point, ratio: number): Point {
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function getAnchorPoint(pen: Pen, point: Point): Point {
  const anchor = { id: s8(), x: point.x, y: point.y };
  const pivot = pen.pivot || {
    x: pen.x + pen.width / 2,
    y: pen.y + pen.height / 2,
  };

  // 鼠标坐标位于画布空间，锚点需要保存为图元旋转、翻转前的坐标。
  rotatePoint(anchor, -(pen.rotate || 0), pivot);
  if (pen.flipX) {
    anchor.x = pen.x + pen.ex - anchor.x;
  }
  if (pen.flipY) {
    anchor.y = pen.y + pen.ey - anchor.y;
  }
  return anchor;
}

/**
 * 将 edgeFn 返回的临时边缘点落地为图元真实锚点。
 * 已存在的锚点直接复用，新增锚点单独记录历史，取消连线时仍然保留。
 */
function persistDynamicAnchor(this: Meta2d): Point | undefined {
  const pen = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
  if (!pen || pen.locked || pen.disableAnchor || !this.hoverAnchor) {
    return;
  }

  const existing = this.hoverAnchor.id ? pen.anchors?.find((anchor) => anchor.id === this.hoverAnchor.id) : undefined;
  if (existing) {
    // 默认锚点或之前生成的动态锚点已经存在时直接复用，避免重复添加。
    this.hoverAnchor = existing;
    return existing;
  }

  // 连线的动态边缘点属于 lineIsEdge 语义，落地后会改变连线路径，本次只处理 edgeFn 图元。
  if (pen.category === PenCategory.Line) {
    return this.hoverAnchor;
  }

  const beforeUpdate = [
    patchClone(pen, {
      anchors: structuredClone(pen.anchors || []),
      connectedLines: structuredClone(pen.connectedLines || []),
      patchFlag: PatchFlag.Active | PatchFlag.Rect,
    }),
  ];
  // edgeFn 接收的就是图元旋转、翻转前的局部画布坐标，返回点可直接持久化。
  const anchor: Point = { ...this.hoverAnchor, id: s8() };
  // 清理仅供拾取和渲染使用的临时字段，防止它们进入画布持久化数据。
  delete anchor.temp;
  delete anchor.host;
  delete anchor.absoluteX;
  delete anchor.absoluteY;
  pen.anchors = [...(pen.anchors || []), anchor];
  const update = [patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect })];

  this.patch(undefined, undefined, beforeUpdate, update);
  // 动态锚点作为独立操作进入历史，因此取消后仍保留，撤销连线也不会同时删除锚点。
  this.pushAction({ beforeUpdate, update });
  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
  }

  // Worker 消息按发送顺序处理，先同步真实锚点，再开始或完成连线。
  this.hover = structuredClone(pen);
  this.hoverAnchor = this.hover.anchors.find((item) => item.id === anchor.id);
  this.hoverType = HoverType.NodeAnchor;
  this.hoverWorker.postMessage({
    action: WorkerMessage.PickAnchor,
    pen: this.hover,
    anchor: this.hoverAnchor,
  });
  this.activePens.some((item) => item.id === pen.id) && this.updateController();

  return anchor;
}

/** 从当前悬浮锚点统一进入连线状态，并保存真实起点引用。 */
function startDrawingLineFromHoverAnchor(this: Meta2d): boolean {
  const anchor = persistDynamicAnchor.call(this);
  const pen = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
  if (!pen || pen.locked || pen.disableAnchor || !anchor) {
    return true;
  }

  this.drawingLineFrom = anchor.id ? { penId: pen.id, anchorId: anchor.id } : undefined;
  this.drawingLineTo = undefined;
  this.drawingLineType = this.lineType;
  this.interactionStateMachine.transition(InteractionMode.DrawingLineReady);

  if (this.activePens?.length) {
    this.clearActive();
  }

  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine,
    lineType: this.drawingLineType,
    point: { x: this.mousedown.x, y: this.mousedown.y },
  });
  return true;
}

/** 在连线完成前固化终点锚点，并保存稳定的图元/锚点 ID。 */
function prepareDrawingLineTarget(this: Meta2d): void {
  const anchor = persistDynamicAnchor.call(this);
  const pen = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
  this.drawingLineTo = pen && anchor?.id ? { penId: pen.id, anchorId: anchor.id } : undefined;
}

/**
 * 连线中鼠标按下事件：新增锚点、完成连线等
 * @returns {boolean} 返回处理结果，表示是否成功处理了事件
 */
function handleDrawingLineDown(this: Meta2d): boolean {
  // 检查当前交互状态是否为绘制线条模式，如果不是则返回false
  if (this.interactionStateMachine.state !== InteractionMode.DrawingLine) {
    return false;
  }

  // 判断是否应该完成绘制：
  // 1. 如果按下了鼠标右键(button === 2)
  // 2. 或者鼠标悬停在节点锚点上(hoverType === HoverType.NodeAnchor)
  // 3. 或者鼠标悬停在线条锚点上(hoverType === HoverType.LineAnchor)
  // 4. mind 固定为两个锚点，第二个锚点生成后立即完成
  const lineType = this.drawingLineType ?? this.lineType;
  const isAnchorTarget = this.hoverType === HoverType.NodeAnchor || this.hoverType === HoverType.LineAnchor;
  const shouldFinish = this.mousedown.button === 2 || isAnchorTarget || lineType === 'mind';

  if (isAnchorTarget && this.mousedown.button !== 2) {
    prepareDrawingLineTarget.call(this);
    // 终点可能刚从动态边缘点落地，先刷新一帧临时端点，确保 Hover Worker 使用新的真实锚点。
    this.hoverWorker.postMessage({
      action: WorkerMessage.DrawingLine,
      lineType: this.drawingLineType ?? this.lineType,
      point: { x: this.mousedown.x, y: this.mousedown.y, temp: true, down: true },
      shift: this.mousedown.shiftKey,
      ctrl: this.mousedown.ctrlKey,
    });
  } else if (this.mousedown.button === 2) {
    this.drawingLineTo = undefined;
  }

  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine,
    lineType,
    point: { x: this.mousedown.x, y: this.mousedown.y },
    shift: this.mousedown.shiftKey,
    ctrl: this.mousedown.ctrlKey,
    finish: shouldFinish,
  });

  if (shouldFinish) {
    this.interactionStateMachine.transition(InteractionMode.None);
    this.hoverType = HoverType.None;
    this.hoverWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
    this.calcWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
    this.calcWorker.postMessage({ action: WorkerMessage.CalcPenBoundary, drawingLine: undefined });
  }

  return true;
}

/**
 * 处理绘制线条准备状态
 * @returns {boolean} 返回是否成功处理绘制线条准备状态
 */
function handleDrawinglineReady(this: Meta2d): boolean {
  // 检查鼠标右键是否被按下，如果是则返回false
  if (this.mousedown.button === 2) {
    return false;
  }

  // 检查当前是否处于绘制线条模式
  if (this.options.anchorMode & AnchorMode.Drawline) {
    if (this.hoverType === HoverType.NodeAnchor || this.hoverType === HoverType.LineAnchor) {
      // 连线模式点击锚点时也走统一入口，确保起点关系可以自动生成。
      return startDrawingLineFromHoverAnchor.call(this);
    }

    // 转换到绘制线条交互模式
    this.interactionStateMachine.transition(InteractionMode.DrawingLineReady);
    this.drawingLineFrom = undefined;
    this.drawingLineTo = undefined;
    this.drawingLineType = this.lineType;

    // 如果存在活动的画笔，则清除活动状态
    if (this.activePens?.length) {
      this.clearActive();
    }

    // 向悬停工作线程发送绘制线条的消息
    this.hoverWorker.postMessage({
      action: WorkerMessage.DrawingLine,
      lineType: this.drawingLineType,
      point: { x: this.mousedown.x, y: this.mousedown.y },
    });

    return true;
  } else if (this.options.anchorMode & AnchorMode.Pencil) {
    this.interactionStateMachine.transition(InteractionMode.DrawingPencil);

    if (this.activePens?.length) {
      this.clearActive();
    }

    this.hoverWorker.postMessage({
      action: WorkerMessage.DrawingPencil,
      point: { x: this.mousedown.x, y: this.mousedown.y },
    });

    return true;
  }

  return false;
}

/**
 * 处理右键点击
 */
function handleRightClickDown(this: Meta2d): void {
  // 拖拽画布
  if (this.interactionStateMachine.state === InteractionMode.None) {
    this.interactionStateMachine.transition(InteractionMode.CanvasMouseRightDown);
  }

  // 右键选中图元
  if (this.hover && (this.options.mode || this.hover)) {
    const found = this.activePens.findIndex((item: Pen) => item.id === this.hover.id);
    if (found < 0) {
      this.activePens = [this.penMap.get(this.hover.id)];
      this.calcWorker.postMessage({
        action: WorkerMessage.Active,
        pens: this.activePens,
      });
    }
  }
}

/**
 * 处理图元选择
 */
function handlePenSelection(this: Meta2d): void {
  // 编辑态 Alt+点击：直接选中鼠标下最上层的图元（不换成父图元，锁定的也能选）。
  // 放到松开时（handleDirectSelect）做：按下时仍按普通点击选，Alt+拖拽照旧复制当前选择 / 整个编组
  this.directPenId = this.options.mode === Mode.Edit && this.mousedown.altKey ? this.hoverTopId : undefined;
  if (this.directPenId && (this.mousedown.shiftKey || this.mousedown.ctrlKey)) {
    // 加选 / 减选全在松开时按最上层图元做，按下时不动选择
    return;
  }

  if (!this.hover) {
    // 点击空白地方，清除选择或开始框选
    if (
      this.activePens.length &&
      ((this.activePens.length === 1 && this.activePens[0].category === PenCategory.Line) ||
        !pointInRect(this.mousedown, this.activeBoundary))
    ) {
      this.clearActive();
    }
    return;
  }
  const hoverId = this.hover.id;
  if (!hoverId) {
    return;
  }

  // 处理 mouseDownFns
  if (
    this.interactionStateMachine.state === InteractionMode.None &&
    this.hover &&
    mouseDownFns[this.hover.type] &&
    mouseDownFns[this.hover.type].call(this, this.hover, this.mousedown) === false
  ) {
    return;
  }

  // Shift / Ctrl 多选
  if (this.mousedown.shiftKey || this.mousedown.ctrlKey) {
    const pen = this.penMap.get(hoverId);
    if (!pen || !toggleActivePen.call(this, pen)) return;
  } else {
    // 单选
    if (this.options.mode === Mode.Run) {
      const pen = this.penMap.get(hoverId);
      if (pen) dispatchEvent.call(this, pen, EventType.Mousedown);
    }

    // 点中的就是已选图元之一 ⇒ 保持当前选择（多选时可以直接拖动整体）。
    // 只认已选图元本身：编组的子图元拾取时已换成编组；容器里的子图元是独立目标，父图元选中与否都能点中。
    if (
      this.activePens.length &&
      (this.activePens.length > 1 || this.activePens[0].category !== PenCategory.Line) &&
      this.activeBoundary &&
      pointInRect(this.mousedown, this.activeBoundary) &&
      this.activePens.some((pen: Pen) => pen.id === hoverId)
    ) {
      // 已选中的自定义输入图元仍需要接收点击，否则第二次点击清空按钮、标签关闭按钮或箭头时会被选中态提前 return 拦截。
      if (this.options.mode === Mode.Run) {
        const activePen = this.penMap.get(hoverId);
        if (activePen?.type && activePen.input === InputMode.Custom && inputFns[activePen.type]) {
          inputFns[activePen.type](this, activePen, this.mousedown);
          this.mousedown = undefined;
          this.interactionStateMachine.transition(InteractionMode.None);
          return;
        }
      }
      return;
    }
    const pen = this.penMap.get(hoverId);
    if (!pen) return;
    this.activePens = [pen];

    if (this.options.mode === Mode.Run) {
      if (pen.input === InputMode.Text || pen.input === InputMode.Number) {
        this.enterTextInput(pen);
        // 输入框位于 top 画布层之外，进入输入后原始 mousedown 可能不会收到 mouseup。
        // 清空按下状态，避免鼠标移出输入框时被误判为画布拖拽。
        this.mousedown = undefined;
        this.interactionStateMachine.transition(InteractionMode.None);
        return;
      } else if (pen.input === InputMode.Custom && inputFns[pen.type]) {
        inputFns[pen.type](this, pen, this.mousedown);
        // 自定义输入同样可能接管后续鼠标事件，不能让画布保留本次按下状态。
        this.mousedown = undefined;
        this.interactionStateMachine.transition(InteractionMode.None);
        return;
      }
    }
  }

  if (this.activePens.length) {
    this.calcWorker.postMessage({
      action: WorkerMessage.Active,
      pens: this.activePens,
    });
  }
}

/**
 * 多选时加入 / 移出一个图元，返回 false 表示选择没变。
 * 祖先与后代不能同时选中（拖动时子图元会被平移两次）：加选子图元时去掉已选的父图元，反之亦然。
 */
function toggleActivePen(this: Meta2d, pen: Pen): boolean {
  const found = this.activePens.findIndex((item: Pen) => item.id === pen.id);
  if (this.activePens.length === 1 && found === 0) {
    return false;
  }
  if (found < 0) {
    this.activePens = this.activePens.filter(
      (item: Pen) => !isAncestor(this.penMap, item, pen) && !isAncestor(this.penMap, pen, item),
    );
    this.activePens.push(pen);
  } else {
    this.activePens.splice(found, 1);
  }
  return true;
}

/** Alt+点击（按下到松开没有拖动）：选中按下时鼠标下最上层的图元；带 Shift / Ctrl 则加选或减选它 */
function handleDirectSelect(this: Meta2d, e: { shiftKey?: boolean; ctrlKey?: boolean }) {
  const pen = this.penMap.get(this.directPenId);
  if (!pen) {
    return;
  }
  if (e.shiftKey || e.ctrlKey) {
    if (!toggleActivePen.call(this, pen)) {
      return;
    }
  } else {
    if (this.activePens.length === 1 && this.activePens[0].id === pen.id) {
      return;
    }
    this.activePens = [pen];
  }
  if (this.activePens.length) {
    this.calcWorker.postMessage({
      action: WorkerMessage.Active,
      pens: this.activePens,
    });
  } else {
    this.clearActive();
  }
}

/** ancestor 是否为 pen 的祖先 */
function isAncestor(penMap: Map<string, Pen>, ancestor: Pen, pen: Pen): boolean {
  let parentId = pen.parentId;
  while (parentId) {
    if (parentId === ancestor.id) {
      return true;
    }
    parentId = penMap.get(parentId)?.parentId;
  }
  return false;
}

/**
 * 处理参考线
 */
function handleGuidelineMouseDown(this: Meta2d): void {
  if (!(this.options.rule?.enable || this.data.rule?.enable)) {
    return;
  }
  if (!this.mousedown) return;

  let style: number;
  if (this.data.rule?.enable) {
    style = this.data.rule?.style;
  } else if (this.options.rule?.enable) {
    style = this.options.rule?.style;
  }

  const ruleSize = RuleStyleConfigs[style || RuleStyle.Simple].ruleSize;
  let pos = null;
  let isVertical = null;
  if (this.mousedown.offsetX > ruleSize && this.mousedown.offsetY <= ruleSize) {
    pos = this.mousedown.x;
    isVertical = true;
  } else if (this.mousedown.offsetY > ruleSize && this.mousedown.offsetX <= ruleSize) {
    pos = this.mousedown.y;
    isVertical = false;
  }

  if (pos) {
    const ruleGap = RuleGapConfigs.normal.minorInterval;
    pos = Math.round(pos / ruleGap) * ruleGap;
    const index = this.guideLines.findIndex((item) => item.pos === pos && item.isVertical === isVertical);
    if (index >= 0) {
      this.guideLines.splice(index, 1);
    } else {
      this.guideLines.push({ pos, isVertical });
    }
    this.utilityWorker.postMessage({
      action: WorkerMessage.RenderGuidelines,
      guideLines: this.guideLines,
    });
  }
}

export function handleClick(this: Meta2d, e: MouseEvent) {
  if (!this.hover || !this.hover.id) {
    return;
  }
  e.preventDefault();
  const pen = this.penMap.get(this.hover.id);
  this.emitter.emit('click', { e, pen });
  if (this.options.mode !== Mode.Edit) {
    dispatchEvent.call(this, pen, EventType.Click);
  }
}

export function handleDblclick(this: Meta2d, e: MouseEvent) {
  if (!this.hover || !this.hover.id) {
    return;
  }

  e.preventDefault();

  if (this.options.mode === Mode.Edit) {
    // hover 已换成编组，双击编辑的应是编组里鼠标下的那个图元
    const top = this.hoverTopId && this.penMap.get(this.hoverTopId);
    const hover = top && isAncestor(this.penMap, this.hover, top) ? top : this.hover;
    if (hover.category === PenCategory.Line) {
      // 获取鼠标在连线上的位置
      const pt: any = {
        x: Math.round((e.offsetX - this.data.x) / this.data.scale),
        y: Math.round((e.offsetY - this.data.y) / this.data.scale),
        deltaX: e.movementX,
        deltaY: e.movementY,
      };
      this.textInputting = s8();
      this.calcWorker.postMessage({
        action: WorkerMessage.PickLinePosition,
        x: pt.x,
        y: pt.y,
        id: hover.id,
      });

      return;
    }
    this.enterTextInput(hover);

    return;
  }

  const pen = this.penMap.get(this.hover.id);
  dispatchEvent.call(this, pen, EventType.Dblclick);
}

/**
 * 按帧合并拾取请求（M9 / G3）。
 *
 * 一帧内可能到来多个 mousemove，但拾取
 * 是无副作用的纯查询，只有最后一个位置的结果会被渲染出来，中间的都是白算。
 *
 * ⚠ 只合并拾取本身。`handleMouseMove` 的其余部分必须保持逐事件同步执行：
 * `preventDefault()` 要在真实事件上调用，状态机迁移不能乱序，`e.movementX/movementY`
 * 是逐事件增量、丢事件就会丢位移。
 */
function requestPick(this: Meta2d, x: number, y: number): void {
  this.pendingPick = { x, y };
  // A/B 开关：关掉合并即退回逐事件拾取，用于现场比对 hover 延迟（见 Options）
  if (this.options.disablePickCoalescing) {
    flushPick.call(this);
    return;
  }
  if (this.pickFrame) {
    return;
  }
  this.pickFrame = requestAnimationFrame(() => {
    this.pickFrame = undefined;
    flushPick.call(this);
  });
}

/**
 * 立即派发挂起的拾取请求。
 *
 * `handleMouseDown` 完全依赖 `this.hover` / `this.hoverType`（由拾取回包异步填充，
 * 见 `meta2d-message.ts:302/344/421`），自己不重新拾取。合并若把拾取推迟一帧，
 * 「边移动边点击」时按下所用的 hover 就会比原来更旧一帧。按下时先冲刷，
 * 即可保证提交时机不晚于合并之前。
 */
function flushPick(this: Meta2d): void {
  const pos = this.pendingPick;
  this.pendingPick = undefined;
  // 帧回调可能落在 disconnectedCallback 之后
  if (!pos || !this.calcWorker) {
    return;
  }
  this.calcWorker.postMessage({ action: WorkerMessage.Pick, x: pos.x, y: pos.y });
}

/**
 * 把这一帧攒下的缩放 / 旋转移动一次做掉（见 handleMouseMove 的 hoverType 分支）。
 * 松手、按下前都要先冲掉，保证 done 函数看到的是最新的几何。
 */
export function flushHoverMove(this: Meta2d): void {
  const p = this.pendingHoverMove;
  this.pendingHoverMove = undefined;
  if (this.hoverMoveFrame) {
    cancelAnimationFrame(this.hoverMoveFrame);
    this.hoverMoveFrame = undefined;
  }
  if (!p || !this.mousedown) {
    return;
  }
  this.mousePos.deltaX = p.dx;
  this.mousePos.deltaY = p.dy;
  this.hoverTypeHandler.onMouseMove(p.type);
  // 这一份增量已经用掉：松手时 reiszePensDone 会再调一次 resizePens，按原来的写法它会把最后一次增量
  // 再加一遍（合并后那是一整帧的量）⇒ 清零，done 那一次只负责记录操作历史
  this.mousePos.deltaX = 0;
  this.mousePos.deltaY = 0;
}

export function handleMouseMove(this: Meta2d, e: MouseEvent): void {
  e.preventDefault();


  const pos = this.toLogicalMouse(e);
  // 浏览器会在原位置补发 mousemove（实测拖拽中 79/155 个：同位置、movement 为 0，距上一个中位 5.2ms），
  // 原样处理会让拖拽/旋转每次移动都执行两次、多发一轮 worker 消息。位置（逻辑 + 画布坐标）、按键、修饰键
  // 都没变且没有位移的事件不会带来任何变化 ⇒ 跳过。逻辑坐标要比：滚动/平移后屏幕坐标不变但画布上的位置变了。
  const last = this.lastMove;
  const keys = (e.ctrlKey ? 1 : 0) | (e.shiftKey ? 2 : 0) | (e.altKey ? 4 : 0) | (e.metaKey ? 8 : 0);
  if (
    last &&
    !e.movementX &&
    !e.movementY &&
    last.x === pos.x &&
    last.y === pos.y &&
    last.offsetX === e.offsetX &&
    last.offsetY === e.offsetY &&
    last.buttons === e.buttons &&
    last.keys === keys
  ) {
    return;
  }
  this.lastMove = { x: pos.x, y: pos.y, offsetX: e.offsetX, offsetY: e.offsetY, buttons: e.buttons, keys };

  this.mousePos = pos;
  // 同时保存画布坐标和屏幕坐标，放大镜截图需要使用未经过画布变换的屏幕坐标。
  this.mousePos.offsetX = e.offsetX;
  this.mousePos.offsetY = e.offsetY;

  switch (this.interactionStateMachine.state) {
    case InteractionMode.DrawingLineReady:
      this.interactionStateMachine.transition(InteractionMode.DrawingLine);
      return;

    case InteractionMode.DrawingLine:
      handleDrawingLineMove.call(this);
      return;

    case InteractionMode.DrawingLineDragFrom:
    case InteractionMode.DrawingLineDragTo:
      handleDrawingLineDragMove.call(this);
      return;

    case InteractionMode.DrawingLineDragAnchorReady:
      handleDrawingLineDragAnchorReady.call(this);
      return;

    case InteractionMode.DrawingLineDragAnchor:
      handleDrawingLineDragAnchor.call(this);
      return;

    case InteractionMode.DrawingPencil:
      this.hoverWorker.postMessage({
        action: WorkerMessage.DrawingPencil,
        point: this.mousePos,
      });
      return;

    case InteractionMode.CanvasMouseRightDown:
      // Run 模式下禁止平移画布
      if (!(this.options.mode === Mode.Run && this.data.disableTranslate)) {
        this.interactionStateMachine.transition(InteractionMode.CanvasTranslate);
      }
      return;
    case InteractionMode.CanvasTranslate:
    case InteractionMode.CanvasDragPens:
    case InteractionMode.CanvasSelectPens:
    case InteractionMode.CanvasMagnifier:
      handleCanvasModeMove.call(this);
      return;
  }

  // 处理 hoverType
  if (this.hoverType && this.mousedown && e.buttons !== 0) {
    // 第六十七轮：按帧合并。实测多选 50+ 缩放 / 旋转：这一步每次 6.5ms（p95 9.5ms）、5 秒 4027 次 = 26.3s 的活
    // ⇒ 主线程超额 5 倍，Patch 发出前就排了 ~19s（main:patch:age）——「框跟得上、图元慢半拍」的真正来源。
    // 一帧内的多次移动只有最后的结果会被看见：缩放按逻辑坐标增量算 ⇒ 增量累加；旋转按绝对鼠标位置算 ⇒ 取最新。
    // movementX/Y 是屏幕像素，resizeRect 使用画布逻辑坐标，必须除以画布缩放比例才能保持控制点与鼠标同步。
    const prev = this.pendingHoverMove;
    const scale = this.data.scale || 1;
    this.pendingHoverMove = {
      type: this.hoverType,
      dx: (prev ? prev.dx : 0) + e.movementX / scale,
      dy: (prev ? prev.dy : 0) + e.movementY / scale,
    };
    if (this.options.disableHoverMoveCoalescing) {
      flushHoverMove.call(this);
    } else if (!this.hoverMoveFrame) {
      this.hoverMoveFrame = requestAnimationFrame(() => {
        this.hoverMoveFrame = undefined;
        flushHoverMove.call(this);
      });
    }
    return;
  }

  // 处理 mouseMoveFns
  if (
    this.interactionStateMachine.state === InteractionMode.None &&
    this.hover &&
    mouseMoveFns[this.hover.type] &&
    mouseMoveFns[this.hover.type].call(this, this.hover, this.mousePos) === false
  ) {
    return;
  }

  // 仅编辑模式允许拖拽或框选，运行模式仍保留图元自身的鼠标交互。
  // 只有鼠标按键实际处于按下状态时才允许拖拽或框选，避免输入框等覆盖层
  // 未能派发 mouseup 时，后续普通 mousemove 触发画布移动。
  if (this.options.mode === Mode.Edit && this.mousedown && e.buttons !== 0) {
    // Alt+点击时手抖几个像素不算拖拽，否则会变成 Alt+拖拽复制
    if (
      this.directPenId &&
      Math.abs(e.offsetX - this.mousedown.offsetX) < 3 &&
      Math.abs(e.offsetY - this.mousedown.offsetY) < 3
    ) {
      return;
    }
    if (
      this.activePens.length &&
      (this.activePens[0].id === this.hover?.id || pointInRect(this.mousedown, this.activeBoundary))
    ) {
      this.interactionStateMachine.transition(InteractionMode.CanvasDragPens);
    } else {
      this.interactionStateMachine.transition(InteractionMode.CanvasSelectPens);
    }
  } else {
    requestPick.call(this, this.mousePos.x, this.mousePos.y);

    if (this.editingAnchor) {
      const pen = this.hover?.id ? this.penMap.get(this.hover.id) : undefined;
      const editingAnchor =
        pen && !pen.locked && !pen.disableAnchor
          ? pen.category === PenCategory.Line
            ? this.hoverLinePoint || null
            : { x: this.mousePos.x, y: this.mousePos.y }
          : null;
      this.hoverWorker.postMessage({
        action: WorkerMessage.Hover,
        editingAnchor,
      });
    }
  }
}

/**
 * 处理连线绘制移动
 */
function handleDrawingLineMove(this: Meta2d): void {
  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine,
    lineType: this.drawingLineType ?? this.lineType,
    point: { x: this.mousePos.x, y: this.mousePos.y, temp: true, down: !!this.mousedown },
    shift: this.mousePos.shiftKey,
    ctrl: this.mousePos.ctrlKey,
  });
  requestPick.call(this, this.mousePos.x, this.mousePos.y);
}

/**
 * 处理连线拖拽移动
 */
function handleDrawingLineDragMove(this: Meta2d): void {
  if (Math.abs(this.mousePos.x - this.mousedown.x) < 10 && Math.abs(this.mousePos.y - this.mousedown.y) < 10) {
    return;
  }

  const isDragFrom = this.interactionStateMachine.state === InteractionMode.DrawingLineDragFrom;
  // 端点重连属于已有连线编辑，整个手势必须沿用该连线自身类型。
  this.drawingLineType = this.activePens[0].type;
  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine + (isDragFrom ? 1 : 2),
    lineType: this.drawingLineType,
    point: { x: this.mousePos.x, y: this.mousePos.y, temp: true },
    texts: getAllChildren(this.penMap, this.hover),
  });

  this.calcWorker.postMessage({
    action: WorkerMessage.CalcPenBoundary,
    pens: [this.hover],
    drawingLine: patchClone(this.hover),
    render: true,
  });

  this.setOptions({ anchorMode: AnchorMode.Drawline });
  this.interactionStateMachine.transition(InteractionMode.DrawingLine);
}

/**
 * 处理连线锚点拖拽准备
 */
function handleDrawingLineDragAnchorReady(this: Meta2d): void {
  if (Math.abs(this.mousePos.x - this.mousedown.x) < 10 && Math.abs(this.mousePos.y - this.mousedown.y) < 10) {
    return;
  }

  this.interactionStateMachine.transition(InteractionMode.DrawingLineDragAnchor);

  this.hoverWorker.postMessage({
    action: WorkerMessage.DragLineAnchor,
    texts: getAllChildren(this.penMap, this.hover),
    lineType: this.activePens[0].type,
    dragAnchorType: getDragAnchorType.call(this),
  });
}

/** 获取当前拖拽的是连线首端还是尾端，供正交线重连时恢复端点关系。 */
function getDragAnchorType(this: Meta2d): DragAnchorType {
  const line = this.activePens.length === 1 ? this.activePens[0] : undefined;
  const anchorId = this.mousedown?.lineAnchorId;
  if (!line || !anchorId || !line.anchors?.length) {
    return DragAnchorType.None;
  }
  if (line.anchors[0].id === anchorId) {
    return DragAnchorType.From;
  }
  if (line.anchors[line.anchors.length - 1].id === anchorId) {
    return DragAnchorType.To;
  }
  return DragAnchorType.None;
}

/**
 * 处理连线锚点拖拽
 */
function handleDrawingLineDragAnchor(this: Meta2d): void {
  if (!this.draggingAnchor) {
    this.draggingAnchor = true;
    this.renderWorker.postMessage({
      action: WorkerMessage.DragPens,
      pens: this.activePens,
      render: true,
    });

    // 设置 anchorMode，使拖动锚点时也能检测目标图元的锚点
    if (this.options.anchorMode !== AnchorMode.Drawline) {
      this.setOptions({ anchorMode: AnchorMode.Drawline });
    }
  }

  this.hoverWorker.postMessage({
    action: WorkerMessage.DragLineAnchor + (this.hoverCp || 0),
    lineType: this.activePens[0].type,
    dragAnchorType: getDragAnchorType.call(this),
    point: { x: this.mousePos.x, y: this.mousePos.y },
    shift: this.mousePos.shiftKey,
    ctrl: this.mousePos.ctrlKey,
  });

  const line = this.activePens.length === 1 ? this.activePens[0] : undefined;
  const anchors = line?.anchors;
  const lineAnchorId = this.mousedown?.lineAnchorId;
  // 只有拖动未闭合连线的首尾普通锚点时，才持续拾取目标图元的锚点。
  if (
    line?.category === PenCategory.Line &&
    !line.close &&
    !this.mousedown?.lineAnchorCp &&
    anchors?.length >= 2 &&
    (anchors[0].id === lineAnchorId || anchors[anchors.length - 1].id === lineAnchorId)
  ) {
    requestPick.call(this, this.mousePos.x, this.mousePos.y);
  }
}

/**
 * 处理画布模式移动
 */
function handleCanvasModeMove(this: Meta2d): void {
  if (this.interactionStateMachine.state === InteractionMode.CanvasMagnifier) {
    this.modeFns[InteractionMode.CanvasMagnifier].call(this);
    return;
  }

  this.modeFns[this.interactionStateMachine.state] &&
    this.mousedown &&
    this.modeFns[this.interactionStateMachine.state].call(this);
}

export function handleMouseUp(this: Meta2d, e: MouseEvent): void {
  e.preventDefault();

  // 松手前把挂起的平移落地。mousedown 一清空，abs 模式就算不出位移了（见 flushTranslate），
  // 不冲刷的话拖拽的最后一帧位移会被丢掉。
  flushTranslate.call(this);
  // 同理：缩放 / 旋转攒着的最后一帧先做掉
  flushHoverMove.call(this);

  if (this.interactionStateMachine.state === InteractionMode.CanvasMagnifier) {
    return;
  }

  const point = this.toLogicalMouse(e);
  // 按下后一直是 None ⇒ 没有拖动 / 框选，是一次点击
  const clicked = this.interactionStateMachine.state === InteractionMode.None && !!this.mousedown;

  switch (this.interactionStateMachine.state) {
    case InteractionMode.DrawingLine:
      handleDrawingLineUp.call(this, point);
      // 画线是多次点击的过程：松手只落一个拐点，不能走到下面的状态复位。
      // 真正结束时 handleDrawingLineUp 自己会把状态设回 None。
      this.mousedown = undefined;
      return;

    case InteractionMode.DrawingLineDragFrom:
    case InteractionMode.DrawingLineDragTo:
    case InteractionMode.DrawingLineDragAnchorReady:
      if (e.button === 2) {
        handleRightClickUp.call(this, e);
        break;
      }
      this.interactionStateMachine.transition(InteractionMode.None);
      break;

    case InteractionMode.DrawingLineDragAnchor:
      // 正交线自由端点使用通用锚点拖拽流程，松手前要固化当前拾取到的目标锚点，
      // 否则 Worker 返回的线虽然更新了端点，但主线程没有 drawingLineTo，无法建立连接关系。
      prepareDrawingLineTarget.call(this);
      this.hoverWorker.postMessage({
        action: WorkerMessage.DragLineAnchor + (this.hoverCp || 0),
        lineType: this.activePens[0].type,
        point,
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
        finish: true,
        dragAnchorType: getDragAnchorType.call(this),
      });

      this.draggingAnchor = false;
      this.renderWorker.postMessage({
        action: WorkerMessage.DragPens,
        pens: this.activePens,
        render: true,
      });
      this.interactionStateMachine.transition(InteractionMode.None);
      break;

    case InteractionMode.DrawingPencil:
      this.hoverWorker.postMessage({
        action: WorkerMessage.DrawingPencil,
        point,
        finish: true,
      });
      this.interactionStateMachine.transition(InteractionMode.None);
      break;

    case InteractionMode.CanvasMouseRightDown:
      handleRightClickUp.call(this, e);
      this.interactionStateMachine.transition(InteractionMode.None);
      break;

    case InteractionMode.DrawingLineReady:
      // 点下了起点、按下到松开之间没动（正常的点击都是这样）：起点已经发给 hover worker 了，
      // 直接进入画线，让起点到鼠标之间的临时线跟着走。原来落到 default 被复位成 None ⇒
      // 起点之后没有临时线，这条线也不在「正在画」状态，P / Enter / Esc 都找不到它。
      this.interactionStateMachine.transition(InteractionMode.DrawingLine);
      this.mousedown = undefined;
      return;

    default:
      if (this.mousedown && (point.x !== this.mousedown.x || point.y !== this.mousedown.y)) {
        this.modeDoneFns[this.interactionStateMachine.state] &&
          this.modeDoneFns[this.interactionStateMachine.state].call(this, point);
        this.hoverTypeHandler.onMouseUp(this.hoverType, this, point, e);
      }
      // 仅当不是 None 状态时才转换
      if (this.interactionStateMachine.state !== InteractionMode.None) {
        this.interactionStateMachine.transition(InteractionMode.None);
      }
  }

  if (this.directPenId) {
    clicked && e.button === 0 && handleDirectSelect.call(this, this.mousedown);
    this.directPenId = undefined;
  }

  // 处理 mouseUpFns
  if (this.interactionStateMachine.state === InteractionMode.None && this.hover) {
    if (mouseUpFns[this.hover.type] && mouseUpFns[this.hover.type].call(this, this.hover, point) === false) {
      this.mousedown = undefined;
      return;
    }

    if (this.options.mode === Mode.Run) {
      const pen = this.penMap.get(this.hover.id);
      dispatchEvent.call(this, pen, EventType.Mouseup);
    }
  }

  // 处理 addCaches：点击放置图元
  if (
    this.addCaches &&
    this.mousedown &&
    this.interactionStateMachine.state === InteractionMode.None &&
    Math.abs(point.x - this.mousedown.x) < 5 &&
    Math.abs(point.y - this.mousedown.y) < 5
  ) {
    handleAddCachesClick.call(this, point);
  }

  this.interactionStateMachine.transition(InteractionMode.None);
  this.mousedown = undefined;
}

/**
 * 处理连线绘制完成
 */
function handleDrawingLineUp(this: Meta2d, e: any): void {
  const lineType = this.drawingLineType ?? this.lineType;
  const isAnchorTarget = this.hoverType === HoverType.NodeAnchor || this.hoverType === HoverType.LineAnchor;
  const shouldFinish = e.button === 2 || isAnchorTarget || lineType === 'mind';

  if (isAnchorTarget && e.button !== 2) {
    prepareDrawingLineTarget.call(this);
  } else if (e.button === 2) {
    this.drawingLineTo = undefined;
  }

  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine,
    lineType,
    point: { x: e.x, y: e.y, temp: !shouldFinish, up: !shouldFinish },
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    finish: shouldFinish,
  });

  if (shouldFinish) {
    this.interactionStateMachine.state = InteractionMode.None;
    this.hoverType = HoverType.None;
    this.calcWorker.postMessage({ action: WorkerMessage.CalcPenBoundary, drawingLine: undefined });
  }
}

/**
 * 处理右键点击完成
 */
function handleRightClickUp(this: Meta2d, e: MouseEvent): void {
  if (this.options.mode === Mode.Run) {
    if (this.hover?.id) {
      const pen = this.penMap.get(this.hover.id);
      dispatchEvent.call(this, pen, EventType.Contextmenu);
    } else if (this.onContextMenu) {
      this.onContextMenu(e, true);
    }
  } else if (this.onContextMenu) {
    this.onContextMenu(e, true);
  }
}

/**
 * 处理 addCaches 点击放置图元
 * 复用 handleDrop 的放置逻辑
 */
function handleAddCachesClick(this: Meta2d, point: Point): void {
  if (this.options.mode !== Mode.Edit) {
    return;
  }

  const cachedPens = this.addCaches;
  if (!cachedPens) {
    return;
  }

  const obj = structuredClone(cachedPens);
  const rootPen = getComponentRoot(obj);
  const w = rootPen?.width || obj[0].width || 0;
  const h = rootPen?.height || obj[0].height || 0;
  const componentPens = isComponentPens(obj);
  const cursorX = point.x;
  const cursorY = point.y;

  if (componentPens) {
    // 组件图元：以中心点对齐鼠标位置
    translateComponentPens(obj, Math.round(cursorX - w / 2), Math.round(cursorY - h / 2));
  } else {
    // 普通图元：以中心点对齐鼠标位置
    obj.forEach((pen: Pen) => {
      const penW = pen.width || 0;
      const penH = pen.height || 0;
      pen.x = Math.round(cursorX - penW / 2);
      pen.y = Math.round(cursorY - penH / 2);
    });
  }

  // 清除 addCaches 和拖拽预览
  this.addCaches = undefined;
  this.dragStart = undefined;
  this.hoverWorker.postMessage({
    action: WorkerMessage.DragPens,
    finish: true,
  });

  makePensId(obj);

  if (this.dropPen && this.dropPen.type) {
    // 更新关联属性
    dropFns[this.dropPen.type] && dropFns[this.dropPen.type](obj);
  }

  this.addPens(obj, Mode.Edit, this.dropPen?.id);

  this.hoverWorker.postMessage({
    action: WorkerMessage.DragOver,
  });

  this.calcWorker.postMessage({
    action: WorkerMessage.DragOver,
  });

  this.dropPen = undefined;
}

export function handleMouseLeave(this: Meta2d, e: MouseEvent): void {
  // 移出后从同一像素移回来，第一个 mousemove 不能被当成重复事件跳过（见 handleMouseMove）
  this.lastMove = undefined;
}

export function handleWheel(this: Meta2d, e: WheelEvent): void {
  if (this.interactionStateMachine.state) {
    return;
  }

  // dom图元滚动
  if (e.target !== this.topElement) {
    return;
  }

  if (this.hover && wheelFns[this.hover.type] && wheelFns[this.hover.type].call(this, this.hover, e) === false) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  // 缩放
  if (e.ctrlKey) {
    // Run 模式下禁止缩放画布
    if (this.options.mode === Mode.Run && this.data.disableScale) {
      return;
    }
    scaleCanvas.call(this, this.data.scale + calcWheelOffset.call(this, e), {
      x: e.clientX,
      y: e.clientY,
    });
    return;
  }

  // Run 模式下禁止平移画布
  if (this.options.mode === Mode.Run && this.data.disableTranslate) {
    return;
  }

  // 水平滚动
  if (e.shiftKey) {
    requestTranslate.call(this, { x: -e.deltaY, y: 0 });
    return;
  }

  // 双指滑动：同时处理水平和垂直方向
  requestTranslate.call(this, { x: -e.deltaX, y: -e.deltaY });
}

/**
 * 立即平移画布。**编程式调用走这里**（公开 API、`fitView`），不能延后。
 *
 * 原来这里有一个 `now - this.lastDrag < 30` 的固定节流。那个节流是用来掩盖
 * `loadImages` 每步 273ms 的开销的（M11 修掉了），留着有两个问题：
 *   1. 把平移硬压在 33Hz —— M11 之后通过率从 83% 掉到 33%，它成了平移帧率
 *      唯一的限制因素，而屏幕是 120Hz，拖动画布能看出顿挫；
 *   2. 对**增量**语义的调用方（滚轮、触摸），丢一次就永久少滚一段 ——
 *      33% 的通过率意味着高频滚轮下约 2/3 的滚动量被吞掉。
 * 而 `fitView` / 公开 API 这类编程式调用被它波及更荒唐：紧跟在一次拖拽后
 * 调用 `fitView()` 会静默地不平移，只缩放。
 *
 * 所以节流整个去掉，改由 `requestTranslate` 在交互入口做按帧合并。
 * `this.lastDrag` 是公开字段，仍然写，只是不再当闸门用。
 */
export function translateCanvas(this: Meta2d, e?: { x: number; y: number }) {
  // 编程式平移不应该被排在一个待派发的交互平移之前，先把挂起的冲刷掉
  flushTranslate.call(this);
  translateCanvasNow.call(this, e);
}

function translateCanvasNow(this: Meta2d, e?: { x: number; y: number }) {
  if (!e) {
    e = this.mousePos;
  }

  let dx = e.x;
  let dy = e.y;
  if (this.mousedown) {
    dx -= this.mousedown.x;
    dy -= this.mousedown.y;
  }

  applyTranslate.call(this, dx, dy);
}

function applyTranslate(this: Meta2d, dx: number, dy: number) {
  this.lastDrag = performance.now();
  this.setViewPosition(this.data.x + ((dx * this.data.scale) | 0), this.data.y + ((dy * this.data.scale) | 0));
}

/**
 * 按帧合并平移请求（M12）。交互输入走这里：右键拖拽、滚轮、双指。
 *
 * ⚠ 两类调用方语义不同，**不能一刀切**，合并方式相反：
 *
 * | 调用方 | `mousedown` | 传入语义 | 丢一次的后果 | 合并 |
 * |---|---|---|---|---|
 * | 右键拖拽（状态机，不传参 ⇒ `e = this.mousePos`） | 有 | `当前鼠标 − 按下点`，且 `mousePos` 经 `toLogicalMouse` 用 `data.x/scale` 反算 ⇒ **负反馈回路，不是增量** | 无，下一次自我纠正 | **取最新值** |
 * | 滚轮 / 双指 | 无 | `dx = e.x`，**纯增量** | 位移永久丢失 | **必须累加** |
 *
 * 混到一帧里（拖拽中同时滚轮）几乎不可能；真出现就按 mode 直接覆盖，不合并。
 *
 * 用「有没有传参」而不是 `this.mousedown` 来区分两类：状态机永远不传参，滚轮和
 * 双指永远传参，这是个确定的判据；`mousedown` 是会在挂起期间变化的可变状态。
 */
export function requestTranslate(this: Meta2d, e?: { x: number; y: number }) {
  if (!e) {
    this.pendingTranslate = { mode: 'abs' };
  } else {
    const prev = this.pendingTranslate && this.pendingTranslate.mode === 'delta' ? this.pendingTranslate : undefined;
    this.pendingTranslate = {
      mode: 'delta',
      x: (prev ? prev.x : 0) + e.x,
      y: (prev ? prev.y : 0) + e.y,
    };
  }

  if (this.translateFrame) {
    return;
  }
  this.translateFrame = requestAnimationFrame(() => {
    this.translateFrame = undefined;
    flushTranslate.call(this);
  });
}

/**
 * 立即派发挂起的平移请求。
 *
 * 这里自己算最终位移、不走 `translateCanvasNow`，因为那个函数会按
 * `this.mousedown` 的**当前**状态决定减不减按下点，而挂起期间这个状态可能已经
 * 变了（mouseup 落在 rAF 之前 / 拖拽中滚了一下滚轮），按错分支会把绝对坐标
 * 当成位移用，画面直接飞走。
 */
function flushTranslate(this: Meta2d): void {
  const p = this.pendingTranslate;
  this.pendingTranslate = undefined;
  if (!p) {
    return;
  }

  if (p.mode === 'delta') {
    // 纯增量，与 mousedown 无关
    applyTranslate.call(this, p.x, p.y);
    return;
  }

  // abs：位移 = 最新鼠标 − 按下点。按下点已经没了（mouseup 先到）就丢弃这一次；
  // handleMouseUp 里会先冲刷，正常路径不会走到这个分支。
  if (!this.mousedown) {
    return;
  }
  applyTranslate.call(this, this.mousePos.x - this.mousedown.x, this.mousePos.y - this.mousedown.y);
}

export function selectPens(this: Meta2d, e: { x: number; y: number }) {
  this.hoverWorker.postMessage({
    action: WorkerMessage.SelectPens,
    x: this.mousedown.x,
    y: this.mousedown.y,
    ex: this.mousePos.x,
    ey: this.mousePos.y,
  });
}

export function selectPensDone(this: Meta2d, e: { x: number; y: number }) {
  const viewLeft = Math.min(this.mousedown.x, e.x);
  const viewTop = Math.min(this.mousedown.y, e.y);
  const viewRight = Math.max(this.mousedown.x, e.x);
  const viewBottom = Math.max(this.mousedown.y, e.y);

  this.activePens = [];
  const pens: Pen[] = [];
  const selections: any = {};
  for (const [, pen] of this.penMap) {
    if (pen.ex == undefined) {
      pen.ex = pen.x + pen.width;
      pen.ey = pen.y + pen.height;
    }

    if (pen.parentId || pen.locked || pen.visible === false || isTinyPen(pen)) {
      continue;
    }

    if (pen.ex > viewLeft && pen.x < viewRight && pen.ey > viewTop && pen.y < viewBottom) {
      selections[pen.id] = true;
      pens.push(pen);
    }
  }

  this.activePens = pens;

  if (!this.activePens.length) {
    this.clearActive();

    return;
  }

  this.calcWorker.postMessage({
    action: WorkerMessage.Active,
    pens: this.activePens,
  });
}

export function dragPens(
  this: Meta2d,
  e: { x: number; y: number; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean },
) {
  if (!this.activeBoundary || !this.activePens.length) {
    return;
  }

  ensureBoundaryPivot.call(this);

  if (!this.draggingPens?.length) {
    // 分组的连接关系可能记录在子图元上。
    const lines = [];
    getAllPens(this.penMap, this.activePens).forEach((pen) => {
      pen.connectedLines?.forEach((item) => {
        if (!lines.includes(item.penId)) {
          lines.push(item.penId);
        }
      });
    });

    this.dragCopy = !!this.mousePos.altKey;
    // 通知render线程发送完整的图元数据给hover
    this.renderWorker.postMessage({
      action: WorkerMessage.DragPens,
      pens: this.activePens,
      sync: true,
      render: true,
      dragCopy: this.dragCopy,
      connectedLines: lines,
    });
    return;
  }

  if (this.dragCopy !== this.mousePos.altKey) {
    this.dragCopy = this.mousePos.altKey;
    // 通知局部渲染区域计算，根据是否拖拽复制，显示或隐藏拖拽对象
    this.renderWorker.postMessage({
      action: WorkerMessage.DragPens,
      pens: this.activePens,
      render: true,
      dragCopy: this.dragCopy,
    });
  }

  let x = this.mousePos.x - this.mousedown.x;
  let y = this.mousePos.y - this.mousedown.y;
  if (this.mousePos.ctrlKey) {
    x = 0;
  }
  if (this.mousePos.shiftKey) {
    y = 0;
  }

  // 计算对齐参考线
  const _x0 = x;
  const _y0 = y;
  const snap = this.snapToPen(x, y);
  x -= snap.offsetX;
  y -= snap.offsetY;

  if (this.options.alignGrid) {
    // 仅当没有吸附对齐时，才网格对齐
    const gridSize = this.data.grid?.size || this.options.grid?.size || 20;

    if (snap.offsetX === 0) {
      // 使用图元左上角的 x 坐标对齐网格线
      const targetX = this.activeBoundary.x + x;
      const gridX = Math.round(targetX / gridSize) * gridSize;
      const offset = targetX - gridX;
      x -= offset;
    }

    if (snap.offsetY === 0) {
      // 使用图元左上角的 y 坐标对齐网格线
      const targetY = this.activeBoundary.y + y;
      const gridY = Math.round(targetY / gridSize) * gridSize;
      const offset = targetY - gridY;
      y -= offset;
    }
  }
  let lines: Pen[];
  let texts: Pen[];
  this.draggingPens.forEach((pen) => {
    pen.connectedLines?.forEach((item) => {
      const line = this.penMap.get(item.penId);
      // 兼容旧画布或协作延迟产生的失效反向引用，避免拖拽被脏数据中断。
      if (!line) {
        return;
      }
      if (!lines) {
        lines = [];
      }
      if (!lines.find((line) => line.id === item.penId)) {
        lines.push(line);
        const children = getAllChildren(this.penMap, line);
        if (children.length) {
          if (!texts) {
            texts = [];
          }
          texts.push(...children);
        }
      }
    });
  });
  const lineNodeMap = new Map<string, Pen>();
  for (const line of lines || []) {
    for (const anchor of line.anchors || []) {
      if (!anchor.connectedPen || lineNodeMap.has(anchor.connectedPen)) {
        continue;
      }
      const node = this.penMap.get(anchor.connectedPen);
      node && lineNodeMap.set(node.id, node);
    }
  }
  this.hoverWorker.postMessage({
    action: WorkerMessage.DragPens,
    pens: this.draggingPens,
    x,
    y,
    snap,
    lines,
    texts,
    lineNodes: Array.from(lineNodeMap.values()),
  });
  if (lines?.length) {
    this.calcWorker.postMessage({
      action: WorkerMessage.CalcPenBoundary,
      pens: lines,
      render: true,
    });
  }
  x += this.mousedown.x;
  y += this.mousedown.y;
  this.calcWorker.postMessage({ action: WorkerMessage.DragOver, pens: this.draggingPens, x, y });

  loadDragImages.call(this, this.draggingPens);
}

/** snapToPen 要读选中框的 pivot；选中框本身不一定带（没旋转过的就没有），拖动前补一个中心点 */
function ensureBoundaryPivot(this: Meta2d) {
  if (this.activeBoundary && !this.activeBoundary.pivot) {
    this.activeBoundary.pivot = {
      x: this.activeBoundary.x + this.activeBoundary.width / 2,
      y: this.activeBoundary.y + this.activeBoundary.height / 2,
    };
  }
}

export function dragPensDone(
  this: Meta2d,
  e: { x: number; y: number; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean },
) {
  this.dragCopy = undefined;
  this.hoverWorker.postMessage({
    action: WorkerMessage.DragPens,
    finish: true,
  });

  // 按下后只动了一下就松手：那一下 mousemove 只把状态切到 CanvasDragPens，dragPens 一次都没跑，
  // activeBoundary.pivot 就没补上 ⇒ 下面 snapToPen 读 pivot.x 抛错，异常还跳过了 handleMouseUp
  // 末尾的状态复位，交互状态卡在拖拽里。这里补上，与 dragPens 同一个默认值。
  // （不能拿 draggingPens 为空当「没拖」提前返回：它是 render 异步回复的，快速拖动时松手前可能还没到。）
  if (!this.activeBoundary || !this.activePens.length) {
    // 与 dragPens 的入口条件一致：没有选中框就没有可拖的东西
    this.draggingPens = undefined;
    return;
  }
  ensureBoundaryPivot.call(this);

  let dx = e.x - this.mousedown.x;
  let dy = e.y - this.mousedown.y;

  // 修饰键读最后一次 mousemove 的 this.mousePos，与预览（dragPens）同源，而不是 mouseup 事件的：
  // 两个时刻的修饰键状态可能不同（远程桌面尤其），读 mouseup 的会让提交与预览不一致（截图 14）。
  const ctrlKey = this.mousePos ? this.mousePos.ctrlKey : e.ctrlKey;
  const shiftKey = this.mousePos ? this.mousePos.shiftKey : e.shiftKey;
  if (ctrlKey) {
    dx = 0;
  }
  if (shiftKey) {
    dy = 0;
  }

  // 最终落点与拖拽预览使用相同的吸附位移，保证图元锚点和连线端点坐标一致。
  const snap = this.snapToPen(dx, dy);
  dx -= snap.offsetX || 0;
  dy -= snap.offsetY || 0;

  // 网格对齐逻辑（与 dragPens 保持一致）
  if (this.options.alignGrid) {
    const gridSize = this.data.grid?.size || this.options.grid?.size || 20;

    if (snap.offsetX === 0) {
      // 使用图元左上角的 x 坐标对齐网格线
      const targetX = this.activeBoundary.x + dx;
      const gridX = Math.round(targetX / gridSize) * gridSize;
      const offset = targetX - gridX;
      dx -= offset;
    }

    if (snap.offsetY === 0) {
      // 使用图元左上角的 y 坐标对齐网格线
      const targetY = this.activeBoundary.y + dy;
      const gridY = Math.round(targetY / gridSize) * gridSize;
      const offset = targetY - gridY;
      dy -= offset;
    }
  }


  // 复制新增
  if (e.altKey) {
    const add: Pen[] = [];
    // 只取最外层再展开：父图元与子图元同时选中时子图元只复制一份，且顺序是先序（父在前）
    const pens = getAllPens(this.penMap, outermostPens(this.penMap, this.activePens));
    for (const pen of pens) {
      if (pen.autoPlay) {
        pen.play = PlayState.Playing;
      }
      const item = structuredClone(pen);
      translateRect(item, dx, dy);
      add.push(item);
    }

    makePensId(add);
    this.addPens(add, Mode.Edit, this.dropPen?.id);

    this.draggingPens = undefined;

    return;
  }

  translatePens.call(this, dx, dy, true);

  if (this.dropPen) {
    this.calcWorker.postMessage({
      action: WorkerMessage.DragOver,
    });

    this.dropPen = undefined;
  }

  this.draggingPens = undefined;
}

export function rotatePens(this: Meta2d, logAction?: boolean) {
  if (hasDisableRotatePen(this.activePens)) {
    return;
  }

  this.activeBoundary.rotate = (calcRotate(this.mousePos, this.rotatePovit) + 360 - this.initRotate) % 360;

  // 自动水平垂直对齐
  if (this.activeBoundary.rotate % 90 < 10) {
    this.activeBoundary.rotate -= this.activeBoundary.rotate % 90;
  }
  if (this.activeBoundary.rotate % 90 > 80) {
    this.activeBoundary.rotate += 90 - (this.activeBoundary.rotate % 90);
  }

  if (this.activeBoundary.rotate % 360 === 0) {
    this.activeBoundary.rotate = 0;
  }

  const angle = this.activeBoundary.rotate - this.lastRotate;
  const _lastBefore = this.lastRotate;
  this.lastRotate = this.activeBoundary.rotate;

  const beforeUpdate: Pen[] = [];
  const update: Pen[] = [];

  for (const pen of this.activePens) {
    rotatePen(this.penMap, pen, angle, this.rotatePovit, beforeUpdate, update, PatchFlag.Active | PatchFlag.Rect);
  }

  updateTransformedConnectedLines.call(this, beforeUpdate, update);

  this.patch(undefined, undefined, beforeUpdate, update);
  this.updateController();

  if (!this.lastBeforeUpdate) {
    this.lastBeforeUpdate = beforeUpdate;
  }

  if (logAction) {
    this.pushAction({
      beforeUpdate: this.lastBeforeUpdate,
      update,
      beforeBoundary: this.beforeBoundary,
      boundary: structuredClone(this.activeBoundary),
    });
  }

  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
  }
}

export function rotatePensDone(this: Meta2d, e: { x: number; y: number }) {
  if (hasDisableRotatePen(this.activePens)) {
    this.lastBeforeUpdate = undefined;
    return;
  }

  rotatePens.call(this, e, true);
  this.lastBeforeUpdate = undefined;

  // 通知calc计算局部重绘pens
  const activePens = [];
  this.activePens.forEach((item: Pen) => {
    if (this.textBoxs[item.id]) {
      item.textBox = this.textBoxs[item.id];
    }
    activePens.push(patchClone(item, { textBox: item.textBox }));
  });

  this.calcWorker.postMessage({
    action: WorkerMessage.Active,
    calcBoundary: true,
    pens: activePens,
    activeBoundary: this.activeBoundary, // 保持控制器不变，重计算局部重绘包围盒
  });
}

export function resizePens(this: Meta2d, logAction?: boolean) {
  if (hasDisableSizePen(this.activePens)) {
    return;
  }

  if (!this.beforeBoundary) {
    this.beforeBoundary = structuredClone(this.activeBoundary);
  }
  this.lastActiveBoundary = structuredClone(this.activeBoundary);

  // 只要有一个被选图元锁定比例，整体就按等比缩放以保证该图元不变形。
  const keepRatio = this.mousePos.shiftKey || this.activePens.some((pen) => pen.ratio);

  this.activeBoundary = resizeRect(
    this.lastActiveBoundary,
    this.sizeDirection,
    this.mousePos.deltaX || 0,
    this.mousePos.deltaY || 0,
    this.mousePos.altKey,
    keepRatio,
  );

  if (!this.activeBoundary.pivot) {
    if (this.activePens.length > 1 || !this.activePens[0].pivot) {
      // 多选时，pivot为选中区域中心
      this.activeBoundary.pivot = {
        x: this.activeBoundary.x + this.activeBoundary.width / 2,
        y: this.activeBoundary.y + this.activeBoundary.height / 2,
      };
    } else {
      this.activeBoundary.pivot = this.activePens[0].pivot;
    }
  }

  const beforeUpdate: Pen[] = [];
  const update: Pen[] = [];
  for (const pen of this.activePens) {
    resizePen(
      this.penMap,
      this.activeBoundary,
      this.lastActiveBoundary,
      pen,
      beforeUpdate,
      update,
      PatchFlag.Active | PatchFlag.Rect,
    );
  }

  updateTransformedConnectedLines.call(this, beforeUpdate, update);

  this.patch(undefined, undefined, beforeUpdate, update);
  this.updateController();

  if (!this.lastBeforeUpdate) {
    this.lastBeforeUpdate = beforeUpdate;
  }

  if (logAction) {
    this.pushAction({
      beforeUpdate: this.lastBeforeUpdate,
      beforeBoundary: this.beforeBoundary,
      update,
      boundary: structuredClone(this.activeBoundary),
    });
  }

  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
    this.pushAction({
      beforeUpdate: this.lastBeforeUpdate,
      beforeBoundary: this.beforeBoundary,
      update,
      boundary: structuredClone(this.activeBoundary),
    });
  }

  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
  }
}

/**
 * 将 resize/rotate 后受影响的连线并入同一批更新。
 *
 * 节点变换会改变其锚点的实际画布坐标，连线端点必须在节点变换完成后重新计算。
 * 连线文字也依赖路径位置，因此需要和连线一起生成 before/update 快照，保证撤销和协作状态完整。
 */
function updateTransformedConnectedLines(this: Meta2d, beforeUpdate: Pen[], update: Pen[]) {
  const beforeUpdateMap = new Map(beforeUpdate.map((pen) => [pen.id, pen]));
  const updateMap = new Map(update.map((pen) => [pen.id, pen]));
  const connectedLineIds = new Set<string>();

  for (const pen of update) {
    pen.connectedLines?.forEach((item) => connectedLineIds.add(item.penId));
  }

  const connectedLines: Pen[] = [];
  const connectedNodes = new Map<string, Pen>();
  for (const lineId of connectedLineIds) {
    const line = this.penMap.get(lineId);
    if (!line) {
      continue;
    }

    if (!beforeUpdateMap.has(line.id)) {
      beforeUpdateMap.set(line.id, patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
    }
    connectedLines.push(line);

    // 正交连线重算需要两端节点；即使另一端没有参与变换，也要放入计算上下文。
    line.anchors?.forEach((anchor) => {
      if (!anchor.connectedPen || connectedNodes.has(anchor.connectedPen)) {
        return;
      }
      const node = this.penMap.get(anchor.connectedPen);
      node && connectedNodes.set(node.id, node);
    });
  }

  updateConnectedLines(connectedLines, Array.from(connectedNodes.values()));
  for (const line of connectedLines) {
    updateMap.set(line.id, patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));

    for (const childId of line.children || []) {
      const text = this.penMap.get(childId);
      if (!text) {
        continue;
      }
      if (!beforeUpdateMap.has(text.id)) {
        beforeUpdateMap.set(
          text.id,
          patchClone(text, { textBox: text.textBox, patchFlag: PatchFlag.Active | PatchFlag.Rect }),
        );
      }
      updateLineTextPosition(line, text);
      updateMap.set(
        text.id,
        patchClone(text, { textBox: text.textBox, patchFlag: PatchFlag.Active | PatchFlag.Rect }),
      );
    }
  }

  beforeUpdate.length = 0;
  beforeUpdate.push(...beforeUpdateMap.values());
  update.length = 0;
  update.push(...updateMap.values());
}

export function reiszePensDone(this: Meta2d, e: { x: number; y: number }) {
  if (hasDisableSizePen(this.activePens)) {
    this.lastBeforeUpdate = undefined;
    return;
  }

  resizePens.call(this, e, true);

  // 通知calc计算局部重绘pens
  const activePens = [];
  this.activePens.forEach((item: Pen) => {
    if (this.textBoxs[item.id]) {
      item.textBox = this.textBoxs[item.id];
    }
    activePens.push(patchClone(item, { textBox: item.textBox }));
  });
  this.calcWorker.postMessage({
    action: WorkerMessage.Active,
    calcBoundary: true,
    pens: activePens,
    activeBoundary: this.activeBoundary,
  });

  this.lastBeforeUpdate = undefined;
}

function hasDisableSizePen(pens: Pen[] = []) {
  return pens.some((pen) => pen.disableSize);
}

function hasDisableRotatePen(pens: Pen[] = []) {
  return pens.some((pen) => pen.disableRotate);
}

export function scaleCanvas(this: Meta2d, scale: number, mouse: Point) {
  // 缩放直接改写 data.x/y/scale。挂起的平移若落在缩放之后派发，会拿新 scale 去
  // 换算旧位移 ⇒ 画面跳一下。先冲刷，保证两者按事件到达顺序生效。
  flushTranslate.call(this);

  const minScale = this.data.minScale ?? this.options.minScale ?? 0.1;
  const maxScale = this.data.maxScale ?? this.options.maxScale ?? 5;
  scale = Math.max(minScale, Math.min(maxScale, scale));
  // 获取相对 canvas 的鼠标坐标
  const rect = this.topElement.getBoundingClientRect();
  let mouseX = mouse.x - rect.left;
  let mouseY = mouse.y - rect.top;

  // 计算鼠标相对于画布原始状态（没有缩放和移动）的坐标
  const baseX = (mouseX - this.data.x) / this.data.scale;
  const baseY = (mouseY - this.data.y) / this.data.scale;

  // 计算画布偏移，保证原始坐标 baseX/baseY 缩放后仍固定在鼠标点位置
  const x = mouseX - baseX * scale;
  const y = mouseY - baseY * scale;

  this.data.x = x;
  this.data.y = y;

  this.data.scale = scale;

  this.componentElementMap.forEach((elem, id) => {
    const pen = this.penMap.get(id);
    this.setElementStyle(elem, pen);
    if (pen && scaleFns[pen.type] && scaleFns[pen.type].call(this, pen, scale) === false) {
      return;
    }
  });
  this.componentInstanceMap.forEach((instance) => {
    // 组件实例的 resize 能力是可选的，播放器等资源实例只需由图元 scale 生命周期同步尺寸。
    if (instance && typeof instance.resize === 'function') {
      instance.resize();
    }
  });

  this.calcWorker.postMessage({
    action: WorkerMessage.TranslateScale,
    x,
    y,
    scale,
  });

  this.hoverWorker.postMessage({
    action: WorkerMessage.TranslateScale,
    x,
    y,
    scale,
  });

  this.utilityWorker.postMessage({
    action: WorkerMessage.Option,
    data: {
      x,
      y,
      scale,
    },
  });
  this.emitter.emit('scale', scale);
}

export function calcWheelOffset(this: Meta2d, e: WheelEvent): number {
  let offset = 0.015;
  if (this.options.scaleOffset) {
    offset = this.options.scaleOffset;
    if (e.deltaY > 0) {
      offset = -this.options.scaleOffset;
    }
  } else {
    let isMac = /mac os /i.test(navigator.userAgent);
    if (isMac) {
      if (!e.ctrlKey) {
        offset *= (e as any).wheelDeltaY / 240;
      } else if (e.deltaY > 0) {
        offset *= -1;
      }
    } else {
      let o = 0.2;
      if (e.deltaY.toString().indexOf('.') !== -1) {
        o = 0.01;
      }
      if (e.deltaY > 0) {
        offset = -o;
      } else {
        offset = o;
      }
    }
  }

  return offset;
}

// ============ 触摸事件处理 ============

/**
 * 将触摸事件转换为鼠标事件对象
 */
function touchToMouseEvent(touch: Touch, clientRect: DOMRect, button: number = 0): any {
  return {
    offsetX: touch.pageX - clientRect.x,
    offsetY: touch.pageY - clientRect.y,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX,
    pageY: touch.pageY,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    button,
    buttons: button === 0 ? 1 : 2,
    preventDefault: () => {},
    stopPropagation: () => {},
  };
}

export function handleTouchstart(this: Meta2d, e: TouchEvent) {
  if (this.options.mode !== Mode.Edit) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const len = e.touches.length;

  if (len === 1) {
    // 单指触摸 = 鼠标左键
    const mouseEvent = touchToMouseEvent(e.touches[0], this.clientRect, 0);
    // 先触发 move 更新 hover 状态，再触发 down
    handleMouseMove.call(this, mouseEvent);
    handleMouseDown.call(this, mouseEvent);
  } else if (len === 2) {
    // 双指触摸 = 手势或右键
    this.twoFingerTouchStart = performance.now();
    this.initTouchDis = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    this.initScale = this.data.scale;
    this.startTouches = e.touches;
    this.touchCenter = {
      x: (e.touches[0].pageX + e.touches[1].pageX) / 2 - this.clientRect.x,
      y: (e.touches[0].pageY + e.touches[1].pageY) / 2 - this.clientRect.y,
    };
  }
}

export function handleTouchmove(this: Meta2d, event: TouchEvent) {
  if (this.options.mode !== Mode.Edit) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const len = event.touches.length;

  if (len === 1) {
    // 单指移动 = 鼠标移动
    const mouseEvent = touchToMouseEvent(event.touches[0], this.clientRect, 0);
    handleMouseMove.call(this, mouseEvent);
  } else if (len === 2 && this.startTouches?.length === 2) {
    // 双指移动 = 缩放/平移手势
    this.twoFingerMoved = true;
    handleTwoFingerGesture.call(this, event);
  }
}

/**
 * 处理双指手势（缩放/平移）
 */
function handleTwoFingerGesture(this: Meta2d, event: TouchEvent): void {
  const touches = event.touches;

  const stateMachine = (this as any).interactionStateMachine as InteractionStateMachine;

  // 检测手势类型
  if (this.interactionStateMachine.state === InteractionMode.None) {
    const gesture = detectTouchGesture.call(this, event);
    if (gesture !== InteractionMode.None) {
      stateMachine.transition(gesture);
    }
  }

  if (this.interactionStateMachine.state === InteractionMode.TouchScaling) {
    // 缩放手势
    if (!(this.options.mode === Mode.Run && this.data.disableScale)) {
      const scale =
        Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) / this.initTouchDis;
      this.scale(this.initScale * scale, this.touchCenter);
    }
  } else if (this.interactionStateMachine.state === InteractionMode.TouchMoving) {
    // 平移手势
    if (!(this.options.mode === Mode.Run && this.data.disableTranslate)) {
      const x = (touches[0].pageX + touches[1].pageX) / 2 - this.clientRect.x;
      const y = (touches[0].pageY + touches[1].pageY) / 2 - this.clientRect.y;

      if (this.lastOffsetX !== undefined) {
        const dx = x - this.lastOffsetX;
        const dy = y - this.lastOffsetY;
        // 增量语义：lastOffsetX/Y 在下面无条件更新，丢一次就永久少滚一段 ⇒ 必须累加合并
        requestTranslate.call(this, { x: dx / this.data.scale, y: dy / this.data.scale });
      }

      this.lastOffsetX = x;
      this.lastOffsetY = y;
    }
  }
}

/**
 * 检测触摸手势类型
 */
function detectTouchGesture(this: Meta2d, event: TouchEvent): InteractionMode {
  const touches = event.touches;
  const x1 = this.startTouches[0].pageX - touches[0].pageX;
  const x2 = this.startTouches[1].pageX - touches[1].pageX;
  const y1 = this.startTouches[0].pageY - touches[0].pageY;
  const y2 = this.startTouches[1].pageY - touches[1].pageY;

  // 判断是缩放还是平移
  const isDiagonal = ((x1 >= 0 && x2 < 0) || (x1 <= 0 && x2 > 0)) && ((y1 >= 0 && y2 < 0) || (y1 <= 0 && y2 > 0));

  return isDiagonal ? InteractionMode.TouchScaling : InteractionMode.TouchMoving;
}

export function handleTouchend(this: Meta2d, event: TouchEvent) {
  if (this.options.mode !== Mode.Edit) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  // 初始化状态机
  if (!(this as any).interactionStateMachine) {
    (this as any).interactionStateMachine = new InteractionStateMachine();
  }
  const stateMachine = (this as any).interactionStateMachine as InteractionStateMachine;

  const len = event.touches.length;

  if (len === 0) {
    // 所有手指离开
    if (this.startTouches?.length === 2 && !this.twoFingerMoved) {
      // 双指点击（没有移动）= 右键菜单
      const touch = event.changedTouches[0];
      const mouseEvent = touchToMouseEvent(touch, this.clientRect, 2);
      handleMouseDown.call(this, mouseEvent);
      handleMouseUp.call(this, mouseEvent);
    } else if (!this.startTouches || this.startTouches.length === 1) {
      // 单指操作结束
      const mouseEvent = touchToMouseEvent(event.changedTouches[0], this.clientRect, 0);
      handleMouseUp.call(this, mouseEvent);
    }

    // 清理触摸状态
    this.touchCenter = undefined;
    this.startTouches = undefined;
    this.lastOffsetX = undefined;
    this.lastOffsetY = undefined;
    this.twoFingerTouchStart = undefined;
    this.twoFingerMoved = false;

    // 重置手势状态（仅当处于手势状态时）
    if (stateMachine.isTouchGesture()) {
      stateMachine.transition(InteractionMode.None);
    }
  } else if (len === 1 && this.startTouches?.length === 2) {
    // 双指变单指，重置手势状态
    this.touchCenter = undefined;
    this.startTouches = undefined;
    this.lastOffsetX = undefined;
    this.lastOffsetY = undefined;
    this.twoFingerMoved = false;

    if (stateMachine.isTouchGesture()) {
      stateMachine.transition(InteractionMode.None);
    }
  }
}

function getComponentRoot(pens: Pen[]): Pen | undefined {
  // 组件升级后会按父子层级排序，根组合不一定位于数组第一个位置。
  const penIds = new Set(pens.map((pen) => pen.id));
  return pens.find(
    (pen) =>
      !!pen.id &&
      pen.type === 'group' &&
      (pens.some((child) => child.parentId === pen.id) || pen.children?.some((id) => penIds.has(id))) &&
      // 嵌套组合中只选择最外层根节点，避免只平移某一个子组合。
      (!pen.parentId || !penIds.has(pen.parentId)),
  );
}

function isComponentPens(pens: Pen[]): boolean {
  return !!getComponentRoot(pens);
}

function translateComponentPens(pens: Pen[], x: number, y: number) {
  const rootPen = getComponentRoot(pens);
  if (!rootPen) {
    return;
  }

  const penMap = new Map<string, Pen>();
  for (const pen of pens) {
    pen.id && penMap.set(pen.id, pen);
  }

  // 以根组合为基准统一平移，确保所有后代图元的相对位置和内部几何保持不变。
  translatePen(penMap, rootPen, x - rootPen.x, y - rootPen.y);
}

export function handleDragover(this: Meta2d, event: DragEvent) {
  event.preventDefault();

  const x = Math.round((event.offsetX - this.data.x) / this.data.scale);
  const y = Math.round((event.offsetY - this.data.y) / this.data.scale);
  this.calcWorker.postMessage({ action: WorkerMessage.DragOver, x, y });

  if (this.addCaches) {
    if (this.dragStart) {
      this.hoverWorker.postMessage({
        action: WorkerMessage.DragPens,
        x: x - this.dragStart.x,
        y: y - this.dragStart.y,
      });
      this.dragStart.x = x;
      this.dragStart.y = y;
      return;
    }

    let previewPens = this.addCaches;
    let previewX = x;
    let previewY = y;
    if (isComponentPens(previewPens)) {
      previewPens = structuredClone(previewPens);
      const rootPen = getComponentRoot(previewPens);
      if (!rootPen) {
        return;
      }

      translateComponentPens(
        previewPens,
        Math.round(x - (rootPen.width || 0) / 2),
        Math.round(y - (rootPen.height || 0) / 2),
      );
      // 组合组件已经按鼠标位置完成平移，Worker 只需接收零位移进行首次绘制。
      previewX = 0;
      previewY = 0;
    }

    loadDragImages.call(this, previewPens);
    this.hoverWorker.postMessage({ action: WorkerMessage.DragPens, x: previewX, y: previewY, pens: previewPens });
    this.dragStart = { x, y };
  }
}

export async function handleDrop(this: Meta2d, event: DragEvent) {
  if (this.options.mode !== Mode.Edit) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  this.dragStart = undefined;

  const cachedPens = this.addCaches;
  let obj: Pen[];
  if (cachedPens) {
    obj = cachedPens;
  } else {
    const { files } = event.dataTransfer;
    if (!files.length || !files[0].type.match('image.*')) {
      return;
    }

    const pen = await fileToPen(files[0], this.uploadFn);
    if (!pen) {
      return;
    }
    obj = [pen];
  }

  const rootPen = getComponentRoot(obj);
  const w = rootPen?.width || obj[0].width || 0;
  const h = rootPen?.height || obj[0].height || 0;
  const componentPens = isComponentPens(obj);
  const cursorX = Math.round((event.offsetX - this.data.x) / this.data.scale);
  const cursorY = Math.round((event.offsetY - this.data.y) / this.data.scale);
  if (componentPens) {
    translateComponentPens(obj, Math.round(cursorX - w / 2), Math.round(cursorY - h / 2));
  } else if (cachedPens) {
    // 普通拖拽缓存中的坐标是相对鼠标的位置，落图时直接转换为画布坐标。
    obj.forEach((pen: Pen) => {
      pen.x = (pen.x ?? 0) + cursorX;
      pen.y = (pen.y ?? 0) + cursorY;
    });
  } else {
    obj[0].x = Math.round((event.offsetX - this.data.x - w / 2) / this.data.scale);
    obj[0].y = Math.round((event.offsetY - this.data.y - h / 2) / this.data.scale);
  }

  this.addCaches = undefined;

  makePensId(obj);

  if (this.dropPen && this.dropPen.type) {
    // 更新关联属性
    dropFns[this.dropPen.type] && dropFns[this.dropPen.type](obj);
  }

  this.addPens(obj, Mode.Edit, this.dropPen?.id);

  this.hoverWorker.postMessage({
    action: WorkerMessage.DragOver,
  });

  this.calcWorker.postMessage({
    action: WorkerMessage.DragOver,
  });

  this.dropPen = undefined;
}

async function fileToPen(file: File, uploadFn: Function) {
  let url = '';
  if (uploadFn) {
    url = await uploadFn(file);
  } else if (this.store.options.uploadUrl) {
    url = await uploadFile(
      file,
      this.store.options.uploadUrl,
      this.store.options.uploadParams,
      this.store.options.uploadHeaders,
    );
  } else {
    url = await fileToBase64(file);
  }

  if (!url) {
    return;
  }

  return {
    name: file.type === 'image/gif' ? 'gif' : 'image',
    image: url,
  };
}

export function magnifier(this: Meta2d) {
  if (
    !Number.isFinite(this.mousePos.x) ||
    !Number.isFinite(this.mousePos.y) ||
    !Number.isFinite(this.mousePos.offsetX) ||
    !Number.isFinite(this.mousePos.offsetY)
  ) {
    return;
  }

  const now = Date.now();
  if (now - this.lastMagnifierCall >= 16) {
    const radius = 100;
    this.renderWorker.postMessage({
      action: WorkerMessage.Magnifier,
      x: this.mousePos.x,
      y: this.mousePos.y,
      offsetX: this.mousePos.offsetX,
      offsetY: this.mousePos.offsetY,
      radius,
    });
    this.lastMagnifierCall = now;
  }
}

