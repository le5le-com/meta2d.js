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

export const inheritanceProps = [
  'dash',
  'lineWidth',
  'lineCap',
  'lineJoin',
  'strokeType',
  'color',
  'lineGradientFromColor',
  'lineGradientToColor',
  'lineGradientAngle',
  'globalAlpha',
  'bkType',
  'background',
  'gradientFromColor',
  'gradientToColor',
  'gradientAngle',
  'gradientRadius',
  'fontFamily',
  'fontSize',
  'textColor',
  'hoverTextColor',
  'activeTextColor',
  'textBackground',
  'fontStyle',
  'fontWeight',
  'textAlign',
  'textBaseline',
  'lineHeight',
  'whiteSpace',
  'textLeft',
  'textTop',
  'flipX',
  'flipY',
  'lineDash',
];
