[简体中文](./data.md) | English

# Real-time Data and Communication

There are two ways to drive the display with data:

1. **Direct updates**: business code calls `meta2d.setValue({ id, ...props })`.
2. **Datasource push**: configure `datasources` and bind data points to pen properties. The engine receives messages in the utility thread and updates pens automatically.

Both end up in `setValue`, and both fire the `valueUpdate` event and pen triggers.

## setValue

```ts
setValue(val: IValue | IValue[], options?: ValueOptions): void

type IValue = { id?: string; tag?: string; [prop: string]: any };
```

- With `id`, updates that pen; with only `tag`, updates every pen with that tag.
- Property names support dot paths, e.g. `{ id: 'p1', 'echarts.option.series.0.data': [...] }`.

| options | Description |
| --- | --- |
| render | Redraw immediately, bypassing the batch queue |
| preventEvent | Don't fire `valueUpdate` or pen triggers. Use it when calling setValue from a data-change listener to avoid infinite loops |
| mode | Pass `Mode.Edit` to mark this as an edit: redraws immediately and syncs to other members during collaboration |
| record | Write an undo record (use with `mode`) |

**Batching and backpressure**: without `render` or `mode` (recommended for high-frequency real-time data), values go into a queue first:

- Only one batch is drawn at a time. The next batch is sent after the previous one finishes drawing.
- While backed up, multiple updates to the same pen are merged and only the latest value is shown; intermediate values are dropped.
- The minimum interval between batches is `options.patchQueueDelay`, 16ms by default. Set it to 0 to show data as soon as it arrives.

So you can call `setValue` heavily inside loops without throttling it yourself.

## Data binding

Bindings live in a pen's `properties`: when data point `bind.id` receives a value, it's written to the pen property `key`.

```ts
{
  id: 'p1',
  type: 'rectangle',
  properties: [
    {
      key: 'text',                // which pen property to write
      label: 'Temperature',
      type: 'float',              // float | integer | bool | string | object | array
      bind: { id: 'temp' },       // data point key
      mock: '20-30.0',            // mock data rule
      enableMock: true,
    },
  ],
}
```

`open()` builds the "data point → pen property" map (`data.boundDataPoints`) automatically. If you change `properties` at runtime, call `meta2d.calcBoundDataPoints()` to rebuild it.

## Datasources

```ts
interface Datasource {
  id: string;
  name: string;
  type: 'MQTT' | 'WebSocket' | 'HTTP' | 'SSE' | 'SQL' | 'IOT';
  connectConfig: any;          // connection config per type, see below
  subscribeConfig?: any;       // request an access token (used as the room id) before connecting; IOT subscription config
  unsubscribeConfig?: any;     // unsubscribe endpoint called on disconnect
  dataPoints?: { key: string; name?: string; type?: string }[];
  enable?: boolean;            // false = don't connect
  connectOnDemand?: boolean;   // connect on demand, not automatically on open
}
```

Connections are established together during `open()`. Every type supports `connectConfig.maxReconnects` (omit for unlimited reconnects).

| type | connectConfig | Notes |
| --- | --- | --- |
| MQTT | `url`, `topics` (comma-separated), `options{ clientId, username, password, reconnectPeriod }`, `ping{ topic, interval, text }` | Built on mqtt.js, which handles reconnects |
| WebSocket | `url`, `protocols`, `ping{ interval, text }` | Reconnects immediately after closing |
| HTTP | `url`, `method`, `headers`, `body`, `interval` | Polls when `interval > 100`, otherwise requests once. Stops on 401/403/404 |
| SSE | `url`, `withCredentials` | Built on EventSource; the browser handles reconnects |
| SQL | `url`, `db`, `sql`, `dataPoint`, `method: 'get' \| 'list'`, `params{ dbType, current, pageSize }`, `headers`, `interval` | POSTs `{ dbId, sql }`; `list` mode paginates automatically |
| IOT | In `subscribeConfig`: subscription `url`, `mqttConfig`, `mqttTopic`, `roomTopic`, `aggregateTopic`, `heartbeat` | Subscribes only to device properties that are actually bound |

