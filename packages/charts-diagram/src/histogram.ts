import { coordinateAxis } from './coordinateAxis';

//柱状图
export function histogram(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  let series = pen.option.series;

  let coordinate = coordinateAxis(ctx, pen);
  let dash = coordinate.dash;
  let normalizedOption = coordinate.normalizedOption;

  let itemWidth = (dash * 4) / 5 / series.length;
  // ctx.strokeStyle = '#ffffff';
  for (let j = 0; j < series.length; j++) {
    ctx.beginPath();
    let data = series[j].data;
    ctx.fillStyle = pen.option.color[j];
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
