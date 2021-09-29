import { Pen } from '../core/src/pen';

declare const window: any;
var currentTopology: any;
export function progress(
  pen: any,
  path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D
) {
  if (!pen.onDestroy) {
    pen.onAdd = add;
    pen.onValue = onValue;
  }
  if (!path) {
    path = new Path2D();
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  let sliderW = w * pen.sliderRadio;
  let inputW = w * pen.inputRadio;
  pen.textLeft = w * (1 - pen.inputRadio);
  pen.textWidth = inputW;

  pen.textAlign = 'start';
  pen.textBaseline = 'middle';

  pen.text = pen.configure.value;
  path.rect(x, y + (h * 2) / 5, sliderW, (h * 1) / 5);
  let currenPosition =
    (sliderW * (pen.configure.value - pen.configure.min)) /
    (pen.configure.max - pen.configure.min);
  path.moveTo(x + currenPosition + h / 5, y + h / 2);
  path.arc(x + currenPosition, y + h / 2, h / 5, 0, Math.PI * 2);
  path.rect(x + w - inputW, y, inputW, h);

  return path;
}

function add(topology: any, pen: any) {
  currentTopology = topology;
}

function onValue(pen: any) {
  let configure = pen.configure;
  configure.value = parseInt(pen.text);
  currentTopology.setValue({
    id: pen.id,
    configure: configure,
  });
}
