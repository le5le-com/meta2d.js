简体中文 | [English](./data.en-US.md)

# 实时数据与通信

数据驱动显示有两种方式：

1. **直接修改**：业务代码调用 `meta2d.setValue({ id, ...props })`。
2. **数据源推送**：配置 `datasources`，把数据点绑定到图元属性，引擎在 utility 线程中收消息并自动更新图元。

两种方式最终都走 `setValue`，都会触发 `valueUpdate` 事件和图元的触发器。

## setValue

```ts
setValue(val: IValue | IValue[], options?: ValueOptions): void

type IValue = { id?: string; tag?: string; [prop: string]: any };
```

- 有 `id` 时修改指定图元；只有 `tag` 时修改所有带该标签的图元。
- 属性名支持点路径，例如 `{ id: 'p1', 'echarts.option.series.0.data': [...] }`。

| options | 说明 |
| --- | --- |
| render | 立即重绘，不经过批量队列 |
| preventEvent | 不触发 `valueUpdate` 和图元触发器。在监听数据变化的脚本里调用 setValue 时用它避免死循环 |
| mode | 传 `Mode.Edit` 表示这是一次编辑操作：立即重绘，在协作状态下会同步给其他成员 |
| record | 写入撤销记录（需配合 `mode`） |

**批量与背压**：不传 `render`、`mode` 时（推荐用于高频实时数据），值会先进入队列：

- 同一时刻只有一批数据在绘制。上一批绘制完成后才发送下一批。
- 积压期间同一图元的多次更新会合并，只显示最新值，中间值会被丢弃。
- 两批之间的最小间隔由 `options.patchQueueDelay` 控制，默认 16ms。设为 0 时数据一到就显示。

因此可以放心地在循环里大量调用 `setValue`，不需要自己节流。

## 数据绑定

绑定写在图元的 `properties` 中：数据点 `bind.id` 收到值后，写入图元的 `key` 属性。

```ts
{
  id: 'p1',
  type: 'rectangle',
  properties: [
    {
      key: 'text',                // 写入哪个图元属性
      label: '温度',
      type: 'float',              // float | integer | bool | string | object | array
      bind: { id: 'temp' },       // 数据点 key
      mock: '20-30.0',            // 模拟数据规则
      enableMock: true,
    },
  ],
}
```

`open()` 时会自动建立"数据点 → 图元属性"的映射（`data.boundDataPoints`）。运行时修改了 `properties` 后，需要调用 `meta2d.calcBoundDataPoints()` 重新计算。

## 数据源

```ts
interface Datasource {
  id: string;
  name: string;
  type: 'MQTT' | 'WebSocket' | 'HTTP' | 'SSE' | 'SQL' | 'IOT';
  connectConfig: any;          // 各类型的连接配置，见下文
  subscribeConfig?: any;       // 连接前先请求访问 token（作为房间号）；IOT 的订阅配置
  unsubscribeConfig?: any;     // 断开时调用的取消订阅接口
  dataPoints?: { key: string; name?: string; type?: string }[];
  enable?: boolean;            // 设为 false 时不连接
  connectOnDemand?: boolean;   // 按需连接，open 时不自动连接
}
```

连接只在 `open()` 时统一建立。各类型都支持 `connectConfig.maxReconnects`（不填表示无限重连）。

| type | connectConfig | 说明 |
| --- | --- | --- |
| MQTT | `url`、`topics`（多个用逗号分隔）、`options{ clientId, username, password, reconnectPeriod }`、`ping{ topic, interval, text }` | 基于 mqtt.js，重连由 mqtt.js 负责 |
| WebSocket | `url`、`protocols`、`ping{ interval, text }` | 断开后立即重连 |
| HTTP | `url`、`method`、`headers`、`body`、`interval` | `interval > 100` 时轮询，否则只请求一次。遇到 401/403/404 停止 |
| SSE | `url`、`withCredentials` | 基于 EventSource，重连由浏览器负责 |
| SQL | `url`、`db`、`sql`、`dataPoint`、`method: 'get' \| 'list'`、`params{ dbType, current, pageSize }`、`headers`、`interval` | 以 POST 方式提交 `{ dbId, sql }`；`list` 模式会自动分页 |
| IOT | 写在 `subscribeConfig` 中：订阅接口 `url`、`mqttConfig`、`mqttTopic`、`roomTopic`、`aggregateTopic`、`heartbeat` | 只订阅实际被绑定的设备属性 |

