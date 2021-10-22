import { getValidValue } from './common';
//仪表全盘
export function gauge(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    // pen.onBeforeValue = onBeforeValue;
  }
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
  let series = { ...basicConfigure, ...pen.lecharts.option.series[0] };
  series.radius = parseFloat(series.radius) / 100;
  let r = w > h ? (h / 2) * series.radius : (w / 2) * series.radius;
  let centerX = x + w / 2;
  let centerY = y + h / 2;
  let value = pen.calculative.value; //series.data[0].value;
  let pointColor: string;
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
    ctx.stroke();
    ctx.closePath();
    beforeBili = afterBili;
  });

  //主刻度线
  let dashWidth = series.splitLine.lineStyle.width;
  let mainR =
    r -
    lineStyle.width / 2 -
    series.splitLine.distance -
    series.splitLine.length / 2;
  let arcLength = (gap / 180) * Math.PI * mainR;

  let dash = (arcLength - dashWidth * series.splitNumber) / series.splitNumber;
  let offsetAngle = ((gap / 180) * Math.PI * dashWidth) / 2 / arcLength;

  ctx.beginPath();
  ctx.strokeStyle = series.splitLine.lineStyle.color;
  ctx.lineWidth = series.splitLine.length;
  ctx.setLineDash([dashWidth, dash]);
  ctx.arc(
    centerX,
    centerY,
    mainR,
    (-series.startAngle / 180) * Math.PI - offsetAngle,
    (-series.endAngle / 180) * Math.PI + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  //从刻度线
  let fromDashWidth = series.axisTick.lineStyle.width;
  let fromR =
    r -
    lineStyle.width / 2 -
    series.axisTick.distance -
    series.axisTick.length / 2;
  let fromArcLength = (gap / 180) * Math.PI * fromR;

  let fromDash =
    (fromArcLength - fromDashWidth * 5 * series.splitNumber) /
    5 /
    series.splitNumber;
  let fromOffsetAngle =
    ((gap / 180) * Math.PI * fromDashWidth) / 2 / fromArcLength;

  ctx.beginPath();
  ctx.strokeStyle = series.axisTick.lineStyle.color;
  ctx.lineWidth = series.axisTick.length;
  ctx.setLineDash([fromDashWidth, fromDash]);
  ctx.arc(
    centerX,
    centerY,
    fromR,
    (-series.startAngle / 180) * Math.PI - fromOffsetAngle,
    (-series.endAngle / 180) * Math.PI + fromOffsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  //绘制文字
  ctx.beginPath();
  let valueGap = series.max - series.min;
  let interval = valueGap / series.splitNumber;
  ctx.font =
    series.axisLabel.fontSize + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
  ctx.textBaseline = 'top';
  let textR = r + lineStyle.width / 2 - series.axisLabel.distance;
  for (let i = 0; i <= series.splitNumber; i++) {
    let bili = (series.startAngle - ((interval * i) / valueGap) * gap) / 180;
    let width = textR * Math.cos(bili * Math.PI);
    let height = textR * Math.sin(bili * Math.PI);
    let temColor = series.axisLabel.color;

    lineStyle.color.reverse().forEach((item: any) => {
      if (i / series.splitNumber <= item[0]) {
        ctx.fillStyle = item[1];
      }
      if ((value - series.min) / (series.max - series.min) <= item[0]) {
        pointColor = item[1];
      }
    });
    lineStyle.color.reverse();
    if (temColor != 'auto') {
      ctx.fillStyle = temColor;
    }
    if (bili > 0.51) {
      ctx.textAlign = 'start';
    } else if (bili < 0.49) {
      ctx.textAlign = 'end';
    } else {
      ctx.textAlign = 'center';
    }
    ctx.fillText(
      getValidValue(interval * i + series.min, 1),
      centerX + width,
      centerY - height
    );
    ctx.fill();
  }
  ctx.closePath();

  //绘制指针
  let currentAngle =
    ((series.startAngle -
      ((value - series.min) / (series.max - series.min)) * gap) /
      180) *
    Math.PI;
  let pointerR = (parseFloat(series.pointer.length) / 100) * r;
  let pointerHalfW = series.pointer.width / 2;
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.fillStyle =
    series.pointer.itemStyle.color === 'auto'
      ? pointColor
      : series.pointer.itemStyle.color;
  ctx.moveTo(
    centerX - pointerHalfW * 3 * Math.cos(currentAngle),
    centerY + pointerHalfW * 3 * Math.sin(currentAngle)
  );
  ctx.lineTo(
    centerX + pointerHalfW * Math.cos(currentAngle - Math.PI / 2),
    centerY - pointerHalfW * Math.sin(currentAngle - Math.PI / 2)
  );
  ctx.lineTo(
    centerX + pointerR * Math.cos(currentAngle),
    centerY - pointerR * Math.sin(currentAngle)
  );
  ctx.lineTo(
    centerX + pointerHalfW * Math.cos(currentAngle + Math.PI / 2),
    centerY - pointerHalfW * Math.sin(currentAngle + Math.PI / 2)
  );
  ctx.lineTo(
    centerX - pointerHalfW * 3 * Math.cos(currentAngle),
    centerY + pointerHalfW * 3 * Math.sin(currentAngle)
  );
  ctx.fill();

  //文字描述
  ctx.beginPath();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle =
    series.detail.color === 'auto' ? pointColor : series.detail.color;
  ctx.fillText(
    series.detail.formatter.replace('{value}', value),
    centerX + (r * parseFloat(series.detail.offsetCenter[0])) / 100,
    centerY + (r * parseFloat(series.detail.offsetCenter[1])) / 100
  );
  ctx.fill();

  return false;
}

function onAdd(pen: any) {
  pen.value = pen.lecharts.option.series[0].data[0].value;
  pen.frames = [
    {
      duration: 10,
      value: 0,
    },
    {
      duration: 2000,
      value: pen.value,
    },
  ];
  setTimeout(() => {
    pen.historyValue = pen.value;
  }, 3000);
  pen.calculative.canvas.parent.startAnimate(pen.id);
}

//setValue 直接触发，所以数据的过渡可能很难实现。
function onBeforeValue(pen: any, data: any) {
  if (data.value) {
    console.log(pen.value);
    pen.frames = [
      {
        duration: 100,
        value: pen.value,
      },
      {
        duration: 2000,
        value: data.value,
      },
    ];
    pen.calculative.canvas.parent.startAnimate(pen.id);
  }
}
