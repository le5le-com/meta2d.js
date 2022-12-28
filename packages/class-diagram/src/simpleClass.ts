import { Pen } from '../../core/src/pen';
export function simpleClass(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = onDestroy;
    pen.onAdd = onAdd;
  }
  const path = !ctx ? new Path2D() : ctx;
  const { x, y, width, height, ex } = pen.calculative.worldRect;
  let wr = pen.calculative.borderRadius || 0,
    hr = wr;
  if (wr < 1) {
    wr = width * wr;
    hr = height * hr;
  }
  let r = wr < hr ? wr : hr;
  if (width < 2 * r) {
    r = width / 2;
  }
  if (height < 2 * r) {
    r = height / 2;
  }
  path.moveTo(x + r, y);
  path.arcTo(x + width, y, x + width, y + height, r);
  path.lineTo(x + width, y + height - r);
  path.arcTo(x + width, y + height, x, y + height, r);
  path.arcTo(x, y + height, x, y, r);
  path.arcTo(x, y, x + width, y, r);
  const topHeight = 0.2 * height;
  path.moveTo(x, y + topHeight);
  path.lineTo(ex, y + topHeight);
  path.closePath();
  if (path instanceof Path2D) return path;
}

function onAdd(pen: Pen) {
  const { x, y, width, height } = pen.calculative.worldRect;
  const list: { text: string }[] = (pen as any).list;
  let childPen: Pen = {
    name: 'text',
    x: x,
    y: y + 0.2 * height,
    width,
    height: 0.8 * height,
    // text: list[0].text,
    textAlign: 'left',
    textBaseline: 'top',
    textLeft: 10,
    textTop: 10,
  };
  Object.assign(childPen, list[0]);
  pen.calculative.canvas.makePen(childPen);
  pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
}
function onDestroy(pen: Pen) {
  const store = pen.calculative.canvas.store;
  pen.children.forEach((p) => {
    const i = store.data.pens.findIndex((item) => item.id === p);
    if (i > -1) {
      store.data.pens.splice(i, 1);
      store.pens[p] = undefined;
    }
  });
  pen.children = undefined;
}
