# Meta2d 集成说明

## 更新内容

### 1. Meta2d 渲染器实现
已按照 meta2d 的正确使用方式重写 `meta2d-renderer.ts`：

- ✅ 使用 `<le5le-meta2d>` Web Component
- ✅ 使用 `open()` 方法加载图元数据
- ✅ 图元从左往右均匀排布
- ✅ 使用 `setValue()` 方法更新文本数据点
- ✅ 配置上下跳动动画，使用 `startAnimate()` 启动
- ✅ 使用 `/img/test.svg` 作为测试图片

### 2. 图元布局算法
矩形、图片、文本均采用从左往右、自动换行的网格布局：
```typescript
const cols = Math.floor(this.width / itemWidth)
const row = Math.floor(i / cols)
const col = i % cols
const x = col * itemWidth + 10
const y = row * itemWidth + offset
```

### 3. 动画配置
使用 meta2d 标准动画配置：
```javascript
{
  animations: [{
    animate: '上下跳动',
    name: '动画1',
    frames: [
      { properties: { y: -10 }, transitional: { y: true }, duration: 100 },
      { properties: { y: 10 }, transitional: { y: true }, duration: 100 },
      { properties: { y: -10 }, transitional: { y: true }, duration: 200 }
    ]
  }],
  currentAnimation: 0,
  autoPlay: true
}
```

### 4. 文本数据刷新
使用 meta2d 的 `setValue` API：
```typescript
this.meta2d.setValue({
  id: penId,
  text: randomValue().toString()
})
```

## 测试建议

1. 先用小数量测试（默认配置）
2. 观察 FPS 和内存使用
3. 逐步增加数量进行压力测试
4. 对比不同库的性能表现

## 已知限制

- meta2d 需要先构建：`cd ../../meta2d && pnpm build`
- 图片路径：`public/img/test.svg`
- 大数量测试（100k+）可能导致浏览器卡顿

## 启动方式

```bash
# 确保 meta2d 已构建
cd ../../meta2d && pnpm build

# 返回项目目录
cd ../../性能测试/performance-test

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3030/
