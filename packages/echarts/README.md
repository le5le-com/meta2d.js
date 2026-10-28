简体中文 | [English](./README.en-US.md)

# @meta2d/echarts

@meta2d/echarts 是使用 meta2d.js 对 echarts 的封装，用于在 meta2d.js 中使用 echarts 绘制图表。

# 使用

1. 设置 name = 'echarts'，category = 2（PenCategory.HtmlElement）
2. 设置 echarts 数据

```
const pen = {
  category: 2,
  name: '折线图',
  type: 'echarts',
  width: 300,
  height: 200,
  echarts: {
    option: {
      xAxis: {
        type: 'category',
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: [820, 932, 901, 934, 1290, 1330, 1320],
        type: 'line'
      }]
    }
  }
};
```

# License

MIT © le5le.com
