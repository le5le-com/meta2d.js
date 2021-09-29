import { Pen } from '../core/src/pen';

export function radio(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = click;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  // pen.lineWidth = h / 5;
  // ctx.lineWidth = h / 5;
  pen.textLeft = h;
  pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  ctx.beginPath();
  ctx.arc(x + h / 2, y + h / 2, h / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.closePath();
  if (pen.isChecked) {
    ctx.beginPath();
    ctx.fillStyle = pen.fillColor;
    ctx.arc(x + h / 2, y + h / 2, h / 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.closePath();
  }
  return false;
}

function click(pen: any) {
  pen.isChecked = !pen.isChecked;
  pen.calculative.canvas.render();
}
