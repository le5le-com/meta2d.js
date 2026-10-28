import { PlayState } from '../../types';
import { ConnectLine, Gradient, Property, Trigger, Event, Background, ProgressColor, TargetType, IValue } from './types';
import {
  Align,
  BackgroundType,
  InputMode,
  InteractiveType,
  LineAnimationType,
  PatchFlag,
  PenCategory,
  TextAlign,
  TextDecoration,
  TextVertical,
  TextWrap,
} from './const';
import { Point } from '../point';
import { Rect } from '../rect';

export interface Pen extends Rect {
  parentId?: string;
  id?: string;
  type?: string;
  category?: PenCategory; // 图形还是连线
  lineIsEdge?: boolean; // 连线作为图形时，连线是否作为图形的边，即连线上所有的点都作为动态锚点
  tags?: string[];
  name?: string;
  visible?: boolean; // 仅visible == false表示不可见
  interactive?: InteractiveType; // 是否具有hover或focus(active)交互状态
  locked?: boolean; // 用于编辑模式下禁止被拖拽
  color?: string; // 默认前景颜色
  backgrounds?: Background[];
  background?: string;
  bkType?: BackgroundType;
  backgroundImage?: string;
  gradient?: Gradient;
  opacity?: number;
  ratio?: boolean; //宽高比锁定
  scrolling?: string; // ???
  scale?: number; // 仅用于标记动画帧存在缩放

  flipX?: boolean;
  flipY?: boolean;

  fillTexts?: string[];
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;

  blur?: number;
  blurBackground?: string;

  tooltip?: string; // 支持markdown
  tooltipJs?: string; // 优先级高于 tooltip
  tooltipFn?: (pen: Pen) => string;

  lineWidth?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  lineSmooth?: number;
  lineGradient?: Gradient;
  lineType?: BackgroundType;
  lineImage?: string;

  anchors?: Point[];
  close?: boolean; // 连线是否闭合路径
  length?: number; // 连线长度
  fromArrow?: string;
  toArrow?: string;
  fromArrowSize?: number;
  toArrowSize?: number;
  fromArrowColor?: string;
  toArrowColor?: string;
  fromArrowFillColor?: string; // 箭头填充色
  toArrowFillColor?: string;
  autoFrom?: boolean;
  autoTo?: boolean;
  fromLineCap?: CanvasLineCap;
  toLineCap?: CanvasLineCap;

  connectedLines?: ConnectLine[];

  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;

  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  text?: string;
  textVisible?: boolean; // 仅visible == false表示不可见
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  fontStyle?: string;
  fontWeight?: string;
  textShadow?: boolean;
  textShadowColor?: string;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textWidth?: number; // 如果不设置，普通形状图元按图元边界限制；文字图元和连线按内容自然宽度计算
  textHeight?: number; // 如果不设置，普通形状图元按图元边界限制；文字图元和连线按内容自然高度计算
  textUnit?: number; // 文字上下左右对齐的单位。缺省像素，1 - 百分比（textTop为0-1之间的小数）。
  textTop?: number;
  textBottom?: number;
  textLeft?: number;
  textRight?: number;
  textColor?: string;
  textAlign?: TextAlign; // 默认居中
  textVertical?: TextVertical; // 默认居中
  textBackground?: string;
  textGradient?: Gradient;
  textHoverColor?: string;
  textActiveColor?: string;
  textFlip?: boolean; //文字是否镜像
  textRotate?: boolean; //文字是否旋转
  textWrap?: TextWrap;
  ellipsis?: boolean;
  keepDecimal?: number; // 默认显示原内容；0 显示整数
  // 下划线或删除线
  textDecoration?: TextDecoration;
  textDecorationDash?: number[];
  textDecorationColor?: string;

  textAutoSize?: boolean; // 文本输入完成后，是否根据文字内容自动计算宽高

  input?: InputMode; //输入框类型
  form?: any; // form表单类型的图元的辅助数据
  disabled?: boolean; //是否禁用
  disableInput?: boolean; //禁止输入
  disableRotate?: boolean; //禁止旋转
  disableSize?: boolean; //禁止调整大小
  disableAnchor?: boolean; //禁用锚点
  disabledColor?: string; //禁用颜色
  disabledBackground?: string; //禁用背景色
  disabledTextColor?: string; //禁用文字颜色

  image?: string;
  imageRatio?: boolean;
  imageRadius?: number; //图片圆角
  crossOrigin?: string; // 跨域图片加载时的crossOrigin属性值

  icon?: string;
  iconTop?: number;
  iconLeft?: number;
  iconWidth?: number;
  iconHeight?: number;
  iconRotate?: number;
  iconColor?: string;
  iconFamily?: string;
  iconWeight?: string;
  iconSize?: number;
  iconAlign?: Align;
  iconGradient?: Gradient;

