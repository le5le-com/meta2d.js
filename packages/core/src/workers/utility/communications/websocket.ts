import { Connection, Datasource } from '../../../types';

import { normalizeMessageData } from './core';

export function connectWebsocket(
  datasource: Datasource,
  callback: (msg: any, datasource: Datasource) => void,
  conn?: Connection
): Connection {
  const { connectConfig, accessToken, subscribeConfig } = datasource;
  let url = connectConfig.url;
  if (accessToken) {
    if (url.includes('?')) {
      url += `&room=${accessToken}`;
    } else {
      url += `?room=${accessToken}`;
    }
  }

  let client = new WebSocket(url, connectConfig.protocols);

  if (conn) {
    conn.instance = client;
    conn.datasource = datasource;
  } else {
    conn = {
      instance: client,
      datasource,
    };
  }

  client.onmessage = (e) => {
    const data = normalizeMessageData(e.data, datasource, undefined, (data) => JSON.parse(data.toString()));
    callback(data, datasource);
  };

  client.onclose = () => {
    if (connectConfig.maxReconnects && connectConfig.reconnects > connectConfig.maxReconnects) {
      client.onclose = undefined;
      client.close();
      return;
    }
    if (!connectConfig.reconnects) {
      connectConfig.reconnects = 1;
    } else {
      ++connectConfig.reconnects;
    }

    console.info('Websocket reconneting...');
    connectWebsocket(datasource, callback, conn);
  };

  client.onopen = () => {
    connectConfig.reconnects = 0;

    // 如果不提前使用http获取accessToken，则使用连接后发送一个订阅请求。【推荐使用http接口获取accessToken方式】
    if (subscribeConfig?.url) {
      client.send(JSON.stringify({ dataKeys: subscribeConfig.dataKeys }));
    }

    if (connectConfig.ping?.interval > 1000) {
      connectConfig.ping.timer = setInterval(() => {
        client.send(connectConfig.ping.text || accessToken || 'ping');
      }, connectConfig.ping.interval);
    }
  };

  return conn;
}

export function disconnectWebsocket(connection: Connection) {
  const { instance, datasource } = connection;
  if (instance) {
    instance.onclose = undefined;
    instance.close();

    if (datasource.connectConfig.ping?.timer) {
      clearInterval(datasource.connectConfig.ping.timer);
    }

    if (datasource.unsubscribeConfig) {
      fetch(datasource.unsubscribeConfig.url, {
        method: datasource.unsubscribeConfig.method,
        headers: datasource.unsubscribeConfig.headers,
        body: datasource.unsubscribeConfig.body,
      });
    }
  }
}
