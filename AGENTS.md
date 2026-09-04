# AGENTS.md

本文件供 AI 编码代理阅读，假定读者对本项目一无所知。

## 项目概述

**meta2d.js** 是一个基于 Web Canvas 的实时数据交互 2D 引擎，可用于构建 Web SCADA、物联网（IoT）、数字孪生、电力/组态图等应用。上游仓库：<https://github.com/le5le-com/meta2d.js>，License 为 MIT，官方文档：<https://doc.le5le.com/document/136>，在线试用：<https://v.le5le.com/>。

本仓库是一个 **pnpm monorepo**（`pnpm-workspace.yaml` 声明 `packages/*`），所有可发布包都在 `packages/` 下，以 `@meta2d/*` 命名发布到 npm（public access）。

## 技术栈

- **语言**：TypeScript（根 `tsconfig.json`：`target`/`module` 均为 `esnext`，`moduleResolution: node`，生成 `.d.ts` 与 sourcemap）。通过 `paths: { "@meta2d/*": ["packages/*"] }` 实现包间**源码直引**——开发态各包 `package.json` 的 `main` 直接指向 `index.ts` 源码，而非编译产物。
- **运行时**：浏览器 Canvas 2D API（含 OffscreenCanvas），核心引擎无框架依赖。
- **关键依赖**：`mitt`（事件总线）、`mqtt`（实时数据接入，`@meta2d/core` 中以 `mqtt/dist/mqtt.min.js` 方式引入）。
- **构建工具**：TypeScript 5.6（`tsc` 为主）、webpack（`packages/meta2d.js` 打 UMD 包）、Vite 5（仅用于 `examples/diagram-editor-vue3` 示例）、shx/copyfiles（拷贝发布用 package.json）。
- **Lint**：根目录 `tslint.json`（tslint 已属 legacy 工具链，仓库中没有 eslint 配置，也没有 lint 脚本钩子）。

## 仓库结构

```
packages/
├── core/                 # @meta2d/core —— 引擎运行核心，其余所有包依赖它
├── meta2d.js/            # meta2d.js —— UMD 打包产物（webpack），聚合 core 与各 diagram 包
├── flow-diagram/         # @meta2d/flow-diagram 流程图
├── chart-diagram/        # @meta2d/chart-diagram 图表
├── class-diagram/        # @meta2d/class-diagram 类图
├── sequence-diagram/     # @meta2d/sequence-diagram 时序图
├── activity-diagram/     # @meta2d/activity-diagram 活动图
├── form-diagram/         # @meta2d/form-diagram 表单控件
├── fta-diagram/          # @meta2d/fta-diagram 故障树
├── layout/               # @meta2d/layout 自动布局
├── le5le-charts/         # @meta2d/le5le-charts 图表集成
├── plugin-mind-core/     # @meta2d/plugin-mind-core 脑图核心插件
├── plugin-mind-collapse/ # @meta2d/plugin-mind-collapse 脑图收起/展开插件
├── svg/                  # @meta2d/svg SVG 解析
├── utils/                # @meta2d/utils 公共工具（连线交叉计算等）
├── vue/                  # @meta2d/vue Vue3 封装组件
├── particle/             # @meta2d/particle 粒子（早期，无 build 脚本）
└── transform/            # @meta2d/transform 变换（早期，无 build 脚本）
examples/
├── diagram-editor-vue3/  # 官方推荐的上手示例（Vite + Vue3）
├── react/                # React 示例（webpack）
└── es5/                  # 纯 ES5/UMD 直接引用示例
```

各包内部约定：包根 `index.ts` 以桶式（barrel）`export *` 再导出 `src/` 模块；引用一律走目录入口而非深路径。diagram 类包的 `src/` 下通常每个图形一个 `.ts` 文件（如 `packages/flow-diagram/src/comment.ts`、`db.ts` 等）。

`packages/core` 是最重要也最复杂的包，内部模块划分（`src/` 下）：`core.ts`（`Meta2d` 主类，7000+ 行，组合画布/数据/事件/网络全部能力）、`canvas/`（渲染层）、`pen/`（图元数据模型与渲染，`model.ts` 的 `Pen` 接口是核心数据模型）、`diagrams/`（内置图形库）、`store/`（全局状态与 `register*` 注册机制）、`event/`、`point/`、`rect/`、`utils/`（含 `safe.ts` 用户脚本沙箱）、以及 `dialog/`、`message/`、`tooltip/`、`scroll/`、`grid/`、`map/` 等内置 DOM UI 层。详见 `packages/core/AGENTS.md`（修改 core 包前必读）。

