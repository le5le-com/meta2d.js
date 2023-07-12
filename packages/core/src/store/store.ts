import { default as mitt, Emitter } from 'mitt';

import { FormItem, LockState, Pen } from '../pen';
import { defaultOptions, Options } from '../options';

import { Point } from '../point';
import { globalStore } from './global';

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
}

export interface Network {
  name?: string;
  type: 'mqtt' | 'websocket' | 'http';
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
  headers?: HeadersInit; //请求头
  method?: string;
  body?: any;
}

export interface HttpOptions {
  http?: string; // http 请求 Url
  httpTimeInterval?: number; // http 请求间隔
  httpHeaders?: HeadersInit; //请求头
  method?: string;
  body?: BodyInit | null;
}

export enum EditType {
  Add,
  Update,
  Delete,
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
  binds: { [key: string]: { id: string; key: string }[] };
  active?: Pen[];
  hover?: Pen;
  lastHover?: Pen;
  activeAnchor?: Point;
  hoverAnchor?: Point;
  pointAt?: Point;
  pointAtIndex?: number;
  animates: Set<Pen>;
  options: Options;
  emitter: Emitter;
  dpiRatio?: number;
  clipboard?: Meta2dClipboard;
  patchFlagsBackground?: boolean; // 是否需要重绘背景，包含网格
  patchFlagsTop?: boolean; // 是否需要重绘标尺
  bkImg: HTMLImageElement;
  // 测试使用
  fillWorldTextRect?: boolean; // 填充文本区域
  meta2dDatas?: Meta2dData[];
}

export interface Meta2dClipboard {
  meta2d?: boolean;
  pens: Pen[];
  origin: Point;
  scale: number;
  offset?: number;
  page: string;
  initRect?: Point;
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
    },
    histories: [],
    pens: {},
    path2dMap: new WeakMap(),
    animateMap: new WeakMap(),
    active: [],
    animates: new Set(),
    options: { ...defaultOptions },
    emitter: mitt(),
    bindDatas: {},
    binds: {},
    meta2dDatas: [],
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

export const clearStore = (store: Meta2dStore) => {
  store.data = {
    x: 0,
    y: 0,
    scale: 1,
    pens: [],
    origin: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    paths: {},
  };
  store.pens = {};
  store.histories = [];
  store.historyIndex = null;
  store.path2dMap = new WeakMap();
  store.animateMap = new WeakMap();
  store.bindDatas = {};
  store.binds = {};
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animates.clear();
};
