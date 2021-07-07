import { default as mitt, Emitter } from 'mitt';

import { LockState, TopologyPen } from '../pen';
import { defaultOptions, Options } from '../options';

import pkg from '../../package.json';
import { Rect } from '../rect';
import { Point } from '../point';

export interface TopologyData {
  pens: TopologyPen[];
  children: { [key: string]: string[]; };
  scale?: number;
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
  Layer
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
  worldRects: WeakMap<TopologyPen, Rect>;
  worldRotates: WeakMap<TopologyPen, number>;
  worldAnchors: WeakMap<TopologyPen, Point[]>;
  // Websocket instance.
  websocket?: any;
  // mqtt instance.
  mqtt?: any;
  histories?: EditAction[];
  path2dMap: WeakMap<TopologyPen, Path2D>;
  active: Map<TopologyPen, number>;
  hover: TopologyPen;
  animate: Map<TopologyPen, number>;
  dirty: Map<TopologyPen, number>;
  options: Options;
  emitter: Emitter;
  registerPens: any;
  dpiRatio?: number;
}

export const store: {
  version: string;
  htmlElements: object;
} = {
  version: pkg.version,
  htmlElements: {}
};

export const createStore = () => {
  return {
    data: {
      pens: [],
      children: {},
    },
    histories: [],
    pens: {},
    worldRects: new WeakMap(),
    worldAnchors: new WeakMap(),
    worldRotates: new WeakMap(),
    path2dMap: new WeakMap(),
    active: new Map(),
    animate: new Map(),
    dirty: new Map(),
    options: Object.assign({}, defaultOptions),
    emitter: mitt()
  } as TopologyStore;
};

// Return a data store, if not exists will create a store.
export const useStore = (id = 'default') => {
  if (!store[id]) {
    store[id] = createStore();
    store[id].topologyId = id;
  }

  return store[id];
};

export const clearStore = (store: TopologyStore) => {
  store.data = {
    pens: [],
    children: {},
  };
  store.pens = {};
  store.histories = [];
  store.worldRects = new WeakMap();
  store.worldAnchors = new WeakMap();
  store.worldRotates = new WeakMap();
  store.path2dMap = new WeakMap();
  store.active.clear();
  store.hover = undefined;
  store.animate.clear();
  store.dirty.clear();
};


