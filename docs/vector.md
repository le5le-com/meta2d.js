简体中文

# 矢量图元 vector

`vector` 是一种通用的矢量图元：任意路径、文字、图案填充都可以装进**一个图元**里，由 core 统一绘制。它主要作为外部格式解析器（`@meta2d/vsdx`、`@meta2d/dxf` 等）的输出目标，也可以手工构造。

和其他图元一样，它能被拖动、缩放、旋转、连线、撤销，也能导出 SVG。几何数据放在局部坐标里，绘制时映射到图元框，所以拖动、缩放只改 `x/y/width/height`，不需要改几何数据。

```ts
{
  id: 'doc1',
  type: 'vector',
  x: 100, y: 100, width: 120, height: 90,
  vector: {
    bbox: { x: 0, y: 0, width: 120, height: 90 },
    items: [
      { t: 'p', d: [0, 0, 0, 1, 120, 0, 1, 120, 70, 2, 90, 50, 30, 90, 0, 70, 4], s: { stroke: '$fg', fill: '$bg', lw: '$lw' } },
      { t: 't', text: '文档', x: 60, y: 35, h: 14, a: 'center', b: 'middle' },
    ],
  },
  color: '#1890ff',
  background: '#e6f7ff',
  lineWidth: 2,
}
```

## 图元属性

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| type | `'vector'` | 必填 |
| vector | VectorGeom | 几何数据：`{ bbox, items }`，见下文 |
| x, y, width, height | number | 图元框。一般用 `penRectOfGeom(vector.bbox)` 算出来 |
| color | string | 前景色，`'$fg'` 取这个值（还会跟随悬停色、选中色、主题） |
| background | string | 背景，`'$bg'` 取这个值（支持渐变、悬停背景），没有背景时 `'$bg'` 不填充 |
| lineWidth | number | 线宽，`lw: '$lw'` 取这个值；`0` 表示不描边。同时也是其他路径的最小线宽 |
| lineDash | number[] | 图元级虚线，子路径没有自己的 `dash` 时使用 |
| vectorTint | boolean | 着色模式：几何里的固定颜色也改用前景色，可以把整个 CAD 块统一改成一种颜色或高亮 |
| anchors | `{ id, x, y }[]` | 连线锚点，使用绝对坐标 |

其余通用属性（`rotate`、`flipX`、`opacity`、`text` 等）见 [pen.md](./pen.md)。

## 几何数据 VectorGeom

```ts
interface VectorGeom {
  bbox: { x: number; y: number; width: number; height: number }; // 几何在局部坐标中的范围
  items: VectorItem[];                                             // 按顺序绘制
}
```

- **局部坐标**：可以用任意单位（像素、英寸、毫米都可以），Y 轴向下。绘制时把 `bbox` 映射到图元框。
- **线宽 `lw`、字高 `h`、虚线 `dash`** 也是局部单位，会随图元一起缩放。
- `bbox` 可以用 `createGeom(items)` 自动计算。

`items` 有四种项，用 `t` 区分。

### 路径 `t: 'p'`

```ts
{ t: 'p', d: number[], s?: VectorStyle }
```

`d` 是扁平的数字数组：每条指令是一个操作码加参数，依次排列。这种格式比对象数组小一个数量级，序列化和跨线程传输也更快。

| 操作码 | 参数 | 含义 |
| --- | --- | --- |
| `0` | x, y | moveTo |
| `1` | x, y | lineTo |
| `2` | x1, y1, x2, y2, x, y | 三次贝塞尔 bezierCurveTo |
| `3` | x1, y1, x, y | 二次贝塞尔 quadraticCurveTo |
| `4` | — | closePath |
| `5` | cx, cy, rx, ry, rotation, start, end, anticlockwise(0/1) | 椭圆弧，参数同 Canvas `ellipse` |

样式 `s`（VectorStyle），所有字段都可选：

| 字段 | 说明 |
| --- | --- |
| stroke | 描边色，缺省为 `'$fg'` |
| fill | 填充色，缺省不填充 |
| lw | 线宽（局部单位），或 `'$lw'` 表示跟随图元 `lineWidth`。缺省用图元线宽；比图元线宽细时取图元线宽 |
| px | 显示线宽（屏幕像素，不随缩放变化）。和 `lw` 同时存在时取两者在屏幕上较粗的那个 |
| dash | 虚线（局部单位） |
| cap / join | 同 Canvas `lineCap` / `lineJoin` |
| rule | 填充规则 `'nonzero'`（缺省）/ `'evenodd'` |
| alpha | 透明度 0–1 |

### 文字 `t: 't'`

