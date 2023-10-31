import { TextAlign, TextBaseline, Pen } from './pen';
import { Point } from './point';
import { Padding } from './utils';

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
  textAlign?: TextAlign;
  textBaseline?: TextBaseline;
  rotateCursor?: string;
  hoverCursor?: string;
  disableInput?: boolean;
  disableRotate?: boolean;
  disableSize?: boolean;
  disableAnchor?: boolean;
  autoAnchor?: boolean;
  disableEmptyLine?: boolean;
  disableRepeatLine?: boolean;
  disableScale?: boolean;
  disableTranslate?: boolean;
  disableDock?: boolean; // 禁止所有停靠辅助线
  disableLineDock?: boolean; // 禁止移动连线时出现辅助线
  moveConnectedLine?: boolean; // 是否能移动被连接的连线
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
  uploadParams?: Record<string, any>;
  uploadHeaders?: Record<string, string>;
  disableRuleLine?: boolean;
  ruleLineColor?: string;
  defaultAnchors?: Point[]; // 图形的默认瞄点
  measureTextWidth?: boolean; // 测量文字宽度
  mouseRightActive?: boolean; //是否允许右键选中节点
  disableClipboard?: boolean; //是否禁止系统剪切板
  drawingLineLength?: number; //绘制过程中允许的最大长度，0表示不限
  disableTouchPadScale?: boolean; //是否禁止触控板缩放
  cdn?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  polylineSpace?: number;
  defaultFormat?: Pen; //默认格式刷
  domShapes?: string[]; //扩展的dom节点
  textFlip?: boolean; //文字镜像
  textRotate?: boolean; //文字旋转
  cacheLength?: number; //缓存数据长度
  unavailableKeys?: string[]; //屏蔽的快捷键
  activeLineDash?: number[];
  activeLineWidth?: number;
  activeGlobalAlpha?: number;
  diagramOptions?: { [key: string]: any };
  strictScope?: boolean; //大屏严格范围
  padding?: Padding; //大屏padding区域
  resizeMode?: boolean;
}

export const defaultOptions: Options = {
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
  measureTextWidth: true,
  moveConnectedLine: true,
  mouseRightActive: true,
  disableClipboard: false,
  drawingLineLength: 0,
  disableTouchPadScale: false,
  cdn: '',
  polylineSpace: 10,
  domShapes: [],
  textFlip: true,
  textRotate: true,
  unavailableKeys: [],
  diagramOptions: {},
};
