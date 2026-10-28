import { WorkerMessage, AlignType, AnchorMode, FitViewOrigin, Mode, InteractionMode } from './types';
import { KeyEventPen } from './const/keyEvent';
import { Meta2d } from './meta2d';
import { scaleCanvas, resizePens } from './meta2d-mouse';
import {
  getAllPens,
  getBlock,
  HandleType,
  IndexPlan,
  outermostPens,
  planAfterBlock,
  planAppendToParent,
  makePensId,
  patchClone,
  PatchFlag,
  Pen,
  PenCategory,
  reconnectLine,
  TextAlign,
  translatePen,
  translateRect,
  updateConnectedLines,
  updateLineTextPosition,
} from './models';
import { s8 } from './utils';

export const KeydownFns: { [key: string]: Function } = {
  ' ': space,
  ArrowUp: arrowUp,
  ArrowDown: arrowDown,
  ArrowLeft: arrowLeft,
  ArrowRight: arrowRight,
  Backspace: del,
  Delete: del,
  Escape: esc,
  Enter: enter,
  '+': scaleUp,
  '=': scaleUp,
  '-': scaleDown,
  '>': increaseTextSize,
  '<': decreaseTextSize,
  ')': resetView,
  Insert: resetView,
  '!': fitWindowSize,
  '！': fitWindowSize,
  End: fitWindowSize,
  '@': scale,
  '1': removeHandle,
  '2': setMirrorHandle,
  '3': setSmoothHandle,
  '4': setFreeHandle,
  '[': layerDown,
  ']': layerUp,
  a: a,
  A: a,
  b: b,
  B: b,
  c: c,
  C: c,
  d: d,
  D: d,
  e: e,
  E: e,
  g: g,
  G: g,
  h: h,
  H: h,
  i: i,
  I: i,
  l: l,
  L: l,
  m: m,
  M: m,
  o: o,
  O: o,
  p: toggleDrawline,
  P: toggleDrawline,
  r: r,
  R: r,
  s: s,
  S: s,
  t: t,
  T: t,
  v: v,
  V: v,
  w: w,
  W: w,
  x: cut,
  X: cut,
  y: y,
  Y: y,
  z: z,
  Z: z,
};

const ClipboardName = 'le5le-clipboard';

export function scaleUp(this: Meta2d, e: KeyboardEvent) {
  this.scale(this.data.scale + 0.1);
}

export function scaleDown(this: Meta2d, e: KeyboardEvent) {
  this.scale(this.data.scale - 0.1);
}

function fitWindowSize(this: Meta2d, e: KeyboardEvent) {
  if ((e.code === 'Digit1' && e.shiftKey) || e.code === 'Numpad1') {
    this.fitView(true, 10);
  }
}

function resetView(this: Meta2d, e: KeyboardEvent) {
  if ((e.code === 'Digit0' && e.shiftKey) || e.code === 'Numpad0') {
    this.fitView(1, 10, FitViewOrigin.Left);
  }
}

function scale(this: Meta2d, e: KeyboardEvent) {
  if ((e.code === 'Digit2' && e.shiftKey) || e.code === 'Numpad2') {
    scaleCanvas.call(this, 1.1, { x: this.clientRect.width / 2, y: this.clientRect.height / 2 });
    return;
  }

  // 原有的 Ctrl/Cmd+2 功能保持不变
  if (!e.ctrlKey && !e.metaKey) {
    return;
  }
  scaleCanvas.call(this, 1.1, { x: this.clientRect.width / 2, y: this.clientRect.height / 2 });
}

function increaseTextSize(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const vals = [];
    if (e.shiftKey) {
      for (const pen of this.activePens) {
        const fontSize = pen.fontSize || 1;
        vals.push({ id: pen.id, fontSize: fontSize + 1 });
      }
    } else if (e.altKey) {
      for (const pen of this.activePens) {
        const lineHeight = pen.lineHeight || 1;
        vals.push({ id: pen.id, lineHeight: lineHeight + 0.1 });
      }
    }
    vals.length && this.setValue(vals);
  }
}

