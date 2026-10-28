import mqtt from 'mqtt';
import { Connection, Datasource } from '../../../types';
import { normalizeMessageData } from './core';

export function connectMqtt(datasource: Datasource, callback: (msg: any, datasource: Datasource) => void): Connection {
  const { connectConfig, accessToken, subscribeConfig } = datasource;
  const client = mqtt.connect(connectConfig.url, connectConfig.options);
  client.on('connect', () => {
    let topics: string[] = connectConfig.topics.split(',');
    if (accessToken) {
      topics = topics.map((topic) => `${topic}/${accessToken}`);
    }
    client.subscribe(topics);

    // 如果不提前使用http获取accessToken，则mqtt连接后发送一次订阅数据消息。【推荐使用http接口获取accessToken方式】
    if (subscribeConfig?.topic) {
      client.publish(subscribeConfig.topic, JSON.stringify({ topics, dataKeys: subscribeConfig.dataKeys }));
    }

    if (connectConfig.ping?.interval > 1000) {
      connectConfig.ping.timer = setInterval(() => {
        client.publish(connectConfig.ping.topic, connectConfig.ping.text || accessToken || 'ping');
      }, connectConfig.ping.interval);
    }
  });
  client.on('message', (topic: string, message: Buffer) => {
    const data = normalizeMessageData(message, datasource, { topic }, (message) => JSON.parse(message.toString()));
    callback(data, datasource);
  });

  return {
    instance: client,
    datasource,
  };
}

export function disconnectMqtt(connection: Connection) {
  const { instance, datasource } = connection;
  if (instance) {
    instance.end();
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
