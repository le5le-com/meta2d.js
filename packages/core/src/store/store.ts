import { default as mitt, Emitter } from 'mitt';

import { LockState, TopologyPen } from '../pen';
import { defaultOptions, Options } from '../options';

import pkg from '../../package.json';

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

  // Websocket instance.
  websocket?: any;
  // mqtt instance.
  mqtt?: any;
  histories?: EditAction[];
  path2dMap: WeakMap<TopologyPen, Path2D>;
  active: TopologyPen[];
  hover: TopologyPen;
  lastHover: TopologyPen;
  animate: Map<TopologyPen, number>;
  dirty: Map<TopologyPen, number>;
  options: Options;
  emitter: Emitter;
  registerPens: any;
  dpiRatio?: number;
  debug?: boolean;
}

export const globalStore: {
  version: string;
  htmlElements: { [key: string]: any; };
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
    path2dMap: new WeakMap(),
    active: [],
    animate: new Map(),
    dirty: new Map(),
    options: Object.assign({}, defaultOptions),
    emitter: mitt()
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
    pens: [],
    children: {},
  };
  store.pens = {};
  store.histories = [];
  store.path2dMap = new WeakMap();
  store.active = [];
  store.hover = undefined;
  store.lastHover = undefined;
  store.animate.clear();
  store.dirty.clear();
};


