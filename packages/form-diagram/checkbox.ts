import { Pen } from '../core/src/pen';

declare const window: any;

export function checkbox(pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = click;
  }
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  let options = pen.configure.options;
  let boxRadio = 1 / pen.radio;
  let hUnit = h / (options.length * boxRadio + options.length - 1);
  pen.lineWidth = 3;
  for (let i = 0; i < options.length; i++) {
    path.rect(
      x,
      y + i * hUnit * (boxRadio + 1),
      hUnit * boxRadio,
      hUnit * boxRadio
    );
    if (pen.checkedOptions.includes(options[i].key)) {
      path.moveTo(x, y + i * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2);
      path.lineTo(
        x + (hUnit * boxRadio) / 2,
        y + i * hUnit * (boxRadio + 1) + hUnit * boxRadio
      );
      path.lineTo(x + hUnit * boxRadio, y + i * hUnit * (boxRadio + 1));
    }
  }
  path.closePath();

  return path;
}

export function checkboxTextByCtx(ctx: CanvasRenderingContext2D, pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  let options = pen.configure.options;
  let boxRadio = 1 / pen.radio;
  let hUnit = h / (options.length * boxRadio + options.length - 1);
  ctx.beginPath();
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  let fontSize = hUnit * boxRadio;
  ctx.font = fontSize + 'px Arial';

  for (let i = 0; i < options.length; i++) {
    ctx.fillText(
      options[i].label,
      x + hUnit * boxRadio + 10,
      y + i * hUnit * (boxRadio + 1) + (hUnit * boxRadio) / 2
    );
  }
  ctx.closePath();
  ctx.restore();
}

function click(pen: any) {
  let mycanvas = document.getElementById('topology');
  mycanvas.onmousedown = (e) => {
    var event = e || window.event;
    console.log('进入', event);
    window.topology.setValue({
      id: pen.id,
      currentClickX: event.offsetX - window.topology.store.data.x,
    });
    window.topology.setValue({
      id: pen.id,
      currentClickY: event.offsetY - window.topology.store.data.y,
    });
  };
}
