import { Point } from '../point';
import { Rect } from '../rect';
import { Event, RealTime, Trigger } from '../event';
import { Canvas } from '../canvas';

export enum PenType {
  Node,
  Line,
}

export enum LockState {
  None,
  DisableEdit,
  DisableMove,
  DisableScale, //仅占位
  DisableMoveScale,
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

//所在画布层 值和画布zIndex对应
export enum CanvasLayer{
  CanvasTemplate = 1, //模版层
  CanvasImageBottom, //底部图片层
  CanvasMain, //主画布层
  CanvasImage //顶部图片层
}

// export enum Flip {
//   None, // 正常
//   Horizontal, // 水平翻转
//   Vertical, // 垂直翻转
//   Both, // 全翻转
// }

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
  'keepDecimal',
];

export const needSetPenProps = ['x', 'y', 'width', 'height', 'flipX', 'flipY'];

export const needPatchFlagsPenRectProps = [
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'flipX',
  'flipY',
  'visible',
  'showChild',
];

export const needCalcIconRectProps = ['iconLeft', 'iconTop', 'iconRotate'];

export interface ConnectLine {
  lineId: string;
  lineAnchor: string;
  anchor: string;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextBaseline = 'top' | 'middle' | 'bottom';
export type WhiteSpace = 'nowrap' | 'pre-line' | 'break-all' | '';
// SetValue 方法参数类型
export type IValue = Pen &
  Partial<ChartData> &
  Partial<Record<'tag' | 'newId', string>> & { [key: string]: any };

// obj 类型数组 text 字段显示文字，其它属性选中后合并到画笔上
// string 类型，只展示文字
export type Dropdown = string | IValue;

export enum LineAnimateType {
  Normal, // 水流
  Beads, // 水珠流动
  Dot, // 圆点
  Arrow, // 箭头,
  WaterDrop, // 水滴
}

export interface ColorStop {
  i: number; //取值0-1,色标位置
  color: string;
}

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
  // 优先级高于 title
  titleFnJs?: string;
  titleFn?: (pen: Pen) => string;

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
  mouseDownValid?: boolean; // 是否鼠标按下是否有样式效果
  mouseDownColor?: string;
  mouseDownBackground?: string;
  bkType?: Gradient;
  /**
   * @deprecated 改用 gradientColors
   */
  gradientFromColor?: string;
  /**
   * @deprecated 改用 gradientColors
   */
  gradientToColor?: string;
  /**
   * @deprecated 改用 gradientColors
   */
  gradientAngle?: number;
  gradientRadius?: number;

  // TODO: stroke 尚无径向渐变
  strokeType?: Gradient;
  /**
   * @deprecated 改用 lineGradientColors
   */
  lineGradientFromColor?: string;
  /**
   * @deprecated 改用 lineGradientColors
   */
  lineGradientToColor?: string;
  /**
   * @deprecated 改用 lineGradientColors
   */
  lineGradientAngle?: number;

  gradientColors?: string;
  switch?: boolean; // 图元是否有开关状态
  checked?: boolean; // 是否选中
  onBackground?: string;
  onGradientColors?: string;
  lineGradientColors?: string;
  lineCap?: CanvasLineCap;
  fromLineCap?: CanvasLineCap;
  toLineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
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
  textAlign?: TextAlign;
  textBaseline?: TextBaseline;
  textBackground?: string;
  whiteSpace?: WhiteSpace;
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
  iconWeight?: string;
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
  followers?: string[];

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

  connectedLines?: ConnectLine[];

  // Cycle count. Infinite if == 0.
  animateCycle?: number;
  nextAnimate?: string;
  // TODO: video 与 动画公用该属性，可能是个问题
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

  lineAnimateType?: LineAnimateType;
  animateName?: string; // 当前执行的动画名称
  frames?: Pen[];
  // 提前预置的不同效果的动画组
  animateList?: Pen[][];
  animateInterval?: number;//动画间隔 （箭头）
  animateShadow?: boolean;//发光效果
  animateShadowColor?: string;
  animateShadowBlur?: number;
  input?: boolean;
  autofocus?: boolean;
  dropdownList?: Dropdown[];
  dropdownBackground?: string;
  dropdownColor?: string;
  dropdownHoverColor?: string;
  dropdownHoverBackground?: string;
  events?: Event[];

