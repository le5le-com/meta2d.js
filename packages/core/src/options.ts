import { Point } from './point';

export enum KeydownType {
  None = -1,
  Document,
  Canvas,
}

export interface Options {
  color?: string;
  activeColor?: string;
  activeBackground?: string;
  hoverColor?: string;
  hoverBackground?: string;
  anchorColor?: string;
  hoverAnchorColor?: string;
  anchorRadius?: number;
  anchorBackground?: string;
  dockColor?: string;
  dockPenColor?: string;
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
  // disableWidth?: boolean;
  // disableHeight?: boolean;
  // alwaysAnchor?: boolean;  TODO: 该功能实现待考虑
  autoAnchor?: boolean;
  disableEmptyLine?: boolean;
  disableRepeatLine?: boolean;
  disableScale?: boolean;
  disableTranslate?: boolean;
  // disableMoveOutParent?: boolean;
  disableDockLine?: boolean;
  // playIcon?: string;
  // pauseIcon?: string;
  // fullScreenIcon?: string;
  // loopIcon?: string;
  // rightMouseTranslate?: boolean;  // TODO: 该功能实现待考虑
  minScale?: number;
  maxScale?: number;
  keydown?: KeydownType;
  background?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  rule?: boolean;
  ruleColor?: string;
  drawingLineName?: string;
  fromArrow?: string;
  toArrow?: string;
  autoPolyline?: boolean;
  interval?: number;
  animateInterval?: number;
  dragAllIn?: boolean;
  scroll?: boolean;
  uploadFn?: (file: File) => Promise<string>; // uploadFn 优先级最高
  uploadUrl?: string;
  uploadParams?: object;
  uploadHeaders?: { [key: string]: string };
  disableRuleLine?: boolean;
  ruleLineColor?: string;
  defaultAnchors?: Point[]; // 图形的默认瞄点
}

export const defaultOptions: Options = {
  textColor: '#222222',
  fontFamily:
    '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
  fontSize: 12,
  lineHeight: 1.5,
  textAlign: 'center',
  textBaseline: 'middle',
  color: '#222222',
  activeColor: '#278df8',
  hoverColor: 'rgba(39,141,248,0.50)',
  anchorColor: '#278DF8',
  hoverAnchorColor: '#FF4101',
  anchorRadius: 4,
  anchorBackground: '#fff',
  dockColor: 'rgba(39,141,248,0.50)',
  dockPenColor: '#1890FF',
  dragColor: '#1890ff',
  rotateCursor: 'rotate.cur',
  hoverCursor: 'pointer',
  minScale: 0.1,
  maxScale: 10,
  keydown: KeydownType.Document,
  gridSize: 20,
  gridColor: '#e2e2e2',
  ruleColor: '#888888',
  drawingLineName: 'curve',
  interval: 30,
  animateInterval: 30,
  autoPolyline: true,
  autoAnchor: true,
  animateColor: '#ff4d4f',
  ruleLineColor: '#FF4101',
  defaultAnchors: [
    {
      x: 0.5,
      y: 0,
    },
    {
      x: 1,
      y: 0.5,
    },
    {
      x: 0.5,
      y: 1,
    },
    {
      x: 0,
      y: 0.5,
    },
  ],
};
