import {
  BindId,
  ChartData,
  deepClone,
  FormItem,
  IValue,
  Pen,
  setElemPosition,
} from '@meta2d/core';
import type { EChartOption } from 'echarts';
// tslint:disable-next-line:no-duplicate-imports
import { deepSetValue } from '@meta2d/core';
import { getter } from '@meta2d/core/src/utils/object';
import { formatTime } from '@meta2d/core/src/utils/time';

export enum ReplaceMode {
  Add,
  Replace,
  ReplaceAll,
}
let keyWords = [
  'fontSize',
  'nameGap',
  'margin',
  'width'/*线条宽度*/,
  'symbolSize'/*结点大小*/,
  'itemWidth', // 图例宽度
  'itemHeight', // 图例高度
  'fontWeight',
  'top',
  'left',
  'right',
  'bottom',
  'zoom',
  'edgeSymbolSize',
  'nodeWidth',
  'nodeGap',
  'distance',
  'length',
  'length2',
  'offsetCenter',
  'size',
  'symbolOffset',
  'padding',
  'barWidth',
  'symbolOffset',
  'shadowOffsetY',
  'shadowOffsetX',
];

export interface ChartPen extends Pen {
  echarts: {
    option: EChartOption; // echarts 参数
    max: number; // 最大数据量
    replaceMode: ReplaceMode; // 替换模式
    theme: string; // 主题
    timeFormat: string; //格式化
    geoName?: string;
    geoJson?: any;
    geoUrl?: string;
  };
  // beforeScale: number;
}

export function echarts(pen: ChartPen): Path2D {
  let echarts = globalThis.echarts;
  if (!pen.echarts || !echarts) {
    return;
  }

  if (typeof pen.echarts === 'string') {
    try {
      pen.echarts = JSON.parse(pen.echarts);
    } catch (e) {}
  }
  if (!pen.echarts) {
    return;
  }
  keyWords =
    pen.calculative.canvas.store.options.diagramOptions['chart']?.keyWords ||
    keyWords;
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onBeforeValue = beforeValue;
    pen.onBinds = binds;
    pen.onMouseEnter = move;
    // pen.onAdd = onAdd;
    pen.onRenderPenRaw = onRenderPenRaw;
  }

  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;

  if (!pen.calculative.singleton.div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    document.body.appendChild(div);
    // 2. 加载到div layer
    pen.calculative.canvas.externalElements?.parentElement.appendChild(div);
    setElemPosition(pen, div);

    // 3. 解析echarts数据
    pen.calculative.singleton.div = div;
    pen.calculative.singleton.echart = echarts.init(div, pen.echarts.theme);
    pen.calculative.singleton.echartsReady = true;
    if (pen.echarts.geoName && !echarts.getMap(pen.echarts.geoName)) {
      if (pen.echarts.geoJson) {
        echarts.registerMap(pen.echarts.geoName, pen.echarts.geoJson);
      } else if (pen.echarts.geoUrl) {
        pen.calculative.singleton.echartsReady = false;
        fetch(pen.echarts.geoUrl).then((e) => {
          e.text().then((data: any) => {
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch {}
            }
            if (data.constructor !== Object && data.constructor !== Array) {
              console.warn('Invalid data:', data);
              return;
            }
            echarts.registerMap(pen.echarts.geoName, data);
            pen.calculative.singleton.echartsReady = true;
            pen.calculative.singleton.echart.setOption(
              updateOption(
                pen.echarts.option,
                pen.calculative.canvas.store.data.scale
              ),
              true
            );
            pen.calculative.singleton.echart.resize();
            setTimeout(() => {
              onRenderPenRaw(pen);
            }, 300);
          });
        });
      }
    }

    // 4. 加载echarts
    if (pen.calculative.singleton.echartsReady) {
      // 初始化时，等待父div先渲染完成，避免初始图表控件太大。
      setTimeout(() => {
        pen.calculative.singleton.echart.setOption(
          updateOption(
            pen.echarts.option,
            pen.calculative.canvas.store.data.scale
          ),
          true
        );
        setTimeout(() => onRenderPenRaw(pen), 300);
      });
    }
  }

  return path;
}

