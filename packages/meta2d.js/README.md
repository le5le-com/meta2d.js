# Meta2d.js 分包构建

这是 Meta2d.js 的分包打包方案，将核心引擎和各图库分别打包为独立文件，支持按需加载。

## 📦 快速开始

### 构建

```bash
# 在项目根目录
pnpm build

# 或在当前目录
cd packages/meta2d.js
pnpm build
```

**产物**：`../../dist/meta2d.js/`
- `meta2d.min.js` - 核心引擎
- `meta2d_echarts.js` - ECharts 图表扩展
- `meta2d_uml.js` - UML 图元库
- `meta2d_form.js` - 表单组件库
- `meta2d_chart.js` - 图表组件库
- `meta2d_fta.js` - 故障树分析库
- `meta2d.*.worker.js` - 4 个 Web Worker 文件


## 🚀 使用方式

### 方式 1：使用 `register()` 动态加载（推荐）

```html
<!DOCTYPE html>
<html>
<head>
  <title>Meta2d - 动态加载</title>
</head>
<body>
  <le5le-meta2d id="canvas" style="width: 100%; height: 600px;"></le5le-meta2d>

  <!-- 引入核心引擎 -->
  <script src="meta2d.min.js"></script>
  
  <script>
    const meta2d = document.getElementById('canvas');
    
    // 使用 register 方法动态加载图库
    await meta2d.register('./meta2d_uml.js');
    await meta2d.register('./meta2d_form.js');
    
    // 现在可以使用这些图库了
    meta2d.open({
      pens: [
        { name: 'rectangle', x: 100, y: 100, width: 200, height: 100 }
      ]
    });
  </script>
</body>
</html>
```

## 📄 License

MIT
