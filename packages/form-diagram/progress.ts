import { Pen } from '../core/src/pen';

declare const window: any;
export function progress(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onResize = resize;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  let sliderW = w * pen.sliderRadio;
  let inputW = w * pen.inputRadio;

  pen.textLeft = w * (1 - pen.inputRadio) + 2;
  pen.textWidth = inputW;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  ctx.beginPath();
  ctx.rect(x, y + (h * 2) / 5, sliderW, (h * 1) / 5);
  ctx.rect(x + w - inputW, y, inputW, h);
  ctx.stroke();
  ctx.closePath();
  let currenPosition =
    (sliderW * (parseInt(pen.text) - pen.min)) / (pen.max - pen.min);
  ctx.beginPath();
  ctx.fillStyle = pen.fillColor;
  ctx.rect(x, y + (h * 2) / 5, currenPosition, (h * 1) / 5);
  ctx.fill();
  ctx.closePath();
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.moveTo(x + currenPosition + h / 5, y + h / 2);
  ctx.arc(x + currenPosition, y + h / 2, h / 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.closePath();
  return ctx;
}
function resize(pen: any) {
  let w = pen.calculative.worldRect.width;
  pen.textLeft = w * (1 - pen.inputRadio) + 2;
  pen.calculative.textLeft = w * (1 - pen.inputRadio) + 2;
}
