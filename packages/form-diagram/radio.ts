import { Pen } from '../core/src/pen';

declare const window: any;
var currentTopology: any;
export function radio(
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
  // pen.lineWidth = h / 5;
  // path.lineWidth = h / 5;
  pen.textLeft = h;
  pen.textWidth = w - h;
  pen.textAlign = 'start';
  pen.textBaseline = 'middle';
  path.arc(x + h / 2, y + h / 2, h / 2, 0, Math.PI * 2);
  if (pen.isChecked) {
    path.moveTo(x, y + h / 2);
    path.lineTo(x + h / 2, y + h);
    path.lineTo(x + h, y);
  }
  return path;
}

function click(pen: any) {
  let isChecked = pen.isChecked;
  currentTopology.setValue({
    id: pen.id,
    isChecked: !isChecked,
  });
}

function add(topology: any, pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  currentTopology = topology;
  const childPen: any = {
    name: 'circle',
    x: x + h / 4,
    y: y + h / 4,
    width: h / 2,
    height: h / 2,
    progress: 1,
  };
  currentTopology.canvas.makePen(childPen);
  currentTopology.pushChildren(pen, [childPen]);
}
