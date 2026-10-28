简体中文 | [English](./extend.en-US.md)

# 安装、集成与扩展

## 安装

```bash
npm i @meta2d/core
# 按需安装扩展图形库
npm i @meta2d/chart @meta2d/form @meta2d/uml @meta2d/fta @meta2d/echarts
# 工具
npm i @meta2d/svg @meta2d/data-upgrade
```

**运行环境**：浏览器需要支持 Module Worker 和 OffscreenCanvas（新版 Chrome、Edge、Firefox、Safari 均支持）。

**打包**：引擎通过 `new Worker(new URL('./workers/xxx/index.js', import.meta.url), { type: 'module' })` 创建 Worker。打包器需要支持这种写法（Vite 原生支持，webpack 5 也支持）。不需要额外配置 Worker 路径，也不需要把文件拷贝到 public 目录。

## 扩展图形库

| 包 | 提供的 type |
| --- | --- |
| @meta2d/chart | `lineChart`、`histogram`、`pieChart`、`gauge`、`heatmap` |
| @meta2d/form | `radio`、`switch`、`checkbox`、`slider`、`time` |
| @meta2d/uml | 流程图：`flowComment`、`flowData`、`flowDisplay`、`flowDb`、`flowDocument`、`flowExternStorage`、`flowInternalStorage`、`flowManually`、`flowParallel`、`flowQueue`、`flowSubprocess`；泳道：`swimlaneH`、`swimlaneV`；活动图、时序图、类图：`activityFinal`、`forkH`、`forkV`、`lifeline`、`sequenceFocus`、`simpleClass`、`interfaceClass` |
| @meta2d/fta | 故障树：`andGate`、`orGate`、`xorGate`、`priorityAndGate`、`votingGate`、`forbiddenGate`、`basicEvent`、`event`、`conditionalEvent`、`switchEvent`、`unexpandedEvent`、`transferSymbol` |
| @meta2d/echarts | `echarts`（DOM 图元，依赖 echarts） |

### 注册

图形库按 **URL** 注册：

```ts
await meta2d.register(url);
```

主线程、render 线程、hover 线程（编辑模式下还有 calc 线程）会各自 `import(url)` 一次。所以有两条要求：

- `url` 必须是浏览器能直接访问的 ES Module 地址，不能写成 `@meta2d/chart` 这样的包名。
- 编辑器需要**先 `setMode(Mode.Edit)` 再 `register`**，否则 calc 线程不会加载这个图形库，会影响编辑时的拾取。

Vite 项目的推荐做法是：开发环境用 alias 直接指向源码，生产环境把每个包打成文件名固定的 chunk。

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  resolve: { alias: { '/npm/': path.resolve('node_modules') + '/' } }, // 开发：/npm/@meta2d/chart/index.js
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const m = id.match(/@meta2d[\\/](chart|form|uml|fta|echarts)[\\/]/);
          if (m) return `npm/@meta2d_${m[1]}`;
        },
        chunkFileNames: (c) => (c.name.startsWith('npm/') ? `${c.name}.js` : 'assets/[name]-[hash].js'),
      },
    },
  },
}));
```

```ts
// 生产环境需要一处静态引用，避免包被 tree-shake 掉
if (import.meta.env.PROD) import('@meta2d/chart');

const url = (pkg: string) =>
  import.meta.env.DEV ? `/npm/@meta2d/${pkg}/index.js` : `/npm/@meta2d_${pkg}.js`;

await meta2d.register(url('chart'));
```

### echarts 图元

```ts
{
  type: 'echarts',
  category: 2,              // PenCategory.HtmlElement
  x: 0, y: 0, width: 300, height: 200,
  echarts: {
    option: {
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [820, 932, 901] }],
    },
  },
}
```

## 自定义图元

一个图形库就是一个 ES Module，导出 `penDefines` 数组，数组中每一项定义一种图元：

```ts
// my-pens/index.ts
import { calcAbsPoint, type Pen } from '@meta2d/core';

function draw(ctx: OffscreenCanvasRenderingContext2D, pen: Pen) {
  const { x, y, width: w, height: h } = pen;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  pen.fillStyles?.forEach((fill) => {   // 引擎已经按 background / gradient / 状态算好填充
    ctx.fillStyle = fill;
    ctx.fill();
  });
  ctx.stroke();                         // strokeStyle、lineWidth、旋转、翻转都已设置好
}