function decreaseTextSize(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const vals = [];
    if (e.shiftKey) {
      for (const pen of this.activePens) {
        const fontSize = pen.fontSize || 1;
        vals.push({ id: pen.id, fontSize: fontSize - 1 });
      }
    } else if (e.altKey) {
      for (const pen of this.activePens) {
        const lineHeight = pen.lineHeight || 1;
        vals.push({ id: pen.id, lineHeight: lineHeight - 0.1 });
      }
    }
    vals.length && this.setValue(vals);
  }
}

function layerUp(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.altKey) {
      this.toFrontOrBack(true);
      return;
    }
    this.moveLayer(true);
  }
}

function layerDown(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.altKey) {
      this.toFrontOrBack(false);
      return;
    }
    this.moveLayer(false);
  }
}

function a(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.shiftKey) {
      selectPens.call(this, true);
      return;
    }
    selectPens.call(this);
    return;
  }

  if (e.altKey) {
    this.alignPens(AlignType.Left);
    return;
  }

  if (!e.shiftKey && !e.repeat) {
    this.toggleAnchorEdit();
  }
}

function b(this: Meta2d, e: KeyboardEvent) {
  if ((!e.ctrlKey && !e.metaKey) || !this.activePens.length) {
    return;
  }
  const vals = [];
  for (const pen of this.activePens) {
    vals.push({ id: pen.id, fontWeight: pen.fontWeight === 'bold' ? 'normal' : 'bold' });
  }
  this.setValue(vals);
}

function c(this: Meta2d, e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    copy.call(this);
    return;
  }
}

function d(this: Meta2d, e: KeyboardEvent) {
  if (e.altKey) {
    this.alignPens(AlignType.Right);
    return;
  }
}

function g(this: Meta2d, e: KeyboardEvent) {
  if (!this.activePens.length || (!e.ctrlKey && !e.metaKey)) {
    return;
  }

  if (e.shiftKey) {
    this.ungroup();
    return;
  }

  this.group();
}

function e(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.repeat) {
    if (this.options.anchorMode !== AnchorMode.Hover) {
      this.setOptions({ anchorMode: AnchorMode.Hover });
    } else {
      this.setOptions({ anchorMode: AnchorMode.Hidden });
    }
  }
}

function h(this: Meta2d, e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    const vals = [];
    for (let pen of this.activePens) {
      const visible = pen.visible ?? true;
      vals.push({ id: pen.id, visible: !visible });
    }
    this.setValue(vals);
    return;
  }

  if (e.altKey && e.shiftKey) {
    this.distributePensEvenly(AlignType.HorizontalDistribute);
    return;
  }

  if (e.altKey) {
    this.alignPens(AlignType.Center);
    return;
  }

  if (e.shiftKey) {
    const vals = [];
    for (let pen of this.activePens) {
      const filpY = pen.flipY || false;
      vals.push({ id: pen.id, flipY: !filpY });
    }
    this.setValue(vals);
    return;
  }
}

function i(this: Meta2d, e: KeyboardEvent) {
  if ((!e.ctrlKey && !e.metaKey) || !this.activePens.length) {
    return;
  }
  const vals = [];
  for (const pen of this.activePens) {
    vals.push({ id: pen.id, fontStyle: pen.fontStyle === 'italic' ? 'normal' : 'italic' });
  }
  this.setValue(vals);
}

function l(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const vals = [];
    if (e.shiftKey) {
      for (let pen of this.activePens) {
        const locked = pen.locked || false;
        vals.push({ id: pen.id, locked: !locked });
      }
      this.setValue(vals);
    }

    if (e.altKey) {
      for (let pen of this.activePens) {
        vals.push({ id: pen.id, textAlign: TextAlign.Left });
      }
    }
    vals.length && this.setValue(vals);
    return;
  }
  if (!e.altKey) {
    addPenByKey.call(this, e);
    return;
  }
}

function o(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    this.emitter.emit('openFile');
    return;
  }

  // O：进入 / 退出正交连线模式（原来是放一个圆）
  toggleDrawline.call(this, e, 'orthogonal');
}

