# panBlit 首屏漏画 — 最小复现

浏览器里直接跑的最小 demo：`open(1000 个图元)` 之后**紧跟着** `fitView()`，让 calc 算 `penIds` 用的视口和主线程转发 `UpdateView` 时读到的 `data.x/y/scale` 错开。

## 跑法

```bash
# 仓库根目录
pnpm install
pnpm --dir examples/fitview-repro dev   # http://localhost:3040
```

## 读数

页面 1.2s 后调用 `getPerfReport({ canvasAudit: true })`，把当前画布与「按当前状态完整重画」逐像素比一次，左上角显示差异像素数：

| 源码 | 首屏 | 差异像素（1440×820 @2x） |
| --- | --- | --- |
| upstream `main` | 整屏空白 | 2,601,280 |
| upstream `main`，关闭 `panBlit` | 正常 | 0 |
| 修复分支 | 正常 | 0 |

- 面板上的 `panBlit: on/off` 可原地 A/B。
- `?noaudit=1` 只看首屏，不触发审计（审计本身会把画布重画成正确结果）。

## 关键点

1. `meta2d.open(data)` 不等返回就 `meta2d.fitView(0.6)`；
2. 图元数量要够多（这里 1000 个），首屏必然要缩放；
3. `panBlit` 保持默认开启。

缺陷在消息时序，不在渲染或拾取：静态点选、悬停都走不到这条路径。
