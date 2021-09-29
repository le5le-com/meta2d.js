import { Pen } from '../core/src/pen';

declare const window: any;
var currentTopology: any;
export function leSwitch(
  pen: any,
  path?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | Path2D
) {
  if (!pen.onDestroy) {
    pen.onAdd = add;
    pen.onClick = click;
  }
  if (!path) {
    path = new Path2D();
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  pen.textLeft = h;
  pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  //   pen.lineWidth = h / 5;
  //   path.lineWidth = h / 5;
  path.arc(x + h / 2, y + h / 2, h / 2, Math.PI / 2, (Math.PI * 3) / 2);
  path.lineTo(x + (h * 3) / 2, y);
  path.arc(x + (h * 3) / 2, y + h / 2, h / 2, -Math.PI / 2, Math.PI / 2);
  path.lineTo(x + h / 2, y + h);
  if (pen.isOpen) {
    path.moveTo(x + h * 2, y + h / 2);
    path.arc(x + (h * 3) / 2, y + h / 2, h / 2, 0, Math.PI * 2);
  } else {
    path.moveTo(x + h, y + h / 2);
    path.arc(x + h / 2, y + h / 2, h / 2, 0, Math.PI * 2);
  }
  return path;
}

function click(pen: any) {
  let isOpen = pen.isOpen;
  currentTopology.setValue({
    id: pen.id,
    isOpen: !isOpen,
  });
}

function add(topology: any, pen: any) {
  currentTopology = topology;
}
