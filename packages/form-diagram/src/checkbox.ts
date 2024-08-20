import { formPen } from './common';
import { Point } from '../../core/src/point';
import { getTextColor, getFont } from '../../core';
import { pSBC } from '../../core';

export function checkbox(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.onMouseDown) {
    pen.onMouseDown = onMousedown;
  }
  if(!pen.options){
    pen.options = pen.data;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let h = pen.calculative.worldRect.height;
  let w = pen.calculative.worldRect.width;
  const { fontStyle, fontWeight, fontSize, fontFamily, lineHeight } =
    pen.calculative;
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

  if (pen.isForbidden || pen.disabled) {
    ctx.fillStyle = pen.disabledBackground || pSBC(0.6 ,pen.background)|| '#ebebeb';
    ctx.strokeStyle = pen.disabledColor || pSBC(0.6 ,pen.color)||'#d9d9d9';
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
  ctx.fillStyle = (pen.disabled || pen.isForbidden)
    ? pen.disabledTextColor || pSBC(0.6,pen.textColor||pen.color)||'#00000040'
    : getTextColor(pen, pen.calculative.canvas.parent.store) || '#000000d9';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  // ctx.font =
  //   (pen.calculative.fontStyle || '') +
  //   ' normal ' +
  //   (pen.calculative.fontWeight || '') +
  //   ' ' +
  //   pen.fontSize +
  //   'px ' +
  //   pen.calculative.fontFamily;

  ctx.font = getFont({
    fontStyle,
    fontWeight,
    fontFamily:
      fontFamily || pen.calculative.canvas.parent.store.options.fontFamily,
    fontSize,
    lineHeight,
  });
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
