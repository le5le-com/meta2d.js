import { InteractionMode } from '../types';

// 交互模式转换规则
export const VALID_TRANSITIONS: Record<InteractionMode, InteractionMode[]> = {
  [InteractionMode.None]: [
    InteractionMode.DrawingLineReady,
    InteractionMode.DrawingPencil,
    InteractionMode.DrawingLineDragFrom,
    InteractionMode.DrawingLineDragTo,
    InteractionMode.DrawingLineDragAnchorReady,
    InteractionMode.CanvasMouseRightDown,
    InteractionMode.CanvasTranslate,
    InteractionMode.CanvasDragPens,
    InteractionMode.CanvasSelectPens,
    InteractionMode.CanvasMagnifier,
    InteractionMode.TouchScaling,
    InteractionMode.TouchMoving,
  ],

  [InteractionMode.DrawingLineReady]: [InteractionMode.DrawingLine, InteractionMode.None],

  [InteractionMode.DrawingLine]: [
    InteractionMode.DrawingLineDragFrom,
    InteractionMode.DrawingLineDragTo,
    InteractionMode.DrawingLineDragAnchor,
    InteractionMode.DrawingLineDragAnchorReady,
    // 完成 / 取消画线（Enter、P、Esc、点到锚点）。原来没有这一条，transition(None) 会被拒绝，
    // 各处只好直接写 state = None；finishDrawingLine 走 transition 时状态就停在画线里。
    InteractionMode.None,
  ],

  [InteractionMode.DrawingLineDragFrom]: [InteractionMode.DrawingLine, InteractionMode.None],

  [InteractionMode.DrawingLineDragTo]: [InteractionMode.DrawingLine, InteractionMode.None],

  [InteractionMode.DrawingLineDragAnchorReady]: [InteractionMode.DrawingLineDragAnchor, InteractionMode.None],

  [InteractionMode.DrawingLineDragAnchor]: [InteractionMode.None],

  [InteractionMode.DrawingPencil]: [InteractionMode.None],

  [InteractionMode.CanvasMouseRightDown]: [InteractionMode.CanvasTranslate, InteractionMode.None],

  [InteractionMode.CanvasTranslate]: [InteractionMode.None],

  [InteractionMode.CanvasDragPens]: [InteractionMode.None],

  [InteractionMode.CanvasSelectPens]: [InteractionMode.None],

  [InteractionMode.CanvasMagnifier]: [InteractionMode.None],

  [InteractionMode.TouchScaling]: [InteractionMode.None],

  [InteractionMode.TouchMoving]: [InteractionMode.None],
};
