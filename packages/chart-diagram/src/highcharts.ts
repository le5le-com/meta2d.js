import { ChartData, Pen, setElemPosition } from '@meta2d/core';
// TODO: 只引入 Chart 作为类型，开发时使用，上传需注释
// import { Chart } from 'highcharts';

export function highcharts(pen: Pen): Path2D {
  const Highcharts = globalThis.Highcharts;
  if (!Highcharts) {
    return;
  }

  if (typeof (pen as any).highcharts === 'string') {
    try {
      (pen as any).highcharts = JSON.parse((pen as any).highcharts.option);
    } catch (e) {}
  }
  if (!(pen as any).highcharts) {
    return;
  }

  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onBeforeValue = beforeValue;
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
    div.style.minWidth = '100px';
    div.style.minHeight = '100px';

    div.id = pen.id;
    document.body.appendChild(div);
    pen.calculative.singleton.div = div;

    setTimeout(() => {
      pen.calculative.singleton.highchart = Highcharts.chart(
        pen.id,
        (pen as any).highcharts.option
      );
    });

    // 4. 加载到div layer
    pen.calculative.canvas.externalElements?.appendChild(div);
    setElemPosition(pen, div);
  }

  path.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);

  if (pen.calculative.patchFlags && pen.calculative.singleton.div) {
    setElemPosition(pen, pen.calculative.singleton.div);
  }
  return path;
}

function destory(pen: Pen) {
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    pen.calculative.singleton.highchart.destroy();

    delete pen.calculative.singleton.div;
    delete pen.calculative.singleton.highchart;
  }
}

function move(pen: Pen) {
  if (!pen.calculative.singleton.div) {
    return;
  }
  setElemPosition(pen, pen.calculative.singleton.div);
}

function resize(pen: Pen) {
  if (!pen.calculative.singleton.div) {
    return;
  }
  setElemPosition(pen, pen.calculative.singleton.div);
  setTimeout(() => {
    pen.calculative.singleton.highchart.reflow();
  }, 100);
}

function value(pen: Pen) {
  if (!pen.calculative.singleton.div) {
    return;
  }
  setElemPosition(pen, pen.calculative.singleton.div);
}

function beforeValue(pen: Pen, value: ChartData): any {
  if ((value as any).highcharts) {
    const chart = pen.calculative.singleton.highchart;
    chart.update((value as any).highcharts.option);
    return value;
  } else if (!value.dataX && !value.dataY) {
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
    // xs ys 适用与 addPoint
    let xs: number[] = [];
    // // [0] 是第一条线； [1] 是第二条线
    let ys: number[][] = null;
    let isCategory = false;
    if (x) {
      // x 轴考虑只有一条
      if (!Array.isArray(x)) {
        x = [x];
      }
      // xAxis 存在数组的情况，只考虑 单 x 轴的情况
      const xAxis = highcharts.option.xAxis;
      const xData: any[] = Array.isArray(xAxis)
        ? xAxis[0].categories
        : xAxis.categories;
      if (xData) {
        // categories 存在，手动添加 category
        // 只更改数据，不更新视图
        xData.push(...x);
        // 删除开头的多余数据
        xData.splice(0, xData.length - max);
        isCategory = true;
      }

      // 记录 x ，后续用来更新视图
      xs = [...x];
    }

    if (y) {
      if (length === 1) {
        if (!Array.isArray(y)) {
          y = [y];
        }
        ys = [y];
      } else {
        // 多条线
        ys = [];
        highcharts.option.series.forEach((serie, index: number) => {
          if (!Array.isArray(y[index])) {
            y[index] = [y[index]];
          }
          ys.push(y[index]);
        });
      }
    }
    if (ys) {
      const chart = pen.calculative.singleton.highchart;
      chart.series.forEach((serie, index: number) => {
        ys[index].forEach((y, index2: number) => {
          let shift = false; // 是否扔掉第一个
          if (max && serie.data.length >= max) {
            shift = true;
          }
          const point: number[] | number =
            isCategory || xs[index2] == undefined ? y : [xs[index2], y];
          serie.addPoint(point, true, shift);
        });
      });
    }
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
    // 更新视图
    const chart = pen.calculative.singleton.highchart;
    chart.update(highcharts.option);
  }
  // 3. 设置完后，清空
  delete value.dataX;
  delete value.dataY;
  delete value.overwrite;
  return Object.assign(value, { highcharts });
}
