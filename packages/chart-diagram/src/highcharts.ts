import { ChartData, Pen, setElemPosition } from '@topology/core';

export const highchartsList: {
  Highcharts: any;
  [id: string]: {
    div: HTMLDivElement;
    chart: any;
  };
} = {
  Highcharts: undefined,
};

export function highcharts(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onChangeId = changeId;
    pen.onBeforeValue = beforeValue;
  }

  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;
  if (!highchartsList.Highcharts && window) {
    highchartsList.Highcharts = window['Highcharts'];
  }
  if (!(pen as any).highcharts || !highchartsList.Highcharts) {
    return;
  }

  if (typeof (pen as any).highcharts === 'string') {
    try {
      (pen as any).highcharts = JSON.parse((pen as any).highcharts.option);
    } catch {}
  }
  if (!(pen as any).highcharts) {
    return;
  }

  if (!highchartsList[pen.id] || !highchartsList[pen.id].div) {
    // 1. 创建父容器
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    div.style.minWidth = '100px';
    div.style.minHeight = '100px';

    div.id = pen.id;
    document.body.appendChild(div);

    highchartsList[pen.id] = {
      div,
      chart: undefined,
    };
    setTimeout(() => {
      highchartsList[pen.id].chart = highchartsList.Highcharts.chart(
        pen.id,
        (pen as any).highcharts.option
      );
    });

    // 4. 加载到div layer
    pen.calculative.canvas.externalElements?.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (pen.calculative.dirty && highchartsList[pen.id]) {
    setElemPosition(pen, highchartsList[pen.id].div);
  }
  return path;
}

function destory(pen: Pen) {
  highchartsList[pen.id].div.remove();
  const chart = highchartsList[pen.id].chart;
  chart.destroy();
  highchartsList[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, highchartsList[pen.id].div);
}

function resize(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, highchartsList[pen.id].div);
  highchartsList[pen.id].chart.reflow();
}

function value(pen: Pen) {
  if (!highchartsList[pen.id]) {
    return;
  }
  setElemPosition(pen, highchartsList[pen.id].div);
  // highchartsList[pen.id].chart = highchartsList.Highcharts.chart(
  //   pen.id,
  //   (pen as any).highcharts.option
  // );
}

function changeId(pen: Pen, oldId: string, newId: string) {
  if (!highchartsList[oldId]) {
    return;
  }
  highchartsList[oldId].div.id = newId;
  highchartsList[newId] = highchartsList[oldId];
  delete highchartsList[oldId];
}

function beforeValue(pen: Pen, value: ChartData): any {
  if ((value as any).highcharts || (!value.dataX && !value.dataY)) {
    const chart = highchartsList[pen.id].chart;
    chart.update((value as any).highcharts.option);
    // 整体传参，不做处理
    return value;
  }
  // 1. 拿到老的 echarts
  const highcharts = (pen as any).highcharts;
  const max: number = highcharts.max; // 特殊处理，值不超过 max
  // 2. 特殊处理
  let x = value.dataX;
  let y = value.dataY;
  // 确认有几条线，即多折线的场景
  const length = highcharts.option.series.length;
  if (!value.overwrite) {
    // 追加数据
    // TODO: xs ys 适用与 addPoint
    // let xs: number[] = null;
    // // [0] 是第一条线； [1] 是第二条线
    // let ys: number[][] = null;
    if (x) {
      // x 轴考虑只有一条
      if (!Array.isArray(x)) {
        x = [x];
      }
      const xData: any[] = highcharts.option.xAxis.categories;
      // 只更改数据，不更新视图
      xData.push(...x);
      // 删除开头的多余数据
      xData.splice(0, xData.length - max);

      // 记录 x ，后续用来更新视图
      // xs = [...x];
    }

    if (y) {
      if (length === 1) {
        if (!Array.isArray(y)) {
          y = [y];
        }
        const yData: any[] = highcharts.option.series[0].data;
        yData.push(...y);
        // 删除开头的多余数据
        yData.splice(0, yData.length - max);

        // ys = [y];
      } else {
        // 多条线
        // ys = [];
        highcharts.option.series.forEach((serie, index: number) => {
          if (!Array.isArray(y[index])) {
            y[index] = [y[index]];
          }
          const yData: any[] = serie.data;
          yData.push(...y[index]);
          // 删除开头的多余数据
          yData.splice(0, yData.length - max);

          // ys.push(y[index]);
        });
      }
    }
    // TODO: 效果更好， 数据会乱
    // if (ys) {
    //   const chart = highchartsList[pen.id].chart;
    //   chart.series.forEach((serie, index: number) => {
    //     ys[index].forEach((y, index2: number) => {
    //       const point: number[] | number = xs[index2] ? [xs[index2], y] : y;
    //       serie.addPoint(point, true, false);
    //     });
    //   });
    // }
  } else {
    // 替换数据
    if (x) {
      highcharts.option.xAxis.categories = x;
      highcharts.option.xAxis.categories.splice(
        0,
        highcharts.option.xAxis.categories.length - max
      );
    }
    if (y) {
      if (length === 1) {
        highcharts.option.series[0].data = y;
        highcharts.option.series[0].data.splice(
          0,
          highcharts.option.series[0].data.length - max
        );
      } else {
        // 多条线
        highcharts.option.series.forEach((serie, index: number) => {
          serie.data = y[index];
          serie.data.splice(0, serie.data.length - max);
        });
      }
    }
  }
  // 更新视图
  const chart = highchartsList[pen.id].chart;
  chart.update(highcharts.option);
  // 3. 设置完后，清空
  delete value.dataX;
  delete value.dataY;
  delete value.overwrite;
  return Object.assign(value, { highcharts });
}
