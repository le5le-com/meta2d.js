import { useStore } from '../store';

export const connectWebsocket = (url: string, topologyId = 'default') => {
  closeWebsocket(topologyId);

  const store = useStore(topologyId);
  const socket = new WebSocket(url);
  store.websocket = socket;

  socket.onclose = () => {
    console.info('[Topology]: Websocket closed and reconneting...');
    connectWebsocket(url);
  };
};

export const closeWebsocket = (topologyId = 'default') => {
  const store = useStore(topologyId);
  if (store.websocket) {
    store.websocket.onclose = undefined;
    store.websocket.close();
  }
  store.websocket = undefined;
};
