import { coordinateAxis } from './coordinateAxis';

//折线图
export function lineChart(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  let series = pen.option.series;

  let coordinate = coordinateAxis(ctx, pen);
  let dash = coordinate.dash;
  let normalizedOption = coordinate.normalizedOption;
  //数据值绘制

  for (let j = 0; j < series.length; j++) {
    ctx.beginPath();
    let data = series[j].data;
    ctx.strokeStyle = pen.option.color[j];
    let currentX = x + (1 + dash / 2);
    let currentY =
      y +
      h -
      ((data[0] - normalizedOption.min) /
        (normalizedOption.max - normalizedOption.min)) *
        h;
    ctx.moveTo(currentX, currentY);
    for (let i = 1; i < data.length; i++) {
      currentX = x + (1 + dash / 2) + (dash + 1) * i;
      currentY =
        y +
        h -
        ((data[i] - normalizedOption.min) /
          (normalizedOption.max - normalizedOption.min)) *
          h;
      ctx.lineTo(currentX, currentY);
    }
    ctx.stroke();
    ctx.closePath();
  }
}
