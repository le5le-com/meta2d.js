import { IValue, Pen } from '../pen';

export type EventValue = string | IValue | undefined | null;
// 事件行为
export type EventName =
  | 'enter'
  | 'leave'
  | 'active'
  | 'inactive'
  | 'click'
  | 'mousedown'
  | 'mouseup'
  | 'dblclick'
  | 'valueUpdate';
export interface Event {
  condition: EventCondition;
  name: EventName;
  action: EventAction; // 事件动作
  where?: Where; // 若无条件，必须为 undefined or null，不可为空对象
  value?: EventValue; // 不同 action 下，该值含义不同，例如：动画相关的，即为 节点 tag; Function 类型即为 字符串函数
  params?: string;
  fn?: (pen: Pen, params: string) => void;
}
export type EventCondition =
  | 'nothing'
  | 'comparison'
  | 'code1'
  | 'code2'
  | 'userDefine';
export enum EventAction {
  Link,
  SetProps,
  StartAnimate,
  PauseAnimate,
  StopAnimate,
  Function,
  WindowFn,
  Emit,
  StartVideo,
  PauseVideo,
  StopVideo,
}

export interface Where {
  key?: string;
  comparison?: Comparison;
  value?: unknown;
  fn?: (pen: Pen) => boolean;
  fnJs?: string;
}

/**
 * 触发器中的符号
 */
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
