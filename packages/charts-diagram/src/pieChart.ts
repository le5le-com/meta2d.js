//饼状图
export function pieChart(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  for (let ser = 0; ser < pen.charts.option.series.length; ser++) {
    let series = pen.charts.option.series[ser];
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
      ctx.fillStyle = pen.charts.option.color[index];
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
      //绘制label
      let centerAngle = (beforeAngle + afterAngle) / 2;
      let temX = centerX + (toR + 5) * Math.sin(centerAngle);
      let temY = centerY - (toR + 5) * Math.cos(centerAngle);
      let temFillStyle = ctx.fillStyle;
      if (['inner', 'inside'].includes(series.label.position)) {
        ctx.fillStyle = '#ffffff';
        temX = centerX + ((toR - fromR) / 2) * Math.sin(centerAngle);
        temY = centerY - ((toR - fromR) / 2) * Math.cos(centerAngle);
      } else if (series.label.position == 'outside') {
      }
      if (series.labelLine.show !== false) {
        ctx.beginPath();
        ctx.strokeStyle = pen.charts.option.color[index];
        ctx.moveTo(
          centerX + toR * Math.sin(centerAngle),
          centerY - toR * Math.cos(centerAngle)
        );

        ctx.lineTo(temX, temY);
      }
      ctx.font = r / 10 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      if (centerAngle > Math.PI) {
        if (series.label.position === 'outside') {
          ctx.textAlign = 'end';
        }
        if (series.labelLine.show !== false) {
          ctx.lineTo(temX - 5, temY);
        }
        if (series.label.show !== false) {
          ctx.fillText(item.name, temX - 5, temY);
        }
      } else {
        if (series.label.position === 'outside') {
          ctx.textAlign = 'start';
        }
        if (series.labelLine.show !== false) {
          ctx.lineTo(temX + 5, temY);
        }
        if (series.label.show !== false) {
          ctx.fillText(item.name, temX + 5, temY);
        }
      }
      ctx.stroke();
      ctx.closePath();
      ctx.fillStyle = temFillStyle;
      ctx.strokeStyle = series.itemStyle.borderColor;
      beforeAngle = afterAngle;
    });
  }
  return false;
}
