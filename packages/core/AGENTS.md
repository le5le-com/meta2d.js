# AGENTS.md

## 项目概述

本目录是 **meta2d.js**  monorepo 中的核心包 `@meta2d/core`（路径 `packages/core`）。meta2d.js 是一个基于 Web Canvas 的实时数据交互 2D 引擎，可用于构建 Web SCADA、物联网（IoT）、数字孪生、电力/组态图等应用。上游仓库：<https://github.com/le5le-com/meta2d.js>，License 为 MIT。

monorepo 根目录（`../../`）使用 **pnpm workspaces**（`pnpm-workspace.yaml` 声明 `packages/*`），包含 core、各类 diagram 扩展包（flow-diagram、chart-diagram、sequence-diagram 等）、plugin、svg、utils、vue 封装等多个子包。本包是其余所有包依赖的运行核心。

## 技术栈

- **语言**：TypeScript（`target`/`module` 均为 `esnext`，`moduleResolution: node`），编译配置在 monorepo 根目录的 `tsconfig.json`，通过 `paths: { "@meta2d/*": ["packages/*"] }` 实现包间源码直引。
- **运行时**：浏览器 Canvas 2D API（含 OffscreenCanvas），无框架依赖。
- **依赖**（见 `package.json`）：
  - `mitt` —— 事件总线，store 与 Meta2d 的事件系统均基于它；
  - `mqtt` —— 实时数据接入（注意 `src/core.ts` 中以 `mqtt/dist/mqtt.min.js` 方式引入，并有相关 webpack 5 兼容注释）。
- **构建/开发工具**（根目录）：TypeScript 5.6、Vite 5（示例工程）、tslint（`tslint.json`）、shx。

## 目录结构

包入口为 `index.ts`，以桶式（barrel）`export *` 再导出 `src/` 下的核心模块：core、options、data、utils、pen、rect、point、event、store、theme。

`src/` 下主要模块划分：

| 目录/文件 | 职责 |
| --- | --- |
| `core.ts` | `Meta2d` 主类（约 7000+ 行），组合画布、数据、事件、网络（WebSocket / MQTT / EventSource）等全部能力，是对外 API 的重心 |
| `options.ts` / `data.ts` / `theme.ts` | 全局配置项、快捷键与常量数据、主题（含 le5le 主题 CSS 变量） |
| `canvas/` | 画布渲染层：`canvas.ts`（主画布）、`canvasImage.ts`、`canvasTemplate.ts`、`magnifierCanvas.ts`（放大镜）、`offscreen.ts` |
| `pen/` | 图元（Pen，画笔）体系：`model.ts` 定义 `Pen` 接口（约 900 行，是核心数据模型）、`render.ts` 渲染、`text.ts` 文本排版、`math.ts`、`plugin.ts` 图元插件、`utils.ts` |
| `diagrams/` | 内置图形库：rectangle、circle、line（`line/` 子目录含曲线/折线/箭头）、svg（`svg/parse.ts`）、iframe、video、htmlDom、gif 等数十种图元 |
| `store/` | 全局状态：`store.ts`（`Meta2dStore`、`Meta2dData`、注册机制 `register*` 系列函数）、`global.ts`（`globalStore`） |
| `event/` | 用户自定义事件/行为模型（`Event`、`EventAction`、`EventName`） |
| `point/` / `rect/` | 几何基础：点、矩形及旋转/包含等计算 |
| `utils/` | 工具集：clone、color、debounce、easing、math、uuid、url、safe（`makeSafeFn`/`makeSafeAsyncFn` 沙箱化用户函数）、jetLinks 协议接入等 |
| `dialog/` `message/` `tooltip/` `popconfirm/` `title/` `scroll/` `grid/` `map/` | 引擎内置的 DOM UI 组件与辅助层（对话框、消息、提示、滚动条、网格、小地图） |

## 构建命令

- 在 monorepo 根目录：`pnpm -r build`（递归构建所有子包），完整发布构建为根脚本 `npm run build`（`pnpm -r build && npm run copyCorePJ`）。
- 仅本包：`npm run build`，即直接运行 `tsc`（使用根 `tsconfig.json`，输出到根 `dist/`，生成 `.d.ts` 与 sourcemap）。
- 发布用构建配置是 `package.build.json`（`tsc && copyfiles package.json ../../dist/core/`），其 `main` 指向 `index.js`；开发态 `package.json` 的 `main` 则直接指向源码 `index.ts`。发布到 npm 时 `@meta2d/core` 为 public 包。
- 本地调试/预览可借助根目录 `examples/`（含 react、diagram-editor-vue3、es5 示例工程）。

## 测试说明

项目**没有测试框架与测试脚本**：没有 jest/vitest 等依赖，`tsconfig.json` 明确排除 `**/*.spec.ts`。改动后的验证方式：

1. `npx tsc --noEmit`（或 `npm run build`）确认类型检查与编译通过；
2. 在 `examples/` 示例工程中实际运行验证交互行为。

## 代码风格约定

- TypeScript，始终使用分号；禁止 `var`；禁止重复 import / 重复变量；不允许 `console.log` 与 `debugger`（见根 `tslint.json`，注意 tslint 已属 legacy 工具链，没有对应的 eslint 配置）。
- 模块通过各目录的 `index.ts` 桶式导出，引用时从目录入口导入而非深路径。
- 类与接口用 PascalCase（`Meta2d`、`Pen`、`Meta2dStore`），内部成员有“下划线前缀表示私有/内部”的 lint 约定。
- 源码中的行内注释**大量使用简体中文**（约半数源文件含中文注释），修改代码时请保持注释语言与上下文一致，并同步更新描述旧行为的注释。
- `Meta2d` 主类文件极大，修改时注意其渲染/事件/网络逻辑高度耦合，尽量把通用计算下沉到 `utils/`、`pen/`、`rect/` 等模块。

## 安全注意事项

- MQTT / WebSocket 的连接参数（含 `username`、`password`、`clientId`）定义在 `Meta2dData`（`src/store/store.ts`）中，处理这些数据时注意不要把凭据写入日志或错误输出。
- 用户自定义脚本/函数通过 `src/utils/safe.ts` 的 `makeSafeFn` / `makeSafeAsyncFn` 包装执行，涉及事件动作（`EventAction`）执行逻辑时请保持该层封装，不要直接 `eval` 用户输入。
- 仓库根目录与本包均不提交 `.env` 等机密文件，不要在其中写入真实凭据。
