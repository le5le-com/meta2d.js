[English](./README.md) | 简体中文

# chart-diagram

chart-diagram 在 le5le topology 中使用的第三方 chart 的工具

# 使用

## echarts

1. 节点 name = 'echarts'
2. 定义自定义数据 data 为 json，其中包含 echarts 属性，为 echarts/highcharts 提过数据

```
{
  text: '折线图',
  width: 300,
  height: 200,
  name: 'echarts',
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
}
```

# 如何开发其他图表控件

参考此目录下 echarts。

## 1. 注册、并加载图形库 js

```
// register.ts

import { registerNode, loadJS} from '@topology/core';
import {
  echarts
} from './echarts';

export function register() {
  if (!(echarts as any)) {
    loadJS('https://cdn.bootcss.com/echarts/4.3.0/echarts.min.js', null, true);
  }
  registerNode('echarts', echarts, null, null, null);
}
```

# How to Contribute

If you have any comment or advice, please report your issue, or make any change as you wish and submit an PR.

alsmile123@qq.com

# License

MIT © le5le.com