function m(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.repeat) {
    // this.toggleMap();
    !this.map?.isShow ? this.showMap() : this.hideMap();
  }
}

function r(this: Meta2d, e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.altKey) {
    const vals = [];
    for (let pen of this.activePens) {
      vals.push({ id: pen.id, textAlign: TextAlign.Right });
    }
    this.setValue(vals);
    return;
  }

  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    this.toggleRule();
    return;
  }

  if (e.altKey) {
    if (!this.data.grid) {
      this.data.grid = {
        enable: true,
      };
    }

    this.data.grid.enable = !this.data.grid.enable;
    this.utilityWorker.postMessage({
      action: WorkerMessage.Option,
      data: this.data,
    });
    return;
  }

  if (!e.ctrlKey && !e.metaKey) {
    addPenByKey.call(this, e);
  }
}

function s(this: Meta2d, e: KeyboardEvent) {
  if (e.altKey) {
    this.alignPens(AlignType.Bottom);
    return;
  }
}

function t(this: Meta2d, e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.altKey) {
    const vals = [];
    for (let pen of this.activePens) {
      vals.push({ id: pen.id, textAlign: TextAlign.Center });
    }
    this.setValue(vals);
    return;
  }

  addPenByKey.call(this, e);
}

function v(this: Meta2d, e: KeyboardEvent) {
  if (e.shiftKey && e.altKey) {
    this.distributePensEvenly(AlignType.VerticalDistribute);
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    paste.call(this, e);
    return;
  }

  if (e.shiftKey) {
    const vals = [];
    for (let pen of this.activePens) {
      const filpX = pen.flipX || false;
      vals.push({ id: pen.id, flipX: !filpX });
    }
    this.setValue(vals);
    return;
  }
}

function w(this: Meta2d, e: KeyboardEvent) {
  if (e.altKey) {
    this.alignPens(AlignType.Top);
    return;
  }
}

function y(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    this.redo();
  }
}

export function cut(this: Meta2d, e?: KeyboardEvent) {
  if (e && !e.ctrlKey && !e.metaKey) {
    return;
  }
  copy.call(this);
  del.call(this);
}

function z(this: Meta2d, e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    this.redo();
  } else if (e.ctrlKey || e.metaKey) {
    this.undo();
  } else if (!e.altKey && !e.shiftKey) {
    // 忽略长按产生的重复事件，避免放大镜状态连续切换。
    if (e.repeat) {
      return;
    }

    const enabled = this.interactionStateMachine.state !== InteractionMode.CanvasMagnifier;
    this.showMagnifier(enabled);
  }
}

function setMirrorHandle(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    this.setAnchorHandleType(HandleType.Mirror);
  }
}

function setSmoothHandle(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    this.setAnchorHandleType(HandleType.Smooth);
  }
}

function setFreeHandle(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    this.setAnchorHandleType(HandleType.Free);
  }
}

function removeHandle(this: Meta2d, e: KeyboardEvent) {
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
    this.setAnchorHandleType();
  }
}

async function del(this: Meta2d) {
  if (!this.activePens.length) {
    return;
  }

  this.deletePens(this.activePens, Mode.Edit);
}

/** 退出连线 / 铅笔模式，回到普通编辑状态（不清除 Active）。O 临时设的正交线型一并还原。 */
function exitDrawlineMode(this: Meta2d) {
  let anchorMode = this.options?.anchorMode || AnchorMode.Hidden;
  anchorMode &= ~AnchorMode.Drawline;
  anchorMode &= ~AnchorMode.Pencil;
  this.setOptions({ anchorMode });
  restoreDrawModeLineType.call(this);
  this.topElement.style.cursor = `default`;

  this.hoverWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
  this.calcWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
}

