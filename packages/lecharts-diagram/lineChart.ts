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

  let coordinateValue = [];
  for (let j = 0; j < series.length; j++) {
    ctx.beginPath();
    let data = series[j].data;
    ctx.strokeStyle = pen.option.color[j];
    ctx.fillStyle = pen.option.color[j];
    let currentX = x + (1 + dash / 2);
    let currentY =
      y +
      h -
      ((data[0] - normalizedOption.min) /
        (normalizedOption.max - normalizedOption.min)) *
        h;
    ctx.moveTo(currentX, currentY);
    coordinateValue.push({ x: currentX, y: currentY });

    if (series[j].smooth) {
      //平滑的曲线
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

    coordinateValue.forEach((item, index) => {
      ctx.beginPath();
      ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    });
    coordinateValue = [];
  }
}
