declare const window: any;
export function progress(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onResize = resize;
    pen.onClick = click;
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
  ctx.fillStyle = '#F5F5F5';
  // ctx.rect(x, y + (h * 2) / 5, sliderW, (h * 1) / 5);
  let r = (0.5 * h) / 5;
  ctx.moveTo(x + r, y + (h * 2) / 5);
  ctx.arcTo(x + sliderW, y + (h * 2) / 5, x + sliderW, y + (h * 3) / 5, r);
  ctx.arcTo(x + sliderW, y + (h * 3) / 5, x, y + (h * 3) / 5, r);
  ctx.arcTo(x, y + (h * 3) / 5, pen.x, pen.y, r);
  ctx.arcTo(x, y + (h * 2) / 5, x + sliderW, y + (h * 2) / 5, r);
  ctx.stroke();
  ctx.fill();
  ctx.rect(x + w - inputW, y, inputW, h);
  ctx.stroke();
  ctx.closePath();
  let currenPosition =
    (sliderW * (parseInt(pen.text) - pen.min)) / (pen.max - pen.min);
  ctx.beginPath();
  ctx.fillStyle = pen.fillColor;
  // ctx.rect(x, y + (h * 2) / 5, currenPosition, (h * 1) / 5);
  ctx.moveTo(x + r, y + (h * 2) / 5);
  ctx.arcTo(
    x + currenPosition,
    y + (h * 2) / 5,
    x + currenPosition,
    y + (h * 3) / 5,
    r
  );
  ctx.arcTo(x + currenPosition, y + (h * 3) / 5, x, y + (h * 3) / 5, r);
  ctx.arcTo(x, y + (h * 3) / 5, pen.x, pen.y, r);
  ctx.arcTo(x, y + (h * 2) / 5, x + currenPosition, y + (h * 2) / 5, r);
  ctx.stroke();
  ctx.fill();
  ctx.closePath();
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  // ctx.strokeStyle = pen.fillColor;
  // ctx.lineWidth = 2;
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

function click(pen: any) {
  let mouseDown = pen.calculative.canvas.mouseDown;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  let sliderW = w * pen.sliderRadio;
  if (
    mouseDown.x > pen.x &&
    mouseDown.x < pen.x + sliderW &&
    mouseDown.y > pen.y + (h * 2) / 5 &&
    mouseDown.y < pen.y + (h * 3) / 5
  ) {
    let value = Math.round(
      ((mouseDown.x - pen.x) / sliderW) * (pen.max - pen.min)
    );
    pen.calculative.canvas.parent.setValue({
      id: pen.id,
      text: value + '',
    });
  }
}
