export function checkbox(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onAdd = checkboxAdd;
    pen.onDestroy = onDestroy;
    // pen.onValue = onValue;
  }
  // let x = pen.calculative.worldRect.x;
  // let y = pen.calculative.worldRect.y;
  // let w = pen.calculative.worldRect.width;
  // let h = pen.calculative.worldRect.height;
  // ctx.beginPath();
  // ctx.rect(x, y, w, h);
  // ctx.stroke();
  // ctx.closePath();
  return false;
}

function checkboxAdd(pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;

  if (pen.direction == 'horizontal') {
    let length = pen.options.length;
    for (let i = 0; i < length; i++) {
      let childPen: any = {
        name: 'checkboxItem',
        x: x + (i * w) / length,
        y: y,
        width: w / length,
        height: h,
        isChecked: pen.selections.includes(pen.options[i]),
        text: pen.options[i],
        textLeft: (h * 6) / 5,
        fillColor: '#1890ff',
      };
      pen.calculative.canvas.makePen(childPen);
      pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
    }
  } else if (pen.direction == 'vertical') {
    let length = pen.options.length;
    for (let i = 0; i < length; i++) {
      let childPen: any = {
        name: 'checkboxItem',
        x: x,
        y: y + ((i * h) / (length * 2 - 1)) * 2,
        width: w,
        height: h / (length * 2 - 1),
        isChecked: pen.selections.includes(pen.options[i]),
        text: pen.options[i],
        textLeft: ((h / (length * 2 - 1)) * 6) / 5,
        fillColor: '#1890ff',
      };
      pen.calculative.canvas.makePen(childPen);
      pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
    }
  }
}

// function onValue(pen: any) {
//   let pens = [];
//   pen.children.forEach((item: string) => {
//     pens.push(pen.calculative.canvas.parent.find(item)[0]);
//   });
//   pen.children = [];
//   console.log(pens);
//   pens.forEach((p) => {
//     const i = pen.calculative.canvas.parent.store.data.pens.findIndex(
//       (item) => item.id === p.id
//     );
//     if (i > -1) {
//       pen.calculative.canvas.parent.store.data.pens.splice(i, 1);
//       pen.calculative.canvas.parent.store.pens[p.id] = undefined;
//     }
//     p.onDestroy && p.onDestroy(p);
//   });
//   checkboxAdd(pen);
// }

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
