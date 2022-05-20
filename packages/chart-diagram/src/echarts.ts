import {
  BindId,
  ChartData,
  FormItem,
  IValue,
  Pen,
  setElemPosition,
} from '@topology/core';

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}

type XAxisType = {
  data: any[];
  type: string;
};

export interface ChartPen extends Pen {
  echarts: {
    option: {
      xAxis: XAxisType | XAxisType[];
      series: {
        data: any[];
        name: string;
        type: string; // 线类型
      }[];
      legend: {
        data?: any[];
      };
    }; // echarts 参数
    max: number; // 最大数据量
    replaceMode: ReplaceMode; // 替换模式
    theme: string; // 主题
  };
}

export const echartsList: {
  echarts: any;
  [id: string]: {
    div: HTMLDivElement;
    chart: any;
  };
} = {
  echarts: undefined,
};

export function echarts(pen: ChartPen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onBeforeValue = beforeValue;
    pen.onChangeId = changeId;
    pen.onBinds = binds;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  let echarts = echartsList.echarts;
  if (!echarts && window) {
    echarts = window['echarts'];
  }
  if (!pen.echarts || !echarts) {
    return;
  }

  if (typeof pen.echarts === 'string') {
    try {
      pen.echarts = JSON.parse(pen.echarts);
    } catch {}
  }
  if (!pen.echarts) {
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
      chart: echarts.init(div, pen.echarts.theme),
    };

    // 3. 生产预览图
    // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
    setTimeout(() => {
      echartsList[pen.id].chart.setOption(pen.echarts.option, true);
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
    pen.calculative.canvas.externalElements?.appendChild(div);
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

function value(pen: ChartPen) {
  if (!echartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, echartsList[pen.id].div);
  echartsList[pen.id].chart.setOption(pen.echarts.option, true);
}

function beforeValue(pen: ChartPen, value: ChartData) {
  if ((value as any).echarts || (!value.dataX && !value.dataY)) {
    // 整体传参，不做处理
    return value;
  }
  // 1. 拿到老的 echarts
  const echarts = pen.echarts;
  const { max, replaceMode } = echarts;
  // 2. 特殊处理
  // x，y 需要判空, 此处不转换数组
  let x = value.dataX;
  let y = value.dataY;
  const series = echarts.option.series;
  // 确认有几条线，即多折线的场景
  const length = series.length;
  const xAxis = echarts.option.xAxis;
  if (Array.isArray(xAxis) && xAxis.length > 1) {
    // 多 x 轴不考虑
    console.warn('echarts 只支持单 x 轴，多 x 轴将被忽略');
  }
  // 单 x 轴
  const oneXAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis;
  if (!replaceMode) {
    // 追加数据
    if (x) {
      // x 轴考虑只有一条
      !Array.isArray(x) && (x = [x]);
      const xData = oneXAxis.data;
      xData.push(...x);
      // 删除开头的多余数据
      xData.splice(0, xData.length - max);
    }

    if (y) {
      if (length === 1) {
        !Array.isArray(y) && (y = [y]);
        const yData = series[0].data;
        yData.push(...y);
        // 删除开头的多余数据
        yData.splice(0, yData.length - max);
      } else {
        // 多条线
        series.forEach((serie, index: number) => {
          if (!Array.isArray(y[index])) {
            y[index] = [y[index]];
          }
          const yData = serie.data;
          yData.push(...y[index]);
          // 删除开头的多余数据
          yData.splice(0, yData.length - max);
        });
      }
    }
  } else if (replaceMode === ReplaceMode.Replace) {
    // 替换部分数据
    if (!oneXAxis) {
      /**
       * 饼图、仪表盘等
       */
      if (y) {
        if (length === 1) {
          !Array.isArray(y) && (y = [y]);
          // 单饼
          y.forEach((yItem, index: number) => {
            const part = series[0].data.find(
              (part) => part.name === yItem.name
            );
            part && (part.value = yItem.value);
          });
        } else {
          // 多饼图
          series.forEach((serie, index: number) => {
            if (!Array.isArray(y[index])) {
              y[index] = [y[index]];
            }
            y[index].forEach((yItem, index: number) => {
              const part = serie.data.find((part) => part.name === yItem.name);
              part && (part.value = yItem.value);
            });
          });
        }
      }
    } else if (oneXAxis.type === 'category') {
      /**
       * dataX 中传的值用来找到对应的 y 轴值
       */
      if (x && y) {
        !Array.isArray(x) && (x = [x]);
        !Array.isArray(y) && (y = [y]);
        if (length === 1) {
          y.forEach((yItem, index: number) => {
            const xIndex = oneXAxis.data.indexOf(x[index]);
            series[0].data[xIndex] = yItem;
          });
        } else {
          // 多条线
          series.forEach((serie, index: number) => {
            y[index].forEach((yItem, index: number) => {
              const xIndex = oneXAxis.data.indexOf(x[index]);
              serie.data[xIndex] = yItem;
            });
          });
        }
      }
    }
  } else if (replaceMode === ReplaceMode.ReplaceAll) {
    // 替换数据
    if (x) {
      oneXAxis.data = x;
      oneXAxis.data.splice(0, oneXAxis.data.length - max);
    }
    if (y) {
      if (length === 1) {
        series[0].data = y;
        series[0].data.splice(0, series[0].data.length - max);
      } else {
        // 多条线
        series.forEach((serie, index: number) => {
          serie.data = y[index];
          serie.data.splice(0, serie.data.length - max);
        });
      }
    }
  }
  // 3. 设置完后，清空
  delete value.dataX;
  delete value.dataY;
  return Object.assign(value, { echarts });
}

function changeId(pen: Pen, oldId: string, newId: string) {
  if (!echartsList[oldId]) {
    return;
  }
  echartsList[newId] = echartsList[oldId];
  delete echartsList[oldId];
}

// TODO: 等测试稳定后再清除日志
function binds(pen: ChartPen, values: IValue[], formItem: FormItem): IValue[] {
  // 1. 拿到老的 echarts
  const echarts = pen.echarts;
  const xAxis = echarts.option.xAxis;
  if (Array.isArray(xAxis) && xAxis.length > 1) {
    // 多 x 轴不考虑
    console.warn('echarts 只支持单 x 轴，多 x 轴将被忽略');
  }
  // 单 x 轴
  const oneXAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis;
  const series = echarts.option.series;
  if (!oneXAxis) {
    /**
     * 饼图、仪表盘等
     */
    const dataY = [];
    // 单个饼
    if (Array.isArray(series) && series.length === 1) {
      series[0].data.forEach((item) => {
        const { dataId: id } = (formItem.dataIds as BindId[]).find(
          (dataId) => dataId.name === item.name
        );
        if (id) {
          const value = values.find((value) => value.dataId === id);
          if (value) {
            dataY.push({
              name: item.name,
              value: value.value,
            });
          }
        }
      });
      console.log('单饼图 dataY', JSON.stringify(dataY));
      return [
        {
          id: pen.id,
          dataY,
        },
      ];
    } else {
      // TODO: 多个饼待考虑
    }
  } else if (oneXAxis.type === 'category') {
    // 根据 x 轴的类型排序 dataY
    const dataY: number[] = [],
      dataX = [];
    oneXAxis.data.forEach((category: string) => {
      const { dataId: id } = (formItem.dataIds as BindId[]).find(
        (dataId) => dataId.name === category
      );
      if (id) {
        const value = values.find((value) => value.dataId === id);
        if (value) {
          dataX.push(category);
          dataY.push(value.value);
        }
      }
    });
    console.log('dataX', JSON.stringify(dataX), 'dataY', JSON.stringify(dataY));
    return [
      {
        id: pen.id,
        dataY,
        dataX,
      },
    ];
  } else if (oneXAxis.type === 'time') {
    // x 轴时间
    const dataY: any[][] = [];
    const now = +new Date();
    let hasValue = false;
    series.forEach((serie, index: number) => {
      const oneDataY = [];
      const { dataId: id } = (formItem.dataIds as BindId[]).find(
        (dataId) => dataId.name === serie.name
      );
      if (id) {
        const value = values.find((value) => value.dataId === id);
        if (value) {
          oneDataY.push([now, value.value]);
          hasValue = true;
        }
      }
      dataY[index] = oneDataY;
    });
    if (hasValue) {
      // 说明有线有值，无值的线补充一个原值，保证每条线每个时间点都有值
      dataY.forEach((oneDataY, index: number) => {
        if (!oneDataY || oneDataY.length === 0) {
          // 0 时间， 1 值
          dataY[index] = [[now, series[index].data.at(-1)[1]]];
        }
      });
    } else {
      return [];
    }
    console.log(
      'series',
      JSON.stringify(series.map((serie) => serie.name)),
      'dataY',
      JSON.stringify(dataY)
    );
    return [
      {
        id: pen.id,
        dataY: dataY.length === 1 ? dataY[0] : dataY,
      },
    ];
  }
}
