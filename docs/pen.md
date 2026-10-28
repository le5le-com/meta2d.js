简体中文 | [English](./pen.en-US.md)

# 图元 Pen

图元是一个普通对象，只有 `type` 是必填字段，其他字段都可选。修改已有图元请用 `meta2d.setValue({ id, ...props })`。

```ts
{
  id: 'p1',
  type: 'rectangle',
  x: 100, y: 100, width: 120, height: 60,
  text: '水泵',
  color: '#1890ff',
  background: '#e6f7ff',
  borderRadius: 0.1,
}
```

## 内置类型

| 类别 | type |
| --- | --- |
| 连线 | `line` 折线、`curve` 曲线、`mind` 脑图曲线、`orthogonal` 正交线 |
| 基础形状 | `rectangle`、`square`、`circle`、`triangle`、`diamond`、`pentagon`、`pentagram`、`hexagon`、`cube`、`cloud`、`file`、`message`（对话气泡）、`people`、`leftArrow`、`rightArrow`、`twowayArrow` |
| 图片 | `image`、`gif`（通过 `image` 字段指定地址） |
| 路径 | `svgPath`（通过 `pathId` 引用 `data.paths`） |
| 组合 | `group`（容器本身不绘制） |
| DOM | `video`、`iframe`、`le5le-meta2d`（嵌入另一张图纸，通过 `dataId` 指定） |

`chart`、`form`、`uml`、`fta`、`echarts` 扩展包提供更多类型，见 [extend.md](./extend.md)。没有注册的 `type` 会显示为灰色占位矩形。

## 基础与几何

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 唯一 id，不填会自动生成 |
| type | string | 图元类型 |
| name | string | 显示名称 |
| category | PenCategory | Node=0、Line=1、HtmlElement=2。内置类型会自动设置；DOM 类扩展图元需要手动设为 2 |
| tags | string[] | 标签，可用于 `find`、`setValue({ tag })` 以及动作的目标 |
| x, y, width, height | number | 逻辑坐标和尺寸。连线的这些字段由 `anchors` 自动计算 |
| rotate | number | 旋转角度（度），绕 `pivot` 旋转，`pivot` 默认是中心点 |
| ratio | boolean | 缩放时保持宽高比 |
| flipX / flipY | boolean | 水平 / 垂直翻转 |
| opacity | number | 透明度 0–1 |
| parentId / children | string / string[] | 父子关系。子图元同样使用绝对坐标，移动父图元时子图元跟着移动 |
| showChild | number | 只显示第几个子图元（可用来做状态切换） |
| container | Rect | 容器区域（0–1 的比例）。拖入该区域的图元会成为子图元 |

## 样式

| 属性 | 说明 |
| --- | --- |
| color | 前景色（边框、线条） |
| background | 填充色 |
| gradient / bkType | 填充渐变；`bkType`：Color=0、LinearGradient=1、RadialGradient=2、Image=3 |
| backgrounds | 多层背景：`[{ type, color, gradient, image, imageRepetition }]` |
| backgroundImage | 背景图片 |
| lineWidth / lineDash / lineDashOffset / lineCap / lineJoin | 与 Canvas 同名属性含义相同 |
| lineGradient / lineType / lineImage | 线条渐变；`lineType` 是线条的填充类型（取值同 bkType），不是连线形状 |
| borderWidth / borderColor / borderRadius | 边框和圆角。`borderRadius` 在 0–1 之间时表示短边的比例，否则单位是像素 |
| shadowColor / shadowBlur / shadowOffsetX / shadowOffsetY | 阴影 |
| blur / blurBackground | 模糊 |
| hoverColor / hoverBackground | 悬停样式 |
| activeColor / activeBackground | 选中样式 |
| disabledColor / disabledBackground / disabledTextColor | 禁用样式 |

渐变 `Gradient`：`{ type: 1 线性 | 2 径向, x0, y0, r0, x1, y1, r1, colorStops: [{ i: 0~1, color }] }`。

## 文字

| 属性 | 说明 |
| --- | --- |
| text | 文字内容 |
| textVisible | 设为 false 时隐藏 |
| fontFamily / fontSize / fontWeight / fontStyle / lineHeight / letterSpacing | 字体 |
| textColor / textBackground / textGradient | 文字颜色、背景、渐变 |
| textHoverColor / textActiveColor | 悬停 / 选中时的文字颜色 |
| textAlign | Left=1、Center=2（默认）、Right=3 |
| textVertical | Top=1、Middle=2（默认）、Bottom=3 |
| textWrap | Normal=0（自动换行）、Line=1（只按换行符换行）、Nowrap=2 |
| textWidth / textHeight | 文字区域尺寸，默认使用图元尺寸 |
| textLeft / textTop / textRight / textBottom / textUnit | 文字偏移；`textUnit` 为 1 时按百分比计算 |
| ellipsis | 文字溢出时显示省略号 |
| keepDecimal | 数字保留几位小数 |
| textDecoration | None=0、Underline=1、LineThrough=2，配合 `textDecorationColor` / `textDecorationDash` |
| textShadow / textShadowColor / textShadowBlur / textShadowOffsetX/Y | 文字阴影 |
| textRotate / textFlip | 文字是否跟随图元旋转 / 翻转 |
| textAutoSize | 输入后按文字内容自动调整尺寸 |

## 图片与图标

