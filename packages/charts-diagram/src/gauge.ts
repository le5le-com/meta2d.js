import { getValidValue } from './common';
//仪表全盘
export function gauge(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  let basicConfigure = {
    radius: '75%',
    startAngle: 225,
    endAngle: -45,
    clockwise: true,
    min: 0,
    max: 100,
    splitNumber: 10,
  };
  let series = { ...basicConfigure, ...pen.option.series[0] };
  series.radius = parseFloat(series.radius) / 100;
  let r = w > h ? (h / 2) * series.radius : (w / 2) * series.radius;
  let centerX = x + w / 2;
  let centerY = y + h / 2;

  //背景圆弧
  let lineStyle = series.axisLine.lineStyle;
  ctx.lineWidth = lineStyle.width;
  let beforeBili = 0;
  let afterBili = 0;
  let gap = series.startAngle - series.endAngle;
  lineStyle.color.forEach((item: any, index: number) => {
    ctx.beginPath();
    afterBili = item[0];
    ctx.strokeStyle = item[1];
    ctx.arc(
      centerX,
      centerY,
      r,
      ((-series.startAngle + beforeBili * gap) / 180) * Math.PI,
      ((-series.startAngle + afterBili * gap) / 180) * Math.PI
    );
    console.log(
      'angele',
      -series.startAngle + beforeBili * gap,
      -series.startAngle + afterBili * gap
    );
    ctx.stroke();
    ctx.closePath();
    beforeBili = afterBili;
  });

  //主刻度线
  let dashWidth = series.splitLine.lineStyle.width;
  let arcLength = (gap / 180) * Math.PI * r;
  let dash = (arcLength - dashWidth * series.splitNumber) / series.splitNumber;
  let offsetAngle = ((gap / 180) * Math.PI * dashWidth) / 2 / arcLength;

  ctx.beginPath();
  ctx.strokeStyle = series.splitLine.lineStyle.color;
  ctx.lineWidth = series.splitLine.lineStyle.width;
  ctx.setLineDash([dashWidth, dash]);
  console.log(dashWidth, dash);
  ctx.arc(
    centerX,
    centerY,
    r - lineStyle.width / 2,
    (-series.startAngle / 180) * Math.PI - offsetAngle,
    (-series.endAngle / 180) * Math.PI + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();
  return false;
}