  iframe?: string;
  video?: string;
  audio?: string;

  progress?: number;
  progressColor?: string;
  verticalProgress?: boolean;
  reverseProgress?: boolean;
  progressGradientColors?: string;
  externElement?: boolean;

  autoPolyline?: boolean;

  // flip?: Flip;
  flipX?: boolean;
  flipY?: boolean;

  fillTexts?: string[];

  hiddenText?: boolean; // 隐藏 text
  keepDecimal?: number; // undefined 显示原内容；0 显示整数
  showChild?: number; // 第几个子元素展示 undefined 即展示全部
  animateDotSize?: number; // 线条原点动画，原点大小
  isRuleLine?: boolean; // 是否是规则线，规则线不受缩放，平移影响
   /**
   * @deprecated 改用 canvasLayer
   */
  isBottom?: boolean; // 是否是底部图片
  canvasLayer?: CanvasLayer; //图元所在画布层
  form?: FormItem[]; // 业务表单
  lockedOnCombine?: LockState; // 组合成 combine ，该节点的 locked 值
  ratio?: boolean; //宽高比锁定
  animateLineWidth?: number; //连线动画线宽
  lineSmooth?:number; //连线平滑度
  gradientSmooth?: number; //渐进色平滑度
  scrolling?: string; //iframe scrolling属性
  animations?: any[]; //动画数组
  currentAnimation?: number; //当前动画索引
  realTimes?: RealTime[];
  triggers?:  Trigger[]; //状态
  crossOrigin?: string;
  imageRadius?: number; //图片圆角
  textFlip?: boolean; //文字是否镜像
  textRotate?: boolean; //文字是否旋转
  // calculative 对象中的值是为了动画存在，表明了渐变过程中，画布上绘制的当前值
  textAutoAdjust?: boolean; //text图元宽高根据文本自动调整
  dbInput?: boolean; //锁定状态下，双击能否输入
  operationalRect?: Rect; //iframe可操作区域 x,y,width,height 均取值0-1
  blur?: number;
  blurBackground?: string;
  /**
   * @deprecated 改用 canvasLayer
   */
  template?: boolean; //是否作为模版图元
  thumbImg?: string; //iframe嵌入场景缩略图
  apiUrl?: string;
  apiMethod?: string;
  apiHeaders?: any;
  apiBody?: any;
  apiEnable?: boolean;
  container?:boolean; //是否是容器组件
  disabled?:boolean; //是否禁用
  disabledColor?:string; //禁用颜色
  disabledBackground?:string; //禁用背景色
  disabledTextColor?:string; //禁用文字颜色
  inputType?:string; //输入框类型
  productId?:string; //产品id
  deviceId?:string;//关联的设备id
  pivot?:Point; //旋转中心 
  noOnBinds?:boolean; //是否禁用绑定事件
  interaction?:boolean; //是否开启交互 组合时将不会被锁定
  childHover?:boolean; //子元素hover和active是否生效
  childActive?:boolean; 
  draw?:boolean; //是否绘制 针对combine
  calculative?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    borderRadius?: number;

    progress?: number;
    progressColor?: string;
    progressGradientColors?: string;
    verticalProgress?: boolean;
    worldRect?: Rect;
    worldAnchors?: Point[];
    worldIconRect?: Rect;
    worldTextRect?: Rect;
    textDrawRect?: Rect;
    svgRect?: Rect;

    // 执行动画前的初始位置
    initRect?: Rect;
    // 执行动画前的初始相对位置
    initRelativeRect?: Rect;
    // 执行动画前存储子图元的显示隐藏情况
    childrenVisible?: any;
    rotate?: number;
    lineWidth?: number;
    borderWidth?: number;
    borderColor?: string;
    globalAlpha?: number;
    lineDash?: number[];
    lineDashOffset?: number;
    color?: string;
    background?: string;
    // anchorColor?: string;    // TODO: 锚点颜色动画，应该不需要
    bkType?: number;
    /**
     * @deprecated 改用 gradientColors
     */
    gradientFromColor?: string;
    /**
     * @deprecated 改用 gradientColors
     */
    gradientToColor?: string;
    /**
     * @deprecated 改用 gradientColors
     */
    gradientAngle?: number;
    gradientRadius?: number;