`url`, `headers`, `body` and `sql` can use `${variable}`. See [Variables](#variables). In SQL, variables are converted to safe SQL literals.

SQL results expand into several data points: `rows` (whole result), `rows#0` (row 0), `rows#0#name` (the name field of row 0). Bind with `bind: { id: 'rows#0#name' }`.

### Message format

Messages received by a datasource (parsed as JSON by default) can take three forms:

```js
// ① Recommended: data point object. The datasource needs dataPoints configured
{ "temp": 25.3, "pump": true }

// ② Data point array
[{ "id": "temp", "value": 25.3 }]

// ③ Update pens directly (bypasses binding)
[{ "id": "p1", "color": "red" }, { "tag": "alarm", "visible": true }]
```

### Message conversion: messageNormalizer

If messages don't match these formats, write a conversion script in `data.messageNormalizer`. All datasources share this one script.

- Arguments: `e` is the raw message (Buffer for MQTT/IOT, string for WebSocket/SSE, parsed JSON for HTTP); `context` is `{ name: datasource name, topic? }`.
- Return: the converted data, or `true` to use the default parsing.

```js
// Example: message "temp=25"
if (context.name !== 'plc') return true;
const [k, v] = String(e).split('=');
return { [k]: Number(v) };
```

### Sending data

Send data to a datasource with the pen event action `SendData` (see [event](./event.en-US.md#actions)):

- MQTT: published to `connectConfig.topics`.
- HTTP: GET puts it in the query string; other methods put it in the body.
- When an HTTP action has a `callback`, the request is made from the main thread and the callback runs with the response.

### Datasource API

| Method | Description |
| --- | --- |
| `addOrUpdateDatasource(ds)` | Add or update a datasource. SQL takes effect immediately; other types on the next `open`. `enable: false` disconnects immediately |
| `deleteDatasource(id)` | Delete a datasource and disconnect it |
| `stopConnect(id?)` | Disconnect one datasource, or all when no id is given |
| `addOrUpdateDataPoint(id, dataPoint)` / `deleteDataPoints(id, keys)` | Edit data point config |
| `calcBoundDataPoints()` | Rebuild data bindings |

## Mock data

Set `enableMock: true` and a `mock` rule on a `properties` item, then set `data.mock = true` or call `meta2d.startDataMock()`. The engine pushes a mock value every second. Call `stopDataMock()` to stop.

| type | mock syntax |
| --- | --- |
| float | `1.5,2,3` picks one at random; `10-20.00` random in range, decimals match the upper bound; `-10--2` negative range |
| integer | `1,2,3` or `0-100` |
| bool | `true` / `false` are fixed values; empty means random |
| string | `a,b,c` picks one at random; `[8]` generates an 8-character random string; anything else is a fixed value |

## Variables

Lookup order for `${key}` templates (dot paths like `${user.name}` are supported):

1. The return value of the host's global function `globalThis.getVars()` (highest priority)
2. URL parameters, sessionStorage, localStorage, cookies

```ts
window.getVars = () => ({ token: store.token, deviceId: route.query.id });
```

Variables work in datasource connection config and in the Link, SetProps, SendData and Dialog event actions.

## Collaboration

```ts
meta2d.open(data);                                 // must open first
meta2d.joinRoom('wss://example.com/collab?room=1'); // second argument readonly: true = receive only
meta2d.on('collaborate', (e) => {
  if (e.type === 'members') { /* members changed */ }
  if (e.type === 'reload') { /* history incomplete, reload the diagram */ }
});
```

- After joining, local adds, deletes, edits, `setPageConfig`, datasource changes and icon font changes sync to other members automatically.
- Reconnects automatically after disconnects, with delays increasing from 1 to 5 seconds, up to 10 times.
- Sensitive fields such as token, password, authorization and cookie are stripped when syncing datasources.
- Pens other members are working on are highlighted with colors from `options.collaborateColors`.

Server protocol:

| Direction | Message |
| --- | --- |
| Client sends | `{ msgId, patch }` |
| Server acks | `{ msgId }`; on `{ msgId, rejected }` the client resends after 5 seconds |
| Server broadcasts | `{ msgs: [{ patch }], seq, uid, historyIncomplete }` |
| Members change | `{ action, members: [{ uid, username }] }` |

`patch` has the shape `{ add, remove, beforeUpdate, update, documentData }`.