| 字段 | 说明 |
| --- | --- |
| text | 内容，`\n` 换行 |
| x, y | 锚点（局部坐标） |
| h | 字高（局部单位） |
| r | 旋转弧度，正值顺时针 |
| a | 水平对齐，同 Canvas `textAlign`，缺省 `left` |
| b | 垂直基线，同 Canvas `textBaseline`，缺省 `alphabetic`。多行时 `middle` 按整段居中，`bottom` 按末行对齐 |
| lh | 行高倍数，缺省 1.25 |
| w | 宽度因子，缺省 1 |
| m | `1` 表示字形沿基线镜像（CAD 镜像块里的文字） |
| font / bold / italic | 字体 |
| fill | 文字颜色，缺省 `'$fg'` |

文字是直接画出来的，不能在画布上双击编辑。需要编辑时用 `textItemToPen` 转成原生 `text` 图元，见下文。

### 图案填充 `t: 'h'`

CAD 的 HATCH：在边界内画若干组平行线。

```ts
{
  t: 'h',
  d: number[],          // 边界路径（多个闭合环，按 evenodd 规则形成孔洞）
  stroke?: string,      // 图案线颜色，缺省 '$fg'
  lines: {
    a: number,          // 线的方向角（弧度）
    x: number, y: number,   // 线族中一条线经过的点
    dx: number, dy: number, // 相邻两条线之间的平移向量
    dash?: number[],    // 线型：正数为实线，负数为间隙，0 为点
  }[],
}
```

单个线族超过 1500 条时，改为半透明填充（线已经密到看不清了）。

### 引用 `t: 'r'`

引用一份共享几何（CAD 块、Visio 母版），定义只存一份，可以多处复用。

```ts
{ t: 'r', id: string, m: [a, b, c, d, e, f], c?: string }
```

| 字段 | 说明 |
| --- | --- |
| id | 共享几何 id，定义在图纸的 `data.vectors` 里 |
| m | 仿射矩阵：定义坐标 → 当前坐标，同 Canvas `transform(a, b, c, d, e, f)` |
| c | 定义里 `'$fg'`（"随块"颜色）在这次引用中的取值，缺省沿用外层的前景色 |

引用可以嵌套，最多 24 层，超出部分不画，防止循环引用导致栈溢出。

## 动态颜色

颜色字段除了普通 CSS 颜色，还可以用下面几个特殊值。IR（`@meta2d/drawir`，与 DrawIR 的 `@drawir/core` 同一份格式）只规定它们是"由渲染后端解析"的占位值，不绑定任何平台；下表是 **meta2d 渲染后端**的解析方式，也是让矢量图元在属性面板里"改颜色就生效"的关键。

| 值 | meta2d 后端的含义 |
| --- | --- |
| `'$fg'` | 前景色：图元当前的描边色（`color`、悬停色、选中色、主题）。在引用里可以被 `c` 覆盖 |
| `'$bg'` | 图元背景（`background`、渐变、悬停背景）。图元没有背景时不填充 |
| `'none'` | 不绘制 |
| `'$lw'` | 只用在 `lw` 上：线宽完全由图元 `lineWidth` 决定 |

写法建议：

- **想让它像原生图元一样可编辑**：路径用 `{ stroke: '$fg', fill: '$bg', lw: '$lw' }`，再把真实的颜色、线宽写到图元的 `color` / `background` / `lineWidth` 上。
- **想保持原图配色**（多色 CAD 图）：路径里写固定颜色。需要整体改色时设置 `vectorTint: true`，所有固定颜色都会改成前景色。

## 使用

### 手工构造

用 `VectorPathBuilder` 生成路径数据，比直接写数组方便。构造时可以传一个矩阵，坐标会先经过矩阵变换再写入，适合做 Y 轴翻转、旋转、单位换算。

```ts
import {
  createMeta2d, Mode, PenCategory,
  VectorPathBuilder, pathItem, createGeom, penRectOfGeom,
  type Meta2d,
} from '@meta2d/core';

createMeta2d();
const meta2d = document.querySelector('le5le-meta2d') as Meta2d;
await meta2d.ready;
meta2d.setMode(Mode.Edit);

// 带波浪底边的文档形状
const b = new VectorPathBuilder();
b.moveTo(0, 0).lineTo(120, 0).lineTo(120, 70).cubicTo(90, 50, 30, 90, 0, 70).close();

const geom = createGeom([
  pathItem(b.d, { stroke: '$fg', fill: '$bg', lw: '$lw' }),
  { t: 't', text: '文档', x: 60, y: 35, h: 14, a: 'center', b: 'middle' },
]);

await meta2d.addPens(
  [
    {
      id: 'doc1',
      type: 'vector',
      category: PenCategory.Node,
      ...penRectOfGeom(geom.bbox), // 由几何范围算出 x / y / width / height
      vector: geom,
      color: '#1890ff',
      background: '#e6f7ff',
      lineWidth: 2,
    },
  ],
  Mode.Edit,
);

// 之后像普通图元一样修改
meta2d.setValue({ id: 'doc1', color: '#f5222d', lineWidth: 4 }, { mode: Mode.Edit, record: true });
```

