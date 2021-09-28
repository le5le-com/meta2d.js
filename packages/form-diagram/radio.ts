import { Pen } from '../core/src/pen';

declare const window: any;

export function radio(pen: any) {
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  let options = pen.configure.options;
  let boxRadio = 1 / pen.radio;
  let hUnit = h / (options.length * boxRadio + options.length - 1);
  pen.lineWidth = 3;
  for (let i = 0; i < options.length; i++) {
    path.arc(
      x + (hUnit * boxRadio) / 2,
      y + i * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2,
      (hUnit * boxRadio) / 2,
      0,
      2 * Math.PI
    );
    path.moveTo(
      x + hUnit * boxRadio,
      y + (i + 1) * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2
    );
  }
  path.closePath();

  return path;
}

export function radioTextByCtx(ctx: CanvasRenderingContext2D, pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  let options = pen.configure.options;
  let boxRadio = 1 / pen.radio;
  let hUnit = h / (options.length * boxRadio + options.length - 1);
  ctx.beginPath();
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  let fontSize = hUnit * boxRadio;
  ctx.font = fontSize + 'px Arial';

  for (let i = 0; i < options.length; i++) {
    ctx.fillText(
      options[i].label,
      x + hUnit * boxRadio + 10,
      y + i * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2
    );

    if (pen.checkedOption === options[i].key) {
      ctx.lineWidth = (hUnit * boxRadio) / 4;
      ctx.arc(
        x + (hUnit * boxRadio) / 2,
        y + i * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2,
        (hUnit * boxRadio) / 4,
        0,
        2 * Math.PI
      );
    }
    ctx.fill();
  }
  ctx.closePath();
  ctx.restore();
}
