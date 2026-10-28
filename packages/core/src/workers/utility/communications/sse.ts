import { Connection, Datasource } from '../../../types';

import { normalizeMessageData } from './core';

export function connectSSE(datasource: Datasource, callback: (msg: any, datasource: Datasource) => void): Connection {
  const { connectConfig, accessToken } = datasource;
  let url = connectConfig.url;
  if (accessToken) {
    if (url.includes('?')) {
      url += `&room=${accessToken}`;
    } else {
      url += `?room=${accessToken}`;
    }
  }

  const instance = new EventSource(url, { withCredentials: connectConfig.withCredentials });
  instance.onmessage = (e) => {
    const data = normalizeMessageData(e.data, datasource, undefined, (data) => JSON.parse(data.toString()));
    callback(data, datasource);
  };

  return {
    instance,
    datasource,
  };
}

export function disconnectSSE(connection: Connection) {
  connection.instance.close();
}
