export enum PenCategory {
  Node,
  Line,
  HtmlElement,
}

export enum InteractiveType {
  None,
  Style = 1, // 0001
  Event = 1 << 1, // 0010
}

export enum ConnectDirection {
  Both,
  In,
  Out,
}

export enum PatchFlag {
  None,
  Active = 1, // 0001
  Rect = 1 << 1, // 0010
  Index = 1 << 2, // 0100，z-index
  Lock = 1 << 3, // 1000，锁定
}

export const PatchRectProps = ['x', 'y', 'width', 'height', 'rotate', 'scale', 'flipX', 'flipY', 'anchors'];

export enum Align {
  Center,
  Left = 1 << 3, // 10 00
  Right = 1 << 2, // 01 00
  Top = 1 << 1, // 00 10
  Bottom = 1, // 00 01
  TopLeft = (1 << 3) + (1 << 1), // 10 10,
  BottomLeft = (1 << 3) + 1, // 10 01,
  TopRight = (1 << 2) + (1 << 1), // 01 10,
  BottomRight = (1 << 2) + 1, // 01 01,
}

export enum GradientType {
  Linear = 1,
  Radial = 2,
}

export enum ColorType {
  Color = 0,
  LinearGradient = GradientType.Linear,
  RadialGradient = GradientType.Radial,
}

export enum BackgroundType {
  Color = ColorType.Color, // 纯色
  LinearGradient = ColorType.LinearGradient, // 1 - 线性渐变
  RadialGradient = ColorType.RadialGradient, // 2 - 径向渐变
  Image = 3, // 图片
}

export enum LineAnimationType {
  Default, // 水流
  Beads, // 水珠流动
  Dot, // 圆点
  Arrow, // 箭头,
  WaterDrop, // 水滴
  Image, // 图片
  Icon, // 图标
  Pen, // 画笔
  Element, // 元素
}

export enum InputMode {
  None,
  Text,
  Number, // 数字输入，只允许输入数值字符
  Custom, // 调用pen的生命周期函数，现在自定义的输入框。例如：下拉列表、日历等
}

export enum TextAlign {
  Left = 1,
  Center,
  Right,
}

export const TextAligns = ['center', 'left', 'center', 'right'];
export const TextJustifyContents = ['center', 'flex-start', 'center', 'flex-end'];

export enum TextVertical {
  Top = 1,
  Middle,
  Bottom,
}

export const TextVerticals = ['flex-start', 'flex-start', 'center', 'flex-end'];

export enum TextWrap {
  Normal, // 默认，汉字或单词换行
  Line, // 换行符换行
  Nowrap, // 不换行
}

export enum TextDecoration {
  None,
  Underline,
  LineThrough,
}

export enum EventAction {
  Link,
  SetProps,
  StartAnimate,
  PauseAnimate,
  StopAnimate,
  JS, //Function
  GlobalFn,
  Emit,
  StartVideo,
  PauseVideo,
  StopVideo,
  SendPropData,
  SendVarData,
  Navigator,
  Dialog,
  SendData, //数据源选择
  PostMessage, //发送场景数据
  PostMessageToParent, //向父窗口发送消息
}
