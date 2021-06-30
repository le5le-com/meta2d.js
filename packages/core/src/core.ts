import { EventType, Handler } from 'mitt';
import { Options } from './options';
import { TopologyData, TopologyStore, useStore } from './store';
import { s8 } from './utils';

declare const window: any;

export class Topology {
  store: TopologyStore;

  constructor(parent: string | HTMLElement, opts: Options = {}) {
    this.store = useStore(s8());

    if (window) {
      window.topology = this;
    }
  }

  open(data?: TopologyData) {
    if (data && data.mqttOptions && !data.mqttOptions.customClientId) {
      data.mqttOptions.clientId = s8();
    }

    this.store.emitter.emit('opened');
  }

  on(eventType: EventType, handler: Handler) {
    this.store.emitter.on(eventType, handler);
    return this;
  }

  off(eventType: EventType, handler: Handler) {
    this.store.emitter.off(eventType, handler);
    return this;
  }
}
