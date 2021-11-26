// declare const window: any;
export function radioItem(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = click;
    pen.onResize = resize;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  // pen.lineWidth = h / 5;
  // ctx.lineWidth = h / 5;
  pen.textLeft = h + h / 5;
  pen.calculative.textLeft = h + h / 5;
  // pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  ctx.strokeStyle = '#d9d9d9';
  if (pen.isChecked) {
    ctx.strokeStyle = '#1890ff20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + h / 2, y + h / 2, h / 2 + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.closePath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1890ff';
  }
  ctx.beginPath();
  ctx.arc(x + h / 2, y + h / 2, h / 2, 0, Math.PI * 2);
  ctx.stroke();
  if (pen.isForbidden) {
    ctx.fillStyle = '#F5F5F5';
    ctx.fill();
  }
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
  if (pen.isForbidden) {
    return;
  }
  if (pen.isChecked) {
    return;
  } else {
    pen.isChecked = true;
    let parent = pen.calculative.canvas.parent.getParent(pen);
    if (parent) {
      parent.selection = pen.text;
    }
    parent.children.forEach((e: string) => {
      if (e !== pen.id) {
        pen.calculative.canvas.parent.setValue({
          id: e,
          isChecked: false,
        });
      }
    });
  }
  // pen.calculative.canvas.parent.render();
}

function resize(pen: any) {
  let h = pen.calculative.worldRect.height;
  pen.textLeft = h + h / 5;
  pen.calculative.textLeft = h + h / 5;
}
