import { Mode } from '../../types';
import { BackgroundType, ColorType, GradientType } from './const';

export interface ConnectLine {
  penId: string;
  penAnchor: string;
  anchor: string;
  in?: boolean; // 默认方向：出
}

// SetValue 方法参数类型
export type IValue = { id?: string; tag?: string; [key: string]: any };

export type ValueOptions = {
  render?: boolean; // 是否立即重绘。for循环中建议不要设置此参数
  preventEvent?: boolean; // 是否阻止触发数据变化时对应的事件。监听数据变化的事件脚本中应通过条件或设置此参数避免死循环调用
  mode?: Mode; // 是否编辑模式。同时也会立即重绘，防止记录数据混杂其他缓存队列数据
  record?: boolean; // 是否记录编辑日志logAction或录制数据变化，以便数据回放
};

export type Dropdown = string | IValue;

export interface ColorStop {
  i: number; //取值0-1,色标位置
  color: string;
}

export interface Background {
  type?: BackgroundType; // 背景类型:  0 -  纯色， 1 - 线性渐变  2 - 径向渐变  3 - 图片。默认纯色

  color?: string;
  gradient?: Gradient;
  image?: string;
  imageRepetition?: string; // 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'
}

export interface ProgressColor {
  type?: ColorType.Color | ColorType.LinearGradient;
  color?: string;
  gradient?: Gradient;
}

export interface Gradient {
  type?: GradientType; // 渐变类型: Linear - 线性渐变  Radial - 径向渐变。默认线性渐变

  x0?: number; //
  y0?: number;
  r0?: number; // 径向渐变内圆半径，默认0
  x1?: number; //
  y1?: number;
  r1?: number; // 径向渐变外圆半径，默认整个区域

  colorStops?: ColorStop[];
}

export enum EventType {
  Click,
  Dblclick,
  Contextmenu,
  Enter,
  Leave,
  Active,
  Inactive,
  Mousedown,
  Mouseup,
  Message,
  ValueUpdate,
  Input,
  Change,
  Submit,
  Reset,
}

export interface Bind {
  label?: string;
  id?: string;
  class?: 'iot' | 'sql';
}

/** 物联网原始属性与历史聚合绑定。 */
export interface IotBind extends Bind {
  class: 'iot';
  datasourceId?: string;
  sourceId?: string;
  deviceId?: string;
  key?: string;
  compute_name?: string;
  aggregate?: string;
  start?: string | number;
  end?: string | number;
  groupBy?: string;
  recent?: string;
  limit?: number | string;
  times?: number;
}

export interface Property {
  label?: string;
  key?: string;
  type?: string;
  bind?: Bind | IotBind;
  value?: string;
  mock?: string; //模拟数据范围
  enableMock?: boolean; //是否开启模拟数据
}

export type Comparison =
  | '='
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | '[)' // 介于，数学中的开闭区间
  | '![)' // 非介于，与上一个相反
  /**
   * 属于，类似于 数组的 includes
   * .. 属于范围语法，30..50 等价于 介于的 [30, 50]
   * [1, 2, 3]  2 // true  1.5 // false
   * [1,20,30..50,65] 1 // true 20 // true 30 // true 30.1 // true
   */
  | '[]'
  | '![]'; // 非属于，与上一个相反

export enum ConditionType {
  Compare, // 关系比较条件
  Function, // 高级条件 - 函数
}

export enum TargetType {
  Value, // 固定值
  Pen, // 图元
  Tag, // 标签（相同标签的多个图元）
}

export interface Condition {
  type?: ConditionType;
  fn?: string; // 高级条件函数的js代码

  source?: string;
  key?: string;
  label?: string;
  operator?: Comparison;
  targetType?: TargetType;
  target?: string; // 固定值或图元id
  targetKey?: string;
  targetLabel?: string;
}

export enum PenActionType {
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
  SendPropData, // 废弃
  SendVarData, // 废弃
  Navigator,
  Dialog,
  SendData, // 数据源选择
  PostMessage, // 发送场景数据
  PostMessageToParent, // 向父窗口发送消息
  MessageBox, // 消息提示
}

export interface PenAction {
  type?: PenActionType; // 动作类型
  targetType?: TargetType; // 涉及到的图元或标签下图元
  target?: string; // 图元id或标签
  payload?: any; // 不同动作类型对应的参数
  timeout?: number; // 动作超时时间，默认0，不超时执行
}

export interface Event {
  type?: EventType; // 事件类型，主要用于鼠标、键盘、消息等交互事件
  name?: string; // 事件名称，交互事件事件可忽略
  isAny?: boolean; // 是否满足任意条件即可触发
  conditions?: Condition[]; // 条件列表
  actions?: PenAction[];
}

// 图元触发器，用于监听数据变化触发的联动场景
export interface Trigger {
  name?: string;
  events?: Event[]; // 事件列表
}
