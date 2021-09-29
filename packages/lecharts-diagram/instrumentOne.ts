import { getValidValue } from './common';

export function instrumentOne(ctx: CanvasRenderingContext2D, pen: any) {
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const w = pen.calculative.worldRect.width;
  const h = pen.calculative.worldRect.height;
  const main = pen.mainBisectrix;
  const from = pen.fromBisectrix;
  let min = w;
  if (w > h) {
    min = h;
  }

  let r = ((145 / 155) * min) / 2;
  let angle = (Math.PI / 2) * 3;
  let mainLineWidth = min / 10;
  let fromLineWidth = min / 20;
  let arcLength = angle * (r - mainLineWidth / 2);

  ctx.beginPath();
  ctx.fillStyle = pen.dialColor;
  ctx.strokeStyle = pen.textColor;
  ctx.rect(x + w / 2 - min / 2, y + h / 2 - min / 2, min, min);
  ctx.fill();
  ctx.stroke();
  ctx.closePath();
  //主等分线
  ctx.beginPath();
  ctx.lineWidth = mainLineWidth;
  ctx.lineCap = 'butt';
  let dash = (arcLength - 2 * main) / main;
  let offsetAngle = (angle * 1) / arcLength;
  ctx.setLineDash([2, dash]);
  ctx.arc(
    x + w / 2,
    y + h / 2,
    r - mainLineWidth / 2,
    (Math.PI * 3) / 4 - offsetAngle,
    (Math.PI * 3) / 4 + angle + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  //绘制文字
  ctx.beginPath();
  let gap = pen.max - pen.min;
  let interval = gap / main;
  ctx.fillStyle = pen.textColor;
  ctx.font = r / 10 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= main; i++) {
    ctx.fillStyle = pen.textColor;
    let width =
      (r - mainLineWidth * 1.25) *
      Math.cos(((interval * i) / gap) * angle + (Math.PI * 3) / 4);
    let height =
      (r - mainLineWidth * 1.25) *
      Math.sin(((interval * i) / gap) * angle + (Math.PI * 3) / 4);
    if (width < 0) {
      ctx.textAlign = 'start';
    } else {
      ctx.textAlign = 'end';
    }
    ctx.fillText(
      getValidValue(interval * i + pen.min, pen.displayFormat),
      x + w / 2 + width,
      y + h / 2 + height
    );
    ctx.fill();
  }
  ctx.closePath();

  //   次等分线;
  ctx.beginPath();
  ctx.strokeStyle = pen.textColor + '8c';
  ctx.lineWidth = fromLineWidth;
  arcLength = angle * (r - fromLineWidth / 2);
  offsetAngle = (angle * 0.5) / arcLength;
  dash = (arcLength - 1 * main * from) / (main * from);
  ctx.setLineDash([1, dash]);
  ctx.arc(
    x + w / 2,
    y + h / 2,
    r - fromLineWidth / 2,
    (Math.PI * 3) / 4 - offsetAngle,
    (Math.PI * 3) / 4 + angle + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.font = r / 5 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(pen.instrumentName, x + w / 2, y + h / 2 + r * 0.75);
  ctx.fillText(pen.instrumentUnit, x + w / 2, y + h / 2 - r / 3);
  ctx.closePath();
  //指针绘制
  ctx.beginPath();
  let currentAngle =
    (Math.PI * 3) / 4 + ((pen.value - pen.min) / (pen.max - pen.min)) * angle;
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.moveTo(
    x + w / 2 - 8 * Math.cos(currentAngle),
    y + h / 2 - 8 * Math.sin(currentAngle)
  );
  ctx.lineTo(
    x + w / 2 + (r - mainLineWidth - 2) * Math.cos(currentAngle),
    y + h / 2 + (r - mainLineWidth - 2) * Math.sin(currentAngle)
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = '#ff0000';
  ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
}