function esc(this: Meta2d, e: KeyboardEvent) {
  if (this.editingAnchor) {
    this.toggleAnchorEdit(false);
    return;
  }

  // 画线过程中 Esc：丢弃正在画的线，并直接退出连线模式（一次到位，不再分两次）
  if (
    this.interactionStateMachine.state === InteractionMode.DrawingLine ||
    this.interactionStateMachine.state === InteractionMode.DrawingLineReady
  ) {
    this.hoverWorker.postMessage({ action: WorkerMessage.Esc });
    this.interactionStateMachine.state = InteractionMode.None;
    // 取消临时连线时只清理连接引用，已经落地并记录历史的动态锚点仍然保留。
    this.drawingLineFrom = undefined;
    this.drawingLineTo = undefined;
    this.mousedown = undefined;
    this.draggingAnchor = undefined;
    restoreDrawingLineType.call(this);
    exitDrawlineMode.call(this);
    return;
  }

  // 连线模式下还没开始画：退出连线模式，但不清除 Active
  if (this.options.anchorMode & AnchorMode.Drawline) {
    exitDrawlineMode.call(this);
    return;
  }

  if (this.interactionStateMachine.state === InteractionMode.CanvasDragPens) {
    this.hoverWorker.postMessage({
      action: WorkerMessage.DragPens,
    });
    this.renderWorker.postMessage({
      action: WorkerMessage.DragPens,
      render: true,
      dragCopy: true,
    });
  } else {
    this.hoverWorker.postMessage({
      action: WorkerMessage.Hover,
      clear: true,
    });
  }

  this.mousedown = undefined;
  this.addCaches = undefined;
  this.interactionStateMachine.state = InteractionMode.None;
  this.drawingLineFrom = undefined;
  this.drawingLineTo = undefined;
  restoreDrawingLineType.call(this);
  restoreDrawModeLineType.call(this);

  let anchorMode = this.options?.anchorMode || AnchorMode.Hidden;
  anchorMode &= ~AnchorMode.Drawline;
  anchorMode &= ~AnchorMode.Pencil;
  this.setOptions({ anchorMode });

  this.draggingAnchor = undefined;

  this.topElement.style.cursor = `default`;

  setTimeout(() => {
    this.dragStart = undefined;
  }, 200);

  this.hoverWorker.postMessage({ action: WorkerMessage.Esc });
  this.clearActive();
}

/**
 * 在当前位置完成正在画的连线（不闭合）。不在画线时返回 false。
 * 只点了起点、还不够两个锚点时，hover worker 会按取消处理（onDrawingLine 里 anchors.length < 2 的分支）。
 */
function finishDrawingLine(this: Meta2d): boolean {
  if (this.interactionStateMachine.state !== InteractionMode.DrawingLine) {
    return false;
  }
  // 在空白处完成连线，不应沿用最后一次悬浮锚点作为终点关系。
  this.drawingLineTo = undefined;
  this.hoverWorker.postMessage({
    action: WorkerMessage.DrawingLine,
    lineType: this.drawingLineType ?? this.lineType,
    finish: true,
  });
  this.interactionStateMachine.transition(InteractionMode.None);
  this.hoverWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
  this.calcWorker.postMessage({ action: WorkerMessage.ActiveAnchor });
  return true;
}

function enter(this: Meta2d, e: KeyboardEvent) {
  // 画线过程中 Enter：完成这条线（不闭合），并退出连线模式，不再继续画
  if (finishDrawingLine.call(this)) {
    exitDrawlineMode.call(this);
    return;
  }

  // 选中连线时：切换闭合状态
  if (this.activePens.length === 1 && this.activePens[0].category === PenCategory.Line) {
    const pen = this.activePens[0];
    this.setValue({ id: pen.id, close: !pen.close });
  }
}

function space(this: Meta2d, e: KeyboardEvent) {
  // 画线过程中：整条线在「原线型 ⇄ 正交线」之间切换（空格在画线时原本没有作用）
  if (this.interactionStateMachine.state === InteractionMode.DrawingLine) {
    if (!e.repeat) {
      toggleDrawingOrthogonal.call(this);
    }
    return;
  }
  if (this.interactionStateMachine.state === InteractionMode.None) {
    this.interactionStateMachine.transition(InteractionMode.CanvasTranslate);
  }
}

