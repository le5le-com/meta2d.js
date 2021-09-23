export interface Event {
  type: string;
  action: EventAction;
  where?: Where;
  value: string | Function;
  params?: string;
}

export enum EventAction {
  Link,
  StartAnimate,
  PauseAnimate,
  StopAnimate,
  FunctionJs,
  WindowFn,
  Emit,
}

export interface Where {
  key?: string;
  comparison?: string;
  value?: any;
  fn?: string;
}
