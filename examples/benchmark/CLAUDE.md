# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 **Canvas 渲染库性能对比测试工具**，用于测试和对比五个主流 Canvas 渲染库的性能表现。

支持的渲染库：
- **meta2d.js** - 2D 可视化引擎（来自父级 meta2d 项目）
- **LeaferJS** - 现代化 Canvas 渲染引擎
- **PixiJS** - WebGL 2D 渲染引擎
- **Konva.js** - HTML5 Canvas 框架
- **Fabric.js** - Canvas 对象模型库

测试维度：
- **图元数量**（矩形）- 5000 / 8000 / 10000 / 20000 / 50000 / 100k / 1M
- **图片数量** - 200 / 500 / 1000 / 2000
- **文本数据点** - 2000 / 4000 / 8000 / 10000 / 100k（支持动态刷新，30ms - 2s）
- **动画数量** - 400 / 1000 / 2000 / 5000

性能指标：
- **FPS**（每秒帧率）- 使用 Stats.js 实时监控
- **首屏时间**（毫秒）- 初始渲染耗时
- **JS 内存**（MB）- JavaScript 堆内存使用量

## 常用命令

### 开发服务器
```bash
pnpm dev
# 启动开发服务器，默认端口 3030，自动打开浏览器
```

### 构建生产版本
```bash
pnpm build
```

### 预览生产构建
```bash
pnpm preview
```

### meta2d 依赖准备
此项目依赖父级目录的 meta2d 核心库。如果 meta2d 有更新，需要先构建：
```bash
cd ../../meta2d
pnpm build
cd ../性能测试/performance-test
```

## 架构设计

### 核心架构模式

采用 **抽象基类 + 具体实现** 的设计模式，所有渲染库实现统一接口：

```typescript
abstract class BaseRenderer {
  abstract renderPrimitives(count: number): Promise<void>  // 渲染矩形
  abstract renderImages(count: number): Promise<void>      // 渲染图片
  abstract renderTexts(count: number): Promise<void>       // 渲染文本
  abstract updateTexts(): void                             // 更新文本（数据刷新）
  abstract startAnimations(count: number): Promise<void>   // 启动动画
  abstract destroy(): void                                 // 清理资源
}
```

每个渲染库继承 `BaseRenderer` 并实现自己的渲染逻辑。

### 渲染器实现要点

#### Meta2d 渲染器（meta2d-renderer.ts）
- 使用 `createMeta2d()` + `<le5le-meta2d>` Web Component
- 通过 `open()` 方法加载图元数据
- 使用 `setValue({ id, text })` 更新文本数据点
- 动画配置使用 meta2d 标准格式（frames + transitional）
- 调用 `startAnimate()` 启动动画

#### 其他渲染器
- **LeaferJS**: 使用 Leafer UI 的 App/Frame/Rect/Image/Text
- **PixiJS**: 使用 Application/Graphics/Sprite/Text，WebGL 渲染
- **Konva**: 使用 Stage/Layer/Rect/Image/Text，Animation 类
- **Fabric**: 使用 Canvas/Rect/Image/Text，requestAnimationFrame 动画循环

### 布局算法

所有图元使用网格布局，从左上角开始平铺：

```typescript
const size = calculateSize(count)  // 根据数量自动调整大小
const gap = 5
const itemWidth = size + gap
const cols = Math.floor(width / itemWidth)

// 计算位置
const x = (i % cols) * itemWidth
const y = Math.floor(i / cols) * itemWidth
```

**尺寸自适应规则**：
- < 2000: 20px
- 2000-5000: 15px
- 5000-8000: 10px
- > 8000: 5px

### 性能监控实现

使用 `PerformanceMonitor` 类（基于 Stats.js）：

```typescript
class PerformanceMonitor {
  private fpsStats: Stats          // FPS 监控
  private firstPaintStats: Stats   // 首屏时间
  private jsMemoryDiv: HTMLElement // 内存显示
  
  getJSMemory(): number           // 获取 performance.memory
  setFirstPaintTime(time: number) // 设置首屏时间
}
```

