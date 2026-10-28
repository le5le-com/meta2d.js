简体中文 | [English](./event.en-US.md)

# 事件与交互

交互逻辑可以写在三个地方：

| 方式 | 写在哪里 | 适用场景 |
| --- | --- | --- |
| 引擎事件 | 宿主代码 `meta2d.on(name, fn)` | 编辑器联动、业务逻辑 |
| 图元事件 `events` | 图纸 JSON | 点击、悬停等交互触发动作，跟随图纸保存 |
| 触发器 `triggers` | 图纸 JSON | 数据变化时按条件切换状态（告警、开关等） |

## 引擎事件

```ts
const onActive = (pens) => {};
meta2d.on('active', onActive);
meta2d.off('active', onActive);
meta2d.on('*', (name, payload) => {}); // 监听全部事件
```

| 事件 | 触发时机 | 参数 |
| --- | --- | --- |
| opened | `open()` 完成 | — |
| loaded | 分批加载全部补齐 | — |
| click | 点击图元（任何模式） | `{ e, pen }` |
| active | 选中的图元发生变化 | `Pen[]`（取消选中时为 `[]`） |
| patch | 图元被添加、删除或修改 | `{ add, remove, beforeUpdate, update }` |
| valueUpdate | 调用 `setValue`（未设置 `preventEvent`） | `IValue[]` |
| layer | 图层顺序变化 | — |
| scale | 画布缩放 | 新的 scale |
| translate | 画布平移 | `{ x, y }` |
| resizeView | 画布尺寸变化 | `{ width, height }` |
| viewRendered | 视口绘制完成 | `{ pens }` 绘制的图元数 |
| changeTheme | 主题切换 | `{ name, theme }` |
| collaborate / dataUpdate | 多人协作消息 / 协作的页面数据更新 | 见 [data.md](./data.md#多人协作) |
| openFile | 按下 Ctrl+O | — |
| error | 导出 PNG / SVG 失败 | 错误信息 |
| 自定义名称 | 图元动作 `Emit` | `{ pen, params }` |

## 图元事件 events

图元事件只在**运行模式**下生效，`disabled` 的图元不会触发。

```ts
{
  events: [{
    type: EventType.Click,         // 0
    isAny: false,                  // 多个条件时：false 要求全部满足，true 满足任一即可
    conditions: [{ type: 0, key: 'status', operator: '==', target: 'on' }],
    actions: [
      { type: PenActionType.SetProps, target: 'lamp', payload: { value: { background: 'red' } } },
      { type: PenActionType.Emit, payload: { value: 'pumpClick' }, timeout: 500 },
    ],
  }],
}
```

### 事件类型 EventType

| 值 | 名称 | 值 | 名称 |
| --- | --- | --- | --- |
| 0 | Click 单击 | 5 | Active 选中 |
| 1 | Dblclick 双击 | 6 | Inactive 取消选中 |
| 2 | Contextmenu 右键 | 7 | Mousedown 鼠标按下 |
| 3 | Enter 鼠标移入 | 8 | Mouseup 鼠标抬起 |
| 4 | Leave 鼠标移出 | | |

枚举中还定义了 Message、ValueUpdate、Input、Change、Submit、Reset（9–14），但引擎暂未派发这些事件。

### 动作 PenActionType

| 字段 | 说明 |
| --- | --- |
| type | 动作类型，见下表 |
| target | 目标图元的 id 或 tag，留空表示当前图元 |
| payload | 动作参数，主要使用 `value` 和 `params` |
| timeout | 延迟执行的毫秒数 |

| 值 | 动作 | payload |
| --- | --- | --- |
| 0 | Link 打开链接 | `value`：URL（支持 `${}`），`params`：窗口名，默认 `_blank` |
| 1 | SetProps 设置属性 | `value`：属性对象。属性值可以是常量、`${}` 模板，或用 `{ id, key }` 引用其他图元的属性 |
| 2 / 3 / 4 | 开始 / 暂停 / 停止动画 | 开始动画时 `params` 为动画名称 |
| 5 | JS 执行脚本 | `value`：函数体，可用参数 `pen`、`params`、`context`（`context.meta2d`） |
| 6 | GlobalFn 调用全局函数 | `value`：函数名，调用 `window[value](pen, params)` |
| 7 | Emit 发送事件 | `value`：事件名，在宿主中用 `meta2d.on(value, fn)` 接收 |
| 8 / 9 / 10 | 播放 / 暂停 / 停止视频 | — |
| 13 | Navigator 跳转图纸 | `value`：图纸 id，通过 `meta2d.getMeta2dData(id)` 获取图纸后打开 |
| 14 | Dialog 弹窗 | `value`：标题，`params`：图纸 id 或 URL，其余字段为弹窗配置 |
| 15 | SendData 下发数据 | `datasource`：数据源 id，`data`：`[{ prop, value \| id+key, type }]`，可选 `callback` |
| 16 | PostMessage | 向目标 iframe 图元发送 `{ name: value, data }` |
| 17 | PostMessageToParent | 向父窗口发送 `{ name: value, data }` |
| 18 | MessageBox 消息提示 | `value`：内容，`params`：主题 |

SendData / PostMessage 的 `data` 中，每一项通过 `prop` 指定字段名，值可以写成固定 `value`（支持 `${}`，按 `type` 转换类型），也可以用 `id` + `key` 读取某个图元的属性。

### 条件 Condition

| 字段 | 说明 |
| --- | --- |
| type | 0 比较；1 函数（`fn` 是函数体，参数为 `pen`、`context`，返回 boolean） |
| key | 当前图元上要比较的属性（支持点路径） |
| operator | 比较运算符，见下表 |
| targetType | 0 固定值（默认）；1 取其他图元的属性：`target` 为图元 id，`targetKey` 为属性名 |
| target | 比较的目标值 |

| 运算符 | 含义 | target 示例 |
| --- | --- | --- |
| `==` `=` `!=` | 等于 / 不等于（宽松比较） | `on` |
| `>` `>=` `<` `<=` | 数值比较 | `80` |
| `[)` / `![)` | 在区间内 / 不在区间内 | `[10,20)` |
| `[]` / `![]` | 属于 / 不属于集合，`..` 表示范围 | `[1,20,30..50]` |

## 触发器 triggers

触发器在**运行模式**下，图元属性通过 `setValue` 发生变化时执行（设置了 `preventEvent` 的除外），适合描述"状态"。

```ts
{
  triggers: [{
    name: '温度告警',
    events: [   // 按顺序判断，命中第一个就停止
      { conditions: [{ key: 'temp', operator: '>=', target: '80' }], actions: [{ type: 1, payload: { value: { background: 'red' } } }] },
      { conditions: [{ key: 'temp', operator: '>=', target: '60' }], actions: [{ type: 1, payload: { value: { background: 'orange' } } }] },
      { conditions: [{ key: 'temp', operator: '<', target: '60' }],  actions: [{ type: 1, payload: { value: { background: 'green' } } }] },
    ],
  }],
}
```

- 只有当条件中用到的属性本次发生了变化，才会判断这个触发器，其他属性变化不会触发它。
- 每个触发器的 `events` 就是一张状态表：按顺序判断，执行第一条条件成立的动作。
- 动作中的 SetProps 使用 `preventEvent`，不会引起循环触发。

## 生命周期钩子

把函数赋值到实例上：

| 钩子 | 调用时机 | 返回 false 时 |
| --- | --- | --- |
| `beforeRender()` | `open()` 期间。如果图纸配置了 `initJs`，会改为执行 `initJs` | — |
| `beforeAdd(pens)` | `addPens()` 未传 `mode` 时，包括拖入、粘贴 | 取消添加 |
| `beforeDelete(pens)` | `deletePens()` 未传 `mode` 时 | 取消删除 |
| `beforeConnectLine(line, from?, to?)` | 连线完成时 | 取消这条连线 |

以上钩子都可以返回 Promise。注意：键盘 Delete 删除和 T/R/L 快捷放置会传入 `Mode.Edit`，不经过 `beforeDelete` / `beforeAdd`。

全局初始化器（每个 `<le5le-meta2d>` 挂载时都会执行一次，适合统一注册图形库和字体）：

```ts
import { setMeta2dInitializer } from '@meta2d/core';
setMeta2dInitializer(async (meta2d) => {
  await meta2d.register('/npm/@meta2d_chart.js');
});
```

## 消息提示与弹窗

```ts
meta2d.messageBox({
  content: '保存成功',
  theme: 'success',     // success | info（默认）| warning | error | question
  placement: 'top',     // top | bottom | left | right
  duration: 3000,       // 0 表示不自动关闭
  closeBtn: true,
});
meta2d.closeAllMessageBox();

// 弹窗：mode 1（默认）在子画布中打开图纸，mode 0 打开 iframe URL
meta2d.dialog.show('详情', 'diagram-id', { mode: 1, width: 800, height: 600 });
```

弹窗配置还支持：`x`、`y`、`background`、`maskBackground`、`hideClose`、`closeTop`、`closeRight`。

## 快捷键

快捷键只在编辑模式下生效（运行模式下只保留空格平移）。可以用 `options.ignoreHotkeys` 屏蔽，例如 `['Delete', 'z']`。表中的 Ctrl 在 macOS 上对应 Cmd。

| 分类 | 按键 | 功能 |
| --- | --- | --- |
| 视图 | 按住空格拖动 | 平移画布 |
| | `+` / `-` | 放大 / 缩小 |
| | Shift+1 | 适应窗口 |
| | Shift+0 | 左对齐适应窗口 |
| | Shift+2 | 以中心放大 |
| | Z | 放大镜 |
| | M / Shift+R / Alt+R | 鹰眼 / 标尺 / 网格 |
| 编辑 | Ctrl+Z / Ctrl+Y（Ctrl+Shift+Z） | 撤销 / 重做 |
| | Ctrl+C / X / V | 复制 / 剪切 / 粘贴 |
| | Delete / Backspace | 删除 |
| | Ctrl+A / Ctrl+Shift+A | 全选 / 反选 |
| | Esc | 取消选中或当前操作 |
| | 方向键（加 Shift） | 移动 1px（5px） |
| | Ctrl+方向键（加 Shift） | 调整尺寸 1px（10px） |
| | Ctrl+G / Ctrl+Shift+G | 组合 / 取消组合 |
| | Ctrl+Shift+L / Ctrl+Shift+H | 锁定 / 显隐 切换 |
| | Shift+H / Shift+V | 垂直翻转 / 水平翻转 |
| 层级 | Ctrl+] / Ctrl+[ | 上移 / 下移一层 |
| | Ctrl+Alt+] / Ctrl+Alt+[ | 置顶 / 置底 |
| 对齐 | Alt+A / D / W / S / H | 左 / 右 / 上 / 下 / 居中对齐 |
| | Alt+Shift+H / Alt+Shift+V | 水平 / 垂直等距分布 |
| 文字 | Ctrl+B / Ctrl+I | 粗体 / 斜体 |
| | Ctrl+Shift+> / < | 字号 ±1 |
| | Ctrl+Alt+> / < | 行高 ±0.1 |
| | Ctrl+Alt+L / T / R | 文字左对齐 / 居中 / 右对齐 |
| 绘制 | T / R / L | 在鼠标位置放置文字 / 矩形 / 直线 |
| | P | 连线模式（画线时按 P 结束当前这条线） |
| | O | 正交连线模式 |
| | Shift+P | 铅笔自由绘制 |
| | 画线时按空格 | 在原线型和正交线之间切换 |
| | Enter | 结束画线；选中一条连线时切换闭合 |
| 锚点 | E | 显示 / 隐藏锚点 |
| | A | 锚点编辑模式 |
| | 1 / 2 / 3 / 4 | 控制柄：移除 / 对称 / 平滑 / 自由 |
| 其他 | Ctrl+O | 触发 `openFile` 事件 |
