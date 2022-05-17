import { SetValue } from "../pen";

export type EventValue = string | SetValue | undefined | null;
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
  comparison?: string;
  value?: unknown;
  fn?: Function;
  fnJs?: string;
}
