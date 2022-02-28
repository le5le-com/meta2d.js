import { getValidValue } from './common';
//仪表全盘
let clockInterval: any;
export function gauge(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    pen.onDestroy = onDestroy;
  }
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;

  let basicConfigure = {
    startAngle: 225,
    endAngle: -45,
    min: 0,
    max: 100,
    splitNumber: 10,
  };
  //对echarts写法做兼容性处理
  if (pen.echarts && pen.echarts.option) {
    let series = pen.echarts.option.series[0];
    pen.startAngle = series.startAngle || basicConfigure.startAngle;
    pen.endAngle = series.endAngle || basicConfigure.endAngle;
    pen.min = series.min || basicConfigure.min;
    pen.max = series.max || basicConfigure.max;
    pen.axisLine = series.axisLine.lineStyle.color;
    pen.unit = series.detail.formatter.replace('{value}', '');
    pen.value = series.data[0].value;
    pen.splitNumber = series.splitNumber || basicConfigure.splitNumber;
  }

  pen = { ...basicConfigure, ...pen };
  let r = w > h ? ((h / 2) * 9) / 10 : ((w / 2) * 9) / 10;
  let centerX = x + w / 2;
  let centerY = y + h / 2;
  let value = pen.echarts
    ? pen.echarts.option.series[0].data[0].value
    : pen.value;
  let pointColor: string;
  let gap = pen.startAngle - pen.endAngle;
  let bgColor = pen.background || '#E6EBF8';

  //绘制背景
  ctx.strokeStyle = bgColor;
  let bgLineWidth = r / 10;
  ctx.lineWidth = bgLineWidth;
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.arc(
    centerX,
    centerY,
    r,
    (-pen.startAngle / 180) * Math.PI,
    (-pen.endAngle / 180) * Math.PI
  );
  ctx.stroke();
  ctx.closePath();

  let bili = 0;
  if (pen.axisLine && !pen.isClock) {
    for (let i = pen.axisLine.length - 1; i >= 0; i--) {
      if (pen.axisLine[i][0] * (pen.max - pen.min) < value) {
        bili = pen.axisLine[i][0];
      } else {
        bili = (value - pen.min) / (pen.max - pen.min);
        pointColor = pen.axisLine[i][1];
      }
      ctx.beginPath();
      ctx.strokeStyle = pen.axisLine[i][1];
      ctx.arc(
        centerX,
        centerY,
        r,
        (-pen.startAngle / 180) * Math.PI,
        ((-pen.startAngle + bili * gap) / 180) * Math.PI
      );
      ctx.stroke();
      ctx.closePath();
    }
  }
  ctx.lineCap = 'butt';
  //主刻度线
  let dashWidth = 2;
  let mainR = r - bgLineWidth;
  if (mainR < 0) {
    mainR = 0;
  }
  let arcLength = (gap / 180) * Math.PI * mainR;

  let dash = (arcLength - dashWidth * pen.splitNumber) / pen.splitNumber;
  let offsetAngle = ((gap / 180) * Math.PI * dashWidth) / 2 / arcLength;

  ctx.beginPath();
  ctx.strokeStyle = pen.color || '#999999';
  ctx.lineWidth = r / 20;
  ctx.setLineDash([dashWidth, dash]);
  ctx.arc(
    centerX,
    centerY,
    mainR,
    (-pen.startAngle / 180) * Math.PI - offsetAngle,
    (-pen.endAngle / 180) * Math.PI + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  //从刻度线
  let fromDashWidth = 1;
  let fromR = r - bgLineWidth;
  if (fromR < 0) {
    fromR = 0;
  }
  let fromArcLength = (gap / 180) * Math.PI * fromR;

  let fromDash =
    (fromArcLength - fromDashWidth * 5 * pen.splitNumber) / 5 / pen.splitNumber;
  let fromOffsetAngle =
    ((gap / 180) * Math.PI * fromDashWidth) / 2 / fromArcLength;

  ctx.beginPath();
  ctx.strokeStyle = pen.color || '#999999';
  ctx.lineWidth = r / 40;
  ctx.setLineDash([fromDashWidth, fromDash]);
  ctx.arc(
    centerX,
    centerY,
    fromR,
    (-pen.startAngle / 180) * Math.PI - fromOffsetAngle,
    (-pen.endAngle / 180) * Math.PI + fromOffsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  //绘制文字
  ctx.beginPath();
  let valueGap = pen.max - pen.min;
  let interval = valueGap / pen.splitNumber;
  ctx.font =
    (pen.calculative.fontStyle || '') +
    ' normal ' +
    (pen.calculative.fontWeight || '') +
    ' ' +
    r / 10 +
    'px ' +
    pen.calculative.fontFamily;
  let textR = r - bgLineWidth - r / 20;
  for (let i = 0; i <= pen.splitNumber; i++) {
    if (Math.abs(pen.startAngle) + Math.abs(pen.endAngle) === 360) {
      //形成一个圆形
      if (i == 0) continue;
    }
    let angle = pen.startAngle - ((interval * i) / valueGap) * gap;
    let width = Math.cos((angle / 180) * Math.PI);
    let height = Math.sin((angle / 180) * Math.PI);
    ctx.fillStyle = '#999999';
    if (width > 0.02) {
      ctx.textAlign = 'end';
    } else if (width < -0.02) {
      ctx.textAlign = 'start';
    } else {
      ctx.textAlign = 'center';
    }
    if (height > 0.02) {
      ctx.textBaseline = 'top';
    } else if (height < -0.02) {
      ctx.textBaseline = 'bottom';
    } else {
      ctx.textBaseline = 'middle';
    }
    ctx.fillText(
      getValidValue(interval * i + pen.min, 1),
      centerX + textR * width,
      centerY - textR * height
    );
    ctx.fill();
  }
  ctx.closePath();

  //绘制指针

  let pointNum = 1;
  let valueArray = ['value'];
  if (pen.isClock) {
    pointNum = 3;
    valueArray = ['hourvalue', 'minutevalue', 'secondvalue'];
  }
  if (pen.isClock) {
    for (let i = 0; i < pointNum; i++) {
      let currentAngle =
        ((pen.startAngle -
          ((pen[valueArray[i]] - pen.min) / (pen.max - pen.min)) * gap) /
          180) *
        Math.PI;
      if (i > 0) {
        currentAngle =
          ((pen.startAngle -
            ((pen[valueArray[i]] - pen.min) / (pen.max * 5 - pen.min)) * gap) /
            180) *
          Math.PI;
      }
      let pointerR = (4 / 5) * r;
      if (valueArray[i] === 'hourvalue') {
        pointerR = (3 / 5) * r;
      }
      if (valueArray[i] === 'minutevalue') {
        pointerR = (3.5 / 5) * r;
      }
      let pointerHalfW = (r * 1) / 40;
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.lineWidth = r / (i + 1) / 20;
      ctx.strokeStyle = pen.color || '#999999';
      ctx.moveTo(
        centerX - pointerHalfW * 3 * Math.cos(currentAngle),
        centerY + pointerHalfW * 3 * Math.sin(currentAngle)
      );
      ctx.lineTo(
        centerX + pointerR * Math.cos(currentAngle),
        centerY - pointerR * Math.sin(currentAngle)
      );
      ctx.stroke();
    }
  } else {
    let currentAngle =
      ((pen.startAngle - ((value - pen.min) / (pen.max - pen.min)) * gap) /
        180) *
      Math.PI;
    let pointerR = (4 / 5) * r;
    let pointerHalfW = (r * 1) / 40;
    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.fillStyle = pointColor;
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
  }
  //文字描述

  ctx.beginPath();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font =
    (pen.calculative.fontStyle || '') +
    ' normal ' +
    (pen.calculative.fontWeight || '') +
    ' ' +
    r / 5 +
    'px ' +
    pen.calculative.fontFamily;
  ctx.fillStyle = pointColor;
  if (pen.isClock) {
    ctx.fillText(
      ('0' + parseInt(pen.hourvalue)).slice(-2) +
        ':' +
        ('0' + parseInt(pen.minutevalue)).slice(-2) +
        ':' +
        ('0' + parseInt(pen.secondvalue)).slice(-2),
      centerX,
      centerY + r / 2
    );
  } else {
    ctx.fillText(value + ' ' + (pen.unit || ''), centerX, centerY + r / 2);
  }
  ctx.fill();

  if (pen.isClock) {
    ctx.beginPath();
    ctx.fillStyle = pen.color || '#999999';
    ctx.strokeStyle = '#ffffff';
    ctx.arc(centerX, centerY, r / 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.closePath();
  }
  return false;
}

function onAdd(pen: any) {
  if (pen.isClock) {
    clockInterval = setInterval(() => {
      var date = new Date();
      var second = date.getSeconds();
      var minute = date.getMinutes() + second / 60;
      var hour = (date.getHours() % 12) + minute / 60;
      pen.calculative.canvas.parent.setValue({
        id: pen.id,
        hourvalue: hour,
        minutevalue: minute,
        secondvalue: second,
      });
    }, 1000);
  } else {
    const tem = pen.value;
    pen.value = 0;
    pen.frames = [
      {
        duration: 2000,
        value: tem,
      },
    ];
    pen.calculative.canvas.parent.startAnimate(pen.id);
    setTimeout(() => {
      pen.value = tem;
    }, 1000);
  }
}

function onDestroy(pen: any) {
  clearInterval(clockInterval);
}