/**
 * 画线中切换正交线：在「这条线开始时的线型 ⇄ 正交线」之间来回切。
 * 开始时就是正交（默认线型或正交快捷键进来的），另一头取直线。
 * 当前操作线型与全局默认 lineType 分开保存，因此切换不会影响下一条线。
 */
function toggleDrawingOrthogonal(this: Meta2d) {
  this.drawingLineType ??= this.lineType;
  this.drawingLineTypeBefore ??= this.drawingLineType;
  const base = this.drawingLineTypeBefore;
  const other = base === 'orthogonal' ? 'line' : 'orthogonal';
  this.drawingLineType = this.drawingLineType === base ? other : base;
  this.hoverWorker.postMessage({
    action: WorkerMessage.SwitchDrawingLineType,
    lineType: this.drawingLineType,
    point: this.mousePos ? { x: this.mousePos.x, y: this.mousePos.y } : undefined,
  });
}

/** 一条线结束（完成 / 取消）时调用：清理本次画线的临时线型状态。 */
export function restoreDrawingLineType(this: Meta2d) {
  this.drawingLineTypeBefore = undefined;
  this.drawingLineType = undefined;
}

function arrowUp(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const delta = e.shiftKey ? -10 : -1;
    adjustPensSize.call(this, delta);
    return;
  }

  if (!this.activePens.length) {
    return;
  }

  let d = -1;
  if (e.shiftKey) {
    d = -5;
  }
  if (e.ctrlKey || e.metaKey) {
    d = -10;
  }

  translatePens.call(this, 0, d, true);
}

function arrowDown(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const delta = e.shiftKey ? 10 : 1;
    adjustPensSize.call(this, delta);
    return;
  }

  if (e.code === 'Numpad2') {
    // 缩放到选中区域
    return;
  }

  if (!this.activePens.length) {
    return;
  }

  let d = 1;
  if (e.shiftKey) {
    d = 5;
  }
  if (e.ctrlKey || e.metaKey) {
    d = 10;
  }

  translatePens.call(this, 0, d, true);
}

function arrowLeft(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const delta = e.shiftKey ? -10 : -1;
    adjustPensSize.call(this, delta);
    return;
  }

  if (!this.activePens.length) {
    return;
  }

  let d = -1;
  if (e.shiftKey) {
    d = -5;
  }
  if (e.ctrlKey || e.metaKey) {
    d = -10;
  }

  this.lastBeforeUpdate = undefined;
  this.beforeBoundary = undefined;
  translatePens.call(this, d, 0, true);
}

function arrowRight(this: Meta2d, e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    const delta = e.shiftKey ? 10 : 1;
    adjustPensSize.call(this, delta);
    return;
  }

  if (!this.activePens.length) {
    return;
  }

  let d = 1;
  if (e.shiftKey) {
    d = 5;
  }
  if (e.ctrlKey || e.metaKey) {
    d = 10;
  }

  this.lastBeforeUpdate = undefined;
  this.beforeBoundary = undefined;
  translatePens.call(this, d, 0, true);
}

/**
 * P / O：连线模式的开关（Shift+P 是铅笔）。
 * - 没在连线模式：进入。lineType 只由 O 传入（'orthogonal'），这次连线模式里的线都用正交线，退出后还原。
 * - 画线过程中：完成当前这条线，**留在连线模式**，准备画下一条（结束画线用 Enter，放弃用 Esc）。
 * - 连线模式下还没开始画：退出连线模式。
 */
function toggleDrawline(this: Meta2d, e: KeyboardEvent, lineType?: string) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) {
    return;
  }
  if (!e.shiftKey && finishDrawingLine.call(this)) {
    return;
  }
  this.toggleAnchorEdit(false);
  let anchorMode = this.options?.anchorMode || AnchorMode.Hidden;
  if (!e.shiftKey && anchorMode & AnchorMode.Drawline) {
    exitDrawlineMode.call(this);
    return;
  }
  if (e.shiftKey) {
    anchorMode &= ~AnchorMode.Drawline;
    anchorMode ^= AnchorMode.Pencil;
  } else {
    anchorMode &= ~AnchorMode.Pencil;
    anchorMode |= AnchorMode.Drawline;
  }
  this.setOptions({ anchorMode });

  if (lineType && anchorMode & AnchorMode.Drawline) {
    this.drawModeLineTypeBefore = this.lineType;
    this.lineType = lineType;
  }
}

