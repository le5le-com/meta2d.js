import { formPen } from './common';
import { pSBC } from '@meta2d/core/src/utils';
import type { Pen } from '@meta2d/core/src/models/pen';
import type { Meta2d } from '@meta2d/core';

export const switchDefine = {
  type: 'switch',
  mouseDown,
  draw: le5leSwitch,
  changeTheme,
};

export function le5leSwitch(ctx: CanvasRenderingContext2D, pen: formPen) {
  let x = pen.x;
  let y = pen.y;
  let w = pen.width;
  let h = pen.height;
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
      ctx.fillStyle = pen.disableOnColor || pSBC(0.6, pen.onColor);
    }
    if (pen.lineWidth) {
      ctx.strokeStyle = pen.onStrokeColor;
      ctx.stroke();
    }
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.moveTo(x + h * 2, y + h / 2);
    ctx.arc(x + w - h / 2, y + h / 2, h / 2 > 2 ? h / 2 - 2 : 1, 0, Math.PI * 2);

    ctx.fill();
  } else {
    ctx.fillStyle = pen.offColor;
    if (pen.disabled || pen.disable) {
      ctx.fillStyle = pen.disableOffColor || pSBC(0.6, pen.offColor);
    }
    if (pen.lineWidth) {
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

function mouseDown(this: Meta2d, _pen: Pen, e: any) {
  const pen: any = this.penMap.get(_pen.id);
  if (!pen) {
    return;
  }
  if (pen.disableDefaultClick) {
    return;
  }
  if (pen.disabled || pen.disable) {
    return;
  }

  this.setValue({ id: pen.id, checked: !pen.checked });
  this.emitter.emit('valueUpdate', pen);
}

function changeTheme(this: Meta2d, pen: formPen, styles: Record<string, string>) {
  pen.onStrokeColor = styles.borderColor || pen.onStrokeColor;
  pen.offStrokeColor = styles.borderColor || pen.offStrokeColor;
}
