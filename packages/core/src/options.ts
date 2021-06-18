export enum KeyType {
  Any = -1,
  CtrlOrAlt,
  Ctrl,
  Shift,
  Alt,
  Right,
}

export enum KeydownType {
  None = -1,
  Document,
  Canvas,
}

export type Padding = number | string | number[];

export interface Options {
  cacheLen?: number;
  extDpiRatio?: number;
  width?: string | number;
  height?: string | number;
  color?: string;
  activeColor?: string;
  hoverColor?: string;
  anchorRadius?: number;
  anchorFillStyle?: string;
  dockStrokeStyle?: string;
  dockFillStyle?: string;
  dragColor?: string;
  animateColor?: string;
  fontColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: string;
  textBaseline?: string;
  rotateCursor?: string;
  hoverCursor?: string;
  hideInput?: boolean;
  hideRotateCP?: boolean;
  hideSizeCP?: boolean;
  hideAnchor?: boolean;
  disableSizeX?: boolean;
  disableSizeY?: boolean;
  anchorSize?: number;
  alwaysAnchor?: boolean;
  autoAnchor?: boolean;
  disableEmptyLine?: boolean;
  disableRepeatLine?: boolean;
  disableScale?: boolean;
  disableTranslate?: boolean;
  disableMoveOutParent?: boolean;
  disableDockLine?: boolean;
  playIcon?: string;
  pauseIcon?: string;
  fullScreenIcon?: string;
  loopIcon?: string;
  translateKey?: KeyType;
  scaleKey?: KeyType;
  minScale?: number;
  maxScale?: number;
  keydown?: KeydownType;
  viewPadding?: Padding;
  bkColor?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  rule?: boolean;
  ruleColor?: string;
  refresh?: number;
  on?: (event: string, data: any) => void;
}

export const fontKeys = ['fontColor', 'fontFamily', 'fontSize', 'lineHeight', 'textAlign', 'textBaseline'];

export const options: Options = {
  cacheLen: 30,
  refresh: 30,
  fontColor: '#222222',
  fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
  fontSize: 12,
  lineHeight: 1.5,
  textAlign: 'center',
  textBaseline: 'middle',
  color: '#222222',
  activeColor: '#1890ff',
  hoverColor: '#fa541c',
  anchorRadius: 4,
  anchorFillStyle: '#fff',
  dockStrokeStyle: '#fa541c',
  dockFillStyle: '#fa541c',
  dragColor: '#1890ff',
  rotateCursor: '/assets/img/rotate.cur',
  hoverCursor: 'pointer',
  minScale: 0.3,
  maxScale: 5,
  anchorSize: 5,
  keydown: KeydownType.Document,
  viewPadding: 0,
  gridSize: 10,
  gridColor: '#f3f3f3',
  ruleColor: '#888888',
};
