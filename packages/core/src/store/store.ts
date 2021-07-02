import { default as mitt, Emitter } from 'mitt';

import { LockState, TopologyPen } from '../pen';
import { defaultOptions, Options } from '../options';

import pkg from '../../package.json';
import { Rect } from '../rect';
import { Point } from '../point';

export interface TopologyData {
  pens: { [key: string]: TopologyPen; };
  children: { [key: string]: string[]; };
  scale: number;
  locked: LockState;
  layer: string[];
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
  layer: number;
}

export interface TopologyStore {
  // An id of topology instance.
  topologyId: string;
  data: TopologyData;
  worldRect: Map<string, Rect>;
  worldAnchor: Map<string, Point[]>;
  // Websocket instance.
  websocket?: any;
  // mqtt instance.
  mqtt?: any;
  histories?: EditAction[];
  layerMap: Map<string, number>;
  active: Map<string, number>;
  hover: Map<string, number>;
  animate: Map<string, number>;
  dirty: Map<string, number>;
  options: Options;
  emitter: Emitter;
}

export const store: {
  version: string;
  htmlElements: object;
} = {
  version: pkg.version,
  htmlElements: {}
};

// Return a data store, if not exists will create a store.
export const useStore = (id = 'default') => {
  if (!store[id]) {
    store[id] = {
      topologyId: id,
      data: {
        pens: {},
        children: {},
        layer: []
      },
      histories: [],
      worldRect: new Map(),
      worldAnchor: new Map(),
      active: new Map(),
      hover: new Map(),
      animate: new Map(),
      dirty: new Map(),
      options: Object.assign({}, defaultOptions),
      emitter: mitt()
    } as TopologyStore;
  }

  return store[id];
};