/** 退出连线模式时：把 O 临时设的线型还原成进入前的默认线型 */
function restoreDrawModeLineType(this: Meta2d) {
  if (this.drawModeLineTypeBefore !== undefined) {
    this.lineType = this.drawModeLineTypeBefore;
    this.drawModeLineTypeBefore = undefined;
  }
}

function adjustPensSize(this: Meta2d, delta: number) {
  if (!this.activePens.length || !this.activeBoundary || !delta || !isFinite(delta)) {
    return;
  }

  const previousSizeDirection = this.sizeDirection;
  this.sizeDirection = 3;

  resizePens.call(
    this,
    {
      x: this.activeBoundary.ex,
      y: this.activeBoundary.ey,
      deltaX: delta,
      deltaY: delta,
      shiftKey: false,
      altKey: true,
    },
    true,
  );

  this.sizeDirection = previousSizeDirection;
}

export function selectPens(this: Meta2d, invert?: boolean) {
  this.selectAll(invert);
}

export async function copy(this: Meta2d, e?: KeyboardEvent) {
  if (!this.activePens || !this.activePens.length) {
    return;
  }
  if (e && !e.ctrlKey && !e.metaKey) {
    return;
  }
  // 剪贴板里就是完整的一份：选中图元连同全部子孙，先序（父在前）。
  // 先去掉祖先也被选中的图元，否则子图元可能排在父图元前面，粘贴后层级就不是「父在前」了
  const add: Pen[] = getAllPens(this.penMap, outermostPens(this.penMap, this.activePens)).map((pen) =>
    structuredClone(pen),
  );

  if (!this.activeBoundary.pivot) {
    this.activeBoundary.pivot = {
      x: this.activeBoundary.x + this.activeBoundary.width / 2,
      y: this.activeBoundary.y + this.activeBoundary.height / 2,
    };
  }

  const clipboard = JSON.stringify({
    povit: this.activeBoundary.pivot,
    pens: add,
  });

  if (this.options.clipboard !== false && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(clipboard);
    } catch {
      localStorage.setItem(ClipboardName, clipboard);
    }
  } else {
    localStorage.setItem(ClipboardName, clipboard);
  }
}

function addPenByKey(this: Meta2d, e: KeyboardEvent) {
  const penType = e.key.toLowerCase();
  const templatePen = structuredClone(KeyEventPen[penType]);
  if (!templatePen) {
    return;
  }

  if (this.mousePos?.x && this.mousePos?.y) {
    templatePen.x = this.mousePos.x - templatePen.width / 2;
    templatePen.y = this.mousePos.y - templatePen.height / 2;
  } else {
    templatePen.x = (this.clientRect.width / 2 - this.data.x) / this.data.scale - templatePen.width / 2;
    templatePen.y = (this.clientRect.height / 2 - this.data.y) / this.data.scale - templatePen.height / 2;
  }

  if (penType === 'l') {
    templatePen.anchors = [
      { length: 0, x: templatePen.x, y: templatePen.y, id: s8() },
      { length: 100, x: templatePen.x + templatePen.width, y: templatePen.y, id: s8() },
    ];
  }

  const add = [templatePen];
  this.addPens(add, Mode.Edit);
}