function anchors(pen: Pen) {
  return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }].map((p, i) => ({
    ...calcAbsPoint(pen, p),            // 比例坐标转换成绝对坐标
    id: String(i),
  }));
}

export const penDefines = [{ type: 'myTriangle', draw, defaultAnchorFn: anchors }];
```

```ts
await meta2d.register('/my-pens/index.js');
meta2d.addPens([{ type: 'myTriangle', x: 100, y: 100, width: 80, height: 60 }]);
```

### 定义项字段

| 字段 | 运行线程 | 签名 | 说明 |
| --- | --- | --- | --- |
| type | — | string | 图元类型 |
| draw | render / hover | `(ctx, pen)` | 绘制函数，使用世界坐标 |
| defaultAnchorFn | 主线程 | `(pen) => Point[]` | 图元没有 anchors 时生成默认锚点（绝对坐标，需要带 id） |
| edgeFn | calc | | 自定义拾取的边缘 |
| create | 主线程 | `(pen) => HTMLElement` | 创建 DOM 元素（DOM 图元使用） |
| beforeUpdate | 主线程 | `(pen, oldPen) => boolean` | 返回 false 丢弃这次更新 |
| afterUpdate | 主线程 | `(pen, values)` | 属性更新之后调用 |
| mouseDown / mouseMove / mouseUp | 主线程 | `(pen, point) => boolean` | 返回 false 阻止默认行为 |
| mouseEnter / mouseLeave | 主线程 | `(pen)` | 鼠标移入 / 移出 |
| wheel | 主线程 | `(pen, e)` | 滚轮 |
| input | 主线程 | `(meta2d, pen, mousedown)` | `pen.input === 3`（Custom）时双击调用，用于下拉框、日期选择等 |
| scale | 主线程 | `(pen, scale)` | 画布缩放时调用 |
| toPng | 主线程 | `(pen) => Promise<ImageBitmap>` | 导出图片时 DOM 图元的截图 |
| changeTheme | 主线程 | `(pen, themeVars)` | 主题切换时调用 |
| destroy | 主线程 | `(pen)` | 图元被删除时调用 |
| dragover / drop | 主线程 | | 拖入画布时调用 |

主线程钩子中的 `this` 指向 meta2d（`input` 除外，meta2d 通过第一个参数传入）。交互型图元可以参考 `@meta2d/form` 的 `switch`：在 `mouseDown` 中调用 `this.setValue({ id: pen.id, checked: !pen.checked })`。

### 注意事项

- 模块会在 Worker 中执行，**模块顶层不能访问 `window`、`document`**。只在主线程运行的钩子可以访问 DOM。
- 函数不会被序列化传递，每个线程各自 import 模块，所以闭包变量在主线程和 Worker 之间不共享。图元需要的数据都应放在 `pen` 上。
- 纯 DOM 图元（不需要 Canvas 绘制）可以改用 `meta2d.registerElement(defs)`，只在主线程注册。它不支持 `mouseDown`、`mouseEnter`、`mouseLeave`、`input`、`wheel`。
- 定义了 `beforeUpdate` / `afterUpdate` 的图元，每次 setValue 都会传完整的图元快照，高频更新时开销更大。

## SVG 导入

```ts
import { parseSvg } from '@meta2d/svg';
const pens = parseSvg(svgText);   // 返回子图元 + 一个 group 容器（数组最后一项）
await meta2d.addPens(pens);
```

## 1.x 数据升级

```ts
import { dataUpgrade, versionIsBefore } from '@meta2d/data-upgrade';

let data = await fetch('/old.json').then((r) => r.json());
if (versionIsBefore(data.version || '1.0.0')) {   // 只比较主版本号
  data = dataUpgrade(data);       // 返回新对象，必须使用返回值
}
meta2d.open(data);
```

`dataUpgrade` 会把相对坐标换成绝对坐标，把 `name` 换成 `type`，并转换动画、数据源、绑定等字段。包里还导出了 `convertPens`、`convertDatasources`、`componentsUpgrade` 等单项转换函数。
