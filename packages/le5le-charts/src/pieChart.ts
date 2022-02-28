//饼状图
export function pieChart(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  const isEcharts = pen.echarts ? true : false;
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
  const seriesArray = isEcharts ? pen.echarts.option.series : pen.data;
  let beforeSeriesLength = 0;
  for (let ser = 0; ser < seriesArray.length; ser++) {
    let series = seriesArray[ser];
    let r = w / 2;
    if (h < w) {
      r = h / 2;
    }
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    let sum = 0;
    if (isEcharts) {
      sum = series.data.reduce((prev: number, curr: any) => {
        return prev + curr.value;
      }, 0);
    } else {
      sum = series.reduce((prev: number, curr: any) => {
        return prev + curr.value;
      }, 0);
    }
    const fromR =
      (r *
        parseFloat(isEcharts ? series.radius[0] : pen.chartsRadius[ser][0])) /
      100;
    const toR =
      (r *
        parseFloat(isEcharts ? series.radius[1] : pen.chartsRadius[ser][1])) /
      100;
    if (fromR > toR) {
      return false;
    }
    let beforeAngle = 0;
    let afterAngle = 0;
    ctx.strokeStyle = isEcharts
      ? series.itemStyle?.borderColor || '#fff'
      : '#fff';
    ctx.lineWidth = isEcharts ? series.itemStyle?.borderWidth || 2 : 2;
    const data = isEcharts ? series.data : series;
    data.forEach((item: any, index: number) => {
      afterAngle += (Math.PI * 2 * item.value) / sum;
      ctx.beginPath();
      ctx.fillStyle = isEcharts
        ? pen.echarts.option.color[beforeSeriesLength + index]
        : pen.chartsColor[beforeSeriesLength + index];
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
      if (!series.label) {
        series.label = { position: 'outside', show: true };
      }
      if (isEcharts && ['inner', 'inside'].includes(series.label.position)) {
        ctx.fillStyle = '#ffffff';
        temX = centerX + ((toR - fromR) / 2) * Math.sin(centerAngle);
        temY = centerY - ((toR - fromR) / 2) * Math.cos(centerAngle);
      } else if (isEcharts && series.label.position == 'outside') {
      }
      if (!series.labelLine) {
        series.labelLine = { show: true };
      }
      if ((isEcharts && series.labelLine.show !== false) || !isEcharts) {
        ctx.beginPath();
        ctx.strokeStyle = isEcharts
          ? pen.echarts.option.color[beforeSeriesLength + index]
          : pen.chartsColor[beforeSeriesLength + index];
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
        if ((isEcharts && series.label.position === 'outside') || !isEcharts) {
          ctx.textAlign = 'end';
        }
        if ((isEcharts && series.labelLine.show !== false) || !isEcharts) {
          ctx.lineTo(temX - 5, temY);
        }
        if ((isEcharts && series.label.show !== false) || !isEcharts) {
          ctx.fillText(item.name, temX - 5, temY);
        }
      } else {
        if ((isEcharts && series.label.position === 'outside') || !isEcharts) {
          ctx.textAlign = 'start';
        }
        if ((isEcharts && series.labelLine.show !== false) || !isEcharts) {
          ctx.lineTo(temX + 5, temY);
        }
        if ((isEcharts && series.label.show !== false) || !isEcharts) {
          ctx.fillText(item.name, temX + 5, temY);
        }
      }
      ctx.stroke();
      ctx.closePath();
      ctx.fillStyle = temFillStyle;
      ctx.strokeStyle = isEcharts
        ? series.itemStyle?.borderColor || '#fff'
        : '#fff';
      beforeAngle = afterAngle;
    });

    beforeSeriesLength += data.length;
  }
  return false;
}