export async function paste(this: Meta2d, e?: KeyboardEvent) {
  let clipboardText: string;
  if (this.options.clipboard !== false && navigator.clipboard) {
    try {
      clipboardText = await navigator.clipboard?.readText();
    } catch {
      clipboardText = localStorage.getItem(ClipboardName);
    }
  } else {
    clipboardText = localStorage.getItem(ClipboardName);
  }

  let clipboard: any;
  if (clipboardText) {
    try {
      clipboard = JSON.parse(clipboardText);
    } catch (e) {
      return;
    }
  }

  if (!clipboard || !clipboard.povit) {
    return;
  }

  let position = this.mousePos; // 鼠标位置粘贴
  if (e?.altKey) {
    // 视图中心粘贴
    position = {
      x: (this.clientRect.width / 2 - this.data.x) / this.data.scale,
      y: (this.clientRect.height / 2 - this.data.y) / this.data.scale,
    };
  } else if (e?.shiftKey) {
    // 原位粘贴
    position = clipboard.povit;
  }

  let dx = position?.x - clipboard.povit.x;
  let dy = position?.y - clipboard.povit.y;
  if (!e || isNaN(dx) || isNaN(dy)) {
    dx = 20;
    dy = 20;
  }

  // 剪贴板在 copy 时已经带上了全部子孙。不能再按原 id 去当前画布里查子孙追加：
  // 同一个旧 id 出现两次，makePensId 只把后一份挂进新父图元的 children，前一份成了孤儿
  // （parentId 指向新父图元、children 里却没有它；位置还是原图元粘贴时的位置）。
  // 剪贴板也可能来自别的页面，当前画布里的同 id 图元与它无关。
  const add: Pen[] = [];
  for (const pen of clipboard.pens) {
    const item = structuredClone(pen);
    translateRect(item, dx, dy);
    add.push(item);
  }

  makePensId(add);
  this.addPens(add, Mode.Edit);
}

