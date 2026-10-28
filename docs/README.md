简体中文 | [English](./README.en-US.md)

# Meta2d.js 2.x 帮助文档

Meta2d.js 是不依赖前端框架的 2D 可视化引擎，适合 Web 组态、SCADA、大屏、流程图等场景。2.x 以 Web Component（`<le5le-meta2d>`）形式提供，内部使用 4 个 Worker 加 OffscreenCanvas 渲染。

| 文档                     | 内容                                                     |
| ------------------------ | -------------------------------------------------------- |
| [README](./README.md)    | 概念、快速上手、与 1.x 的差异                            |
| [api.md](./api.md)       | Meta2d 实例：属性、方法、配置项                          |
| [pen.md](./pen.md)       | 图元（Pen）数据结构                                      |
| [data.md](./data.md)     | 实时数据：setValue、数据源、模拟数据、变量、多人协作     |
| [event.md](./event.md)   | 事件监听、图元事件与动作、触发器、生命周期、快捷键       |
| [extend.md](./extend.md) | 安装集成、扩展图形库、自定义图元、SVG 导入、1.x 数据升级 |

## 核心概念

- **图纸**（`Meta2dData`）：一个可序列化的 JSON，包含图元列表 `pens` 和页面配置（背景、网格、数据源等），用 `open()` 打开，用 `getData()` 导出。
- **图元**（`Pen`）：画布上的元素，按 `category` 分为三类：节点（Node=0）、连线（Line=1）、DOM 元素（HtmlElement=2，如视频、iframe、echarts）。具体形状由 `type` 决定。
- **模式**：`Mode.Run`（0，默认，运行与交互）和 `Mode.Edit`（1，拖拽编辑）。图元事件、触发器只在运行模式生效；快捷键只在编辑模式生效。
- **坐标**：图元的 `x/y/width/height` 和连线的 `anchors` 都是画布逻辑坐标（绝对坐标），与缩放、平移无关。屏幕坐标 = 逻辑坐标 × `data.scale` + `data.x/y`。
- **线程**：主线程只负责数据与 DOM；render 线程负责绘制，calc 线程负责拾取和几何计算，hover 线程负责选中框、锚点等交互层，utility 线程负责背景、标尺和数据通信。所以图元数据的修改必须通过 API（`setValue`、`addPens` 等）进行，直接改对象不会重绘。

## 快速上手

```ts
import { createMeta2d, Mode, type Meta2d } from '@meta2d/core';

// 1. 注册自定义元素 <le5le-meta2d>（只需一次）
createMeta2d();

// 2. 放到页面上。元素默认 100% 宽高，父容器需要有高度
document.querySelector('#app')!.innerHTML = '<le5le-meta2d></le5le-meta2d>';
const meta2d = document.querySelector('le5le-meta2d') as Meta2d;

// 3. 等待 Worker 初始化完成
await meta2d.ready;

// 4. 打开图纸
meta2d.setMode(Mode.Edit);
meta2d.open({
  pens: [
    { id: 'a', type: 'rectangle', x: 100, y: 100, width: 120, height: 60, text: '开始' },
    { id: 'b', type: 'circle', x: 320, y: 100, width: 60, height: 60, text: '结束' },
  ],
});
meta2d.fitView();

// 5. 交互与数据
meta2d.on('active', (pens) => console.log('选中', pens));
meta2d.setValue({ id: 'a', text: '运行中', background: '#52c41a' });
```

Vue 项目需要把它声明为自定义元素：

```ts
// vite.config.ts
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'le5le-meta2d' } } });
```

元素从 DOM 移除时（`disconnectedCallback`）会自动销毁 Worker 和定时器，不需要手动调用销毁函数。
