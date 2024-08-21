import { leChartPen, ReplaceMode } from './common';
import {getFont} from "../../core";
//饼状图
export function pieChart(ctx: CanvasRenderingContext2D, pen: leChartPen) {
  if (!pen.onBeforeValue) {
    pen.onBeforeValue = beforeValue;
  }
  // 缩放模式
  let scale = pen.calculative.canvas.store.data.scale;
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  const isEcharts = pen.echarts ? true : false;
  // if (pen.echarts && !pen.echarts.option.color) {
  //   pen.echarts.option.color = [
  //     '#1890ff',
  //     '#2FC25B',
  //     '#FACC14',
  //     '#c23531',
  //     '#2f4554',
  //     '#61a0a8',
  //     '#d48265',
  //   ];
  // } else {
  //   pen.chartsColor = [
  //     '#1890ff',
  //     '#2FC25B',
  //     '#FACC14',
  //     '#c23531',
  //     '#2f4554',
  //     '#61a0a8',
  //     '#d48265',
  //   ];
  // }
  if (pen.echarts) {
    if (!pen.echarts.option.color) {
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
    pen.chartsColor = pen.echarts.option.color;
  } else {
    if (!pen.chartsColor) {
      pen.chartsColor = [
        '#1890ff',
        '#2FC25B',
        '#FACC14',
        '#c23531',
        '#2f4554',
        '#61a0a8',
        '#d48265',
      ];
    }
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
      return;
    }
    let beforeAngle = 0;
    let afterAngle = 0;
    ctx.strokeStyle = isEcharts
      ? series.itemStyle?.borderColor || '#fff'
      : '#fff';
    ctx.lineWidth = (isEcharts ? series.itemStyle?.borderWidth || 2 : 2) * scale;
    const data = isEcharts ? series.data : series;
    data.forEach((item: any, index: number) => {
      afterAngle += (Math.PI * 2 * item.value) / sum;
      ctx.beginPath();
      let colorLength = beforeSeriesLength + index;
      if (colorLength >= pen.chartsColor.length) {
        colorLength = colorLength % pen.chartsColor.length;
      }
      ctx.fillStyle = isEcharts
        ? pen.echarts.option.color[colorLength]
        : pen.chartsColor[colorLength];
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
      let temX = centerX + (toR + 10*scale) * Math.sin(centerAngle);
      let temY = centerY - (toR + 10*scale) * Math.cos(centerAngle);
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
      let fontOption = {
        fontStyle: pen.tickLabel?.fontStyle || pen.calculative.fontStyle,
        fontWeight:pen.tickLabel?.fontWeight || pen.calculative.fontWeight,
        fontFamily:pen.tickLabel?.fontFamily || pen.calculative.fontFamily,
        lineHeight: pen.tickLabel?.lineHeight || pen.calculative.lineHeight,
        fontSize: (pen.tickLabel?.fontSize || pen.calculative.fontSize) * scale
      };
      ctx.font = getFont(fontOption);  // r / 10 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      // 写入文字
      if (centerAngle > Math.PI) {
        if ((isEcharts && series.label.position === 'outside') || !isEcharts) {
          ctx.textAlign = 'end';
        }
        if ((isEcharts && series.labelLine.show !== false) || (!isEcharts && (pen.tickLabel?.labelLine?.show??true))) {
          ctx.lineTo(temX - 5*scale, temY);
        }
        if ((isEcharts && series.label.show !== false) || (!isEcharts && (pen.tickLabel?.show??true))) {
          ctx.fillText(item.name, temX - 5*scale, temY);
        }
      } else {
        if ((isEcharts && series.label.position === 'outside') || !isEcharts) {
          ctx.textAlign = 'start';
        }
        if ((isEcharts && series.labelLine.show !== false) || !isEcharts) {
          ctx.lineTo(temX + 5*scale, temY);
        }
        if ((isEcharts && series.label.show !== false) || (!isEcharts && (pen.tickLabel?.show??true))) {
          ctx.fillText(item.name, temX + 5*scale, temY);
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
}

function beforeValue(pen: leChartPen, value: any) {
  if (value.data || (!value.dataX && !value.dataY)) {
    // 整体传参，不做处理
    return value;
  }

  const _data = pen.data;
  const replaceMode = pen.replaceMode;
  let data = [];
  if (!replaceMode) {
    //追加
    _data.forEach((item: any, index: number) => {
      let _item = [...item, ...value.dataY[index]];
      data.push(_item);
    });
  } else if (replaceMode === ReplaceMode.Replace) {
    //替换部分
    value.dataY.forEach((item: any, index: number) => {
      item.forEach((_innerItem: any, _innderIndex: number) => {
        let _filterItem = _data[index].filter(
          (_i: any) => _i.name === _innerItem.name
        );
        if (_filterItem.length > 0) {
          _filterItem[0].value = _innerItem.value;
        }
      });
    });
    data = _data;
  } else if (replaceMode === ReplaceMode.ReplaceAll) {
    //全部替换
    data = value.dataY;
  }
  delete value.dataX;
  delete value.dataY;
  return Object.assign(value, { data });
}