`url`、`headers`、`body`、`sql` 中可以使用 `${变量}`，见 [变量](#变量)。SQL 中的变量会被转成安全的 SQL 字面量。

SQL 查询结果会展开成多个数据点：`rows`（整体）、`rows#0`（第 0 行）、`rows#0#name`（第 0 行的 name 字段）。绑定时写 `bind: { id: 'rows#0#name' }`。

### 消息格式

数据源收到的消息（默认按 JSON 解析）支持三种格式：

```js
// ① 推荐：数据点对象。数据源需要配置 dataPoints
{ "temp": 25.3, "pump": true }

// ② 数据点数组
[{ "id": "temp", "value": 25.3 }]

// ③ 直接修改图元（跳过绑定）
[{ "id": "p1", "color": "red" }, { "tag": "alarm", "visible": true }]
```

### 消息转换 messageNormalizer

消息不是以上格式时，可以在 `data.messageNormalizer` 中写一段转换脚本。所有数据源共用这一份脚本。

- 参数：`e` 是原始消息（MQTT/IOT 为 Buffer，WebSocket/SSE 为字符串，HTTP 为已解析的 JSON），`context` 是 `{ name: 数据源名称, topic? }`。
- 返回值：返回转换后的数据，或返回 `true` 表示使用默认解析。

```js
// 例：消息 "temp=25"
if (context.name !== 'plc') return true;
const [k, v] = String(e).split('=');
return { [k]: Number(v) };
```

### 发送数据

通过图元事件动作 `SendData`（见 [event.md](./event.md#动作-penactiontype)）向数据源下发数据：

- MQTT：发布到 `connectConfig.topics`。
- HTTP：GET 请求拼接到 query 中，其他方法放在 body 中。
- HTTP 动作配置 `callback` 时，请求改在主线程发出，并用响应结果执行 callback。

### 数据源 API

| 方法 | 说明 |
| --- | --- |
| `addOrUpdateDatasource(ds)` | 新增或更新数据源。SQL 类型立即生效，其他类型在下次 `open` 时生效；`enable: false` 会立即断开 |
| `deleteDatasource(id)` | 删除数据源并断开连接 |
| `stopConnect(id?)` | 断开指定数据源，不传 id 时断开全部 |
| `addOrUpdateDataPoint(id, dataPoint)` / `deleteDataPoints(id, keys)` | 修改数据点配置 |
| `calcBoundDataPoints()` | 重新计算数据绑定 |

## 模拟数据

在 `properties` 项上设置 `enableMock: true` 和 `mock` 规则，再设置 `data.mock = true` 或调用 `meta2d.startDataMock()`，引擎每秒推送一次模拟值。调用 `stopDataMock()` 停止。

| type | mock 写法 |
| --- | --- |
| float | `1.5,2,3` 从中随机取一个；`10-20.00` 范围随机，小数位数与上限一致；`-10--2` 负数范围 |
| integer | `1,2,3` 或 `0-100` |
| bool | `true` / `false` 为固定值，留空则随机 |
| string | `a,b,c` 随机取一个；`[8]` 生成 8 位随机字符串；其他内容为固定值 |

## 变量

`${key}` 模板（支持点路径 `${user.name}`）的取值顺序：

1. 宿主提供的全局函数 `globalThis.getVars()` 的返回值（优先级最高）
2. URL 参数、sessionStorage、localStorage、cookie

```ts
window.getVars = () => ({ token: store.token, deviceId: route.query.id });
```

变量可以用在数据源的连接配置，以及事件动作的链接、SetProps、SendData、Dialog 中。

## 多人协作

```ts
meta2d.open(data);                                 // 必须先 open
meta2d.joinRoom('wss://example.com/collab?room=1'); // 第二个参数 readonly 为 true 时只接收不发送
meta2d.on('collaborate', (e) => {
  if (e.type === 'members') { /* 成员变化 */ }
  if (e.type === 'reload') { /* 历史不完整，需要重新拉取图纸 */ }
});
```

- 加入房间后，本地的添加、删除、编辑、`setPageConfig`、数据源增删、图标字体变更会自动同步给其他成员。
- 断线后会自动重连，间隔 1–5 秒递增，最多 10 次。
- 同步数据源时会去掉 token、password、authorization、cookie 等敏感字段。
- 其他成员正在操作的图元会用 `options.collaborateColors` 中的颜色标出。

服务端协议：

| 方向 | 消息 |
| --- | --- |
| 客户端发送 | `{ msgId, patch }` |
| 服务端确认 | `{ msgId }`；返回 `{ msgId, rejected }` 时客户端会在 5 秒后重发 |
| 服务端广播 | `{ msgs: [{ patch }], seq, uid, historyIncomplete }` |
| 成员变化 | `{ action, members: [{ uid, username }] }` |

`patch` 的结构是 `{ add, remove, beforeUpdate, update, documentData }`。
