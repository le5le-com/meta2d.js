import { scaleCompute, ScaleOption } from './normalizedAxis';

//用于绘制坐标轴
export function coordinateAxis(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  let series = pen.option.series;
  console.log('serries', series);
  let collection_data = [];
  for (let i = 0; i < series.length; i++) {
    collection_data = collection_data.concat(series[i].data);
  }
  console.log('data', collection_data);

  let initOption: ScaleOption = {
    max: Math.max.apply(null, collection_data),
    min: Math.min.apply(null, collection_data),
    splitNumber: 5,
  };
  let normalizedOption = scaleCompute(initOption);
  let num = pen.option.xAxis.data.length;
  ctx.beginPath();
  ctx.lineWidth = 6;
  ctx.lineCap = 'butt';
  let dash = (w - 1 * (num + 1)) / num;
  ctx.setLineDash([1, dash]);
  ctx.moveTo(x, y + h + 3);
  ctx.lineTo(x + w, y + h + 3);
  ctx.stroke();
  ctx.closePath();

  //x轴绘制
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  //y轴绘制
  ctx.beginPath();
  for (let i = 0; i < normalizedOption.splitNumber + 1; i++) {
    let temH = (i * h) / normalizedOption.splitNumber;
    ctx.beginPath();
    ctx.strokeStyle = '#D3D3D3';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      normalizedOption.max - i * normalizedOption.interval + '',
      x - 10,
      y + temH
    );
    ctx.fill();
    if (i < normalizedOption.splitNumber) {
      ctx.moveTo(x, y + temH);
      ctx.lineTo(x + w, y + temH);
      ctx.stroke();
    }
  }
  ctx.closePath();

  //x轴下标绘制
  ctx.beginPath();
  let xData = pen.option.xAxis.data;
  let xdataX = 0;
  for (let i = 0; i < xData.length; i++) {
    xdataX = x + (1 + dash / 2) + (dash + 1) * i;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(xData[i], xdataX, y + h + 10);
    ctx.fill();
  }
  ctx.closePath();

  return { dash: dash, normalizedOption: normalizedOption };
}
