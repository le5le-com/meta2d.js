import { default as mitt, Emitter } from 'mitt';

import { LockState, Pen } from '../pen';
import { defaultOptions, Options } from '../options';

import { Point } from '../point';
import { globalStore } from '.';

export interface TopologyData {
  pens: Pen[];
  x: number;
  y: number;
  scale: number;
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
  socketCbFn?: Function;
  initJs?: string;
  grid?: boolean;
  gridColor?: string;
  gridSize?: number;
  rule?: boolean;
  ruleColor?: string;
  fromArrow?: string;
  toArrow?: string;
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
  clipboard?: Pen[];
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
  };
  store.pens = {};
  store.histories = [];
  store.path2dMap = new WeakMap();
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animates.clear();
};
