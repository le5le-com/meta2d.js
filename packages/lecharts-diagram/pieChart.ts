//饼状图
export function pieChart(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  let series = pen.option.series[0];
  let r = w / 2;
  if (h < w) {
    r = h / 2;
  }
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  let sum = series.data.reduce((prev: number, curr: any) => {
    return prev + curr.value;
  }, 0);
  let fromR = (r * parseFloat(series.radius[0])) / 100;

  let toR = (r * parseFloat(series.radius[1])) / 100;
  if (fromR > toR) {
    return false;
  }
  let beforeAngle = 0;
  let afterAngle = 0;

  ctx.strokeStyle = series.itemStyle.borderColor;
  ctx.lineWidth = series.itemStyle.borderWidth;
  series.data.forEach((item: any, index: number) => {
    afterAngle += (Math.PI * 2 * item.value) / sum;
    ctx.beginPath();
    ctx.fillStyle = pen.option.color[index];
    ctx.moveTo(
      centerX + fromR * Math.sin(afterAngle),
      centerY - fromR * Math.cos(afterAngle)
    );
    ctx.arc(
      centerX,
      centerY,
      fromR,
      -Math.PI / 2 + afterAngle,
      -Math.PI / 2 + beforeAngle,
      true
    );
    ctx.lineTo(
      centerX + toR * Math.sin(beforeAngle),
      centerY - toR * Math.cos(beforeAngle)
    );
    ctx.arc(
      centerX,
      centerY,
      toR,
      -Math.PI / 2 + beforeAngle,
      -Math.PI / 2 + afterAngle
    );
    ctx.lineTo(
      centerX + fromR * Math.sin(afterAngle),
      centerY - fromR * Math.cos(afterAngle)
    );
    ctx.stroke();
    ctx.fill();
    ctx.closePath();

    let centerAngle = (beforeAngle + afterAngle) / 2;
    ctx.beginPath();
    ctx.strokeStyle = pen.option.color[index];
    ctx.moveTo(
      centerX + toR * Math.sin(centerAngle),
      centerY - toR * Math.cos(centerAngle)
    );
    let temX = centerX + (toR + 5) * Math.sin(centerAngle);
    let temY = centerY - (toR + 5) * Math.cos(centerAngle);
    ctx.lineTo(temX, temY);
    ctx.font = r / 10 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
    ctx.textBaseline = 'middle';

    if (centerAngle > Math.PI) {
      ctx.textAlign = 'end';
      ctx.lineTo(temX - 5, temY);
      ctx.fillText(item.name, temX - 5, temY);
    } else {
      ctx.textAlign = 'start';
      ctx.lineTo(temX + 5, temY);
      ctx.fillText(item.name, temX + 5, temY);
    }
    ctx.stroke();
    ctx.closePath();
    ctx.strokeStyle = series.itemStyle.borderColor;
    beforeAngle = afterAngle;
  });
  return false;
}
