import { IValue } from '../pen';

export type EventValue = string | IValue | undefined | null;
export interface Event {
  name: string;
  action: EventAction;
  where?: Where;
  value?: EventValue;
  params?: string;
  fn?: Function;
}

export enum EventAction {
  Link,
  SetProps,
  StartAnimate,
  PauseAnimate,
  StopAnimate,
  Function,
  WindowFn,
  Emit,
}

export interface Where {
  key?: string;
  comparison?: Comparison;
  value?: unknown;
  fn?: Function;
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
