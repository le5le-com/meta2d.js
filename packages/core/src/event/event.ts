export interface Event {
  name: string;
  action: EventAction;
  where?: Where;
  value?: any;
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
  value?: any;
  fn?: Function;
  fnJs?: string;
}