  pathId?: string; // svgPath类型图元的在pathMap中的id
  pathFill?: boolean; // 默认storke，有background则执行fill，fill颜色为background。否则fill代替storke，background无效

  iframe?: string;
  /** iframe 导出使用的缩略图地址。 */
  thumbImg?: string;
  video?: string;
  audio?: string;

  animations?: Animation[]; //动画数组
  currentAnimation?: number; //当前动画索引
  lineAnimation?: LineAnimation; // 连线图元的动画属性
  linePosition?: number; // 连线图元动画位置

  play?: PlayState; // 当前播放状态
  autoPlay?: boolean; // 是否自动播放
  playLoop?: boolean; // 为音视频时，是否自动循环播放

  attributes?: any[]; // 用于表述图元的外观、功能等属性
  properties?: Property[]; // 业务数据（数据模型的属性）
  triggers?: Trigger[]; //状态
  events?: Event[];

  segment?: number; //  作为文字，在父节点line中第几个线段上显示
  position?: number; // 作为文字，在父节点line中几个线段上的百分比（0-1）位置

  progress?: number;
  progressMin?: number;
  progressMax?: number;
  verticalProgress?: boolean;
  reverseProgress?: boolean;
  progressColors?: ProgressColor[];

  container?: Rect; // 拖拽其他图元到当前区域，变成子图元。x,y,width,height组成，值为0-1的小数形式百分比
  children?: string[];
  showChild?: number; // 第几个子元素展示 undefined 即展示全部

  // 下面属性仅为外部HTML Element图元使用
  isBottom?: boolean; // 是否在底层
  zIndex?: number;
  className?: string;
  styles?: any;

  operationalRect?: Rect; //iframe可操作区域 x,y,width,height 均取值0-1

  // 下面属性仅为临时计算变量
  // 临时计算属性
  calculative?: {
    lineSegments?: LinePathSegment[];
    gradientSegments?: Point[];
  }
  active?: boolean; // 是否激活
  tag?: string;
  path?: string; // 仅用于addPen时的临时参数
  oldId?: string;
  patchFlag?: PatchFlag;
  textRectX?: number; // 文本设置的区域。由textLeft/Right/Top/Bottom等数据计算而来
  textRectY?: number;
  textRectWidth?: number;
  textRectHeight?: number;
  textLines?: Pen[];
  textBox?: Rect; // 文本实际区域，因为对齐方式、换行、长度等原因可能超出pen范围
  fillStyles?: any[]; // 当前状态的背景。类型为fillStyle直接使用的string | CanvasGradient | CanvasPattern
  __val?: IValue; // 临时存储当前更改的属性
}

export interface Animation {
  name?: string; // 动画名称
  cycle?: number; // 循环播放次数。如果等于0，无限循环播放
  keepAnimationState?: boolean; // 结束动画后，是否保持动画状态
  animate?:string;
  nextType?: TargetType; // id或标签
  next?: string; // 当前动画结束后，要播放的下一个动画
  nextAnimation?: number; // 当前动画结束后，要播放的下一个动画的索引

  // 连线图元的动画属性
  lineAnimation?: LineAnimation;

  // 节点图元的动画属性
  frames?: Frame[]; // 动画帧
}

export interface Frame {
  properties?: Pen; // 动画帧的属性
  transitional?: { [key: string]: boolean }; // 由初始值过渡到动画帧的值的属性
  timingFunction?: string; // 值变化的时序函数，默认匀速
  duration?: number; // 动画帧时长
}

export interface LineAnimation {
  type?: LineAnimationType; // 动画类型
  color?: string; // 连线动画颜色
  dotSize?: number; // 连线动画的点的大小
  lineWidth?: number; // 连线动画线宽
  span?: number; // 连线动画速度
  lineDash?: number[] | string; // 连线动画虚线值
  reverse?: boolean; // 连线动画是否反向
  markerSpacing?: number; // 连线箭头或其他小图标之间的间隔
  shadow?: boolean; // 是否有连线阴影，主要用于发光效果
  shadowColor?: string; // 连线阴影颜色
  shadowBlur?: number; // 连线阴影模糊值
  count?: number; // 连线动画图元的个数

  // 连线动画的移动位置
  position?: number; // 连线动画移动位置。每次加span
  image?: string; // 连线动画的图片

  icon?: string; // 连线动画的图标
  iconFamily?: string; // 连线动画的图标字体

  targetType?: TargetType; // 涉及到的图元或标签下图元
  target?: string; // 图元id或标签
}

interface LinePathSegmentBase {
  start: Point;
  end: Point;
  segment: number;
  endSegment: number;
}

export type LinePathSegment = LinePathSegmentBase &
  ({ type: 'line' } | { type: 'quadratic'; cp: Point } | { type: 'cubic'; cp1: Point; cp2: Point });
