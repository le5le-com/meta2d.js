import { Connection, Datasource, HttpConfig, WorkerMessage } from '../../../types';
import { Bind, IValue } from '../../../models';
import { replaceJsonTemplateVars, replaceStringTemplateVars } from '../../../utils';

import { connectHttp, disconnectHttp, getAccessToken } from './http';
import { connectWebsocket, disconnectWebsocket } from './websocket';
import { connectMqtt, disconnectMqtt } from './mqtt';
import { connectSSE, disconnectSSE } from './sse';
import { connectSQL, disconnectSQL } from './sql';
import { connectIot, disconnectIot } from './iot';

export interface ConnectionContext {
  boundDataPoints: Record<string, unknown>;
  bindings: Bind[];
}

const connectMap: Record<
  string,
  {
    connect: (datasource: Datasource, callback: (msg: any, datasource: Datasource) => void, context?: ConnectionContext) => Connection;
    disconnect?: (connection: Connection) => void | Promise<void>;
    getAccessToken?: (subscribeConfig: HttpConfig | any) => Promise<string>;
  }
> = {
  MQTT: {
    connect: connectMqtt,
    disconnect: disconnectMqtt,
    getAccessToken,
  },
  WebSocket: {
    connect: (datasource, callback) => connectWebsocket(datasource, callback),
    disconnect: disconnectWebsocket,
    getAccessToken,
  },
  HTTP: {
    connect: connectHttp,
    disconnect: disconnectHttp,
    getAccessToken,
  },
  SSE: {
    connect: connectSSE,
    disconnect: disconnectSSE,
    getAccessToken,
  },
  SQL: {
    connect: connectSQL,
    disconnect: disconnectSQL,
  },
  IOT: {
    connect: connectIot,
    disconnect: disconnectIot,
  },
};

let connections: Connection[] = [];
let boundDataPoints: { [key: string]: { id: string; key: string }[] } = {};

let varMap: Record<string, any> = {};
let vars: any = {};

let collaborateConnection: Connection;

export function setVarMap(map: Record<string, any>) {
  varMap = map;
}

export let messageNormalizer: (msg: any, context: { name: string; topic?: string }) => any;

export function normalizeMessageData(
  data: any,
  datasource: Datasource,
  context?: { topic?: string },
  getDefaultData: (data: any) => any = (data) => data
) {
  if (!messageNormalizer) {
    return getDefaultData(data);
  }

  const normalized = messageNormalizer(data, { name: datasource.name, ...context });
  return normalized === true ? getDefaultData(data) : normalized;
}

// 注册自定义通信，需要传入一个包含connects的js文件路径。文件内容参考：
// export const connects = [{
//    type: '自定义通信类型',
//    connect: (datasource: Datasource, callback: (msg: any, datasource: Datasource) => void) => Connection,
//    disconnect?: (connection: Connection) => void,
//    getAccessToken?: (subscribeConfig: HttpConfig | any) => Promise<string>,
// }];
//
// 【可选】自定义获取动态变量对象的函数，用于替换模板中的变量。
// export getVars = () => {return {}};
export async function register(filePath: string) {
  try {
    const { connects } = await import(/* @vite-ignore */ filePath);
    for (const c of connects) {
      delete c.type;
      connectMap[c.type] = c;
    }
  } catch (e) {
    console.error('注册自定义通信错误：', e);
  }
}

// 新连接等待旧连接清理，避免同一订阅房间被旧关闭请求误取消。
let closing: Promise<void> = Promise.resolve();

export async function onSetConnections(e: MessageEvent) {
  // 重置数据源
  if (e.data.stopAll) {
    void onStopConnect({ data: {} } as MessageEvent);
  }

  if (e.data.boundDataPoints) {
    boundDataPoints = e.data.boundDataPoints;
  }

  if (e.data.vars) {
    vars = e.data.vars;
  }

  if (e.data.datasources) {
    const snapshot = { boundDataPoints, bindings: e.data.bindings || [] };
    for (const datasource of e.data.datasources as Datasource[]) {
      if (datasource.enable === false || datasource.connectOnDemand) continue;
      void onStartConnect(datasource, snapshot);
    }
  }
}

export async function onAddOrUpdateConnect(e: MessageEvent) {
  const datasource = e.data.datasource as Datasource;
  if (datasource.enable === false) {
    await onStopConnect({ data: { id: datasource.id } } as MessageEvent);
    return;
  }
  const connection = connections.find((c) => c.datasource.id === datasource.id && c.datasource.type === 'SQL');
  if (datasource.type !== 'SQL' || !connection) return;
  if (!connection.instance) {
    // 打开流程还在等待清理时，只替换待启动配置，不额外创建查询任务。
    Object.assign(connection.datasource, structuredClone(datasource));
    return;
  }
  // 只刷新已有 SQL：取消旧请求和轮询，再立即按新配置查询，旧响应由 cancel 隔离。
  disconnectSQL(connection);
  Object.assign(connection, connectSQL(structuredClone(datasource), (msg, source) => {
    if (connections.includes(connection)) onMessage(msg, source);
  }));
}

