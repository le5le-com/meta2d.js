import { default as mitt, Emitter } from 'mitt';

import { CanvasLayer, FormItem, LockState, Pen } from '../pen';
import { defaultOptions, Options } from '../options';
import { defaultTheme, Theme } from '../theme';

import { Point } from '../point';
import { globalStore } from './global';
import { Rect } from '../rect';
import { Event, Trigger } from '../event';

export interface Meta2dData {
  pens: Pen[];
  x: number;
  y: number;
  scale: number;
  // 标尺起点
  origin: Point;
  center: Point;
  locked?: LockState;
  websocket?: string;
  mqtt?: string;
  mqttOptions?: {
    clientId?: string;
    username?: string;
    password?: string;
    customClientId?: boolean;
  };
  mqttTopics?: string;
  websocketProtocols?: string | string[];
  background?: string;
  globalAlpha?: number;
  socketCbJs?: string;
  initJs?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  gridRotate?: number;
  rule?: boolean;
  ruleColor?: string;
  fromArrow?: string;
  toArrow?: string;
  lineWidth?: number;
  lineColor?: string; // 线条默认颜色
  color?: string; // 画笔默认 color 优先级高于 options.color
  textColor?: string; // 画笔文字颜色
  penBackground?: string; // 画笔默认背景色
  paths?: { [key: string]: string }; // paths 该图纸使用到的 svgPath ，打开后需要保存到 globalStore.paths
  bkImage?: string; // 背景图片
  http?: string; // http 请求 Url
  httpTimeInterval?: number; // http 请求间隔
  httpHeaders?: HeadersInit; //请求头
  version?: string; // 版本号
  id?: string;
  _id?: string;
  https?: HttpOptions[];
  width?: number;
  height?: number;
  networkInterval?: number;
  networks?: Network[];
  iconUrls?: string[];
  mockData?: Function;
  name?: string;
  enableMock?: boolean;
  minScale?: number;
  maxScale?: number;
  template?: string; //模版id
  cancelFirstConnect?: boolean; //http定时轮询首次是否请求
  component?: boolean;
  theme?: string; //主题
  smoothNum?:number;//平滑量 值越大，平滑效果越好
  triggers?:Trigger[]; //全局状态
  dataPoints?: string[]; //数据点
  dataset?:{
    devices?: DataMock[]; //数据模拟
  };
  dataEvents?:Event[]; //数据点事件
  fits?: Fit[];
  disableTranslate?: boolean; //禁止平移
  disableScale?: boolean; //禁止缩放
}

export interface Fit {
  id?:string;
  name?:string;
  x?:number;
  y?:number;
  ex?:number;
  ey?:number;
  width?:number;
  height?:number;
  children?:string[];
  active?:boolean;
  left?:boolean;
  right?:boolean;
  top?:boolean;
  bottom?:boolean;
  leftValue?:number;
  rightValue?:number;
  topValue?:number;
  bottomValue?:number;
}

export interface DataMock {
  id: string;
  label?: string;
  mock?: string;
  type?: string;
  enableMock?: boolean;
}

export interface Network {
  name?: string;
  protocol?: 'mqtt' | 'websocket' | 'http' | 'iot' | 'sql'| 'jetLinks';
  type?: string; //subscribe
  url?: string;
  //websocket
  protocols?: string;
  //mqtt
  topics?: string;
  options?: {
    clientId?: string;
    username?: string;
    password?: string;
    customClientId?: boolean;
  };
  //http
  headers?: any; //请求头
  method?: string;
  body?: any;
  data?: Network
  interval?: number; // http 请求间隔
  times?: number; // 临时 重连次数
  index?: number; // 临时 索引
  devices?: any[]; //物联网设备,
  dbId?: string; //数据库id
  sql?: string; //sql语句
}

export interface HttpOptions {
  http?: string; // http 请求 Url
  httpTimeInterval?: number; // http 请求间隔
  httpHeaders?: HeadersInit; //请求头
  method?: string;
  body?: BodyInit | null;
  times?: number; // 临时 重连次数
}