export function translatePens(this: Meta2d, dx: number, dy: number, logAction?: boolean) {
  if (this.activePens.every((pen) => pen.locked)) {
    return;
  }
  const beforeUpdate: Pen[] = [];
  const update: Pen[] = [];
  const activeIds = this.activePens.map((pen) => pen.id).filter((id): id is string => Boolean(id));

  // 拖入 / 拖出容器会改 parentId 与 index。translatePen 是在调用那一刻记撤销快照的，而这两样都在它之前就改了 ⇒
  // 先记下旧值，最后回填进 beforeUpdate；否则撤销后图元仍挂在容器下、容器的 children 却已还原（孤儿）
  const oldLayer = new Map<string, { parentId: string; index: number }>();
  const rememberLayer = (pens: Pen[]) =>
    pens.forEach((p) => oldLayer.has(p.id) || oldLayer.set(p.id, { parentId: p.parentId, index: p.index }));

  let parent: Pen;
  let layerPlan: IndexPlan;
  if (this.dropPen) {
    // 拖拽到容器里面了
    parent = this.penMap.get(this.dropPen.id);

    // children 要复制一份：下面会往 parent.children 里 push，快照若引用同一个数组，撤销时就还原不了
    beforeUpdate.push(patchClone(parent, { children: parent.children && [...parent.children], patchFlag: PatchFlag.Rect }));

    if (!parent.children) {
      parent.children = [];
    }

    const adopted = this.activePens.filter((item: Pen) => !item.parentId && item.id !== parent.id);
    const blocks = adopted.map((item: Pen) => getBlock(this.penMap, item).pens);
    blocks.forEach(rememberLayer);
    for (const item of adopted) {
      item.parentId = parent.id;
      parent.children.push(item.id);
    }
    // 放进容器最上层（.docs/pen-layer-order.md §5.6），被拖的块按原顺序
    const moving = blocks.sort((a, b) => a[0].index - b[0].index).flat();
    layerPlan = planAppendToParent(this.penMap, parent, moving);
  } else if (this.activePens.length === 1 && this.activePens[0].parentId) {
    parent = this.penMap.get(this.activePens[0].parentId);

    if (parent.container && parent.category !== PenCategory.Line) {
      // 移出容器
      beforeUpdate.push(patchClone(parent, { children: parent.children && [...parent.children], patchFlag: PatchFlag.Rect }));

      const item = this.penMap.get(this.activePens[0].id);
      const block = getBlock(this.penMap, item).pens;
      rememberLayer(block);
      parent.children = parent.children.filter((id) => id !== item.id);
      this.activePens[0].parentId = undefined;
      item.parentId = undefined;
      // 放到容器块之上：拖出后仍画在容器上方
      layerPlan = planAfterBlock(this.penMap, parent, block);
    }
  }
  layerPlan?.forEach((index, id) => {
    const pen = this.penMap.get(id);
    pen && (pen.index = index);
  });

  const activePens = [];
  this.activePens.forEach((item: Pen) => {
    if (this.textBoxs[item.id]) {
      item.textBox = structuredClone(this.textBoxs[item.id]);
    }

    translatePen(this.penMap, item, dx, dy, beforeUpdate, update, PatchFlag.Active | PatchFlag.Rect | PatchFlag.Index);

    activePens.push(patchClone(item, { textBox: item.textBox }));
  });

  // 整条连线发生平移时，两端不再位于原图元锚点上，必须立即断开双向连接。
  // 此时 beforeUpdate 已保存移动前的连线快照，节点快照和断连结果继续并入同一次操作，保证撤销与协作一致。
  const translatedLineIds = new Set(
    update.filter((pen) => pen.category === PenCategory.Line).map((pen) => pen.id),
  );
  const disconnectedNodes = new Map<string, Pen>();
  const recordNodeBeforeDisconnect = (pen: Pen) => {
    if (!beforeUpdate.some((item) => item.id === pen.id)) {
      beforeUpdate.push(patchClone(pen, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
    }
  };
  for (const lineId of translatedLineIds) {
    const line = this.penMap.get(lineId);
    if (!line?.anchors?.length) {
      continue;
    }

    const endpoints = [line.anchors[0], line.anchors[line.anchors.length - 1]].filter(
      (anchor, index, anchors) => anchor && anchors.findIndex((item) => item.id === anchor.id) === index,
    );
    for (const endpoint of endpoints) {
      if (!endpoint.connectedPen) {
        continue;
      }
      const previous = {
        id: endpoint.id,
        connectedPen: endpoint.connectedPen,
        connectedAnchor: endpoint.connectedAnchor,
      };
      for (const node of reconnectLine(
        this.penMap,
        line,
        endpoint,
        previous,
        undefined,
        recordNodeBeforeDisconnect,
      )) {
        disconnectedNodes.set(node.id, node);
      }
    }

    // translatePen 生成的更新快照仍带旧连接字段，追加新快照后由下方 Map 以最后一份为准。
    update.push(patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect | PatchFlag.Index }));
  }
  for (const node of disconnectedNodes.values()) {
    update.push(patchClone(node, { patchFlag: PatchFlag.Active | PatchFlag.Rect }));
  }

  for (const before of beforeUpdate) {
    const old = oldLayer.get(before.id);
    if (old) {
      before.parentId = old.parentId;
      before.index = old.index;
    }
  }
  if (parent) {
    update.push(patchClone(parent, { children: parent.children, patchFlag: PatchFlag.Rect }));
  }

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
      beforeUpdateMap.set(
        line.id,
        patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }),
      );
    }
    connectedLines.push(line);

    // 正交重算需要同时读取起终点图元；未移动的一端也必须加入计算上下文。
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
    updateMap.set(
      line.id,
      patchClone(line, { patchFlag: PatchFlag.Active | PatchFlag.Rect }),
    );

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

  const beforeBoundary = structuredClone(this.activeBoundary);
  translateRect(this.activeBoundary, dx, dy);
  const boundary = structuredClone(this.activeBoundary);
  this.patch(undefined, undefined, beforeUpdate, update);
  logAction && this.pushAction({ beforeUpdate, update, beforeBoundary, boundary, activeIds });

  // 通知calc计算包围盒和局部重绘pens
  this.calcWorker.postMessage({
    action: WorkerMessage.Active,
    calcBoundary: true,
    pens: activePens,
    activeBoundary: this.activeBoundary,
  });

  if (this.options.mode && this.collaborate) {
    this.utilityWorker.postMessage({
      action: WorkerMessage.Patch,
      patch: { beforeUpdate, update },
    });
  }
}