`VectorPathBuilder` 的方法：

| 方法 | 说明 |
| --- | --- |
| `new VectorPathBuilder(matrix?)` | 所有坐标先经过 `matrix` 再写入 |
| `moveTo(x, y)` / `lineTo(x, y)` | 还没有当前点时，`lineTo` 等于 `moveTo` |
| `cubicTo(x1, y1, x2, y2, x, y)` / `quadTo(x1, y1, x, y)` | 贝塞尔曲线 |
| `ellipse(cx, cy, rx, ry, rotation, start, end, anticlockwise?, connect?)` | 椭圆弧。矩阵是相似变换时会解析地变换，否则转成贝塞尔。`connect` 为 `true` 时与当前点相连 |
| `bulgeTo(x, y, bulge, from)` | 按凸度画圆弧（CAD 多段线） |
| `polyline(points, closed?)` | 折线 |
| `close()` | 闭合 |
| `.d` | 生成的路径数据 |

### 使用共享几何（引用）

同一个形状出现很多次时（CAD 里的螺栓、门窗块），只存一份定义，用 `t: 'r'` 引用：

```ts
import { createGeom, pathItem, penRectOfGeom, computeItemsBox, getVector } from '@meta2d/core';

// 1. 共享定义
const bolt = createGeom([pathItem([5, 0, 0, 10, 10, 0, 0, Math.PI * 2, 0], { stroke: '$fg' })]);
const vectors = { bolt };

// 2. 引用它（平移到 (100, 50)，放大 2 倍）
const items = [{ t: 'r' as const, id: 'bolt', m: [2, 0, 0, 2, 100, 50] as any }];
const geom = { bbox: computeItemsBox(items, (id) => vectors[id]), items };
const pens = [{ id: 'b1', type: 'vector', ...penRectOfGeom(geom.bbox), vector: geom }];

// 3a. 作为新图纸打开：vectors 和 pens 一起传入
meta2d.open({ pens, vectors });

// 3b. 或者追加到当前图纸：必须先 addVectors，再 addPens
meta2d.addVectors(vectors);
await meta2d.addPens(pens, Mode.Edit);
```

`addVectors(vectors, broadcast = true)`：

- 合并到 `meta2d.data.vectors`，并同步给 render / hover worker。
- 同 id 的定义会被覆盖。定义按内容生成 id 时，相当于去重。
- 多人协作时会广播给其他人；`broadcast = false` 只在本地生效。
- `addPens` 在协作模式下会自动带上新图元引用到的定义。

### 由解析器生成（最常用）

DrawIR 的 IR 文档是平台无关的 `VectorDocument`（只有几何，没有图元）：

```ts
interface VectorDocument extends VectorGeom {
  vectors?: Record<string, VectorGeom>; // 共享几何
  width?: number;
  height?: number;
  color?: string;      // '$fg' 的缺省值
  background?: string; // '$bg' 的缺省值及页面背景
  lineWidth?: number;  // '$lw' 的缺省值
  lineDash?: number[];
}
```

core 内置了它的 meta2d 渲染后端 `VectorRenderer`：把 IR 转成 `vector` 图元（可编辑模式下文字转原生文字图元、固定样式绑定到图元属性）再交给 Meta2d：

```ts
import { VectorRenderer, loadVectorDocument, vectorDocumentToPens } from '@meta2d/core';

await loadVectorDocument(meta2d, doc);                       // 作为新图纸打开并适配视图
await new VectorRenderer(meta2d).render(doc, { mode: 'append' }); // 追加（可撤销）
const { pens, vectors } = vectorDocumentToPens(doc, { granularity: 'document' }); // 只转换，可在 Worker 中运行
```

`@meta2d/dxf`、`@meta2d/vsdx` 依赖 `@meta2d/drawir` 生成几何，并直接输出 meta2d 图纸数据 `{ pens, vectors, width, height }`（同时适配 1.x / 2.x），可以直接打开，也可以追加：

```ts
import { parseVisio, loadVisio } from '@meta2d/vsdx';

await loadVisio(meta2d, file);                    // 作为新图纸打开，并让内容居中
await loadVisio(meta2d, file, { append: true });  // 追加到当前图纸（可撤销）

// 只解析，自己决定怎么加载
const doc = await parseVisio(file, { editable: true });
meta2d.open({ pens: doc.pens, vectors: doc.vectors });
```

