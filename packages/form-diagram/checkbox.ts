import { Pen } from '../core/src/pen';

export function checkbox(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = click;
    pen.onResize = resize;
  }

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  pen.textLeft = h + h / 5;
  pen.calculative.textLeft = h + h / 5;
  pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  ctx.beginPath();
  ctx.rect(x, y, h, h);
  ctx.stroke();
  if (pen.isChecked) {
    ctx.fillStyle = pen.fillColor;
    ctx.fill();
    ctx.beginPath();
    ctx.lineWidth = h / 10;
    ctx.strokeStyle = '#ffffff';
    ctx.moveTo(x + (102 / 506) * h, y + h / 2);
    ctx.lineTo(x + (220 / 506) * h, y + (346 / 460) * h);
    ctx.lineTo(x + (404 / 506) * h, y + (142 / 460) * h);
    ctx.stroke();
  }
  ctx.closePath();
  return false;
}

function click(pen: any) {
  pen.isChecked = !pen.isChecked;
  pen.calculative.canvas.render();
}
function resize(pen: any) {
  let h = pen.calculative.worldRect.height;
  pen.textLeft = h + h / 5;
  pen.calculative.textLeft = h + h / 5;
}