export async function onStartConnect(e: MessageEvent | Datasource, snapshot?: ConnectionContext) {
  // 只有打开流程传入快照；保留旧 Worker 入口，但不再由它创建连接。
  if (!snapshot || 'data' in e) return;
  const datasource = structuredClone(e);
  if (datasource.enable === false || connections.find((c) => c.datasource.id === datasource.id)) return;

  // 先登记连接，等待旧清理或普通 token 请求期间也能去重、停止。
  const opening: Connection = { datasource, instance: undefined };
  let conn = opening;
  connections.push(opening);
  try {
    await closing;
    if (!connections.includes(conn)) return;
    const adapter = connectMap[datasource.type];
    if (!adapter) throw new Error('未知数据源类型：' + datasource.type);

    // IOT、SQL 在各次请求中解析变量，不能在这里改写原始模板。
    if (datasource.type !== 'IOT' && datasource.type !== 'SQL') {
      const { connectConfig, subscribeConfig, unsubscribeConfig } = datasource;
      for (const config of [connectConfig, subscribeConfig, unsubscribeConfig]) {
        if (!config) continue;
        if (config.url) config.url = replaceStringTemplateVars(config.url, vars);
        if (config.headers) config.headers = replaceJsonTemplateVars(config.headers, vars);
        if (config.body) config.body = typeof config.body === 'string'
          ? replaceStringTemplateVars(config.body, vars) : replaceJsonTemplateVars(config.body, vars);
      }
    }
    if (datasource.subscribeConfig && adapter.getAccessToken) {
      datasource.accessToken = await adapter.getAccessToken(datasource.subscribeConfig);
      if (!datasource.accessToken || !connections.includes(opening)) return;
    }
    conn = adapter.connect(datasource, (msg, source) => {
      if (connections.includes(conn)) onMessage(msg, source);
    }, snapshot);
    if (conn) {
      // 保留适配器返回的对象，WebSocket 重连会更新它的 instance。
      connections.push(conn);
      if (datasource.collaborator) collaborateConnection = conn;
    }
  } catch (error) {
    console.error('数据源连接失败：', error);
  } finally {
    // 成功、无有效订阅或异常退出，都统一移除启动占位。
    connections = connections.filter((c) => c !== opening);
  }
}

export async function onStopConnect(e: MessageEvent) {
  if (!e.data.id) {
    boundDataPoints = {};
    vars = {};
  }
  const conns = connections.filter((c) => !e.data.id || c.datasource.id === e.data.id);
  connections = connections.filter((c) => !conns.includes(c));
  if (conns.includes(collaborateConnection)) collaborateConnection = undefined;
  // disconnect 立即取消连接内部的启动请求；新打开仍等待旧清理完成。
  closing = Promise.all([closing, ...conns.map(async (conn) => {
    if (!conn.instance) return;
    try { await connectMap[conn.datasource.type].disconnect?.(conn); }
    catch (error) { console.error('断开数据源失败：', error); }
  })]).then(() => {});
  return closing;
}

export async function onSendData(e: MessageEvent) {
  try {
    await sendData(e.data.datasource, e.data.data, e.data.callback);
  } catch (error) {
    console.error('[meta2d] 发送数据失败:', error);
  }
}

export function onAddOrUpdateDataPoint(e: MessageEvent) {
  const connection = connections.find((c) => c.datasource.id === e.data.id);
  if (!connection) {
    return;
  }

  const dp = connection.datasource.dataPoints.find((item) => item.key === e.data.dataPoint.key);
  if (dp) {
    Object.assign(dp, e.data.dataPoint);
  } else {
    connection.datasource.dataPoints.push(structuredClone(e.data.dataPoint));
  }
}

export function onDeleteDataPoints(e: MessageEvent) {
  const connection = connections.find((c) => c.datasource.id === e.data.id);
  if (!connection) {
    return;
  }

  connection.datasource.dataPoints = connection.datasource.dataPoints.filter((d) => !e.data.keys.includes(d.key));
}

export function setMessageNormalizer(js?: string) {
  if (!js) {
    messageNormalizer = undefined;
    return;
  }

  try {
    messageNormalizer = new Function('e', 'context', js) as any;
  } catch (e) {
    console.error('自定义消息格式转换函数的脚本错误：', e);
  }
}

