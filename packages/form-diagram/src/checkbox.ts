import { getTextLength, initOptions } from './common';
import { formPen } from './common';
import { Point } from '../../core/src/point';

<<<<<<< HEAD
export function checkbox(ctx: CanvasRenderingContext2D, pen: formPen) {
<<<<<<< HEAD
  if (!pen.onDestroy) {
=======
export function checkbox(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onAdd) {
>>>>>>> 2620d99 (registerCanvasDraw type)
    pen.onAdd = onAdd;
    if (!pen.optionPos) {
      pen.onAdd(pen);
    }
=======
  if (!pen.onMouseDown) {
>>>>>>> 7b21798 (perfect_form)
    pen.onMouseDown = onMousedown;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let h = pen.calculative.worldRect.height;
  let w = pen.calculative.worldRect.width;

  let r = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arcTo(x + h, y, x + h, y + h, r);
  ctx.arcTo(x + h, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + h, y, r);

  ctx.strokeStyle = '#d9d9d9';
  ctx.fillStyle = '#ffffff00';
  if (pen.checked) {
    ctx.fillStyle = pen.background || '#1890ff';
    ctx.strokeStyle = pen.background || '#1890ff';
  }

  if (pen.isForbidden) {
    ctx.fillStyle = '#ebebeb';
    ctx.strokeStyle = '#d9d9d9';
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  if (pen.checked) {
    ctx.beginPath();
    ctx.lineWidth = h / 10;
    ctx.strokeStyle = '#ffffff';
    ctx.moveTo(x + (102 / 506) * h, y + h / 2);
    ctx.lineTo(x + (220 / 506) * h, y + (346 / 460) * h);
    ctx.lineTo(x + (404 / 506) * h, y + (142 / 460) * h);
    ctx.stroke();
  }
  ctx.restore();

  //文字
  ctx.save();
  ctx.fillStyle = pen.isForbidden ? '#00000040' : '#000000d9';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.font =
    (pen.calculative.fontStyle || '') +
    ' normal ' +
    (pen.calculative.fontWeight || '') +
    ' ' +
    pen.fontSize +
    'px ' +
    pen.calculative.fontFamily;
  ctx.fillText(pen.value + '', x + h + 10, y + h / 2);
  ctx.restore();
}

function onMousedown(pen: formPen, e: Point) {
  if (!pen.isForbidden) {
    pen.checked = !pen.checked;
    pen.calculative.canvas.store.emitter.emit('valueUpdate', pen);
    pen.calculative.canvas.render();
  }
}
