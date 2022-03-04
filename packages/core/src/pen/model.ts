import { Point } from '../point';
import { Rect } from '../rect';
import { Event } from '../event';

export enum PenType {
  Node,
  Line,
}

export enum LockState {
  None,
  DisableEdit,
  DisableMove,
  // DisableActive,
  Disable = 10,
}

export enum AnchorMode {
  Default,
  In,
  Out,
}

export enum Gradient {
  None, // 没有渐变
  Linear, // 线性渐变
  Radial, // 镜像渐变
}

export enum Flip {
  None, // 正常
  Horizontal, // 水平翻转
  Vertical, // 垂直翻转
}

// 修改哪些属性需要重现计算 textRect
export const needCalcTextRectProps = [
  'text',
  'textWidth',
  'textHeight',
  'textLeft',
  'textTop',
  'fontFamily',
  'fontSize',
  'lineHeight',
  'fontStyle',
  'fontWeight',
  'textAlign',
  'textBaseline',
  'whiteSpace',
  'ellipsis',
];

export const needDirtyPenRectProps = [
  'x',
  'y',
  'width',
  'height',
  'rotate',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
];

export const needCalcIconRectProps = ['iconLeft', 'iconTop', 'iconRotate'];

export interface Pen extends Rect {
  id?: string;
  tags?: string[];
  parentId?: string;
  type?: PenType;
  name?: string;
  lineName?: string;
  borderRadius?: number;
  // Hidden only visible == false
  visible?: boolean;
  locked?: LockState;

  // 连线是否闭合路径
  close?: boolean;
  // 连线长度
  length?: number;

  title?: string;

  lineWidth?: number;
  borderWidth?: number;
  borderColor?: string;
  globalAlpha?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  color?: string;
  background?: string;
  anchorColor?: string;
  hoverAnchorColor?: string;
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;
  bkType?: Gradient;
  gradientFromColor?: string;
  gradientToColor?: string;
  gradientAngle?: number;
  gradientRadius?: number;

  // TODO: stroke 尚无径向渐变
  strokeType?: Gradient;
  lineGradientFromColor?: string;
  lineGradientToColor?: string;
  lineGradientAngle?: number;

  lineCap?: string;
  lineJoin?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  textHasShadow?: boolean; // 文字是否需要阴影

  text?: string;
  textWidth?: number;
  textHeight?: number;
  textLeft?: number;
  textTop?: number;
  textColor?: string;
  hoverTextColor?: string;
  activeTextColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontStyle?: string;
  fontWeight?: string;
  textAlign?: string;
  textBaseline?: string;
  textBackground?: string;
  whiteSpace?: string;
  ellipsis?: boolean;

  image?: string;
  icon?: string;
  iconRotate?: number;
  iconWidth?: number;
  iconHeight?: number;
  iconTop?: number;
  iconLeft?: number;
  iconColor?: string;
  iconFamily?: string;
  iconSize?: number;
  iconAlign?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'left-top'
    | 'right-top'
    | 'left-bottom'
    | 'right-bottom'
    | 'center';
  imageRatio?: boolean;

  disableInput?: boolean;
  disableRotate?: boolean;
  disableSize?: boolean;
  disableAnchor?: boolean;

  // 相对值，若小于 1 认为是相对坐标
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;

  backgroundImage?: string;
  strokeImage?: string;

  children?: string[];

  anchors?: Point[];
  anchorRadius?: number;
  anchorBackground?: string;

  pathId?: string;
  path?: string;

  fromArrow?: string;
  toArrow?: string;
  fromArrowSize?: number;
  toArrowSize?: number;
  fromArrowColor?: string;
  toArrowColor?: string;

  autoFrom?: boolean;
  autoTo?: boolean;

  connectedLines?: { lineId: string; lineAnchor: string; anchor: string }[];

  // Cycle count. Infinite if == 0.
  animateCycle?: number;
  nextAnimate?: string;
  autoPlay?: boolean;
  playLoop?: boolean;

  // 动画帧时长
  duration?: number;
  // 匀速渐变
  linear?: boolean;
  // 主要用于动画帧的缩放
  scale?: number;
  // 连线动画速度
  animateSpan?: number;
  animateColor?: string;
  animateLineDash?: number[];
  animateReverse?: boolean;
  // 结束动画后，是否保持动画状态
  keepAnimateState?: boolean;

  lineAnimateType?: number;

  frames?: Pen[];
  // 提前预置的不同效果的动画组
  animateList?: Pen[][];

  input?: boolean;
  dropdownList?: any[]; // obj 类型数组 text 字段显示文字，其它属性选中后合并到画笔上
  // string 类型数组，只展示文字

  events?: Event[];

  iframe?: string;
  video?: string;
  audio?: string;

  progress?: number;
  progressColor?: string;
  verticalProgress?: boolean;
  externElement?: boolean;

  autoPolyline?: boolean;

  flip?: Flip;

  hiddenText?: boolean; // 隐藏 text
  keepDecimal?: number; // undefined 显示原内容；0 显示整数
  showChild?: number; // 第几个子元素展示 undefined 即展示全部
  animateDotSize?: number; // 线条原点动画，原点大小
  // calculative 对象中的值是为了动画存在，表明了渐变过程中，画布上绘制的当前值
  calculative?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    borderRadius?: number;

    progress?: number;
    progressColor?: string;