// 所有数据通信的统一回调函数
function onMessage(msg: any, datasource: Datasource) {
  if (Array.isArray(msg) && msg.length) {
    // [{id: dataPointId,value: dataPointValue}]格式数据
    if ((msg[0].id || msg[0].dataId) && Object.prototype.hasOwnProperty.call(msg[0], 'value')) {
      const values: IValue[] = [];
      for (const obj of msg) {
        obj.id = obj.id || obj.dataId;
        if (varMap?.[obj.id]) {
          vars[obj.id] = obj.value;
        }

        if (!boundDataPoints[obj.id]) {
          continue;
        }

        // const dataPoint = datasource.dataPoints.find((d) => d.key === obj.id);
        // if (!dataPoint) {
        //   continue;
        // }
        for (const bound of boundDataPoints[obj.id]) {
          values.push({
            id: bound.id,
            [bound.key]: obj.value,
          });
        }
      }

      if (values.length) {
        self.postMessage({
          action: WorkerMessage.MessageCallback,
          values,
        });
      }
      return;
    }

    // [{id:penId, tag: penTag, color:penColor,...}] 直接图元格式数据
    self.postMessage({
      action: WorkerMessage.MessageCallback,
      values: msg,
    });
    return;
  }

  if ((!datasource.collaborator && !datasource.dataPoints?.length) || !msg || typeof msg !== 'object') {
    return;
  }

  const values: IValue[] = [];

  // {add, remove, beforeUpdate, update, collaborator}格式的多人协作数据
  if (msg.patch || msg.patchs) {
    msg.action = WorkerMessage.MessageCallback;
    self.postMessage(msg);

    return;
  }

  // {id:value}，直接数据点id:数据点值组成的json数据。推荐
  for (const key in msg) {
    if (varMap?.[key]) {
      vars[key] = msg[key];
    }

    if (!boundDataPoints[key]) {
      continue;
    }

    // const dataPoint = datasource.dataPoints.find((d) => d.key === key);
    // if (!dataPoint) {
    //   continue;
    // }

    for (const bound of boundDataPoints[key]) {
      values.push({
        id: bound.id,
        [bound.key]: msg[key],
      });
    }
  }
  if (values.length) {
    self.postMessage({
      action: WorkerMessage.MessageCallback,
      values,
    });
  }
}

// 发送多人协作数据
export function onPatch(e: MessageEvent) {
  if (collaborateConnection?.datasource.type === 'WebSocket') {
    collaborateConnection.instance.send(
      JSON.stringify({
        collaborator: collaborateConnection.datasource.collaborator,
        patch: e.data.patch,
      }),
    );
    return;
  }

  if (collaborateConnection?.datasource.type === 'MQTT') {
    const connectConfig = collaborateConnection.datasource.connectConfig;
    const topic = connectConfig.collaborateTopic || connectConfig.topic + '/collaborate';
    collaborateConnection.instance.publish(
      topic,
      JSON.stringify({
        collaborator: collaborateConnection.datasource.collaborator,
        patch: e.data.patch,
      }),
    );
    return;
  }
}

async function sendData(datasource: Datasource, data: any, callback?: string) {
  switch (datasource.type) {
    case 'MQTT':
      return sendMqttData(datasource, data);
    case 'WEBSOCKET':
      return sendWebSocketData(datasource, data);
    case 'HTTP':
      return sendHttpData(datasource, data, callback);
    default:
      console.warn(`[meta2d] 暂不支持 ${datasource.type} 数据源发送数据`);
  }
}

async function getOrCreateConnection(datasource: Datasource) {
  const connection = connections.find((c) => c.datasource.id === datasource.id);
  if (connection?.instance) {
    return connection;
  }
  throw new Error(`数据源 ${datasource.name || datasource.id} 未连接，请先打开图纸`);
}

async function sendMqttData(datasource: Datasource, data: any) {
  const connection = await getOrCreateConnection(datasource);
  const topics: string[] = datasource.connectConfig?.topics.split(',');
  if (!topics || topics.length === 0) {
    throw new Error('MQTT发送数据缺少topic');
  }

  const message = JSON.stringify(data);
  if (connection.instance.connected) {
    topics.forEach((topic) => connection.instance.publish(topic, message));
    return;
  }

  connection.instance.once('connect', () => {
    topics.forEach((topic) => connection.instance.publish(topic, message));
  });
}

async function sendWebSocketData(datasource: Datasource, data: any) {
  const connection = await getOrCreateConnection(datasource);
  const message = JSON.stringify(data);
  const client: WebSocket = connection.instance;

  if (client.readyState === WebSocket.OPEN) {
    client.send(message);
    return;
  }

  client.addEventListener(
    'open',
    () => {
      client.send(message);
    },
    { once: true },
  );
}

async function sendHttpData(datasource: Datasource, data: any, callback?: string) {
  const { connectConfig } = datasource;
  if (connectConfig.method === 'GET') {
    connectConfig.url = appendQuery(connectConfig.url, data);
  } else {
    connectConfig.body = JSON.stringify(data);
  }
  if (callback) {
    let fn = new Function('data', 'datasource', callback) as (msg: any, datasource: Datasource) => void;
    connectHttp(datasource, fn);
  } else {
    connectHttp(datasource);
  }
}

function appendQuery(url: string, data: any) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return url;
  }

  const query = new URLSearchParams();
  for (const key in data) {
    if (data[key] != undefined) {
      query.set(key, data[key].toString());
    }
  }

  if (!query.toString()) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}${query.toString()}`;
}
