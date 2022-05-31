import { coordinateAxis } from './coordinateAxis';
import { leChartPen } from './common';

//柱状图
export function histogram(ctx: CanvasRenderingContext2D, pen: leChartPen) {
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
  if (pen.echarts) {
    for (let i = 0; i < pen.echarts.option.series.length; i++) {
      series.push(pen.echarts.option.series[i].data);
    }
  } else {
    series = pen.data;
  }
  let coordinate = coordinateAxis(ctx, pen);
  let dash = coordinate.dash;
  let normalizedOption = coordinate.normalizedOption;

  let itemWidth = (dash * 4) / 5 / series.length;
  // ctx.strokeStyle = '#ffffff';
  for (let j = 0; j < series.length; j++) {
    ctx.beginPath();
    let data = series[j];
    ctx.fillStyle = pen.echarts
      ? pen.echarts.option.color[j]
      : pen.chartsColor[j];
    ctx.strokeStyle = '#ffffff';
    let currentX = 0;
    let currentY = 0;
    let currentH = 0;
    for (let i = 0; i < data.length; i++) {
      currentX = x + (1 + 0.1 * dash) + (dash + 1) * i + itemWidth * j;
      currentH =
        ((data[i] - normalizedOption.min) /
          (normalizedOption.max - normalizedOption.min)) *
        h;
      currentY = y + h - currentH;
      //宽度-1是为了数据之间的间距 高度-1是为了坐标轴不被覆盖
      ctx.rect(currentX, currentY, itemWidth - 1, currentH - 1);
      ctx.stroke();
      ctx.fill();
    }
    ctx.closePath();
  }

  // let;
}
