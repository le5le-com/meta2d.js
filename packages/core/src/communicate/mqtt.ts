import * as mqtt from 'mqtt/dist/mqtt.min.js';

import { useStore } from '../store';

export const connectMqtt = (url: string, topics: string, options: any = undefined, topologyId = 'default') => {
  closeMqtt(topologyId);

  const store = useStore(topologyId);
  store.mqtt = mqtt.connect(url, options);
  if (topics) {
    store.mqtt.subscribe(topics.split(','));
  }
};

export const closeMqtt = (topologyId = 'default') => {
  const store = useStore(topologyId);
  if (store.mqtt) {
    store.mqtt.end();
  }
  store.mqtt = undefined;
};

