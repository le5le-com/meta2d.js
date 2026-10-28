import { Connection, Datasource, HttpConfig } from '../../../types';

import { normalizeMessageData } from './core';

export function connectHttp(datasource: Datasource, callback?: (msg: any, datasource: Datasource) => void): Connection {
  const { connectConfig, accessToken } = datasource;
  let url = connectConfig.url;
  if (accessToken) {
    if (url.includes('?')) {
      url += `&room=${accessToken}`;
    } else {
      url += `?room=${accessToken}`;
    }
  }

  const instance: any = { reconnects: 0 };

  fetch(url, {
    method: connectConfig.method,
    headers: connectConfig.headers,
    body: connectConfig.body,
  })
    .then((response) => {
      if (response.status !== 200) {
        const error: any = { url };
        error.status = response.status;
        throw error;
      }

      return response.json();
    })
    .then((data) => {
      data = normalizeMessageData(data, datasource);
      callback?.(data, datasource);
    })
    .catch((error) => {
      console.error('网络错误:', error.url);
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        instance.cancel = true;
        return;
      }
      instance.reconnects++;
    });

  if (connectConfig.interval > 100) {
    const timer = setInterval(() => {
      if (instance.cancel || (connectConfig.maxReconnects && instance.reconnects > connectConfig.maxReconnects)) {
        clearInterval(timer);
        return;
      }

      fetch(url, {
        method: connectConfig.method,
        headers: connectConfig.headers,
        body: connectConfig.body,
      })
        .then((response) => {
          if (response.status !== 200) {
            const error: any = { url };
            error.status = response.status;
            throw error;
          }

          return response.json();
        })
        .then((data) => {
          instance.reconnects = 0;

          data = normalizeMessageData(data, datasource);
          callback?.(data, datasource);
        })
        .catch((error) => {
          console.error('网络错误:', error.url);
          if (error.status === 401 || error.status === 403 || error.status === 404) {
            instance.cancel = true;
            return;
          }
          instance.reconnects++;
        });
    }, connectConfig.interval);
  }

  return {
    instance,
    datasource,
  };
}

export function disconnectHttp(connection: Connection) {
  const { instance, datasource } = connection;
  instance.cancel = true;
  if (datasource?.unsubscribeConfig) {
    fetch(datasource.unsubscribeConfig.url, {
      method: datasource.unsubscribeConfig.method,
      headers: datasource.unsubscribeConfig.headers,
      body: datasource.unsubscribeConfig.body,
    });
  }
}

// 使用http接口获取accessToken作为多人协作的房间号
export async function getAccessToken(subscribeConfig: HttpConfig | any): Promise<string> {
  const res: Response = await fetch(subscribeConfig.url, {
    method: subscribeConfig.method,
    headers: subscribeConfig.headers,
    body: subscribeConfig.body,
  });
  if (res.ok) {
    const data = await res.json();
    if (!data) {
      return;
    }
    return data.accessToken || data.token || data.id;
  } else {
    console.error('获取数据订阅Access Token失败');
  }
}
