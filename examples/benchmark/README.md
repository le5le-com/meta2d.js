# Canvas 性能对比测试工具

一个用于对比测试多个 Canvas 渲染库性能的工具。

## 支持的库

- **meta2d.js** - 2D 可视化引擎核心库
- **LeaferJS** - 现代化的 Canvas 渲染引擎
- **PixiJS** - WebGL 2D 渲染引擎
- **Konva.js** - HTML5 Canvas JavaScript 框架
- **Fabric.js** - 强大的 Canvas 库

## 测试维度

1. **图元数量** - 使用矩形测试基础图形渲染性能
2. **图片数量** - 测试图片加载和渲染性能
3. **文本（数据点）** - 测试文本渲染和动态更新性能
   - 支持自定义刷新时间（30ms - 2000ms）
4. **动画** - 测试动画流畅度

## 性能指标

- **FPS** - 每秒帧数
- **首屏时间** - 初始渲染耗时
- **JS 内存** - JavaScript 堆内存使用量

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

## 使用说明

1. **选择库** - 点击顶部的库按钮切换不同的渲染库
2. **配置测试参数** - 使用下拉菜单设置各个维度的数量
3. **查看性能指标** - 右上角实时显示 FPS、首屏时间和内存使用
4. **观察渲染效果** - 画布区域显示实时渲染结果

## 项目结构

```
performance-test/
├── src/
│   ├── libs/              # 各个渲染库的实现
│   │   ├── base-renderer.ts
│   │   ├── meta2d-renderer.ts
│   │   ├── leafer-renderer.ts
│   │   ├── pixi-renderer.ts
│   │   ├── konva-renderer.ts
│   │   └── fabric-renderer.ts
│   ├── utils/             # 工具类
│   │   └── performance-monitor.ts
│   ├── main.ts            # 主入口
│   └── style.css          # 样式文件
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 技术栈

- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **各种 Canvas 库** - 性能对比对象

## 注意事项

- meta2d.js 当前使用模拟实现，需要进一步集成实际的 meta2d 核心库
- 大数量测试（如 100k, 1M）可能导致浏览器卡顿，请谨慎使用
- 建议在 Chrome 浏览器中打开开发者工具查看更详细的性能数据

## License

MIT
