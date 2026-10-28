import mqtt, { type MqttClient } from 'mqtt';
import type { ConnectionContext } from './core';
import type { Bind, IotBind } from '../../../models';
import type { Connection, Datasource, HttpConfig, IotDevice, MqttConfig } from '../../../types';
import { replaceStringTemplateVars } from '../../../utils/vars';
import { WorkerMessage } from '../../../types/message';
import { normalizeMessageData } from './core';

export interface IotConnectionPlan {
  devices: ReturnType<typeof iotSelection>['devices'];
  computes: IotBind[];
}

export function readIotBody(source: Datasource): { devices: IotDevice[]; room?: string } {
  try {
    const body = source.subscribeConfig?.body;
    const value = typeof body === 'string' ? JSON.parse(body) : body;
    return { devices: Array.isArray(value?.devices) ? value.devices : [], room: value?.room };
  } catch {
    return { devices: [] };
  }
}

/** 聚合结果绑定必须反向关联原始属性，不能用结果 ID 直接向设备订阅。 */
export function iotSelection(source: Datasource, bound: Record<string, unknown>, bindings: (Bind | IotBind)[]) {
  const computes = bindings.filter((bind): bind is IotBind => bind.class === 'iot').filter((bind) => bind.compute_name &&
    (!bind.datasourceId || bind.datasourceId === source.id) &&
    source.dataPoints?.some((point) => point.key === bind.sourceId ||
      (point.deviceId === bind.deviceId && point.propertyKey === bind.key)));
  const selected = new Set<string>();
  source.dataPoints?.forEach((point) => {
    if (bound[point.key] || computes.some((bind) => bind.sourceId === point.key ||
      (bind.deviceId === point.deviceId && bind.key === point.propertyKey))) {
      selected.add(`${point.deviceId}#${point.propertyKey}`);
    }
  });
  const devices = readIotBody(source).devices.map((device) => ({
    ...device,
    properties: [...new Set(device.properties.filter((key) => selected.has(`${device.deviceId}#${key}`)))].sort(),
  })).filter((device) => device.properties.length).sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  return { devices, computes: [...new Map(computes.map((bind) => [bind.id, bind])).values()] };
}

export function buildAggregate(bind: IotBind, token: string, vars: Record<string, unknown>) {
  const result: Record<string, unknown> = { token, deviceId: bind.deviceId, key: bind.key, name: `${bind.key}_${bind.compute_name}` };
  for (const key of ['aggregate', 'start', 'end', 'groupBy', 'limit', 'recent'] as const) {
    let value: unknown = bind[key];
    if (value === undefined || value === '') continue;
    if (typeof value === 'string') {
      const match = value.match(/^\$\{(.+)\}$/);
      value = match ? match[1].split('.').reduce<unknown>((v, part) => v && typeof v === 'object' ? v[part] : undefined, vars)
        : replaceStringTemplateVars(value, vars);
    }
    if (value === undefined || value === '') throw new Error(`聚合参数 ${key} 缺少变量值`);
    if (key === 'start' || key === 'end') {
      value = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : Math.floor(new Date(String(value)).getTime() / 1000);
      if (!Number.isFinite(value)) throw new Error(`无效的聚合时间：${key}`);
    }
    result[key] = value;
  }
  return result;
}

/** 生成物联网连接计划，并只修改传入的 Worker 数据源副本。 */
export function getIotConnectionPlan(source: Datasource, boundDataPoints: Record<string, unknown>, bindings: (Bind | IotBind)[]): IotConnectionPlan {
  const selection = iotSelection(source, boundDataPoints, bindings);
  const body = readIotBody(source);
  if (source.subscribeConfig) {
    source.subscribeConfig.body = JSON.stringify({ ...body, devices: selection.devices });
  }
  return selection;
}

type IotInstance = {
  client: MqttClient;
  close: () => Promise<void>;
};