| 属性 | 说明 |
| --- | --- |
| image | 图片地址 |
| imageRatio / imageRadius / crossOrigin | 保持比例、圆角、跨域设置 |
| icon / iconFamily / iconWeight / iconSize / iconColor / iconGradient | 字体图标（需要先用 `setIconfonts` 加载字体） |
| iconTop / iconLeft / iconWidth / iconHeight / iconRotate | 图标位置和尺寸 |
| iconAlign | 位标志：Center=0、Bottom=1、Top=2、Right=4、Left=8，可以组合 |
| pathId / pathFill | svgPath 引用的 path；`pathFill` 为 true 时填充 path |
| video / audio / autoPlay / playLoop | 音视频 |
| iframe | iframe 地址 |

## 连线

连线的形状由 `anchors` 决定，每个点都是绝对坐标。

| 属性 | 说明 |
| --- | --- |
| anchors | 路径点 `Point[]`。端点通过 `connectedPen` / `connectedAnchor` 连接到图元 |
| close | 路径是否闭合 |
| lineSmooth | 折线圆滑度，大于 0 时生效 |
| fromArrow / toArrow | 起点 / 终点箭头：`triangle`、`reverseTriangle`、`circle`、`diamond`、`line`、`lineUp`、`lineDown` |
| fromArrowSize / fromArrowColor / fromArrowFillColor | 起点箭头的大小和颜色（终点使用 `toArrow*` 系列） |
| fromLineCap / toLineCap | 两端的线帽 |
| length | 连线长度（自动计算） |
| connectedLines | 节点上记录的、连到它的连线 `[{ penId, penAnchor, anchor, in? }]`（自动维护） |

连线上的文字是一个子图元，用 `segment`（第几段）和 `position`（在该段上的 0–1 位置）定位。

### 锚点 Point

| 字段 | 说明 |
| --- | --- |
| id, x, y | 锚点 id 和绝对坐标 |
| radius / color / background / visible / disabled / title | 锚点外观、提示文字 |
| twoWay | 连线方向限制：Both=0、In=1、Out=2、None=3 |
| cp1 / cp2 / handleType | 贝塞尔控制点；`handleType`：Mirror=0、Smooth=1、Free=2 |
| connectedPen / connectedAnchor | 连线端点所连接的图元和锚点 |

节点不填 `anchors` 时，会按类型生成默认锚点（多数形状是上、右、下、左 4 个点）。

## 状态与交互

| 属性 | 说明 |
| --- | --- |
| visible | 设为 false 时隐藏 |
| locked | 编辑模式下不能被选中和拖拽 |
| disabled | 禁用：不响应事件，并使用禁用样式 |
| disableInput / disableRotate / disableSize / disableAnchor | 单独禁用双击输入、旋转、缩放尺寸、锚点 |
| interactive | 位标志：Style=1（有悬停/选中样式）、Event=2（响应事件） |
| input | 双击输入方式：None=0、Text=1、Number=2、Custom=3（调用图元的 `input` 钩子） |
| tooltip / tooltipJs | 悬停提示，支持 markdown；`tooltipJs` 为返回提示内容的脚本 |
| progress / progressMin / progressMax / progressColors / verticalProgress / reverseProgress | 进度条 |

## 数据与事件

| 属性 | 说明 |
| --- | --- |
| properties | 业务属性及数据绑定，见 [data.md](./data.md#数据绑定) |
| events | 交互事件与动作，见 [event.md](./event.md#图元事件-events) |
| triggers | 数据变化触发器（状态），见 [event.md](./event.md#触发器-triggers) |
| form | 表单类图元使用的辅助数据 |

## 动画

图元可以有多个动画，`currentAnimation` 表示当前使用哪一个（索引）。`autoPlay: true` 的图元在打开图纸时自动播放。

```ts
{
  animations: [{
    name: '闪烁',
    cycle: 0,                  // 循环次数，0 为无限循环
    keepAnimationState: false, // 结束后是否保持最后一帧
    frames: [                  // 节点帧动画
      { duration: 500, properties: { opacity: 0.2 } },
      { duration: 500, properties: { opacity: 1 } },
    ],
    nextAnimation: 1,          // 结束后接着播放的动画索引
  }],
  currentAnimation: 0,
  autoPlay: true,
}
```

| Animation 字段 | 说明 |
| --- | --- |
| name / cycle / keepAnimationState | 名称、循环次数、结束时是否保持状态 |
| frames | `[{ duration, properties, transitional?, timingFunction? }]`。`transitional` 列出要做过渡插值的属性 |
| lineAnimation | 连线动画配置（连线专用） |
| next / nextType / nextAnimation | 结束后联动的目标和要播放的动画 |

连线动画 `lineAnimation`：

| 字段 | 说明 |
| --- | --- |
| type | Default=0 水流、Beads=1 水珠、Dot=2 圆点、Arrow=3 箭头、WaterDrop=4 水滴、Image=5 图片、Icon=6 图标、Pen=7 画笔、Element=8 元素 |
| color / lineWidth / dotSize / lineDash | 外观 |
| span | 速度 |
| reverse | 反向流动 |
| count / markerSpacing | 数量、间距 |
| shadow / shadowColor / shadowBlur | 发光效果 |
| image / icon / iconFamily / target | type 为 5–8 时使用的素材 |

播放控制请调用 `meta2d.startAnimate(id, { name })`、`pauseAnimate`、`stopAnimate`。
