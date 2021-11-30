export function checkbox(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onAdd = checkboxAdd;
    pen.onDestroy = onDestroy;
    pen.onValue = onValue;
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
      let text = '';
      let itemProps = {};
      if (typeof pen.options[i] === 'object') {
        text = pen.options[i].text;
        itemProps = pen.options[i];
      } else {
        text = pen.options[i];
      }
      const forbidden = pen.forbiddens.includes(text);
      let childPen: any = {
        name: 'checkboxItem',
        x: x + (i * w) / length,
        y: y,
        width: w / length,
        height: h,
        isChecked: pen.selections.includes(text),
        isForbidden: forbidden,
        text: text,
        textLeft: (h * 6) / 5,
        background: '#1890ff',
        hoverColor: forbidden ? '#00000040' : '#000000d9',
        activeColor: forbidden ? '#00000040' : '#000000d9',
        textColor: forbidden ? '#00000040' : '#000000d9',
        fontSize: 14,
        ...itemProps,
      };
      pen.calculative.canvas.makePen(childPen);
      pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
    }
  } else if (pen.direction == 'vertical') {
    let length = pen.options.length;
    for (let i = 0; i < length; i++) {
      let text = '';
      let itemProps = {};
      if (typeof pen.options[i] === 'object') {
        text = pen.options[i].text;
        itemProps = pen.options[i];
      } else {
        text = pen.options[i];
      }
      const forbidden = pen.forbiddens.includes(text);
      let childPen: any = {
        name: 'checkboxItem',
        x: x,
        y: y + ((i * h) / (length * 2 - 1)) * 2,
        width: w,
        height: h / (length * 2 - 1),
        isChecked: pen.selections.includes(text),
        isForbidden: forbidden,
        text: text,
        textLeft: ((h / (length * 2 - 1)) * 6) / 5,
        background: '#1890ff',
        hoverColor: forbidden ? '#00000040' : '#000000d9',
        activeColor: forbidden ? '#00000040' : '#000000d9',
        textColor: forbidden ? '#00000040' : '#000000d9',
        fontSize: 14,
        ...itemProps,
      };
      pen.calculative.canvas.makePen(childPen);
      pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
    }
  }
}

function onValue(pen: any) {
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let h = pen.calculative.worldRect.height;
  let length = pen.options.length;
  if (pen.direction == 'horizontal') {
    for (let i = 0; i < length; i++) {
      let text = '';
      let itemProps = {};
      if (typeof pen.options[i] === 'object') {
        text = pen.options[i].text;
        itemProps = pen.options[i];
      } else {
        text = pen.options[i];
      }
      if (pen.children[i]) {
        let childPen: any = {
          id: pen.children[i],
          x: (i * w) / length / w,
          y: 0,
          width: 1 / length,
          height: 1,
          isChecked: pen.selections.includes(text),
          text: text,
          textLeft: (h * 6) / 5,
        };
        pen.calculative.canvas.parent.setValue(childPen);
      } else {
        const forbidden = pen.forbiddens.includes(text);
        //修改options选项，新增子节点
        let childPen: any = {
          name: 'checkboxItem',
          x: x + (i * w) / length,
          y: y,
          width: w / length,
          height: h,
          isChecked: pen.selections.includes(text),
          isForbidden: forbidden,
          text: text,
          textLeft: (h * 6) / 5,
          background: '#1890ff',
          hoverColor: forbidden ? '#00000040' : '#000000d9',
          activeColor: forbidden ? '#00000040' : '#000000d9',
          textColor: forbidden ? '#00000040' : '#000000d9',
          fontSize: 14,
          ...itemProps,
        };
        pen.calculative.canvas.makePen(childPen);
        pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
      }
    }
  } else if (pen.direction == 'vertical') {
    for (let i = 0; i < length; i++) {
      let text = '';
      let itemProps = {};
      if (typeof pen.options[i] === 'object') {
        text = pen.options[i].text;
        itemProps = pen.options[i];
      } else {
        text = pen.options[i];
      }
      if (pen.children[i]) {
        let childPen: any = {
          id: pen.children[i],
          x: 0,
          y: (((i * h) / (length * 2 - 1)) * 2) / h,
          width: 1,
          height: 1 / (length * 2 - 1),
          isChecked: pen.selections.includes(text),
          text: text,
          textLeft: ((h / (length * 2 - 1)) * 6) / 5,
        };
        pen.calculative.canvas.parent.setValue(childPen);
      } else {
        const forbidden = pen.forbiddens.includes(text);
        let childPen: any = {
          name: 'checkboxItem',
          x: x,
          y: y + ((i * h) / (length * 2 - 1)) * 2,
          width: w,
          height: h / (length * 2 - 1),
          isChecked: pen.selections.includes(text),
          isForbidden: forbidden,
          text: text,
          textLeft: ((h / (length * 2 - 1)) * 6) / 5,
          background: '#1890ff',
          hoverColor: forbidden ? '#00000040' : '#000000d9',
          activeColor: forbidden ? '#00000040' : '#000000d9',
          textColor: forbidden ? '#00000040' : '#000000d9',
          fontSize: 14,
          ...itemProps,
        };
        pen.calculative.canvas.makePen(childPen);
        pen.calculative.canvas.parent.pushChildren(pen, [childPen]);
      }
    }
  }
  if (length < pen.children.length) {
    pen.children.splice(length, pen.children.length).forEach((p) => {
      const i = pen.calculative.canvas.parent.store.data.pens.findIndex(
        (item) => item.id === p
      );
      if (i > -1) {
        pen.calculative.canvas.parent.store.data.pens.splice(i, 1);
        pen.calculative.canvas.parent.store.pens[p] = undefined;
      }
    });
  }
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