// function onAdd(pen: ChartPen) {
//   // pen.beforeScale = pen.calculative.canvas.store.data.scale;
// }

function destory(pen: Pen) {
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    let echarts = globalThis.echarts;
    echarts && echarts.dispose(pen.calculative.singleton.echart);

    delete pen.calculative.singleton.div;
    delete pen.calculative.singleton.echart;
  }
}

function move(pen: Pen) {
  pen.calculative.singleton.div &&
    setElemPosition(pen, pen.calculative.singleton.div);
}

function resize(pen: ChartPen) {
  if (!pen.calculative.singleton.echart) {
    return;
  }
  let echarts = globalThis.echarts;
  setElemPosition(pen, pen.calculative.singleton.div);
  // let option = pen.echarts.option;
  // if (!pen.beforeScale) {
  //   pen.beforeScale = pen.calculative.canvas.store.data.scale;
  // }
  // let ratio: number = pen.calculative.canvas.store.data.scale / pen.beforeScale;
  // updateOption(option, ratio);
  if (pen.echarts.geoName && !echarts.getMap(pen.echarts.geoName)) return;
  pen.calculative.singleton.echart.setOption(
    updateOption(pen.echarts.option, pen.calculative.canvas.store.data.scale),
    true
  );
  // pen.beforeScale = pen.calculative.canvas.store.data.scale;
  pen.calculative.singleton.echart.resize();
}

function value(pen: ChartPen) {
  if (!pen.calculative.singleton.echart) {
    return;
  }
  setElemPosition(pen, pen.calculative.singleton.div);
  pen.calculative.singleton.echartsReady &&
    pen.calculative.singleton.echart.setOption(
      updateOption(pen.echarts.option, pen.calculative.canvas.store.data.scale),
      true
    );
}

