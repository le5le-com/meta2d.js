简体中文 | [English](./api.en-US.md)

# Meta2d 实例 API

`meta2d` 指页面上的 `<le5le-meta2d>` 元素。下文中 `idOrTag` 表示图元 id 或标签（tag），`pens` 表示 `Pen[]`。

## 常用属性

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| ready | Promise\<void\> | Worker 和初始化器完成后 resolve，之后才能 `open` |
| data | Meta2dData | 当前图纸的页面配置。打开后 `data.pens` 会被清空，图元以 `penMap` 为准 |
| options | Options | 当前配置项，修改请用 `setOptions` |
| penMap | Map\<string, Pen\> | 所有图元的最新数据（只读，修改请用 API） |
| activePens | Pen[] | 当前选中的图元 |
| emitter | mitt Emitter | 事件总线，`on` / `off` 是它的快捷方式 |
| dialog | Dialog | 弹窗组件实例 |

## 配置项 Options

通过 `meta2d.setOptions(options)` 设置，可以随时调用，多次调用会合并。

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| mode | Mode.Run | 0 运行，1 编辑 |
| anchorMode | AnchorMode.Hidden | 位标志：Hidden=0、Hover=1（悬停显示锚点）、Drawline=2（连线模式）、Pencil=4（铅笔模式） |
| editPivot | | 显示并允许编辑旋转支点 |
| minScale / maxScale | 0.1 / 10 | 缩放范围 |
| background | | 画布背景色 |
| grid | | `{ enable, color, size }` 网格 |
| alignGrid | | 拖拽时吸附网格 |
| rule | | `{ enable, style, color, background, textColor, guidelineColor }` 标尺 |
| origin | | 标尺原点 |
| disableRotate / disableSize | | 全局禁止旋转 / 缩放尺寸 |
| ignoreHotkeys | | 要忽略的按键（`KeyboardEvent.key` 值） |
| clipboard | true | 复制粘贴是否使用系统剪贴板，false 时使用 localStorage |
| drawingLineOptions | | 新建连线的预设：`color`、`lineWidth`、`lineSmooth`、`lineGradient`、`fromArrow`、`toArrow` |
| fromArrow / toArrow | | 新建连线的默认箭头 |
| pencilTolerance | | 铅笔画线的简化容差 |
| color / textColor / fontFamily | `#222222` / / 雅黑等 | 图元默认颜色和字体 |
| activeColor / activeBackground | `#278df8` | 选中颜色 |
| hoverColor / hoverBackground / hoverCursor | `rgba(39,141,248,0.8)` / / `pointer` | 悬停样式 |
| hoverBoxColor / activeBoxColor / dragSelectionColor | | 悬停框、选中框、框选区域颜色 |
| anchorColor / hoverAnchorColor / anchorRadius / anchorBackground | `#fa541c` / `#FF4101` / 4 / `#fff` | 锚点样式 |
| dockColor | `#00a00020` | 吸附参考线颜色 |
| lineTextBackground | `#ffffff` | 连线文字背景色 |
| animateInterval | 20 | 动画帧间隔（ms） |
| patchQueueDelay | 16 | `setValue` 批量显示的最小间隔（ms），0 表示不限制，见 [data.md](./data.md#setvalue) |
| progressiveLoad | true | 图元多（≥2 万）时先绘制视口内的图元，其余分批补齐，补齐后触发 `loaded` |
| collaborateColors | 8 色 | 多人协作成员的颜色 |
| perfProbe | false | 开启性能探针，配合 `getPerfReport()` 使用 |

`panBlit`、`animBatch`、`patchAudit` 等其余选项是性能调试开关，默认值已是推荐值，一般不需要修改。

## 图纸数据 Meta2dData

`open(data)` 的参数，也是 `getData()` 的返回值。

| 名称 | 说明 |
| --- | --- |
| id / name / version | 图纸标识；`version` 由 `getData()` 写入 |
| pens | 图元数组，数组顺序就是层级顺序（后面的在上层） |
| x / y / scale | 画布平移和缩放 |
| width / height | 固定画布尺寸（大屏）。不设置时画布无限大 |
| background / backgroundGradient / backgroundImage | 画布背景 |
| grid / rule / origin | 网格、标尺、标尺原点 |
| theme | 主题名，默认 `dark`，内置 `dark` / `light` |
| color / textColor / penBackground / fontSize | 图元的默认颜色、文字颜色、背景、字号 |
| lineGradient / textGradient / penGradient | 图元默认渐变 |
| minScale / maxScale / disableTranslate / disableScale | 缩放和平移限制 |
| lineIntersect | 连线相交处画跨线弯 |
| smoothNum | 铅笔画线的平滑量 |
| initJs | 打开图纸时执行的脚本，参数为 `context = { meta2d }`。设置后不再调用 `beforeRender` |
| datasources / mock / messageNormalizer / vars | 数据源、模拟数据、消息转换脚本、全局变量，见 [data.md](./data.md) |
| paths | svgPath 图元引用的 path 数据：`{ pathId: d }` |
| iconfonts | 图标字体 CSS 地址列表 |

## 方法

### 图纸

| 方法 | 说明 |
| --- | --- |
| `open(data?: Meta2dData)` | 打开图纸：重置状态、计算数据绑定、建立数据源连接、播放 `autoPlay` 动画，最后触发 `opened` |
| `whenLoaded(): Promise<void>` | 等分批加载补齐。导出图片前会自动等待 |
| `getData(): Meta2dData` | 导出完整图纸（深拷贝，图元按层级排序） |
| `setPageConfig(data: Partial<Meta2dData>)` | 修改页面配置（不含 pens），如背景、网格、变量 |
| `setOptions(o: Options)` | 修改配置项 |
| `setMode(mode: Mode)` | 切换运行 / 编辑模式 |
| `setTheme(name)` / `registerTheme(name, theme)` | 切换 / 注册主题，切换后触发 `changeTheme` |
| `setIconfonts(urls: string[])` / `removeIconfont(url)` | 添加 / 移除图标字体 |
| `loadFonts(fontFaceCss: string): Promise<void>` | 加载 `@font-face` 字体（主线程和各个 Worker 都会加载） |
| `getVersion(): string` | 引擎版本 |

### 图元增删改查

| 方法 | 说明 |
| --- | --- |
| `addPens(pens, mode?, parentId?): Promise` | 添加图元，可指定父图元。不传 `mode` 时先调用 `beforeAdd` 钩子 |
| `deletePens(pens, mode?): Promise` | 删除图元及其子图元，连线关系会一并清理。不传 `mode` 时先调用 `beforeDelete` |
| `setValue(val: IValue \| IValue[], options?)` | 修改图元属性，详见 [data.md](./data.md#setvalue) |
| `find(idOrTag): Pen[]` | 按 id 查找，找不到再按 tag 查找 |
| `findOne(idOrTag): Pen` | `find` 的第一个结果 |

```ts
await meta2d.addPens([{ type: 'rectangle', x: 0, y: 0, width: 100, height: 50 }]);
meta2d.setValue({ id: 'a', x: 200, rotate: 45 }, { render: true });
await meta2d.deletePens(meta2d.find('temp'));
```

### 选中、组合、图层

| 方法 | 说明 |
| --- | --- |
| `active(pens?)` | 选中图元（会过滤掉锁定和隐藏的图元）；不传参数时重新计算选中框 |
| `clearActive()` | 取消选中 |
| `selectAll(invert = false)` | 全选；`invert` 为 true 时反选 |
| `group(pens?, showChild?)` | 把至少 2 个图元组合成 `type: 'group'`；不传时组合当前选中。`showChild` 表示只显示第几个子图元 |
| `ungroup(pens?)` | 取消组合 |
| `toComponent(pens?): Pen[]` | 生成可复用的组合组件数据（深拷贝，外层包一个 group） |
| `moveLayer(isForward)` | 选中图元上移 / 下移一层 |
| `toFrontOrBack(toTop)` | 选中图元置顶 / 置底 |
| `movePenToFrontOf(pen, target)` / `movePenToBackOf(pen, target)` | 移到目标图元的上一层 / 下一层（限同一父级） |
| `normalizeLayers()` | 整理层级编号 |

### 对齐分布（作用于选中图元）

| 方法 | 说明 |
| --- | --- |
| `alignPens(type: AlignType, last = false)` | 以第一个（或最后一个）选中图元为基准对齐 |
| `alignPensToPage(type, whole = true)` | 对齐到画布（需设置 `data.width/height`）。`whole` 为 true 时按整体移动 |
| `distributePensEvenly(direction)` | 等距分布，`AlignType.HorizontalDistribute` / `VerticalDistribute` |

`AlignType`：Left、Center、Right、Top、Middle、Bottom、HorizontalDistribute、VerticalDistribute。

### 视图

| 方法 | 说明 |
| --- | --- |
| `fitView(fitContent = true, padding = 0, origin = FitViewOrigin.Center)` | 缩放并居中到窗口。有 `data.width/height` 时按画布尺寸适配，否则按内容适配 |
| `scale(scale, center?)` | 缩放到指定比例，`center` 为屏幕（client）坐标，默认是画布中心 |
| `translateCanvas(x, y)` | 平移画布（相对当前位置的偏移量） |
| `setViewPosition(x, y)` | 设置画布的绝对平移位置 |
| `gotoView(pen)` | 平移画布，让图元居中显示 |
| `showMap()` / `hideMap()` | 显示 / 隐藏鹰眼 |
| `toggleRule(enabled?)` | 切换标尺 |
| `showMagnifier(enabled)` | 开关放大镜 |
| `resize()` | 按元素当前尺寸重设画布。引擎不会自动监听尺寸变化，容器大小改变后需要宿主调用（例如在 `ResizeObserver` 回调里） |

### 编辑

| 方法 | 说明 |
| --- | --- |
| `undo()` / `redo()` | 撤销 / 重做 |
| `pushAction(action)` | 手动写入一条撤销记录：`{ add?, remove?, beforeUpdate?, update? }` |
| `setLineType(type)` | 设置新建连线的类型：`line` / `curve` / `mind` / `orthogonal` |
| `toggleAnchorEdit(enabled?)` | 进入或退出锚点编辑 |
| `setAnchorHandleType(type?: HandleType)` | 设置当前悬停锚点的控制柄：Mirror=0、Smooth=1、Free=2；不传表示移除控制柄 |
| `enterTextInput(pen)` / `exitTextInput()` | 进入 / 退出图元文字编辑 |
| `setRotateCursors(cursors: string[4])` | 自定义 4 个方向的旋转光标 |

### 动画与媒体

| 方法 | 说明 |
| --- | --- |
| `startAnimate(idOrTagOrPens?, { name?, currentAnimation? }?)` | 播放图元的 `animations`。可以按名称或索引指定播放哪个动画；不传图元时播放所有 `autoPlay` 图元 |
| `pauseAnimate(idOrTagOrPens)` / `stopAnimate(idOrTagOrPens)` | 暂停 / 停止。必须传参数 |
| `startVideo(idOrTagOrPens?)` / `pauseVideo(...)` / `stopVideo(...)` | 控制视频图元 |

### 导出

| 方法 | 说明 |
| --- | --- |
| `toPng(params?, callback?)` | 导出 PNG。`params`：`{ pens?, padding?, backgroundImage?, maxWidth? }`。传 `callback(buffer: ArrayBuffer, error?)` 时通过回调返回数据，不传时直接下载 |
| `toSvg(defs?: string[])` | 导出并下载 SVG |

```ts
meta2d.toPng({ padding: 20 }, (buf, err) => {
  if (!err) {
    const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
  }
});
```

### 数据、通信、协作

`calcBoundDataPoints`、`addOrUpdateDatasource`、`deleteDatasource`、`stopConnect`、`startDataMock`、`stopDataMock`、`joinRoom` 等方法见 [data.md](./data.md)。

### 扩展注册

`register(url)`、`registerElement(defs)`、`registerDatasource(url)` 见 [extend.md](./extend.md)。

### 其他

| 方法 | 说明 |
| --- | --- |
| `messageBox(options)` / `closeAllMessageBox()` | 消息提示，见 [event.md](./event.md#消息提示与弹窗) |
| `getPerfReport(opt?)` | 获取各线程的性能数据（需要 `perfProbe: true`） |
| `on(name, fn)` / `off(name, fn)` | 监听事件，见 [event.md](./event.md) |

## 可赋值的钩子

直接赋值到实例上即可生效，详见 [event.md](./event.md#生命周期钩子)。

```ts
meta2d.beforeAdd = async (pens) => true;       // 返回 false 取消添加
meta2d.beforeDelete = async (pens) => confirm('删除？');
meta2d.beforeConnectLine = (line, from, to) => true;
meta2d.beforeRender = () => {};                 // open 时调用
meta2d.getMeta2dData = (id) => fetch(`/api/diagram/${id}`).then((r) => r.json()); // 页面跳转、弹窗用
meta2d.uploadFn = async (file) => '/upload/url'; // 拖入图片文件时上传
```
