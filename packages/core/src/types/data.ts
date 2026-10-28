import { RuleStyle } from '../types';
import { Gradient, Pen, Point, Trigger } from '../models';

export interface Meta2dData {
  id?: string;
  name?: string;
  version?: string;
  pens?: Pen[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  origin?: Point; // 标尺起点
  background?: string;
  backgroundGradient?: Gradient; // 固定尺寸画布的背景渐变
  backgroundImage?: string;
  grid?: {
    enable?: boolean;
    color?: string;
    size?: number;
    rotate?: number;
  };
  rule?: {
    enable?: boolean;
    style?: RuleStyle; // 标尺样式
    color?: string;
    background?: string; //背景颜色
    textColor?: string; //文字颜色
  };
  color?: string; // 画笔默认 color
  lineGradient?: Gradient; // 画笔默认线条渐变
  textColor?: string; // 画笔文字颜色
  textGradient?: Gradient; // 画笔默认文字渐变
  penBackground?: string;
  penGradient?: Gradient; // 画笔默认填充渐变
  fontSize?: number;

  smoothNum?: number; //平滑量 值越大，平滑效果越好
  minScale?: number;
  maxScale?: number;
  disableTranslate?: boolean; //禁止平移
  disableScale?: boolean; //禁止缩放
  lineIntersect?: boolean; // 是否启用连线相交弯曲

  initJs?: string;

  layoutBoxs?: Layout[];
  template?: string; //模版id
  theme?: string; //主题

  datasources?: Datasource[]; // 数据源
  boundDataPoints?: { [key: string]: { id: string; key: string }[] }; // 绑定的数据点，数据点Key: 图元ID列表
  mock?: boolean;
  messageNormalizer?: string; // 把自定义格式的消息转化为Meta2d的标准格式的数据的JS脚本

  sendDataRequests?: HttpConfig[]; // 发送数据请求

  vars?: { [key: string]: any }[]; // 全局变量。key: {name,...}

  paths?: { [key: string]: string };
  iconfonts?: string[];

  seq?: number; // 多人协作序列
}

export interface Layout {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  ex?: number;
  ey?: number;
  width?: number;
  height?: number;
  children?: string[];
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  active?: boolean;
}

export interface Datasource {
  id: string; // 数据源ID
  name: string; // 数据源名称
  key?: string; // 数据源key
  type: 'MQTT' | 'WebSocket' | 'HTTP' | 'SSE' | 'SQL' | 'IOT' | string; // 数据源类型

  connectConfig: MqttConfig | WebSocketConfig | HttpConfig | SqlConfig | any; // 连接配置
  subscribeConfig?: SubscribeConfig; // 订阅请求及物联网连接信息请求配置
  unsubscribeConfig?: HttpConfig | any; // 取消订阅请求时的配置

  dataPoints?: DataPoint[]; // 数据点配置

  enable?: boolean; // 是否启用，默认启用
  connectOnDemand?: boolean; // 是否按需连接，默认自动连接
  collaborator?: string; // 数据源是否用于多人协作，协作者名称
  accessToken?: string; // 【临时变量】数据订阅的访问token，也是订阅数据的房间号
}

export interface Connection {
  instance: any; // 具体的连接实例，例如new Websocket()对象
  datasource: Datasource;
}

export interface ConnectConfig {
  url: string;

  maxReconnects?: number; // 重连次数，默认无限重连
}

export interface MqttConfig extends ConnectConfig {
  topics: string;
  options?: {
    clientId?: string;
    username?: string;
    password?: string;
    reconnectPeriod?: number;
  };
  ping?: {
    topic: string;
    interval: number; // 发送ping的间隔时间，单位毫秒
    text?: string;
    timer?: any;
  };
  sendDataTopic?: string; // 发送数据用的主题
  collaborateTopic?: string;
}

export interface WebSocketConfig extends ConnectConfig {
  protocols?: string | string[];
  token?: string;
  reconnectPeriod?: number; // 重连间隔时间

  ping?: {
    topic: string;
    interval: number; // 发送ping的间隔时间，单位毫秒
    text?: string;
    timer?: any;
  };
}

export interface HttpConfig extends ConnectConfig {
  headers?: HeadersInit;
  method?: string;
  body?: BodyInit | null;

  interval?: number; // 请求间隔，单位毫秒。默认无，仅请求一次

  withCredentials?: boolean; // 做SSE请求时的参数
}

export interface SqlConfig extends ConnectConfig {
  headers?: HeadersInit;
  interval?: number; // 请求间隔，单位毫秒。默认只请求一次
  method?: 'get' | 'list' | string; // SQL 查询方式，不代表 HTTP 方法
  db: string; // 数据库 ID
  params?: Record<string, unknown>; // 数据库附加参数，例如 { dbType: 'mysql', current: 1, pageSize: 20 }
  sql: string; // 原始 SQL，分页由运行时按 params 生成
  dataPoint: string; // 把 SQL 查询结果映射到数据点的 key
}

export interface DataPoint {
  key: string; // 属性key

  name?: string; // 数据点名称
  type?: string; // 数据点类型

  mock?: string; //模拟数据范围

  triggers?: Trigger[]; // 条件触发器
  deviceId?: string;
  propertyKey?: string;
  deviceName?: string;
}

export interface IotDevice {
  deviceId: string;
  token?: string;
  properties: string[];
}

export interface SubscribeConfig extends HttpConfig {
  mqttConfig?: HttpConfig;
  topic?: string;
  dataKeys?: string[];
  /** 物联网平台 MQTT 订阅配置，值由数据源保存，不由核心库补全。 */
  mqttTopic?: string;
  roomTopic?: string;
  aggregateTopic?: string;
  heartbeat?: {
    topic: string;
    interval: number;
  };
}

export interface GuideLine {
  pos: number;
  isVertical: boolean;
}

/** Hover 线程绘制协作操作者标识所需的最小指针数据。 */
export interface CollaboratePointer {
  id: string;
  uid: string;
  username: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
