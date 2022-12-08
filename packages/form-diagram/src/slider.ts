import { formPen } from './common';
import { Point } from '../../core/src/point';
import { calcRightBottom, calcTextRect } from '@topology/core';

export function slider(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.onAdd) {
    pen.onAdd = initRect;
    pen.onResize = initRect;
    pen.onMove = initRect;
    pen.onMouseMove = mouseMove;
    pen.onMouseDown = mouseDown;
    pen.onValue = onValue;
    pen.onBeforeValue = beforeValue;
  }

  if (!pen.calculative.barRect) {
    initRect(pen);
    // return;
  }

  const data = pen.calculative.canvas.store.data;
  const options = pen.calculative.canvas.store.options;
  // calcBallRect(pen);

  // draw bar
  ctx.fillStyle = pen.background;
  ctx.beginPath();
  let x = pen.calculative.worldRect.x + pen.calculative.barRect.x;
  let y = pen.calculative.worldRect.y + pen.calculative.barRect.y;
  let w = pen.calculative.barRect.width;
  let h = pen.calculative.barRect.height;
  let r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, pen.x, pen.y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();

  // draw active bar
  // ctx.fillStyle = pen.activeColor || data.activeColor || options.activeColor;
  ctx.fillStyle = pen.activeColor || options.activeColor;
  ctx.beginPath();
  w = pen.calculative.ballRect.x;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, pen.x, pen.y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();

  // draw ball
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  x = pen.calculative.worldRect.x + pen.calculative.ballRect.x;
  y =
    pen.calculative.worldRect.y +
    pen.calculative.ballRect.y +
    pen.calculative.ballRect.height / 2;
  ctx.lineWidth = pen.calculative.ballRect.width / 10;
  ctx.arc(x, y, pen.calculative.ballRect.width / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function initRect(pen: formPen) {
  if (!pen._textWidth) {
    pen._textWidth = pen.textWidth || 50;
    pen._fontSize = pen.fontSize || 12;
  }
  pen.textWidth = pen.calculative.worldRect.width;
  pen.calculative.textWidth = pen.textWidth;
  if (!pen.unit) {
    pen.unit = '%';
  }
  if (!pen.sliderWidth) {
    pen.sliderWidth = pen.width;
  }
  if (!pen.sliderHeight) {
    pen.sliderHeight = pen.height;
  }

  if (!pen.calculative.worldRect) {
    return;
  }

  const scaleX = pen.calculative.worldRect.width / pen.sliderWidth;
  const scaleY = pen.calculative.worldRect.height / pen.sliderHeight;
  const textScale = Math.min(scaleX, scaleY);
  pen.fontSize = pen._fontSize * textScale;

  const barWidth = pen.calculative.worldRect.width - pen._textWidth * textScale;
  pen.textLeft = barWidth + 10 * textScale;
  pen.calculative.textLeft = pen.textLeft;

  pen.calculative.barRect = {
    x: 0,
    y: (pen.calculative.worldRect.height - pen.barHeight * scaleY) / 2,
    width: barWidth,
    height: pen.barHeight * scaleY,
  };
  calcRightBottom(pen.calculative.barRect);

  calcBallRect(pen);
}

function calcBallRect(pen: formPen) {
  const height = pen.calculative.barRect.height * 3.5;
  const progress =
    (pen.calculative.barRect.width * (pen.value as number)) / 100;
  pen.calculative.ballRect = {
    x: progress,
    y: (pen.calculative.worldRect.height - height) / 2,
    width: height,
    height,
  };
  calcRightBottom(pen.calculative.ballRect);

  pen.calculative.text = pen.value + pen.unit;
  calcTextRect(pen);
}

function mouseDown(pen: formPen, e: Point) {
  const pos = e.x - pen.calculative.worldRect.x;
  if (pos > pen.calculative.barRect.width) {
    return;
  }

  let value = Math.round((pos / pen.calculative.barRect.width) * 100);
  if (value < pen.min || value > pen.max) {
    return;
  }
  if (value < 0 || value > 100) {
    return;
  }
  pen.value = value;
  calcBallRect(pen);
  pen.calculative.text = pen.value + pen.unit;
  calcTextRect(pen);
  pen.calculative.canvas.store.emitter.emit('valueUpdate', pen);
  pen.calculative.canvas.render();
}

function mouseMove(pen: formPen, e: Point) {
  if (pen.calculative.canvas.mouseDown) {
    mouseDown(pen, e);
  }
}

function onValue(pen: formPen) {
  if (pen.calculative.isUpdateData) {
    delete pen.calculative.isUpdateData;
    initRect(pen);
  }
  calcBallRect(pen);
}

function beforeValue(pen: formPen, value: any) {
  pen.calculative.isUpdateData = false;

  if (value.textWidth || value.barHeight) {
    if (value.textWidth) {
      pen._textWidth = 0;
    }
    pen.calculative.isUpdateData = true;
  }

  return value;
}
