import { getValidValue } from './common';

export function instrumentTwo(
  pen: any,
  path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D
) {}

export function instrumentTwobyCtx(ctx: CanvasRenderingContext2D, pen: any) {
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

  let r = (256 / 318) * min;
  let centerDis = (48 / 318) * min;
  let angle = Math.PI / 2;
  let mainLineWidth = min / 10;
  let fromLineWidth = min / 20;
  let arcLength = angle * (r - mainLineWidth / 2);

  ctx.beginPath();
  ctx.fillStyle = pen.dialColor;
  ctx.strokeStyle = pen.textColor;
  ctx.rect(x + w - min, y + h - min, min, min);
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
    x + w - centerDis,
    y + h - centerDis,
    r - mainLineWidth / 2,
    Math.PI - offsetAngle,
    Math.PI + angle + offsetAngle
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
      Math.cos(((interval * i) / gap) * angle + Math.PI);
    let height =
      (r - mainLineWidth * 1.25) *
      Math.sin(((interval * i) / gap) * angle + Math.PI);
    if (width < 0) {
      ctx.textAlign = 'start';
    } else {
      ctx.textAlign = 'end';
    }
    ctx.fillText(
      getValidValue(interval * i + pen.min, pen.displayFormat),
      x + w + width - centerDis,
      y + h + height - centerDis
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
    x + w - centerDis,
    y + h - centerDis,
    r - fromLineWidth / 2,
    Math.PI - offsetAngle,
    Math.PI + angle + offsetAngle
  );
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.font = r / 10 + 'px AlibabaPuHuiTi-Regular, Alibaba PuHuiTi';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'top';
  ctx.fillText(pen.instrumentName, x + w - r * 0.5, y + h - r * 0.5);
  ctx.fillText(pen.instrumentUnit, x + w - r * 1.05, y + h - r * 1.05);
  ctx.closePath();
  //指针绘制
  ctx.beginPath();
  let currentAngle =
    Math.PI + ((pen.value - pen.min) / (pen.max - pen.min)) * angle;
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.moveTo(
    x + w - centerDis - 8 * Math.cos(currentAngle),
    y + h - centerDis - 8 * Math.sin(currentAngle)
  );
  ctx.lineTo(
    x + w - centerDis + (r - mainLineWidth - 2) * Math.cos(currentAngle),
    y + h - centerDis + (r - mainLineWidth - 2) * Math.sin(currentAngle)
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = '#ff0000';
  ctx.arc(x + w - centerDis, y + h - centerDis, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
}
