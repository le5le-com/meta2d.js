import { Pen } from '../../core/src/pen';
export function simpleClass(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = onDestroy;
    pen.onAdd = onAdd;
  }
  const path = new Path2D();
  if (!pen.calculative.borderRadius) {
    pen.calculative.borderRadius = 0;
  }
  let wr = pen.calculative.borderRadius;
  let hr = pen.calculative.borderRadius;
  if (pen.calculative.borderRadius < 1) {
    wr = pen.calculative.worldRect.width * pen.calculative.borderRadius;
    hr = pen.calculative.worldRect.height * pen.calculative.borderRadius;
  }
  let r = wr < hr ? wr : hr;
  if (pen.calculative.worldRect.width < 2 * r) {
    r = pen.calculative.worldRect.width / 2;
  }
  if (pen.calculative.worldRect.height < 2 * r) {
    r = pen.calculative.worldRect.height / 2;
  }
  path.moveTo(pen.calculative.worldRect.x + r, pen.calculative.worldRect.y);
  path.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    r
  );
  path.lineTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height - r
  );
  path.arcTo(
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    r
  );
  path.arcTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y,
    pen.calculative.worldRect.x + pen.calculative.worldRect.width,
    pen.calculative.worldRect.y,
    r
  );
  const topHeight = 0.2 * pen.calculative.worldRect.height;
  path.moveTo(
    pen.calculative.worldRect.x,
    pen.calculative.worldRect.y + topHeight
  );
  path.lineTo(
    pen.calculative.worldRect.ex,
    pen.calculative.worldRect.y + topHeight
  );
  path.closePath();
  return path;
}

function onAdd(pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  let childPen: any = {
    name: 'text',
    x: x,
    y: y + 0.2 * h,
    width: w,
    height: 0.8 * h,
    text: pen.list[0].text,
    textAlign: 'left',
    textBaseline: 'top',
    textLeft: 10,
    textTop: 10,
  };
  pen.calculative.canvas.makePen(childPen);
  pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
}
function onDestroy(pen: any) {
  pen.children.forEach((p) => {
    const i = pen.calculative.canvas.parent.store.data.pens.findIndex(
      (item) => item.id === p
    );
    if (i > -1) {
      pen.calculative.canvas.parent.store.data.pens.splice(i, 1);
      pen.calculative.canvas.parent.store.pens[p] = undefined;
    }
  });
  pen.children = undefined;
}
