import { TopologyStore } from '../store';

export interface Event {
  name: string;
  action: EventAction;
  where?: Where;
  value?: string;
  params?: string;
  fn?: Function;
}

export enum EventAction {
  Link,
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
