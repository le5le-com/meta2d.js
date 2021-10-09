import { Pen } from "../core/src/pen";
declare const window: any;

export function button(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    // pen.onAdd = onAdd;
    // pen.onClick = click;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let ex = pen.calculative.worldRect.ex;
  let ey = pen.calculative.worldRect.ey;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  ctx.beginPath();
  ctx.fillStyle = pen.fillColor;
  let wr = pen.borderRadius || 0;
  let hr = pen.borderRadius || 0;
  if (wr < 1) {
    wr = w * wr;
    hr = h * hr;
  }
  let r = wr < hr ? wr : hr;
  if (w < 2 * r) {
    r = w / 2;
  }
  if (h < 2 * r) {
    r = h / 2;
  }

  ctx.moveTo(x + r, y);
  ctx.arcTo(ex, y, ex, ey, r);
  ctx.arcTo(ex, ey, x, ey, r);
  ctx.arcTo(x, ey, x, y, r);
  ctx.arcTo(x, y, ex, y, r);
  ctx.stroke();
  ctx.fill();
  ctx.closePath();
  return false;
}

function click(pen: any) {
  console.log(pen.calculative.canvas);
  let temStyle = pen.fillColor;
  window.topology.setValue({ id: pen.id, fillColor: pen.pressColor });
  window.setTimeout(() => {
    window.topology.setValue({ id: pen.id, fillColor: temStyle });
  }, 100);
  //   var parent =window.topology.getParent(pen);
  //   window.topology.setValue(parent.id, 0, "currentPage");
}

// function onAdd(topology: any, pen: any) {
//   console.log("进入onadd");
//   console.log(topology.canvas);
// }
