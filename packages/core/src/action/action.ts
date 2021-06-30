

export interface Action {
  do?: string;
  url?: string;
  _blank?: string;
  tag?: string;
  fn?: string;
  params?: any;
}

export interface Where {
  key?: string;
  comparison?: string;
  value?: any;
  fn?: string;
  actions?: Action[];
}

const eventFns: string[] = ['link', 'doStartAnimate', 'doFn', 'doWindowFn', '', 'doPauseAnimate', 'doStopAnimate', 'doEmit'];
