import { TopologyPen } from '../core/src/pen';


export function thermometer(pen: any) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  let R: number, r: number;
  if (pen.calculative.worldRect.width < pen.calculative.worldRect.height / 2) {
    R = Math.floor(pen.calculative.worldRect.width / 2);
  } else {
    R = Math.floor(pen.calculative.worldRect.height / 4);
  }
  r = Math.round((R * 1) / 2);

  let thermometer = pen.data.thermometer;

  if (!thermometer.Maximum) {
    thermometer.Maximum = 20;
  }
  if (!thermometer.Minimum) {
    thermometer.Minimum = -20;
  }
  if (!thermometer.criticalValue) {
    thermometer.criticalValue = 0;
  }
  if (!thermometer.thresholdsColor) {
    thermometer.thresholdsColor = '#F40';
  }
  // 绘制刻度
  // drawScale(path, pen, R, r, thermometer);
  // 描绘外形
  createdthermometer(path, pen, R, r);
  // 根据温度值，绘制内容区域
  fillValuethermometer(path, pen, R, r, thermometer);

  path.closePath();
  return path;
}

export function thermometerDrawScaleByCtx(ctx: CanvasRenderingContext2D,
  pen: any){
    let R: number, r: number;
    let h = pen.calculative.worldRect.height;
    let w = pen.calculative.worldRect.width;
    if (w < h / 2) {
      R = Math.floor(pen.calculative.worldRect.width / 2);
    } else {
      R = Math.floor(h / 4);
    }
    r = Math.round((R * 1) / 2);

    const min = pen.data.thermometer.Minimum;
    const max = pen.data.thermometer.Maximum;
    let x = pen.calculative.worldRect.x + 3 * r;
    let ey = pen.calculative.worldRect.y;
    ctx.fillStyle = pen.fontColor ?? '#000';
    let fontSize = w>h/2?h/20:w/10
    ctx.font = fontSize + 'px Arial';
    // ctx.textBaseline = 'bottom';
    // ctx.textAlign = 'center';

    for (let i = min; i <= max; i++) {
      // 刻度线
      const y = getYByValue(pen, i, R, r,pen.data.thermometer);
      ctx.beginPath();
      ctx.moveTo(x, y + ey);
      if (i % 10 == 0) {
        ctx.lineWidth = 2;
        ctx.lineTo(x + (r * 2) / 3, y + ey);
        ctx.fillText(i as any, x + 15+fontSize, y + 6 + ey);
        ctx.stroke();
      } else {
        ctx.lineWidth = 1;
        if (i % 5 == 0) {
          ctx.lineTo(x + r / 2, y + ey);
        } else {
          ctx.lineTo(x + r / 3, y + ey);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

function fillValuethermometer(
  path: Path2D,
  pen: any,
  R: number,
  r: number,
  thermometer: any
) {
  let value = pen.data.value;
  let valY: number;
  if (value < thermometer.Minimum) {
    valY = getYByValue(pen, thermometer.Minimum, R, r, thermometer);
  } else if (value > thermometer.Maximum) {
    valY = getYByValue(pen, thermometer.Maximum, R, r, thermometer);
  } else {
    valY = getYByValue(pen, value, R, r, thermometer);
  }
  path.moveTo(
    pen.calculative.worldRect.x + 3 * r,
    pen.calculative.worldRect.y + valY
  );
  path.lineTo(
    pen.calculative.worldRect.x + r,
    pen.calculative.worldRect.y + valY
  );
  const theta = Math.acos((r * 1.0) / R);
  
  path.arc(
    pen.calculative.worldRect.x + R,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - R,
    R,
    theta + Math.PI,
    -theta,
    true
  );
}

function createdthermometer(
  path: Path2D,
  pen: TopologyPen,
  R: number,
  r: number
) {
//   path.moveTo(
//     pen.calculative.worldRect.x + R + r,
//     pen.calculative.worldRect.y + r
//   );
  path.arc(
    pen.calculative.worldRect.x + R,
    pen.calculative.worldRect.y + r,
    r,
    0,
    Math.PI,
    true
  );
  
  const theta = Math.acos((r * 1.0) / R);
//   path.moveTo(
//     pen.calculative.worldRect.x +  R,
//     pen.calculative.worldRect.y + pen.calculative.worldRect.height - R
//   );
  path.arc(
    pen.calculative.worldRect.x + R,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - R,
    R,
    theta + Math.PI,
    -theta,
    true
  );

  path.lineTo(pen.calculative.worldRect.x + R+r,
    pen.calculative.worldRect.y + r);
}

function getYByValue(
  pen: TopologyPen,
  v: number,
  R: number,
  r: number,
  thermometer: any
) {
  const min = thermometer.Minimum;
  const max = thermometer.Maximum;
  // 刻度线总高度
  const height = pen.calculative.worldRect.height - 2 * R - r;
  const dy = height / (max - min);
  // 起始刻度线所在位置
  const zeroY = pen.calculative.worldRect.height - 2 * R + dy * min;
  return zeroY - dy * v;
}
