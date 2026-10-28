import { Direction, HandleType, TwoWay } from './const';

export interface Point {
  id?: string;
  x: number;
  y: number;
  radius?: number;
  color?: string;
  background?: string;
  visible?: boolean;
  disabled?: boolean;
  lineCross?: boolean; // 是否为跨线工具生成的锚点

  title?: string; // 锚点hover提示文字
  rotate?: number; // 当为控制框boundingCPs的点时，表示是第几个旋转控制点，左上角为第一个点

  connectedPen?: string; // line连接的pen.id
  connectedAnchor?: string; // line连接的pen的anchor.id
  twoWay?: TwoWay;

  cp1?: Point;
  cp2?: Point;
  handleType?: HandleType;

  length?: number; // 连线起点到当前点的长度
  segment?: number; // 当前点在连线第几个线段中
  position?: number; // 当前点在连线所在线段中的位置比例0-1

  /////////////////////////////////////////////////////////////
  // 以下均为临时辅助变量
  temp?: boolean; // 是否临时点
  direction?: Direction; // 线段方向0123：上右下左
  host?: any; // 锚点所属pen

  // 锚点绝对坐标。仅用于旋转图元的锚点。
  // 为了逻辑简洁性和避免提前过度计算，加载图元时不判断图元是否存在旋转
  // 仅在交互拾取时，按需把动态鼠标位置参数向图元对齐
  // 可能会带来鼠标交互时的轻微性能损耗，但好处是避免了初始加载时大量不必要的计算，缩短页面白屏时间
  // 为了部分需要绝对坐标场景的需求，提供此字段
  absoluteX?: number;
  absoluteY?: number;
}
