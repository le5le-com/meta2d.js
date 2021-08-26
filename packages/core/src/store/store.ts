import { default as mitt, Emitter } from 'mitt';

import { LockState, Pen } from '../pen';
import { defaultOptions, Options } from '../options';

import { Point } from '../point';
import { globalStore } from '.';

export interface TopologyData {
  pens: Pen[];
  children: { [key: string]: string[] };
  x: number;
  y: number;
  scale: number;
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
}

export enum EditType {
  Add,
  Update,
  Delete,
  Layer,
}

export interface EditAction {
  type: EditType;
  data: any;
}

export interface TopologyStore {
  // An id of topology instance.
  topologyId: string;
  data: TopologyData;
  pens: any;

  // world offset
  center: Point;

  // Websocket instance.
  websocket?: any;
  // mqtt instance.
  mqtt?: any;
  histories?: EditAction[];
  path2dMap: WeakMap<Pen, Path2D>;
  active?: Pen[];
  hover?: Pen;
  lastHover?: Pen;
  anchor?: Point;
  pointAt?: Point;
  pointAtIndex?: number;
  animate: Map<Pen, number>;
  options: Options;
  emitter: Emitter;
  penPaths: any;
  dpiRatio?: number;
}

export const createStore = () => {
  return {
    data: {
      x: 0,
      y: 0,
      scale: 1,
      pens: [],
      children: {},
      center: { x: 0, y: 0 },
    },
    histories: [],
    pens: {},
    path2dMap: new WeakMap(),
    active: [],
    animate: new Map(),
    options: { ...defaultOptions },
    emitter: mitt(),
  } as TopologyStore;
};

// Return a data store, if not exists will create a store.
export const useStore = (id = 'default') => {
  if (!globalStore[id]) {
    globalStore[id] = createStore();
    globalStore[id].topologyId = id;
  }

  return globalStore[id];
};

export const clearStore = (store: TopologyStore) => {
  store.data = {
    x: 0,
    y: 0,
    scale: 1,
    pens: [],
    children: {},
    center: { x: 0, y: 0 },
  };
  store.center = { x: 0, y: 0 };
  store.pens = {};
  store.histories = [];
  store.path2dMap = new WeakMap();
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animate.clear();
};