    // TODO: stroke 尚无径向渐变
    strokeType?: Gradient;
    /**
     * @deprecated 改用 lineGradientColors
     */
    lineGradientFromColor?: string;
    /**
     * @deprecated 改用 lineGradientColors
     */
    lineGradientToColor?: string;
    /**
     * @deprecated 改用 lineGradientColors
     */
    lineGradientAngle?: number;
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
    textType?: Gradient;
    textGradientColors?: string;
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
    iconWeight?: string;

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
    focus?: boolean; //聚焦图元
    hover?: boolean;
    mouseDown?: boolean; //是否鼠标按下
    containerHover?: boolean; //容器组件hover
    isDock?: boolean; // 是否是对齐参考画笔
    pencil?: boolean;
    activeAnchor?: Point;
    patchFlags?: boolean;
    visible?: boolean; // TODO: visible 是否参与动画呢？
    // 仅仅内部专用
    inView?: boolean;
    // 辅助变量，画线时，动态计算锚点是否时水平方向
    drawlineH?: boolean;

    // 节点是否有图片
    hasImage?: boolean;
    // 图片是否已经绘画，避免频繁重绘
    imageDrawed?: boolean;
    // 图片是否在底层
    /**
     * @deprecated 改用 canvasLayer
     */
    isBottom?: boolean;
    canvasLayer?: CanvasLayer; //图元所在画布层

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

    layer?: number;

    canvas?: Canvas;

    iframe?: string;
    video?: string;
    audio?: string;
    media?: HTMLMediaElement;

    // flip?: Flip;
    flipX?: boolean;
    flipY?: boolean;

    h?: boolean; // 是否水平

    hiddenText?: boolean; // 隐藏 text
    keepDecimal?: number; // undefined 显示原内容；0 显示整数；保留几位小数
    showChild?: number; // 第几个子元素展示 undefined 即展示全部
    animateDotSize?: number; // 线条原点动画，原点大小
    zIndex?: number; //dom节点 z-index;
    // media element
    onended?: (pen: Pen) => void;

    // 不应该被deepClone多份的数据，例如外部第三方组件库挂载点，
    singleton?: any;
    gradientColors?: string;
    onBackground?: string;
    onGradientColors?: string;
    checked?: boolean;
    lineGradientColors?: string;
    gradient?: CanvasGradient; //临时渐进色 防止每次都计算
    lineGradient?: CanvasGradient;
    radialGradient?: CanvasGradient;
    gradientColorStop?: ColorStop[]; //临时 连线ColorStop
    gradientTimer?: any;
    animateLineWidth?: number;
    lineSmooth?:number; //连线平滑度
    gradientSmooth?: number; //渐进色平滑度
    gradientAnimatePath?: Path2D;
    cssDisplay?: string; //css display
    animations?: any[];
    imageRadius?: number;
    disabled?: boolean; //是否禁用
    disabledColor?: string;
    disabledBackground?: string;
    disabledTextColor?:string; //禁用文字颜色
  };
  lastConnected?:any;
  // 下划线相关配置属性
  textDecoration?: string;
  textDecorationDash?: number[];
  textDecorationColor?: string;
  // 删除线相关配置
  textStrickoutColor?: string;
  textStrickoutDash?: number[];
  textStrickout?: boolean;
  // 前一个动画帧状态数据
  prevFrame?: Pen;

  onAdd?: (pen: Pen) => void;
  onValue?: (pen: Pen) => void;
  onBeforeValue?: (pen: Pen, value: ChartData) => any;
  onDestroy?: (pen: Pen) => void;
  onMove?: (pen: Pen) => void;
  onResize?: (pen: Pen) => void;
  onRotate?: (pen: Pen) => void;
  onScale?: (pen: Pen) => void;
  onClick?: (pen: Pen, e: Point) => void;
  onMouseEnter?: (pen: Pen, e: Point) => void;
  onMouseLeave?: (pen: Pen, e: Point) => void;
  onMouseDown?: (pen: Pen, e: Point) => void;
  onMouseMove?: (pen: Pen, e: Point) => void;
  onMouseUp?: (pen: Pen, e: Point) => void;
  onShowInput?: (pen: Pen, e: Point) => void;
  onInput?: (pen: Pen, text: string) => void;
  onChangeId?: (pen: Pen, oldId: string, newId: string) => void;
  onBinds?: (pen: Pen, values: IValue[], formItem: FormItem) => IValue;
  onStartVideo?: (pen: Pen) => void;
  onPauseVideo?: (pen: Pen) => void;
  onStopVideo?: (pen: Pen) => void;
  onRenderPenRaw?: (pen: Pen) => void;
  onKeyDown?: (pen: Pen, key: string) => void;
  onWheel?: (pen: Pen, e: WheelEvent) => void;
  onContextmenu?: (pen: Pen, e: Point) => void;
  onConnectLine?: (line: Pen, e: {
    lineAnchor: Point;
    fromAnchor: Point;
    line: Pen;
    anchor: Point;
    pen: Pen;
    fromPen: Pen
  }) => void;
}

