import { default as mitt, Emitter } from 'mitt';

import { LockState, Pen } from '../pen';
import { defaultOptions, Options } from '../options';

import { Point } from '../point';
import { globalStore } from './global';

export interface TopologyData {
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
  color?: string;   // 画笔默认 color 优先级高于 options.color
  penBackground?: string;   // 画笔默认背景色
  paths?: { [key: string]: string };  // paths 该图纸使用到的 svgPath ，打开后需要保存到 globalStore.paths
  bkImage?: string; // 背景图片
  http?: string; // http 请求 Url
  httpTimeInterval?: number; // http 请求间隔
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
  step?: number;   // 多次历史记录记为一次， step >= 2
  origin?: Point;
  scale?: number;
}

export interface TopologyStore {
  id: string;
  data: TopologyData;
  pens: { [key: string]: Pen };

  histories?: EditAction[];
  historyIndex?: number;
  path2dMap: WeakMap<Pen, Path2D>;
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
  clipboard?: TopologyClipboard;
  dirtyBackground?: boolean; // 是否需要重绘背景，包含网格
  dirtyTop?: boolean;   // 是否需要重绘标尺
}

export interface TopologyClipboard {
  pens: Pen[];
  origin: Point;
  scale: number;
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
    },
    histories: [],
    pens: {},
    path2dMap: new WeakMap(),
    active: [],
    animates: new Set(),
    options: { ...defaultOptions },
    emitter: mitt(),
  } as TopologyStore;
};

// Return a data store, if not exists will create a store.
export const useStore = (id = 'default') => {
  if (!globalStore[id]) {
    globalStore[id] = createStore();
    globalStore[id].id = id;
  }

  return globalStore[id];
};

export const clearStore = (store: TopologyStore) => {
  store.data = {
    x: 0,
    y: 0,
    scale: 1,
    pens: [],
    origin: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    paths: {}
  };
  store.pens = {};
  store.histories = [];
  store.historyIndex = null;
  store.path2dMap = new WeakMap();
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animates.clear();
};