`@meta2d/vsdx` 在 `editable: true`（缺省）时：

- 标准形状（矩形、圆、菱形、三角形、五边形、六边形）生成原生图元。
- 其他形状生成 `vector` 图元，颜色、线宽绑定到图元属性。
- 文字生成原生文字图元。
- 连接线生成原生连线。

`editable: false` 时按原图外观原样生成矢量图元。

### 文字转为可编辑的原生图元

矢量图元里的文字是直接画出来的。需要双击编辑时，用 `textItemToPen` 转成原生 `text` 图元：

```ts
import { textItemToPen, s8 } from '@meta2d/core';

const textPen = textItemToPen(
  { t: 't', text: '标题', x: 60, y: 35, h: 14, a: 'center', b: 'middle' },
  { id: s8(), name: '标题', color: '#000000' }, // color：IR 里没写颜色或写 '$fg' 时使用
);
await meta2d.addPens([textPen], Mode.Edit);
```

转换时会尽量和原图位置一致：按对齐方式、基线和旋转换算出文字框。镜像文字会转成正向可读的文字。

## 工具函数

IR 类型和构建工具定义在独立包 `@meta2d/drawir`（`packages/drawir`，只依赖 `@meta2d/math`，内容与 DrawIR 的 `@drawir/core` 保持一致），解析器只需依赖它；`@meta2d/core` 会重新导出全部内容。meta2d 渲染后端相关的部分（`penRectOfGeom`、共享几何仓库、`textItemToPen`、`VectorRenderer`）只在 `@meta2d/core` 中提供。

| 函数 | 说明 |
| --- | --- |
| `createGeom(items, resolve?, minSize?)` | 生成 `{ bbox, items }`，包围盒自动计算 |
| `pathItem(d, style?)` | 构造路径项，省略空样式 |
| `penRectOfGeom(bbox)` | 由几何范围算出图元框，太细的方向撑到 `MIN_PEN_SIZE`（2）并居中 |
| `computeItemsBox(items, resolve?)` | 计算一组项的包围盒，`resolve` 用来解析引用 |
| `transformPathData(d, m)` / `transformItem(item, m)` | 按矩阵变换路径 / 项 |
| `textItemToPen(item, opts)` | 文字项 → 原生 `text` 图元 |
| `vectorDocumentToPens(doc, opts?)` | IR 文档 → `{ pens, vectors }`（meta2d 渲染后端的转换部分，纯函数） |
| `VectorRenderer` / `loadVectorDocument(meta2d, doc, opts?)` | IR 文档直接渲染到 Meta2d 实例 |
| `setVectors(defs)` / `getVector(id)` / `hasVector(id)` | 当前线程的共享几何仓库 |
| `collectVectorRefs(items, resolve?)` | 收集直接或间接引用到的共享几何 id |
| `isDynamicColor(c)` | 是否为 `'$fg'` / `'$bg'` |

矩阵、包围盒、椭圆弧、NURBS 等通用几何函数（`composeMatrix`、`applyMatrix`、`BoxAccumulator`、`ellipseToCubics` 等）来自 `@meta2d/math`，`@meta2d/core` 也会重新导出它们。

## 注意事项

- **图元框不能为 0。** 水平线、竖线的包围盒在某个方向上是 0，视口筛选会跳过宽或高小于 2 的图元，导致不显示。务必用 `penRectOfGeom` 生成图元框，它只撑大图元框，几何本身不变。
- **引用的定义要先到。** `t: 'r'` 引用的 id 必须已经通过 `open()` 或 `addVectors()` 下发，否则这部分不显示（不会报错）。
- **共享几何只增不删。** 每个线程各存一份；撤销、粘贴回来的图元可能还引用旧定义，所以不会删除。
- **解析库和页面必须用同一份 core。** 共享几何仓库是 core 的模块级变量，打包出两份 core 会导致引用找不到。用 vite 时把 `@meta2d/core`、`@meta2d/drawir`、`@meta2d/math` 指向同一个目录（参考 `examples/import/vite.config.ts`）。
- **性能。** 路径会缓存成 `Path2D`（按 `d` 数组对象缓存，所以不要原地修改 `d`，要改就换一个新数组）。小于 1 个设备像素的文字不画；一个周期不足 3 个像素的虚线按实线画。
- **1.x 的区别。** meta2d 1.x 也移植了矢量图元，但写法是 `name: 'vector'`（1.x 用 `name` 表示图形类型），图元框坐标和锚点约定也不同，两边的数据不能直接混用。