// 属性绑定变量
export interface FormItem {
  key: string;
  /**
   * 单属性绑定单变量 或 绑定多变量
   * 为数组时，顺序不重要
   */
  dataIds?: BindId | BindId[];
}

export type BindId = {
  dataId: string;
  name: string; // TODO: 用作图表的归类
};

/**
 * 图表追加或替换数据，只关注数据
 */
export interface ChartData {
  dataX: any | any[]; // x轴 或 y 轴分类变化
  dataY: any | any[]; // series 数据变化
  /**
   * @deprecated 旧版本，未来移除该属性
   */
  overwrite?: boolean; // 追加 or 替换 ， false 追加
}

/**
 * dom 类型的 图形
 */
export const isDomShapes = [
  'gif',
  'iframe',
  'video',
  'echarts',
  'highcharts',
  'lightningCharts',
];

/**
 *  交互图元
 */
export const isInteraction = [
  'radio',
  'checkbox',
  'button',
  'inputDom',
  'slider',
  'echarts',
]

// 格式刷同步的属性
export const formatAttrs: Set<string> = new Set([
  'borderRadius',
  // 'rotate',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'progress',
  'progressColor',
  'verticalProgress',
  'reverseProgress',
  // 'flip',
  'flipX',
  'flipY',
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
  'borderWidth',
  'borderColor',
  'animateLineWidth',
  'lineAnimateType',
  'frames',
  'animateColor',
  'animateType',
  'animateReverse',
  'background',
  'gradientColors',
  'lineGradientColors',
  'animateLineWidth',
  'gradientSmooth',
  'lineSmooth',
  'animations'
]);

/**
 * 清空 pen 的 生命周期
 */
export function clearLifeCycle(pen: Pen) {
  pen.onAdd = undefined;
  pen.onValue = undefined;
  pen.onBeforeValue = undefined;
  pen.onDestroy = undefined;
  pen.onMove = undefined;
  pen.onResize = undefined;
  pen.onRotate = undefined;
  pen.onClick = undefined;
  pen.onMouseEnter = undefined;
  pen.onMouseLeave = undefined;
  pen.onMouseDown = undefined;
  pen.onMouseMove = undefined;
  pen.onMouseUp = undefined;
  pen.onShowInput = undefined;
  pen.onInput = undefined;
  pen.onChangeId = undefined;
  pen.onBinds = undefined;
  pen.onStartVideo = undefined;
  pen.onPauseVideo = undefined;
  pen.onStopVideo = undefined;
  pen.onRenderPenRaw = undefined;
  pen.onKeyDown = undefined;
  pen.onContextmenu = undefined;
  pen.onScale = undefined;
  pen.onWheel = undefined;
  pen.onConnectLine = undefined;
}