监控面板固定在右上角，深色背景，实时更新。

## 关键技术细节

### Meta2d 集成注意事项

1. **必须使用 Web Component 方式**，不能直接使用 Canvas
2. **初始化流程**：
   - `createMeta2d()` 创建实例
   - 等待 `instance.ready` Promise
   - 使用 `open({ pens: [...] })` 加载数据
3. **图元 ID 生成**：使用 16 进制随机字符串
4. **动画配置格式**：
   ```javascript
   {
     animations: [{
       animate: '上下跳动',
       frames: [
         { properties: { y: -10 }, transitional: { y: true }, duration: 100 },
         { properties: { y: 10 }, transitional: { y: true }, duration: 100 }
       ]
     }],
     currentAnimation: 0,
     autoPlay: true
   }
   ```

### 数据更新机制

- **meta2d**: 使用 `setValue()` API 更新，保持图元引用
- **其他库**: 直接修改对象属性或重新渲染

文本刷新通过 `setInterval` 定时器触发，间隔可配置（≥30ms）。

### 资源路径

- 测试图片：`/img/test.svg`（放在 `public/img/` 目录）
- Vite 会将 public 目录作为静态资源根路径

## 开发注意事项

### 添加新渲染库

1. 在 `src/libs/` 创建新的渲染器文件（如 `new-renderer.ts`）
2. 继承 `BaseRenderer` 并实现所有抽象方法
3. 在 `src/main.ts` 的 `switchLibrary()` 方法中添加 case
4. 在 UI 中添加对应的库切换按钮

### 性能测试建议

1. **从小数量开始测试**，逐步增加，避免浏览器崩溃
2. **对比测试时保持其他维度一致**，只变化一个变量
3. **大数量测试（100k+）可能导致卡顿或崩溃**，谨慎使用
4. 使用 Chrome DevTools Performance 面板进行详细分析
5. 关注 Chrome 任务管理器查看真实内存和 CPU 占用

### 调试技巧

- meta2d 实例挂载到 `globalThis.meta2d`，可在控制台直接访问
- 所有渲染器的图元数据存储在 `primitives/images/texts/animations` 数组中
- FPS 掉帧时检查 `updateTexts()` 的调用频率
- 动画不生效时检查渲染库的动画启动方法是否正确调用

## 项目结构说明

```
src/
├── libs/                    # 渲染器实现
│   ├── base-renderer.ts     # 抽象基类（定义接口）
│   ├── meta2d-renderer.ts   # Meta2d 实现
│   ├── leafer-renderer.ts   # LeaferJS 实现
│   ├── pixi-renderer.ts     # PixiJS 实现
│   ├── konva-renderer.ts    # Konva 实现
│   └── fabric-renderer.ts   # Fabric 实现
├── utils/
│   └── performance-monitor.ts  # 性能监控工具
├── main.ts                  # 应用入口（UI 逻辑 + 渲染器调度）
└── style.css                # 完整 UI 样式
```

**main.ts 职责**：
- UI 初始化和事件绑定
- 渲染器切换和生命周期管理
- 配置管理（TestConfig）
- 文本刷新定时器控制
- 性能监控启动

## 技术栈

- **Vite 6** - 构建工具
- **TypeScript 5.7** - 类型安全
- **Stats.js** - 性能监控（FPS）
- **各种 Canvas 库** - 性能对比对象

## 父级项目集成

此项目是 meta2d 生态系统的一部分：
- 位于 `c:\work\产品\2.0\性能测试\performance-test`
- 依赖 `../../meta2d` 的核心库
- 不使用 Vite alias 直接引用，而是通过 npm 包 `@meta2d/core`
- 配置了 `optimizeDeps.include` 预构建 CJS 依赖（upng, gifuct-js）
