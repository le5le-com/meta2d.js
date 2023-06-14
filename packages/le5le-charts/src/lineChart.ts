import { coordinateAxis } from './coordinateAxis';
import { leChartPen, ReplaceMode } from './common';

//折线图
export function lineChart(ctx: CanvasRenderingContext2D, pen: leChartPen) {
  if (!pen.onBeforeValue) {
    pen.onBeforeValue = beforeValue;
  }
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  let series = [];
  if (pen.echarts && !pen.echarts.option.color) {
    pen.echarts.option.color = [
      '#1890ff',
      '#2FC25B',
      '#FACC14',
      '#c23531',
      '#2f4554',
      '#61a0a8',
      '#d48265',
    ];
  }
  let coordinate = coordinateAxis(ctx, pen);
  let dash = coordinate.dash;
  let normalizedOption = coordinate.normalizedOption;
  //数据值绘制
  const smooth = (
    pen.echarts ? pen.echarts.option.series[0].smooth : pen.smooth
  )
    ? true
    : false;
  let coordinateValue = [];
  if (pen.echarts) {
    for (let i = 0; i < pen.echarts.option.series.length; i++) {
      series.push(pen.echarts.option.series[i].data);
    }
  } else {
    series = pen.data;
  }
  for (let j = 0; j < series.length; j++) {
    ctx.beginPath();
    let data = series[j];
    ctx.strokeStyle = pen.echarts
      ? pen.echarts.option.color[j]
      : pen.chartsColor[j];
    ctx.fillStyle = pen.echarts
      ? pen.echarts.option.color[j]
      : pen.chartsColor[j];
    let currentX = x + (1 + dash / 2);
    let currentY =
      y +
      h -
      ((data[0] - normalizedOption.min) /
        (normalizedOption.max - normalizedOption.min)) *
        h;
    ctx.moveTo(currentX, currentY);
    coordinateValue.push({ x: currentX, y: currentY });

    if (smooth) {
      //平滑的曲线
      if (data.length <= 2) {
        //小于两个点的情况无法构成贝塞尔
        for (let i = 1; i < data.length; i++) {
          currentX = x + (1 + dash / 2) + (dash + 1) * i;
          currentY =
            y +
            h -
            ((data[i] - normalizedOption.min) /
              (normalizedOption.max - normalizedOption.min)) *
              h;
          ctx.lineTo(currentX, currentY);
          coordinateValue.push({ x: currentX, y: currentY });
        }
      } else {
        let cAx: number, cAy: number, cBx: number, cBy: number;
        data.forEach((item: number, index: number) => {
          currentX = x + (1 + dash / 2) + (dash + 1) * index;
          currentY =
            y +
            h -
            ((data[index] - normalizedOption.min) /
              (normalizedOption.max - normalizedOption.min)) *
              h;
          let last1x = x + (1 + dash / 2) + (dash + 1) * (index + 1);
          let last1y =
            y +
            h -
            ((data[index + 1] - normalizedOption.min) /
              (normalizedOption.max - normalizedOption.min)) *
              h;
          let before1x = x + (1 + dash / 2) + (dash + 1) * (index - 1);
          let before1y =
            y +
            h -
            ((data[index - 1] - normalizedOption.min) /
              (normalizedOption.max - normalizedOption.min)) *
              h;
          let last2x = x + (1 + dash / 2) + (dash + 1) * (index + 2);
          let last2y =
            y +
            h -
            ((data[index + 2] - normalizedOption.min) /
              (normalizedOption.max - normalizedOption.min)) *
              h;
          if (index === 0) {
            //第一个节点 用自己代替前一个节点
            before1x = x + (1 + dash / 2) + (dash + 1) * index;
            before1y =
              y +
              h -
              ((data[index] - normalizedOption.min) /
                (normalizedOption.max - normalizedOption.min)) *
                h;
          } else if (index === data.length - 2) {
            //倒数第二个节点 用下一个节点替代下下个节点
            last2x = x + (1 + dash / 2) + (dash + 1) * (index + 1);
            last2y =
              y +
              h -
              ((data[index + 1] - normalizedOption.min) /
                (normalizedOption.max - normalizedOption.min)) *
                h;
          }
          coordinateValue.push({ x: currentX, y: currentY });
          cAx = currentX + (last1x - before1x) / 4;
          cAy = currentY + (last1y - before1y) / 4;
          cBx = last1x - (last2x - currentX) / 4;
          cBy = last1y - (last2y - currentY) / 4;
          ctx.bezierCurveTo(cAx, cAy, cBx, cBy, last1x, last1y);
          //绘制到下一个节点的贝塞尔曲线
        });
      }
    } else {
      for (let i = 1; i < data.length; i++) {
        currentX = x + (1 + dash / 2) + (dash + 1) * i;
        currentY =
          y +
          h -
          ((data[i] - normalizedOption.min) /
            (normalizedOption.max - normalizedOption.min)) *
            h;
        ctx.lineTo(currentX, currentY);
        coordinateValue.push({ x: currentX, y: currentY });
      }
    }
    ctx.stroke();
    ctx.closePath();
    ctx.save();
    coordinateValue.forEach((item, index) => {
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      ctx.closePath();
    });
    ctx.restore();
    coordinateValue = [];
  }
}

export function beforeValue(pen: leChartPen, value: any) {
  if (value.xAxisData || value.data || (!value.dataX && !value.dataY)) {
    // 整体传参，不做处理
    return value;
  }

  const _xAxisData = pen.xAxisData;
  const _data = pen.data;
  const replaceMode = pen.replaceMode;
  let xAxisData = [];
  let data = [];
  if (!replaceMode) {
    //追加
    xAxisData = [..._xAxisData, ...value.dataX];
    _data.forEach((item: any, index: number) => {
      let _item = [...item, ...value.dataY[index]];
      data.push(_item);
    });
  } else if (replaceMode === ReplaceMode.Replace) {
    //替换部分
    value.dataX.forEach((item: any, i: number) => {
      let _index = _xAxisData.indexOf(item);
      _data.forEach((d: any, index: number) => {
        d[_index] = value.dataY[index][i];
      });
    });
    xAxisData = _xAxisData;
    data = _data;
  } else if (replaceMode === ReplaceMode.ReplaceAll) {
    //全部替换
    xAxisData = value.dataX;
    data = value.dataY;
  }
  delete value.dataX;
  delete value.dataY;
  return Object.assign(value, { xAxisData, data });
}
