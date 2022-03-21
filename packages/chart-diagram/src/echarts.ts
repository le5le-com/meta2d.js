import { ChartData, Pen, setElemPosition } from '@topology/core';

export const echartsList: any = {};

export function echarts(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onBeforeValue = beforeValue;
    pen.onChangeId = changeId;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  let echarts = echartsList.echarts;
  if (!echarts && window) {
    echarts = window['echarts'];
  }
  if (!(pen as any).echarts || !echarts) {
    return;
  }

  if (typeof (pen as any).echarts === 'string') {
    try {
      (pen as any).echarts = JSON.parse((pen as any).echarts);
    } catch {}
  }
  if (!(pen as any).echarts) {
    return;
  }

  if (!echartsList[pen.id] || !echartsList[pen.id].div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    document.body.appendChild(div);

    // 2. 创建echart
    echartsList[pen.id] = {
      div,
      chart: echarts.init(div, (pen as any).echarts.theme),
    };

    // 3. 生产预览图
    // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
    setTimeout(() => {
      echartsList[pen.id].chart.setOption((pen as any).echarts.option, true);
      echartsList[pen.id].chart.resize();
      setTimeout(() => {
        const img = new Image();
        img.src = echartsList[pen.id].chart.getDataURL({
          pixelRatio: 2,
        });
        pen.calculative.img = img;
      }, 100);
    });

    // 4. 加载到div layer
    pen.calculative.canvas.externalElements &&
      pen.calculative.canvas.externalElements.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (pen.calculative.dirty && echartsList[pen.id]) {
    setElemPosition(pen, echartsList[pen.id].div);
  }
  return path;
}

function destory(pen: Pen) {
  echartsList[pen.id].div.remove();
  let echarts = echartsList.echarts;
  if (!echarts && window) {
    echarts = window['echarts'];
  }
  echarts && echarts.dispose(echartsList[pen.id].chart);
  echartsList[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
}

function resize(pen: Pen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
  echartsList[pen.id].chart.resize();
}

function value(pen: Pen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
  echartsList[pen.id].chart.setOption((pen as any).echarts.option, true);
}

function beforeValue(pen: Pen, value: ChartData) {
  if ((value as any).echarts || (!value.dataX && !value.dataY)) {
    // 整体传参，不做处理
    return value;
  }
  // 1. 拿到老的 echarts
  const echarts = (pen as any).echarts;
  const max: number = echarts.max;  // 特殊处理，值不超过 max
  // 2. 特殊处理
  let x = value.dataX;
  let y = value.dataY;
  // 确认有几条线，即多折线的场景
  const length = echarts.option.series.length;
  if (!value.overwrite) {
    // 追加数据
    if (x) {
      // x 轴考虑只有一条
      if (!Array.isArray(x)) {
        x = [x];
      }
      const xData: any[] = echarts.option.xAxis.data;
      xData.push(...x);
      // 删除开头的多余数据
      xData.splice(0, xData.length - max);
    }

    if (y) {
      if (length === 1) {
        if (!Array.isArray(y)) {
          y = [y];
        }
        const yData: any[] = echarts.option.series[0].data; 
        yData.push(...y);
        // 删除开头的多余数据
        yData.splice(0, yData.length - max);
      } else {
        // 多条线
        echarts.option.series.forEach((serie, index: number) => {
          if (!Array.isArray(y[index])) {
            y[index] = [y[index]];
          }
          const yData: any[] = serie.data;
          yData.push(...y[index]);
          // 删除开头的多余数据
          yData.splice(0, yData.length - max);
        });
      }
    }
  } else {
    // 替换数据
    if (x) {
      echarts.option.xAxis.data = x;
      echarts.option.xAxis.data.splice(0, echarts.option.xAxis.data.length - max);
    }
    if (y) {
      if (length === 1) {
        echarts.option.series[0].data = y;
        echarts.option.series[0].data.splice(0, echarts.option.series[0].data.length - max);
      } else {
        // 多条线
        echarts.option.series.forEach((serie, index: number) => {
          serie.data = y[index];
          serie.data.splice(0, serie.data.length - max);
        });
      }
    }
  }
  // 3. 设置完后，清空
  delete value.dataX;
  delete value.dataY;
  delete value.overwrite;
  return Object.assign(value, { echarts });
}

function changeId(pen: Pen, oldId: string, newId: string) {
  if (!echartsList[oldId]) {
    return;
  }
  echartsList[newId] = echartsList[oldId];
  delete echartsList[oldId];
}