export enum EditType {
  Add,
  Update,
  Delete,
  Replace
}

export interface EditAction {
  type?: EditType;
  initPens?: Pen[];
  pens?: Pen[];
  step?: number; // 多次历史记录记为一次， step >= 2
  origin?: Point;
  scale?: number;
}

export interface Meta2dStore {
  id: string;
  data: Meta2dData;
  pens: { [key: string]: Pen };

  histories?: EditAction[];
  historyIndex?: number;
  path2dMap: WeakMap<Pen, Path2D>;
  animateMap: WeakMap<Pen, Pen>;
  bindDatas: { [key: string]: { id: string; formItem: FormItem }[] };
  bind?: { [key: string]: { id: string; key: string }[] };
  active?: Pen[];
  hover?: Pen;
  lastHover?: Pen;
  hoverContainer?:Pen;
  lastHoverContainer?:Pen;
  activeAnchor?: Point;
  hoverAnchor?: Point;
  pointAt?: Point;
  pointAtIndex?: number;
  animates: Set<Pen>;
  options: Options;
  theme: Theme;
  emitter: Emitter;
  dpiRatio?: number;
  clipboard?: Meta2dClipboard;
  patchFlagsBackground?: boolean; // 是否需要绘制底层图片   是否需要重绘背景，包含网格
  patchFlagsTop?: boolean; // 是否需要重绘标尺
  bkImg?: HTMLImageElement;
  // 测试使用
  fillWorldTextRect?: boolean; // 填充文本区域
  cacheDatas?: {
    data: Meta2dData;
  }[];
  patchFlagsLast?: boolean; // 清除上次图片画布层
  messageEvents?: { [key: string]: { pen: Pen; event: Event }[] };
  templatePens?: { [key: string]: Pen };
  sameTemplate?: boolean; //标记是否是同一模版
  lastScale?: number; //记录上次模版的scale
  pensNetwork?: {
    [key: string]: { url?: string; method?: string; headers?: any; body?: any };
  };
  globalTriggers?:{[key:string]:Trigger[]};
}

export interface Meta2dClipboard {
  meta2d?: boolean;
  pens: Pen[];
  origin: Point;
  scale: number;
  offset?: number;
  page: string;
  initRect?: Rect;
  pos?: Point;
}

export const createStore = () => {
  return {
    data: {
      x: 0,
      y: 0,
      scale: 1,
      pens: [],
      origin: { x: 0, y: 0 },
      center: { x: 0, y: 0 },
      paths: {},
      theme:'light'
    },
    histories: [],
    pens: {},
    path2dMap: new WeakMap(),
    animateMap: new WeakMap(),
    active: [],
    animates: new Set(),
    options: { ...defaultOptions },
    theme:{ ...defaultTheme },
    emitter: mitt(),
    bindDatas: {},
    bind: {},
    pensNetwork: {},
    cacheDatas: [],
    messageEvents: {},
    templatePens: {},
    globalTriggers:{},
  } as Meta2dStore;
};

// Return a data store, if not exists will create a store.
export const useStore = (id = 'default'): Meta2dStore => {
  if (!globalStore[id]) {
    globalStore[id] = createStore();
    globalStore[id].id = id;
  }

  return globalStore[id];
};

export const clearStore = (store: Meta2dStore, template?: string) => {
  const isSame = store.data.template === template;
  if (isSame) {
    //模版一样
    for (const pen of store.data.pens) {
      // if (pen.template) {
      if (pen.canvasLayer === CanvasLayer.CanvasTemplate) {
        store.templatePens[pen.id] = pen;
      }
    }
  }
  store.lastScale = store.data.scale;
  store.data = {
    x: 0,
    y: 0,
    scale: 1,
    pens: [],
    origin: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    paths: {},
    template: isSame ? template : null,
  };
  store.sameTemplate = isSame;
  store.pens = {};
  store.histories = [];
  store.historyIndex = null;
  store.path2dMap = new WeakMap();
  store.animateMap = new WeakMap();
  store.bindDatas = {};
  store.bind = {};
  store.pensNetwork = {};
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animates.clear();
};