    worldRect?: Rect;
    worldAnchors?: Point[];
    worldIconRect?: Rect;
    worldTextRect?: Rect;
    textDrawRect?: Rect;
    svgRect?: Rect;

    // 执行动画前的初始位置
    initRect?: Rect;

    rotate?: number;
    lineWidth?: number;
    borderWidth?: number;
    borderColor?: string;
    globalAlpha?: number;
    lineDash?: number[];
    lineDashOffset?: number;
    color?: string;
    background?: string;
    anchorColor?: string;
    hoverColor?: string;
    hoverBackground?: string;
    activeColor?: string;
    activeBackground?: string;
    bkType?: number;
    gradientFromColor?: string;
    gradientToColor?: string;
    gradientAngle?: number;
    gradientRadius?: number;

    // TODO: stroke 尚无径向渐变
    strokeType?: Gradient;
    lineGradientFromColor?: string;
    lineGradientToColor?: string;
    lineGradientAngle?: number;
    lineCap?: string;
    lineJoin?: string;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    textHasShadow?: boolean;

    tempText?: string;
    text?: string;
    textWidth?: number;
    textHeight?: number;
    textLeft?: number;
    textTop?: number;
    textColor?: string;
    hoverTextColor?: string;
    activeTextColor?: string;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    fontStyle?: string;
    fontWeight?: string;
    textBackground?: string;
    iconSize?: number;
    icon?: string;
    iconRotate?: number;
    iconWidth?: number;
    iconHeight?: number;
    iconTop?: number;
    iconLeft?: number;
    iconColor?: string;
    iconFamily?: string;

    // 绝对值，计算后的结果
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;

    textLines?: string[];
    textLineWidths?: number[]; // textLines 每一行 width 组成的数组
    image?: string;
    img?: HTMLImageElement;
    imgNaturalWidth?: number;
    imgNaturalHeight?: number;
    backgroundImage?: string;
    strokeImage?: string;
    backgroundImg?: HTMLImageElement;
    strokeImg?: HTMLImageElement;
    active?: boolean;
    hover?: boolean;
    isDock?: boolean; // 是否是对齐参考画笔
    pencil?: boolean;
    activeAnchor?: Point;
    dirty?: boolean;
    visible?: boolean;
    // 仅仅内部专用
    inView?: boolean;
    // 辅助变量，画线时，动态计算锚点是否时水平方向
    drawlineH?: boolean;

    scale?: number;

    // 动画开始时间
    start?: number;
    // 动画时长
    duration?: number;
    // 动画结束时间
    end?: number;
    // 当前动画帧
    frameIndex?: number;
    // 当前动画帧起止时间
    frameStart?: number;
    frameEnd?: number;
    frameDuration?: number;
    animatePos?: number;
    // 已经循环次数
    cycleIndex?: number;
    // 是否暂停动画
    pause?: number;
    // 动画播放中的参考基准
    _rotate?: number;

    layer?: number;
    dropdownList?: any[];

    canvas?: any;

    iframe?: string;
    video?: string;
    audio?: string;
    media?: HTMLMediaElement;

    flip?: Flip;

    hiddenText?: boolean; // 隐藏 text
    keepDecimal?: number; // undefined 显示原内容；0 显示整数；保留几位小数
    showChild?: number; // 第几个子元素展示 undefined 即展示全部
    animateDotSize?: number; // 线条原点动画，原点大小
    // media element
    onended?: (pen: Pen) => void;
  };

  // 最后一个动画帧状态数据
  lastFrame?: Pen;

  onAdd?: (pen: Pen) => void;
  onValue?: (pen: Pen) => void;
  onDestroy?: (pen: Pen) => void;
  onMove?: (pen: Pen) => void;
  onResize?: (pen: Pen) => void;
  onRotate?: (pen: Pen) => void;
  onClick?: (pen: Pen, e: Point) => void;
  onMouseEnter?: (pen: Pen, e: Point) => void;
  onMouseLeave?: (pen: Pen, e: Point) => void;
  onMouseDown?: (pen: Pen, e: Point) => void;
  onMouseMove?: (pen: Pen, e: Point) => void;
  onMouseUp?: (pen: Pen, e: Point) => void;
  onShowInput?: (pen: Pen, e: Point) => void;
  onInput?: (pen: Pen, text: string) => void;
}

/**
 * dom 类型的 图形
 */
export const isDomShapes = [
  'gif',
  'div',
  'iframe',
  'video',
  'echarts',
  'highcharts',
  'lightningCharts',
];

// 格式刷同步的属性
export const formatAttrs: Set<string> = new Set([
  'borderRadius',
  'rotate',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'progress',
  'progressColor',
  'verticalProgress',
  'flip',
  'input',
  'lineDash',
  'lineCap',
  'lineJoin',
  'strokeType',
  'lineGradientFromColor',
  'lineGradientToColor',
  'lineGradientAngle',
  'color',
  'hoverColor',
  'activeColor',
  'lineWidth',
  'bkType',
  'gradientFromColor',
  'gradientToColor',
  'gradientAngle',
  'gradientRadius',
  'hoverBackground',
  'activeBackground',
  'globalAlpha',
  'anchorColor',
  'anchorRadius',
  'shadowColor',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'textHasShadow',
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
  'textWidth',
  'textHeight',
  'textLeft',
  'textTop',
  'ellipsis',
  'hiddenText',
  'keepDecimal',
]);
