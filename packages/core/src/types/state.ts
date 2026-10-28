export enum Mode {
  Run,
  Edit,
}

export enum InteractionMode {
  // 基础状态
  None = 0,

  // 连线相关状态 (1-7)
  DrawingLineReady = 1,
  DrawingLine = 2,
  DrawingLineDragFrom = 3,
  DrawingLineDragTo = 4,
  DrawingLineDragAnchor = 5,
  DrawingLineDragAnchorReady = 6,
  DrawingPencil = 7,

  // 画布操作状态 (9-13)
  CanvasMouseRightDown = 9,
  CanvasTranslate = 10,
  CanvasDragPens = 11,
  CanvasSelectPens = 12,
  CanvasMagnifier = 13,

  // 触摸手势状态 (15-16)
  TouchScaling = 15,
  TouchMoving = 16,
}

export enum AnchorMode {
  Hidden, // 不显示。
  Hover, // 鼠标移动到图元时显示图元锚点
  Drawline = 1 << 1, // 0010, // 是否进入连线状态
  Pencil = 1 << 2, // 0100, // 是否进入铅笔自由画线状态
}

export enum HoverType {
  None,
  Node,
  Line,
  Resize,
  Rotate,
  NodeAnchor,
  LineAnchor,
  LineAnchorCp1,
  LineAnchorCp2,
}

export enum PlayState {
  None,
  Playing,
  Paused,
}

export enum FitViewOrigin {
  Center,
  Left,
}

export enum AlignType {
  Left,
  Center,
  Right,
  Top,
  Middle,
  Bottom,
  HorizontalDistribute,
  VerticalDistribute,
}
