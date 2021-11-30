// declare const window: any;
export function checkboxItem(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = click;
    pen.onResize = resize;
  }

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  let r = 2;

  pen.textLeft = h + h / 5;
  pen.calculative.textLeft = h + h / 5;
  // pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  ctx.beginPath();
  // ctx.rect(x, y, h, h);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + h, y, x + h, y + h, r);
  ctx.arcTo(x + h, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + h, y, r);
  ctx.strokeStyle = '#d9d9d9';
  if (pen.isChecked) {
    ctx.strokeStyle = '#1890ff';
  }
  if (pen.isForbidden) {
    ctx.strokeStyle = '#d9d9d9';
    ctx.fillStyle = '#ebebeb';
    ctx.fill();
  }
  ctx.stroke();
  if (pen.isChecked) {
    ctx.fillStyle = pen.background;
    if (pen.isForbidden) {
      ctx.fillStyle = '#ebebeb';
    }
    ctx.fill();
    if (!pen.isForbidden) {
      ctx.beginPath();
      ctx.lineWidth = h / 10;
      ctx.strokeStyle = '#ffffff';
      ctx.moveTo(x + (102 / 506) * h, y + h / 2);
      ctx.lineTo(x + (220 / 506) * h, y + (346 / 460) * h);
      ctx.lineTo(x + (404 / 506) * h, y + (142 / 460) * h);
      ctx.stroke();
    }
  }
  ctx.closePath();
  return false;
}

function click(pen: any) {
  if (pen.isForbidden) {
    return;
  }
  pen.isChecked = !pen.isChecked;
  let parent = pen.calculative.canvas.parent.getParent(pen);
  if (parent) {
    if (pen.isChecked) {
      parent.selections.push(pen.text);
    } else {
      let index = parent.selections.indexOf(pen.text);
      parent.selections.splice(index, 1);
    }
    parent.children.forEach((e: string) => {
      let child = pen.calculative.canvas.parent.find(e)[0];
      if (parent.selections.includes(child.text)) {
        pen.calculative.canvas.parent.setValue({
          id: e,
          isChecked: true,
        });
      } else {
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
