[English](./README.md) | 简体中文

# @meta2d/echarts

The @meta2d/echart is a wrapper for echarts using meta2d.js, allowing the use of echarts to draw charts within meta2d.js.

# How to use

1. Set `name` to `'echarts'` and `category` to 2 (PenCategory.HtmlElement)
2. Set echarts option

```
const pen = {
  category: 2,
  name: 'Line Chart',
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
