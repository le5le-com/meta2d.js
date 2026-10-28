简体中文 | [English](./README.en-US.md)

# Meta2d.js

Meta2d.js 是一个 「**数据驱动显示** + **动态交互**」 2d 可视化引擎，具有绘图、动画、消息、事件、实时数据通信、条件告警、生命周期、图形自定义、扩展等功能，方便快速实现 Web 组态、SCADA，表报、流程图、中控可视化等可视化需求。

<center style="display:flex;justify-content:center">
<img style="height:100px;margin: 10px" src="1.png" >

<img style="height:100px;margin: 10px" src="2.png" >

<img style="height:100px;margin: 10px" src="3.webp"> 
</center>

<br>

# 在线使用

[在线体验（乐吾乐大屏）](http://v.le5le.com)

<br>

# 特色

**理念**

- 数据 + 算法 + 风格 = 栩栩如生
- 数据驱动显示
- 实时数据驱动
- 动态的、交互的，自由可控
- 生命周期管理，灵活可控
- 可扩展可定制
- 简单而不简单

**实时数据通信**

- 支持 MQTT/WebSocket/HTTP/SSE 等多协议数据通信
- 简单的数据点绑定模式
- 支持指令发送

**实时监听与条件告警**

- 支持生命周期函数
- 支持关系条件监听数据
- 支持自定义条件监听数据
- 支持条件触发行为

**丰富的交互事件**

- 鼠标事件
- 内置系统消息
- 自定义消息
- 移动、缩放、旋转等事件
- 动画、视频播放事件
- 表单输入

**原生 Web 组件开发方式**

- 原生 Web Component 组件化开发技术
- 隔离、独立
- 多实例、易复用

**追求卓越性能**

- 多线程与局部渲染
- 支持 10+万以上节点
- 支持 1000+ 实时数据点，大数据、高要求场景无压力
- 支持 400+动画播放，依旧丝滑流畅

| 图元  | 性能：帧  | 性能：内存（MB） | 备注             |
| ----- | --------- | ---------------- | ---------------- |
| 1万   | 117 - 120 | 44 - 50          | 拖拽、缩放不影响 |
| 10万  | 114 - 120 | 80 - 110         | 鼠标拾取不掉帧   |
| 100万 | 109 - 117 | 510 - 840        | 鼠标拾取不掉帧   |

基准测试： 基于examples/benchmark  
测试环境： 8核 3.8GHz CPU，32GB 内存  
其他条件： 200 图片、2000 数据点、400 动画

**自由可扩展**

- 可自定义图形库
- 支持自由组合
- 支持生命周期函数、布局等插件扩展

<br>

# 安装

```
# npm
$ npm install @meta2d/core @meta2d/extension --save

# yarn
$ yarn add @meta2d/core @meta2d/extension

# pnpm
$ pnpm add @meta2d/core @meta2d/extension
```

# 快速使用

1. 在 html 中新增 le5le-meta2d 的 web 组件

```
  <body>
    <le5le-meta2d></le5le-meta2d>
  </body>
```

2. 在 js 中创建 le5le-meta2d 的实例

```
import { createMeta2d,Mode } from '@meta2d/core';

createMeta2d();

const meta2d = document.querySelector('le5le-meta2d');
meta2d.setMode(Mode.Edit); // 设置为编辑模式，默认为运行模式
meta2d.setOptions(...); // 可选

fetch('your-data.json')
  .then((res) => res.json())
  .then((data) => {
    meta2d.open(data);
  });
```

<br>

# 使用文档

[使用文档](docs/README.md)

<br>

# 应用：架构流程设计器

架构流程设计器（diagram-flow）是基于 Meta2d.js 开发的架构图、流程图、思维导图、图表等各类 2D 交互的创意绘图与设计工具。

## 本地运行

```
# 在根目录安装依赖包
pnpm/npm install

# 进入架构流程设计器目录
cd diagram-flow
pnpm/npm  start
```

# 开源协议

MIT © le5le.com
