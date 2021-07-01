import { default as mitt, Emitter, EventType, Handler } from 'mitt';

import { TopologyPen } from '../pen';
import { defaultOptions } from '../options';

import pkg from '../../package.json';

export interface TopologyData {
  pens: { [key: string]: TopologyPen; };
  children: { [key: string]: string[]; };
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
  // Websocket instance.
  websocket?: any;
  // mqtt instance.
  mqtt?: any;
  histories?: EditAction[];
  active: WeakMap<TopologyPen, any>;
  hover: WeakMap<TopologyPen, any>;
  animate: WeakMap<TopologyPen, any>;
  options: Object;
  emitter: Emitter;
}

export const store: {
  version: string;
  doms: object;
} = {
  version: pkg.version,
  doms: {}
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
      active: new WeakMap(),
      hover: new WeakMap(),
      animate: new WeakMap(),
      options: Object.assign({}, defaultOptions),
      emitter: mitt()
    } as TopologyStore;
  }

  return store[id];
};