## 构建命令

- **安装依赖**：`pnpm install`
- **全量构建（发布用）**：根目录 `npm run build`，即 `pnpm -r build && npm run copyCorePJ`——递归构建所有子包到根 `dist/`，再把 `packages/core/package.build.json` 拷贝为 `dist/core/package.json`。
- **单包构建**：各包 `npm run build` 即 `tsc`（复用根 `tsconfig.json`，输出到根 `dist/<包名>/`）；多数包还会执行 `copy` 脚本把发布用 package.json 拷入 `dist/`。例外：`packages/meta2d.js` 用 webpack 打 UMD 包（`meta2djs` 全局变量，输出 `dist/meta2d.js/meta2d.js`）；`packages/particle`、`packages/transform` 没有 build 脚本。
- 发布用的 `main` 指向编译产物（如 `index.js`），与开发态指向源码不同，注意区分 `package.json` 与 `package.build.json`。

## 本地调试

仓库没有 dev server 脚本，调试用 `examples/`：

- `examples/diagram-editor-vue3`：`pnpm start`（Vite，官方推荐）；
- `examples/react`：`npm start`（webpack dev server）；
- `examples/es5`：直接打开 `index.html`，引用 `dist/` 下的 UMD 产物。

## 测试说明

项目**没有测试框架与测试脚本**：没有 jest/vitest 等依赖，根 `tsconfig.json` 明确排除 `**/*.spec.ts`。注意 `CONTRIBUTING.md` 中"改动必须附测试"的条款是沿用的模板文本，与仓库实际状态不符。改动后的实际验证方式：

1. `npx tsc --noEmit`（或对应包的 `npm run build`）确认类型检查与编译通过；
2. 在 `examples/` 示例工程中实际运行，验证交互行为。

## 发布/部署流程

GitHub Actions（`.github/workflows/main.yml`）：推送 `v*` 标签触发。流程为 `pnpm install --ignore-scripts --frozen-lockfile` → `npm run build` → 用标签版本号更新 `dist/core` 与 `dist/meta2d.js` 的版本 → 通过 npm OIDC（`id-token: write`）逐包 `npm publish`（core、meta2d.js、各 diagram 包、plugin-mind-*、svg、utils、vue；均 `continue-on-error: true`）。CI 使用 Node 24、pnpm 10.33.2。发布版本号以 git 标签为准，而不是各包 `package.json` 里的 version。

## 代码风格约定

- TypeScript，始终使用分号；禁止 `var`；禁止重复 import / 重复变量；禁止 `console.log` 与 `debugger`；内部（私有）成员用下划线前缀（以上均见根 `tslint.json`）。
- 类与接口用 PascalCase（`Meta2d`、`Pen`、`Meta2dStore`）。
- 模块通过各目录/包根的 `index.ts` 桶式导出，新增文件记得在对应 `index.ts` 中导出。
- 源码行内注释**大量使用简体中文**；README 中英双语（`README.md` / `README.CN.md`）。修改代码时保持注释语言与上下文一致，并同步更新描述旧行为的注释。
- `packages/core/src/core.ts` 的 `Meta2d` 主类极大且渲染/事件/网络逻辑高度耦合，改动需谨慎；通用计算尽量下沉到 `utils/`、`pen/`、`rect/` 等模块。
- Git 提交信息遵循 Conventional Commits 风格：`<type>(<scope>): <subject>`，type 取 build/ci/docs/feat/fix/perf/refactor/style/test，标题用祈使句、首字母小写、结尾不加句号、单行不超过 100 字符（详见 `CONTRIBUTING.md`）。

## 安全注意事项

- MQTT / WebSocket 的连接参数（含 `username`、`password`、`clientId`）定义在 `Meta2dData`（`packages/core/src/store/store.ts`）中，处理这些数据时不要把凭据写入日志或错误输出。
- 用户自定义脚本/函数通过 `packages/core/src/utils/safe.ts` 的 `makeSafeFn` / `makeSafeAsyncFn` 包装执行；涉及事件动作（`EventAction`）执行逻辑时必须保持该层封装，不要直接 `eval` 用户输入。
- 不要提交 `.env` 等机密文件，不要在源码中写入真实凭据。