async function request(config: HttpConfig, signal?: AbortSignal, body?: unknown) {
  const vars = await requestVars(config, signal);
  if (signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  // 处理 headers，支持多种 HeadersInit 格式
  let headers: Record<string, string> = {};
  if (config.headers) {
    if (config.headers instanceof Headers) {
      // Headers 对象：使用 forEach 方法
      config.headers.forEach((value, key) => {
        headers[key] = replaceStringTemplateVars(value, vars);
      });
    } else if (Array.isArray(config.headers)) {
      // 数组格式：[['key', 'value'], ...]
      config.headers.forEach(([key, value]) => {
        headers[key] = replaceStringTemplateVars(value, vars);
      });
    } else {
      // 对象格式：{ key: 'value' }
      Object.entries(config.headers).forEach(([key, value]) => {
        headers[key] = replaceStringTemplateVars(value, vars);
      });
    }
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  // 限制订阅/取消订阅等待时间，服务端失联时也能释放连接队列。
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(replaceStringTemplateVars(config.url, vars), {
      method: config.method || 'POST', headers, signal: controller.signal,
      body: body === undefined ? (typeof config.body === 'string' ? replaceStringTemplateVars(config.body, vars) : config.body) : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`物联网请求失败：${response.status}`);
    const result = await response.json();
    if (result?.error) throw new Error(String(result.error));
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** 立即返回连接对象，使 broker/订阅请求期间也能通过 disconnect 取消。 */
export function connectIot(source: Datasource, callback: (msg: unknown, source: Datasource) => void,
  context: ConnectionContext): Connection {
  const plan = getIotConnectionPlan(source, context.boundDataPoints, context.bindings);
  if (!plan.devices.length) return;
  const controller = new AbortController();
  let connection: Connection;
  let closing: Promise<void>;
  const task = openIot(source, plan, controller.signal, callback).then((result) => {
    connection = result;
  }).catch((error) => {
    if (!controller.signal.aborted) console.error('物联网连接失败：', error);
  });
  return {
    datasource: source,
    instance: {
      close() {
        controller.abort();
        // 等待在途请求退出，迟到的订阅结果仍由 openIot 负责取消。
        closing ||= task.then(() => connection && disconnectIot(connection));
        return closing;
      },
    },
  };
}

async function openIot(source: Datasource, plan: IotConnectionPlan, signal: AbortSignal,
  callback: (msg: unknown, source: Datasource) => void): Promise<Connection> {
  if (!source.subscribeConfig?.mqttConfig?.url) throw new Error('物联网 MQTT 配置缺少 broker 请求地址');
  if (!source.subscribeConfig.url) throw new Error('物联网配置缺少属性订阅地址');
  const broker = await request(source.subscribeConfig.mqttConfig, signal);
  if (signal.aborted) throw new DOMException('请求已取消', 'AbortError');
  // 平台可以在响应中下发 broker/topic 配置；没有下发时才使用数据源保存的配置。
  const brokerInfo = broker?.data && typeof broker.data === 'object' && !Array.isArray(broker.data) ? broker.data : broker;
  const brokerConfig = brokerInfo?.mqttConfig && typeof brokerInfo.mqttConfig === 'object'
    ? brokerInfo.mqttConfig : brokerInfo;
  const secure = self.location.protocol === 'https:';
  const brokerUrl = brokerConfig?.url || (brokerConfig?.host && (secure ? brokerConfig.wssPort : brokerConfig.wsPort)
    ? `${secure ? 'wss' : 'ws'}://${brokerConfig.host}:${secure ? brokerConfig.wssPort : brokerConfig.wsPort}${brokerConfig.path || ''}`
    : '');
  if (!brokerUrl) throw new Error('物联网 MQTT 地址不可用');
  const body = readIotBody(source);
  // 关闭图纸时可中止属性订阅；若响应仍迟到，下面先取消订阅再退出。
  const subscribed = await request(source.subscribeConfig, signal, body);
  const subscribeInfo = subscribed?.data && typeof subscribed.data === 'object' && !Array.isArray(subscribed.data)
    ? subscribed.data : subscribed;
  const topicConfig = {
    mqttTopic: subscribeInfo?.mqttTopic || subscribeInfo?.topic || brokerInfo?.mqttTopic || brokerInfo?.topic
      || source.subscribeConfig.mqttTopic,
    roomTopic: subscribeInfo?.roomTopic || brokerInfo?.roomTopic || source.subscribeConfig.roomTopic,
    aggregateTopic: subscribeInfo?.aggregateTopic || brokerInfo?.aggregateTopic || source.subscribeConfig.aggregateTopic,
    heartbeat: subscribeInfo?.heartbeat || brokerInfo?.heartbeat || source.subscribeConfig.heartbeat,
  };
  const token = subscribed.token || subscribed.accessToken || subscribeInfo?.token || subscribeInfo?.accessToken;
  const room = subscribed.room || subscribeInfo?.room || body.room;
  const unsubscribe = async () => {
    if (!source.unsubscribeConfig?.url) return;
    try { await request(source.unsubscribeConfig, undefined, { token, room }); }
    catch (error) { console.error('物联网取消订阅失败：', error); }
  };
  let client: MqttClient;
  try {
    if (signal.aborted || !token) {
      throw new Error(signal.aborted ? '物联网订阅已取消' : '物联网订阅未返回 token');
    }
    if (!topicConfig.mqttTopic && !topicConfig.roomTopic) {
      throw new Error('物联网配置缺少 MQTT 订阅 topic');
    }
    if (!topicConfig.aggregateTopic && plan.computes.length) {
      throw new Error('物联网配置缺少聚合 topic');
    }
    let closed = false;
    let ready = false;
    let version = 0;
    const tasks = plan.computes;
    let timer: ReturnType<typeof setInterval>;
    let heartbeat: ReturnType<typeof setInterval>;
    let ticks = 0;
    let publishing = false;
    const queries = new AbortController();
    const pending = new Map<string, IotBind>();
    const clearTimers = () => { clearInterval(timer); clearInterval(heartbeat); };
    const vars = await requestVars(source.subscribeConfig, signal);
    if (signal.aborted) throw new DOMException('请求已取消', 'AbortError');
    const resolveTopic = (template: string, roomValue = room, tokenValue = token) =>
      replaceStringTemplateVars(
        template.replaceAll('{room}', roomValue || '').replaceAll('{token}', tokenValue || ''),
        { room: roomValue, token: tokenValue, ...vars },
      );
    const propertyTemplate = room ? topicConfig.roomTopic || topicConfig.mqttTopic : topicConfig.mqttTopic || topicConfig.roomTopic;
    if (!propertyTemplate) throw new Error('物联网配置缺少当前连接所需的 MQTT topic');
    const propertyTopic = resolveTopic(propertyTemplate);
    const aggregateTopic = topicConfig.aggregateTopic ? resolveTopic(topicConfig.aggregateTopic) : '';
    const publish = async (items: IotBind[], client: IotInstance['client']) => {
      items.forEach((item) => pending.set(item.id, item));
      if (publishing || !ready || closed) return;
      publishing = true;
      const currentVersion = version;
      const batch = [...pending.values()];
      pending.clear();
      try {
        if (!aggregateTopic) throw new Error('物联网配置缺少聚合 topic');
        const currentVars = await requestVars(batch, queries.signal);
        if (closed || !ready || currentVersion !== version) return;
        // 单个任务缺失变量或时间无效时，不阻断同一批次中的其他有效任务。
        const payload = batch.flatMap((item) => {
          try {
            return [buildAggregate(item, token, currentVars)];
          } catch (error) {
            console.error('历史聚合参数无效：', item.id, error);
            return [];
          }
        });
        if (payload.length) client.publish(aggregateTopic, JSON.stringify(payload));
      } catch (error) {
        console.error('历史聚合请求失败：', error);
      } finally {
        publishing = false;
        if (pending.size && ready && !closed) void publish([], client);
      }
    };
    const schedule = (client: IotInstance['client']) => {
      clearInterval(timer);
      ticks = 0; version++; pending.clear();
      if (!ready || !tasks.length) return;
      void publish(tasks, client);
      if (tasks.some((item) => item.times > 0)) {
        timer = setInterval(() => {
          ticks++;
          const due = tasks.filter((item) => item.times > 0 && ticks % item.times === 0);
          if (due.length) void publish(due, client);
        }, 1000);
      }
    };
    const brokerOptions = brokerConfig.options || {};
    const connectConfig = (source.connectConfig || { url: '', topics: '' }) as MqttConfig;
    source.connectConfig = connectConfig;
    connectConfig.url = brokerUrl;
    connectConfig.options = {
      ...connectConfig.options,
      ...brokerOptions,
      username: brokerConfig.username || brokerOptions.username,
      password: brokerConfig.password || brokerOptions.password,
      clientId: brokerConfig.clientId || brokerOptions.clientId || `client-${Math.random().toString(16).slice(2, 10)}`,
    };
    connectConfig.topics = propertyTopic;
    connectConfig.ping = topicConfig.heartbeat && topicConfig.heartbeat.interval > 0
      ? { topic: resolveTopic(topicConfig.heartbeat.topic), interval: topicConfig.heartbeat.interval, text: room || token }
      : undefined;
    client = mqtt.connect(connectConfig.url, connectConfig.options);
    const offline = () => {
      ready = false;
      version++;
      clearTimers();
      pending.clear();
    };
    client.on('connect', () => {
      if (closed || signal.aborted) return;
      const current = ++version;
      client.subscribe([propertyTopic], (error) => {
        if (closed || signal.aborted || current !== version) return;
        if (error) { console.error('物联网 topic 订阅失败：', error); return; }
        ready = true;
        clearTimers();
        const ping = connectConfig.ping;
        if (ping?.interval > 0) {
          heartbeat = setInterval(() => {
            if (ready && !closed) client.publish(ping.topic, ping.text);
          }, ping.interval);
        }
        schedule(client);
      });
    });
    client.on('offline', offline);
    client.on('close', offline);
    client.on('error', (error) => {
      if (!closed) console.error('物联网 MQTT 连接失败：', error);
    });
    client.on('message', (topic, message) => {
      if (closed || signal.aborted) return;
      try {
        callback(normalizeMessageData(message, source, { topic }, (raw) => JSON.parse(raw.toString())), source);
      } catch (error) { console.error('物联网消息解析失败：', error); }
    });
    let closing: Promise<void>;
    const instance: IotInstance = {
      client,
      close() {
        if (closing) return closing;
        closed = true;
        queries.abort();
        offline();
        // 先停止客户端，取消订阅接口异常或超时均不影响本地资源释放。
        client.end(true);
        closing = unsubscribe();
        return closing;
      },
    };
    if (subscribed.data !== undefined) callback(normalizeMessageData(subscribed.data, source), source);
    return { datasource: source, instance };
  } catch (error) {
    client?.end(true);
    await unsubscribe();
    throw error;
  }
}

export function disconnectIot(connection: Connection) {
  return (connection.instance as IotInstance).close();
}

let sequence = 0;
const requests = new Map<string, (vars: Record<string, unknown>) => void>();

/** 每次请求都向主线程读取最新变量，协议前缀用于隔离并发响应。 */
function requestVars(value: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  if (signal?.aborted) return Promise.resolve({});
  const keys = [...new Set([...(JSON.stringify(value) || '').matchAll(/\$\{([^}]+)\}/g)].map((match) => match[1]))];
  const requestId = 'iot:' + ++sequence;
  return new Promise((resolve) => {
    const finish = (vars: Record<string, unknown>) => {
      clearTimeout(timer);
      requests.delete(requestId);
      signal?.removeEventListener('abort', abort);
      resolve(vars);
    };
    const abort = () => finish({});
    const timer = setTimeout(() => finish({}), 5000);
    requests.set(requestId, finish);
    signal?.addEventListener('abort', abort, { once: true });
    self.postMessage({ action: WorkerMessage.SetConnections, requestId, keys });
  });
}

export function onIotVars(e: MessageEvent) {
  requests.get(e.data.requestId)?.(e.data.vars || {});
}
