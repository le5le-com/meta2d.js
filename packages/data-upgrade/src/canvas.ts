import { Datasource, Meta2dData, s8, Pen } from '@meta2d/core';
import { upgradeScript } from './script';

export function buildMeta2dData(data: any, pens: Pen[]): Meta2dData {
  return {
    id: data.id,
    name: data.name,
    pens,
    x: 0,
    y: 0,
    width: data.width,
    height: data.height,
    scale: 1,
    background: data.background,
    backgroundImage: data.bkImage,
    grid: {
      enable: data.grid,
      color: data.gridColor,
      size: data.gridSize,
      rotate: data.gridRotate,
    },
    rule: {
      enable: data.rule,
      color: data.ruleColor,
    },
    color: data.color,
    textColor: data.textColor,
    penBackground: data.penBackground,
    smoothNum: data.smoothNum,
    minScale: data.minScale,
    maxScale: data.maxScale,
    disableTranslate: data.disableTranslate,
    disableScale: data.disableScale,
    initJs: upgradeScript(data.initJs),
    layoutBoxs: data.fits,
    template: data.template,
    theme: data.theme,
    datasources: convertDatasources(data),
    mock: data.enableMock,
    messageNormalizer: data.socketCbJs,
    paths: data.paths,
    iconfonts: data.iconUrls,
  };
}

export function convertDatasources(data: any): Datasource[] {
  const datasources: Datasource[] = [];

  if (data.mqtt) {
    datasources.push({
      id: s8(),
      name: 'mqtt',
      type: 'MQTT',
      connectConfig: {
        topics: data.mqttTopics,
        options: data.mqttOptions,
        url: data.mqtt,
      },
      dataPoints: [],
    });
  }

  if (data.websocket) {
    datasources.push({
      id: s8(),
      name: 'websocket',
      type: 'WebSocket',
      connectConfig: {
        url: data.websocket,
        protocols: data.websocketProtocols,
      },
      dataPoints: [],
    });
  }

  if (data.https) {
    data.https.forEach((item: any, index: number) => {
      datasources.push({
        id: s8(),
        name: `https${index + 1}`,
        type: 'HTTP',
        connectConfig: {
          url: item.http,
          headers: item.httpHeaders,
          method: item.method,
          body: item.body,
          interval: item.httpTimeInterval || 1000,
        },
        dataPoints: [],
      });
    });
  }

  if (data.networks) {
    data.networks.forEach((item: any) => {
      if (item.protocol === 'http') {
        datasources.push({
          id: s8(),
          name: item.name,
          type: 'HTTP',
          connectConfig: {
            url: item.url,
            headers: item.headers,
            method: item.method,
            body: item.body,
            interval: item.once ? undefined : item.interval || 1000,
          },
          enable: item.enable,
          dataPoints: convertDataPoints(item.children),
        });
      } else if (item.protocol === 'mqtt') {
        datasources.push({
          id: s8(),
          name: item.name,
          type: 'MQTT',
          connectConfig: {
            topics: item.topics,
            options: item.options,
            url: item.url,
          },
          enable: item.enable,
          dataPoints: convertDataPoints(item.children),
        });
      } else if (item.protocol === 'websocket') {
        datasources.push({
          id: s8(),
          name: item.name,
          type: 'WebSocket',
          connectConfig: {
            url: item.url,
            protocols: item.protocols,
          },
          enable: item.enable,
          dataPoints: convertDataPoints(item.children),
        });
      } else if (item.protocol === 'SSE') {
        datasources.push({
          id: s8(),
          name: item.name,
          type: 'SSE',
          connectConfig: {
            url: item.url,
            withCredentials: item.withCredentials,
          },
          enable: item.enable,
          dataPoints: convertDataPoints(item.children),
        });
      }
    });
  }

  return datasources;
}

function convertDataPoints(children: any[]) {
  return (
    children?.map((child: any) => {
      return {
        key: child.value || child.id,
        name: child.label,
        type: child.type,
        mock: child.mock,
      };
    }) || []
  );
}
