export enum HoverType {
  None,
  LineAnchor,
  NodeAnchor,
  Line,
  Node,
  Resize,
  Rotate,
  LineAnchorPrev,
  LineAnchorNext,
}

export enum HotkeyType {
  None,
  Translate,
  Select, // TODO: 未实现
  Resize,
  AddAnchor,
}

export enum MouseRight {
  None,
  Down,
  Translate,
}

export enum Direction {
  None = -1,
  Up,
  Right,
  Bottom,
  Left,
}

export const defaultCursors = [
  'nw-resize',
  'ne-resize',
  'se-resize',
  'sw-resize',
] as const;
export const rotatedCursors = [
  'n-resize',
  'e-resize',
  's-resize',
  'w-resize',
] as const;

export const defaultDrawLineFns = ['curve', 'polyline', 'line'];