function beforeValue(pen: ChartPen, value: any) {
  if ((value as any).echarts) {
    let echarts = globalThis.echarts;
    if (value.echarts.geoName && !echarts.getMap(value.echarts.geoName)) {
      if (value.echarts.geoJson) {
        echarts.registerMap(value.echarts.geoName, value.echarts.geoJson);
      } else if (value.echarts.geoUrl) {
        pen.calculative.singleton.echartsReady = false;
        fetch(value.echarts.geoUrl).then((e) => {
          e.text().then((data: any) => {
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch {}
            }
            if (data.constructor !== Object && data.constructor !== Array) {
              console.warn('Invalid data:', data);
              return;
            }
            echarts.registerMap(value.echarts.geoName, data);
            pen.calculative.singleton.echartsReady = true;
           // @ts-ignore
            pen.onValue(pen);
            return false;
          });
        });
      }
    }
    // 整体传参，不做处理
    return value;
  }
  if (pen.realTimes && pen.realTimes.length) {
    const { xAxis, yAxis } = pen.echarts.option;
    const { max, replaceMode, timeFormat } = pen.echarts;

    for (let key in value) {
      if (key.includes('echarts.option')) {
        let beforeV = getter(pen, key);
        if (Array.isArray(beforeV) && replaceMode === ReplaceMode.Add) {
          //追加
          beforeV.push(value[key]);
          if (max) {
            beforeV.splice(0, beforeV.length - max);
          }
          value[key] = beforeV;
          let _key = 'echarts.option.xAxis.data';
          if (Array.isArray(xAxis) && xAxis.length) {
            _key = 'echarts.option.xAxis.0.data';
          }
          let _value = getter(pen, _key);
          let _time = formatTime(
            timeFormat || '`${hours}:${minutes}:${seconds}`'
          );
          _value.push(_time);
          if (max) {
            _value.splice(0, _value.length - max);
          }
          value[_key] = _value;
        }
      }
    }
    return value;
  }
  if (!value.dataX && !value.dataY) {
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
  const { xAxis, yAxis } = echarts.option;
  if (Array.isArray(xAxis) && xAxis.length > 1) {
    // 多 x 轴不考虑
    console.warn('echarts 只支持单 x 轴，多 x 轴将被忽略');
  }
  // 单 x 轴
  const oneXAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis;
  const oneYAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis;
  if (!replaceMode) {
    // 追加数据
    if (x) {
      // x 轴考虑只有一条
      !Array.isArray(x) && (x = [x]);
      // TODO: Y 轴是分类，x 轴是值，追加不考虑
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
    if (!oneXAxis && !oneYAxis) {
      /**
       * 饼图、仪表盘等
       */
      if (y) {
        if (length === 1) {
          !Array.isArray(y) && (y = [y]);
          // 单饼
          y.forEach((yItem, index: number) => {
            const part = (
              series[0].data as EChartOption.SeriesSunburst.DataObject[]
            ).find((part) => part.name === yItem.name);
            part && (part.value = yItem.value);
          });
        } else {
          // 多饼图
          series.forEach((serie, index: number) => {
            if (!Array.isArray(y[index])) {
              y[index] = [y[index]];
            }
            y[index].forEach((yItem, index: number) => {
              const part = (
                serie.data as EChartOption.SeriesSunburst.DataObject[]
              ).find((part) => part.name === yItem.name);
              part && (part.value = yItem.value);
            });
          });
        }
      }
    } else if (oneXAxis.type === 'category' || oneYAxis.type === 'category') {
      /**
       * dataX 中传的值用来找到对应的 y 轴值
       */
      if (x && y) {
        const categoryData =
          oneXAxis.type === 'category' ? oneXAxis.data : oneYAxis.data;
        !Array.isArray(x) && (x = [x]);
        !Array.isArray(y) && (y = [y]);
        if (length === 1) {
          y.forEach((yItem, index: number) => {
            const xIndex = categoryData.indexOf(x[index]);
            series[0].data[xIndex] = yItem;
          });
        } else {
          // 多条线
          series.forEach((serie, index: number) => {
            y[index].forEach((yItem, index: number) => {
              const xIndex = categoryData.indexOf(x[index]);
              serie.data[xIndex] = yItem;
            });
          });
        }
      }
    }
  } else if (replaceMode === ReplaceMode.ReplaceAll) {
    // 替换数据
    if (x) {
      // TODO: Y 轴是分类，x 轴是值，替换全部不考虑
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

function binds(pen: ChartPen, values: IValue[], formItem: FormItem): IValue {
  if (formItem.key !== 'dataY') {
    return;
  }
  // 1. 拿到老的 echarts
  const echarts = pen.echarts;
  const { xAxis, yAxis } = echarts.option;
  if (Array.isArray(xAxis) && xAxis.length > 1) {
    // 多 x 轴不考虑
    console.warn('echarts 只支持单 x 轴，多 x 轴将被忽略');
  }
  // 单 x 轴
  const oneXAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis;
  const oneYAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis;
  const series = echarts.option.series;
  if (!oneXAxis && !oneYAxis) {
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
      return {
        id: pen.id,
        dataY,
      };
    } else {
      // TODO: 多个饼待考虑
    }
  } else if (oneXAxis.type === 'category' || oneYAxis.type === 'category') {
    // 根据 x 轴的类型排序 dataY
    const dataY: number[] = [],
      dataX = [];
    const categoryData =
      oneXAxis.type === 'category' ? oneXAxis.data : oneYAxis.data;
    categoryData?.forEach((category: string) => {
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
    return {
      id: pen.id,
      dataY,
      dataX,
    };
  } else if (oneXAxis.type === 'time') {
    // TODO: Y 轴时间不考虑
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
          const last = series[index].data[series[index].data.length - 1];
          // series[index].data.at(-1) 92 版本 chrome 才支持
          // 0 时间， 1 值
          dataY[index] = [[now, last[1]]];
        }
      });
    } else {
      return;
    }
    return {
      id: pen.id,
      dataY: dataY.length === 1 ? dataY[0] : dataY,
    };
  }
  return;
}

/**
 * 配置 echarts option, 并修改 replaceMode
 * @param pen 当前画笔
 * @param ids 绑定 id 数组
 * @param isTime 是否实时，用于折线图与柱状图，若实时多条线
 * @param isYCategory 是否 Y 轴为 category，用于折线图与柱状图
 */
export function setEchartsOption(
  pen: ChartPen,
  ids: BindId[],
  isTime: boolean = false,
  isYCategory: boolean = false
) {
  if (pen.name !== 'echarts') {
    console.warn('当前画笔不是 echarts');
    return;
  }
  // 该画笔类型是 echarts
  const echarts = pen.echarts;
  const { xAxis, yAxis } = echarts.option;
  // 单 x 轴
  const oneXAxis = Array.isArray(xAxis) ? xAxis[0] : xAxis;
  const oneYAxis = Array.isArray(yAxis) ? yAxis[0] : yAxis;
  const series = echarts.option.series;
  if (!oneXAxis && !oneYAxis) {
    /**
     * 饼图、仪表盘等
     */
    // 单饼图
    echarts.option.legend = {};
    series[0].data = ids.map((id) => {
      return {
        name: id.name,
        value: 100, // TODO: 该值为初始值
      };
    });
  } else {
    if (isTime) {
      // TODO: 时间类型，只可以 x 轴是时间
      // x 轴时间
      const yType = series[0].type; // 类型，折线或柱状
      const now = +new Date();
      // x 轴时间，若选择多个，即为多线图
      oneXAxis.type = 'time';
      oneXAxis.data = [];
      oneYAxis.type = 'value';
      oneYAxis.data = [];
      echarts.option.legend = {};
      echarts.option.series = ids.map((id) => {
        return {
          name: id.name,
          type: yType,
          data: [[now, 0]], // TODO: 初始值
        };
      });
      echarts.replaceMode = ReplaceMode.Add; // 追加
    } else {
      // x 轴分类，或 y 轴分类
      const [categoryAxis, valueAxis] = isYCategory
        ? [oneYAxis, oneXAxis]
        : [oneXAxis, oneYAxis];
      categoryAxis.type = 'category';
      categoryAxis.data = ids.map((id) => id.name);
      valueAxis.type = 'value';
      valueAxis.data = [];
      series.length = 1;
      series[0].data.length = ids.length;
      echarts.replaceMode = ReplaceMode.Replace; // 替换
    }
  }
  const meta2d = pen.calculative.canvas.parent;
  meta2d.setValue({ id: pen.id, echarts }, { render: false, doEvent: false });
}

function onRenderPenRaw(pen: Pen) {
  const img = new Image();
  img.src = pen.calculative.singleton?.echart?.getDataURL({
    pixelRatio: 2,
  });
  pen.calculative.img = img;
}

function updateOption(_option, ratio) {
  const option = deepClone(_option);
  // if (option.grid) {
  //   let props = ['top', 'bottom', 'left', 'right'];
  //   for (let i = 0; i < props.length; i++) {
  //     if (Array.isArray(option.grid)) {
  //       option.grid.forEach((item) => {
  //         if (!isNaN(item[props[i]])) {
  //           item[props[i]] *= ratio;
  //         }
  //       });
  //     } else {
  //       if (!isNaN(option.grid[props[i]])) {
  //         option.grid[props[i]] *= ratio;
  //       }
  //     }
  //   }
  // }

  if (option.dataZoom) {
    let props = ['right', 'top', 'width', 'height', 'left', 'bottom'];
    for (let i = 0; i < props.length; i++) {
      option.dataZoom.forEach((item) => {
        if (!isNaN(item[props[i]])) {
          item[props[i]] *= ratio;
        }
      });
    }
  }
  deepSetValue(option, keyWords, ratio);
  return option;
}
