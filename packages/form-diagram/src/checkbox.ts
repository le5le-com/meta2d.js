import { getTextLength, initOptions } from './common';

export function checkbox(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    pen.onMouseDown = onMousedown;
    pen.onValue = onValue;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let h = pen.calculative.worldRect.height;
  let w = pen.calculative.worldRect.width;

  if (!pen.optionPos) {
    return;
  }
  if (pen.direction == 'horizontal') {
    let r = 2;
    for (let i = 0; i < pen.optionPos.length; i++) {
      const gap = (pen.optionPos[i] * w) / pen.checkboxWidth; //选项开始位置
      const isForbidden = pen.options[i].isForbidden;
      ctx.beginPath();
      ctx.moveTo(x + gap + h, y);
      ctx.arcTo(x + gap + h, y, x + gap + h, y + h, r);
      ctx.arcTo(x + gap + h, y + h, x + gap, y + h, r);
      ctx.arcTo(x + gap, y + h, x + gap, y, r);
      ctx.arcTo(x + gap, y, x + gap + h, y, r);

      ctx.strokeStyle = '#d9d9d9';
      ctx.fillStyle = '#ffffff00';
      if (pen.options[i].isChecked) {
        ctx.fillStyle = pen.options[i].background || '#1890ff';
        ctx.strokeStyle = pen.options[i].background || '#1890ff';
      }

      if (isForbidden) {
        ctx.fillStyle = '#ebebeb';
        ctx.strokeStyle = '#d9d9d9';
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      if (!isForbidden && pen.options[i].isChecked) {
        ctx.beginPath();
        ctx.lineWidth = h / 10;
        ctx.strokeStyle = '#ffffff';
        ctx.moveTo(x + (102 / 506) * h + gap, y + h / 2);
        ctx.lineTo(x + (220 / 506) * h + gap, y + (346 / 460) * h);
        ctx.lineTo(x + (404 / 506) * h + gap, y + (142 / 460) * h);
        ctx.stroke();
      }
      ctx.restore();

      //文字
      ctx.save();
      ctx.fillStyle = isForbidden ? '#00000040' : '#000000d9';
      const textScale = (pen.calculative.worldRect.height * 14) / 16;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'middle';
      ctx.font =
        (pen.calculative.fontStyle || '') +
        ' normal ' +
        (pen.calculative.fontWeight || '') +
        ' ' +
        textScale +
        'px ' +
        pen.calculative.fontFamily;
      ctx.fillText(
        pen.options[i].text,
        x + h + gap + (10 / pen.checkboxWidth) * w,
        y + h / 2
      );
      ctx.restore();
    }
  } else if (pen.direction == 'vertical') {
    let r = 2;
    const optionHeight = (pen.optionHeight * h) / pen.checkboxHeight;
    for (let i = 0; i < pen.optionPos.length; i++) {
      const gap = (pen.optionPos[i] * h) / pen.checkboxHeight;
      const isForbidden = pen.options[i].isForbidden;
      ctx.beginPath();
      ctx.moveTo(x + r, y + gap);
      ctx.arcTo(
        x + optionHeight,
        y + gap,
        x + optionHeight,
        y + optionHeight + gap,
        r
      );
      ctx.arcTo(
        x + optionHeight,
        y + optionHeight + gap,
        x,
        y + optionHeight + gap,
        r
      );
      ctx.arcTo(x, y + optionHeight + gap, x, y + gap, r);
      ctx.arcTo(x, y + gap, x + optionHeight, y + gap, r);

      ctx.strokeStyle = '#d9d9d9';
      ctx.fillStyle = '#ffffff00';
      if (pen.options[i].isChecked) {
        ctx.fillStyle = pen.options[i].background || '#1890ff';
        ctx.strokeStyle = pen.options[i].background || '#1890ff';
      }

      if (isForbidden) {
        ctx.fillStyle = '#ebebeb';
        ctx.strokeStyle = '#d9d9d9';
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      if (!isForbidden && pen.options[i].isChecked) {
        ctx.beginPath();
        ctx.lineWidth = optionHeight / 10;
        ctx.strokeStyle = '#ffffff';
        ctx.moveTo(x + (102 / 506) * optionHeight, y + optionHeight / 2 + gap);
        ctx.lineTo(
          x + (220 / 506) * optionHeight,
          y + (346 / 460) * optionHeight + gap
        );
        ctx.lineTo(
          x + (404 / 506) * optionHeight,
          y + (142 / 460) * optionHeight + gap
        );
        ctx.stroke();
      }
      ctx.restore();

      //文字
      ctx.save();
      ctx.fillStyle = isForbidden ? '#00000040' : '#000000d9';
      const textScale =
        (14 * pen.calculative.worldRect.height) / pen.checkboxHeight;
      ctx.textAlign = 'start';
      ctx.textBaseline = 'middle';
      ctx.font =
        (pen.calculative.fontStyle || '') +
        ' normal ' +
        (pen.calculative.fontWeight || '') +
        ' ' +
        textScale +
        'px ' +
        pen.calculative.fontFamily;
      ctx.fillText(
        pen.options[i].text,
        x + optionHeight + 10,
        y + optionHeight / 2 + gap
      );
      ctx.restore();
    }
  }
}

function onAdd(pen: any) {
  initOptions(pen);
}

function onMousedown(pen: any, e: any) {
  if (pen.direction == 'horizontal') {
    for (let i = 0; i < pen.optionPos.length; i++) {
      if (
        !pen.options[i].isForbidden &&
        e.x >
          pen.calculative.worldRect.x +
            (pen.optionPos[i] * pen.calculative.worldRect.width) /
              pen.checkboxWidth &&
        e.x <
          pen.calculative.worldRect.x +
            ((pen.optionPos[i] + pen.height) / pen.checkboxWidth) *
              pen.calculative.worldRect.width +
            getTextLength(pen.options[i].text, pen) +
            (10 / pen.checkboxWidth) * pen.calculative.worldRect.width
      ) {
        pen.options[i].isChecked = !pen.options[i].isChecked;
      }
    }
  } else if (pen.direction == 'vertical') {
    const scaleY = pen.calculative.worldRect.height / pen.checkboxHeight;
    for (let i = 0; i < pen.optionPos.length; i++) {
      if (
        !pen.options[i].isForbidden &&
        e.y > pen.calculative.worldRect.y + pen.optionPos[i] * scaleY &&
        e.y <
          pen.calculative.worldRect.y +
            (pen.optionPos[i] + pen.optionHeight) * scaleY
      ) {
        pen.options[i].isChecked = !pen.options[i].isChecked;
      }
    }
  }
  pen.calculative.canvas.render(Infinity);
}

function onValue(pen: any) {
  initOptions(pen);
}
