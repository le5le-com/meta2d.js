import { formPen } from './common';
import { pSBC } from '@meta2d/core';

export function le5leSwitch(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.onClick) {
    pen.onClick = click;
    pen.setTheme = setTheme;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  if (w < h * 1.5) {
    w = 1.5 * h;
  }
  ctx.beginPath();
  ctx.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.lineTo(x + w - h / 2, y);
  ctx.arc(x + w - h / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + h / 2, y + h);
  if (pen.checked) {
    ctx.fillStyle = pen.onColor;
    if (pen.disabled || pen.disable) {
      ctx.fillStyle = pen.disableOnColor || pSBC(0.6,pen.onColor);
    }
    if(pen.lineWidth){
      ctx.strokeStyle = pen.onStrokeColor;
      ctx.stroke();
    }
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(x + h * 2, y + h / 2);
    ctx.arc(
      x + w - h / 2,
      y + h / 2,
      h / 2 > 2 ? h / 2 - 2 : 1,
      0,
      Math.PI * 2
    );

    ctx.fill();
  } else {
    ctx.fillStyle = pen.offColor;
    if (pen.disabled || pen.disable) {
      ctx.fillStyle = pen.disableOffColor || pSBC(0.6,pen.offColor);
    }
    if(pen.lineWidth){
      ctx.strokeStyle = pen.offStrokeColor;
      ctx.stroke();
    }
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(x + h, y + h / 2);
    ctx.arc(x + h / 2, y + h / 2, h / 2 > 2 ? h / 2 - 2 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.closePath();
}

function click(pen: formPen) {
  if (pen.disabled || pen.disable) {
    return;
  }
  pen.checked = !pen.checked;
  pen.calculative.canvas.store.emitter.emit('valueUpdate', pen);
  pen.calculative.canvas.render();
}
function setTheme(pen:any,styles:any){
  for (const key in styles) {
    if (Object.prototype.hasOwnProperty.call(styles, key)) {
      const element = styles[key];
        if(pen.hasOwnProperty(key)){
          pen[key] = element;
        }
        if(pen.calculative.hasOwnProperty(key)){
          pen.calculative[key] = element;
        }
    }
  }
  pen.onStrokeColor = styles["borderColor"];
  pen.offStrokeColor = styles["borderColor"];
}