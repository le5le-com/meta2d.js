import { Padding } from './utils/padding';

export enum KeydownType {
  None = -1,
  Document,
  Canvas,
}

export interface Options {
  extDpiRatio?: number;
  color?: string;
  activeColor?: string;
  activeBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  anchorColor?: string;
  anchorRadius?: number;
  anchorBackground?: string;
  dockColor?: string;
  dockBackground?: string;
  dragColor?: string;
  animateColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: string;
  textBaseline?: string;
  rotateCursor?: string;
  hoverCursor?: string;
  disableInput?: boolean;
  disableRotate?: boolean;
  disableSize?: boolean;
  disableAnchor?: boolean;
  disableWidth?: boolean;
  disableHeight?: boolean;
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
  rightMouseTranslate?: boolean;
  minScale?: number;
  maxScale?: number;
  keydown?: KeydownType;
  viewPadding?: Padding;
  background?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  rule?: boolean;
  ruleColor?: string;
  drawingLineName?: string;
  interval?: number;
  animateInterval?: number;
  dragAllIn?: boolean;
}

export const defaultOptions: Options = {
  textColor: '#222222',
  fontFamily: '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
  fontSize: 12,
  lineHeight: 1.5,
  textAlign: 'center',
  textBaseline: 'middle',
  color: '#222222',
  activeColor: '#1890ff',
  hoverColor: '#1890ff',
  anchorColor: '#fa541c',
  anchorRadius: 4,
  anchorBackground: '#fff',
  dockColor: '#fa541c',
  dockBackground: '#fa541c',
  dragColor: '#1890ff',
  rotateCursor: '/assets/img/rotate.cur',
  hoverCursor: 'pointer',
  minScale: 0.1,
  maxScale: 10,
  keydown: KeydownType.Document,
  viewPadding: 0,
  gridSize: 20,
  gridColor: '#f3f3f3',
  ruleColor: '#888888',
  drawingLineName: 'curve',
  interval: 20,
  animateInterval: 30,
};
