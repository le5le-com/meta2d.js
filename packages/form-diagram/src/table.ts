declare const window: any;
export function table(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onClick = onclick;
    pen.onValue = onValue;
  }
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let col = pen.configure.col;
  ctx.strokeStyle = pen.configure.lineStyle;
  ctx.fillStyle = pen.configure.fillStyle;
  let header = pen.configure.header;
  let rowCount = pen.configure.rowCount;
  let currentPage = pen.currentPage;
  let rowLength = pen.configure.row.length;

  let total = Math.ceil(rowLength / rowCount);
  window.topology.setValue({ id: pen.id, totalPage: total });
  let radioArray = col.filter((e) => e.radio != undefined && e.radio != '');
  //如果所有的radio都没设置，则宽度为实际设置宽度
  //如果有某一列的radio有值，未设置的radio默认为1

  let temX = 0;
  let beforeX = 0;

  let halfXObj = {};
  let colWObj = {};
  if (radioArray.length > 0) {
    let sum = col.reduce(function (prev, cur) {
      //没有设置比例，默认为1
      if (cur.radio == '' || cur.radio == undefined) {
        return prev + 1;
      } else {
        return prev + cur.radio;
      }
    }, 0);
    //获取列坐标
    for (let i = 0; i < col.length; i++) {
      beforeX = temX;
      temX +=
        col[i].radio == '' || col[i].radio == undefined ? 1 : col[i].radio;
      let halfX = ((temX + beforeX) / 2 / sum) * w;
      colWObj[col[i].key] = ((temX - beforeX) / sum) * w;
      halfXObj[col[i].key] = halfX;
    }
  } else {
    for (let i = 0; i < col.length; i++) {
      beforeX = temX;
      temX +=
        col[i].width == '' || col[i].width == undefined ? 100 : col[i].width;
      colWObj[col[i].key] = temX - beforeX;

      halfXObj[col[i].key] = (temX + beforeX) / 2;
    }
    w = col.reduce(function (prev, cur) {
      //没有设置比例，默认为1
      if (cur.width == '' || cur.width == undefined) {
        return prev + 100;
      } else {
        return prev + cur.width;
      }
    }, 0);
  }
  // console.log('half', halfXObj, colWObj);
  //绘制第一行
  ctx.beginPath();
  if (header.fillColor) {
    ctx.fillStyle = header.fillColor;
  }
  if (header.transparency) {
    ctx.globalAlpha = header.transparency;
  }
  if (header.height) {
    ctx.rect(x, y, w, header.height);
  } else {
    ctx.rect(x, y, w, pen.configure.rowHeight);
  }
  ctx.stroke();
  ctx.fill();
  let operation = pen.configure.operation;
  // 绘制数据行
  let temY = header.height;
  let beforeY = 0;
  for (
    let i = 0 + currentPage * rowCount;
    i - currentPage * rowCount < rowCount;
    i++
  ) {
    let oneCol = null;
    if (i < rowLength) {
      oneCol = pen.configure.row[i];
      beforeY = temY;

      if (oneCol.height) {
        temY += oneCol.height;
      } else {
        temY += pen.configure.rowHeight;
      }
      if (oneCol.fillColor) {
        ctx.fillStyle = oneCol.fillColor;
      } else {
        ctx.fillStyle = pen.configure.fillStyle;
      }
      if (oneCol.transparency) {
        ctx.globalAlpha = oneCol.transparency;
      } else {
        ctx.globalAlpha = pen.configure.transparency;
      }
    } else {
      beforeY = temY;
      temY += pen.configure.rowHeight;
      ctx.fillStyle = pen.configure.fillStyle;
      ctx.globalAlpha = pen.configure.transparency;
    }
    ctx.beginPath();
    ctx.moveTo(x, y + temY);
    ctx.lineTo(x + w, y + temY);
    if (
      x < pen.currentClickX &&
      pen.currentClickX < x + w &&
      pen.currentClickY > y + beforeY &&
      pen.currentClickY < y + temY
    ) {
      ctx.fillStyle = pen.configure.selectStyle;
      window.topology.setValue({
        id: pen.id,
        currentData: JSON.stringify(oneCol),
      });
    }
    ctx.rect(x, y + beforeY, w, temY - beforeY);
    ctx.stroke();
    ctx.fill();
    pen.fillStyle = pen.configure.fillStyle;
    ctx.closePath();
    ctx.beginPath();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pen.configure.textStyle;
    ctx.font = pen.fontSize + 'px Arial';
    let halfY = (beforeY + temY) / 2;
    ctx.globalAlpha = 1;
    if (oneCol) {
      if (oneCol.textColor) {
        ctx.fillStyle = oneCol.textColor;
      } else {
        ctx.fillStyle = pen.configure.textStyle;
      }
      if (oneCol.font) {
        ctx.font = oneCol.font;
      }
      for (let j in oneCol) {
        if (halfXObj[j]) {
          let temText = '';
          if (ctx.measureText(oneCol[j]).width < colWObj[j]) {
            temText = oneCol[j];
          } else {
            let fenmu = ctx.measureText(oneCol[j]).width;
            let fenzhi = colWObj[j];
            let to = parseInt((oneCol[j].length * fenzhi) / fenmu + '');
            temText = oneCol[j].slice(0, to - 3) + '...';
          }
          ctx.fillText(temText, x + halfXObj[j], y + halfY);
          ctx.fill();
        }
      }
    }
    let beginIndex = pen.configure.header.beginIndex;
    if (halfXObj['index']) {
      ctx.fillText(
        i + (beginIndex === undefined ? 0 : beginIndex) + '',
        x + halfXObj['index'],
        y + halfY
      );
      ctx.fill();
    }
    ctx.closePath();
    if (halfXObj['operation'] && oneCol) {
      ctx.beginPath();
      ctx.fillStyle = operation.fillStyle;
      if (
        x + halfXObj['operation'] - operation.width / 2 < pen.currentClickX &&
        pen.currentClickX <
          x + halfXObj['operation'] + operation.width / 2 + w &&
        pen.currentClickY > y + halfY - operation.height / 2 &&
        pen.currentClickY < y + halfY + operation.height / 2
      ) {
        ctx.fillStyle = operation.btnPressColor;

        if (pen.clickBtnY === 0 && pen.clickBtnX == 0) {
          window.topology.setValue({
            id: pen.id,
            clickBtnX: halfXObj['operation'],
          });
          window.topology.setValue({ id: pen.id, clickBtnY: halfY });
          window.topology.setValue({ id: pen.id, isOperation: 1 });
          window.topology.setValue({ id: pen.id, isOperation: 0 });
        }
      }
      // window.topology.setValue(pen.id, 0, 'isOperation');
      ctx.rect(
        x + halfXObj['operation'] - operation.width / 2,
        y + halfY - operation.height / 2,
        operation.width,
        operation.height
      );
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.fillStyle = operation.textColor;
      ctx.font = operation.font;
      ctx.fillText(operation.text, x + halfXObj['operation'], y + halfY);
      ctx.fill();
    }
    ctx.closePath();
    ctx.globalAlpha = pen.configure.transparency;
    ctx.font = pen.fontSize + 'px Arial';
  }
  let realH = temY;
  //绘制列
  ctx.beginPath();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pen.configure.header.textColor;
  if (pen.configure.header.font) {
    ctx.font = pen.configure.header.font;
  } else {
    ctx.font = pen.fontSize + 'px Arial';
  }
  ctx.globalAlpha = 1;
  temX = 0;
  beforeX = 0;
  for (let i = 0; i < col.length; i++) {
    let halfY = pen.configure.rowHeight / 2;
    if (header.height) {
      halfY = header.height / 2;
    }
    beforeX = temX;
    let halfX = 0;
    let temWidth = 0;
    let beforeWidth = 0;
    let gapWidth = 0;
    //通过比例
    if (radioArray.length > 0) {
      temX +=
        col[i].radio == '' || col[i].radio == undefined ? 1 : col[i].radio;
      halfX = ((temX + beforeX) / 2 / sum) * w;
      temWidth = (temX / sum) * w;
      beforeWidth = (beforeX / sum) * w;
      gapWidth = ((temX - beforeX) / sum) * w;
    } else {
      //通过固定宽度
      temX +=
        col[i].width == '' || col[i].width == undefined ? 100 : col[i].width;
      halfX = (temX + beforeX) / 2;
      temWidth = temX;
      beforeWidth = beforeX;
      gapWidth = temWidth - beforeWidth;
    }
    ctx.fillText(col[i].name, x + halfX, y + halfY);
    ctx.moveTo(x + temWidth, y);
    ctx.lineTo(x + temWidth, y + realH);
    ctx.stroke();
    if (col[i].fillColor) {
      ctx.beginPath();
      ctx.fillStyle = col[i].fillColor;
      ctx.globalAlpha = 0.1;
      ctx.rect(
        x + beforeWidth,
        y + header.height,
        gapWidth,
        realH - header.height
      );
      ctx.fill();
      ctx.closePath();
      ctx.fillStyle = pen.configure.header.textColor;
      ctx.globalAlpha = 1;
    }
  }
  ctx.closePath();
}

function onclick(pen: any) {
  let mycanvas = document.getElementById('topology');
  mycanvas.onmousedown = () => {
    var event = event || window.event;
    window.topology.setValue({
      id: pen.id,
      currentClickX: event.offsetX - window.topology.store.data.x,
    });
    window.topology.setValue({
      id: pen.id,
      currentClickY: event.offsetY - window.topology.store.data.y,
    });
    if (pen.clickBtnY === 0 && pen.clickBtnX == 0) {
      return;
    }
    if (
      pen.clickBtnY - pen.configure.operation.height / 2 > pen.currentClickY ||
      pen.clickBtnY + pen.configure.operation.height / 2 < pen.currentClickY ||
      pen.clickBtnX - pen.configure.operation.width / 2 > pen.currentClickX ||
      pen.clickBtnX + pen.configure.operation.width / 2 < pen.currentClickX
    ) {
      window.topology.setValue({ id: pen.id, clickBtnY: 0 });
      window.topology.setValue({ id: pen.id, clickBtnX: 0 });
      window.topology.setValue({ id: pen.id, isOperation: 0 });
    }
  };
}

function onValue(pen: any) {
  // console.log('监听到setValue事件');
}
function add(topology: any, pen: any) {
  const childPen: any = {
    name: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 20,
    progress: 1,
    text: '数据',
    calculative: {
      textDrawRect: {
        height: 10,
        width: 10,
        x: 100,
        y: 100,
      },
      worldTextRect: {
        height: 10,
        width: 10,
        x: 100,
        y: 100,
      },
    },
    animateCycle: 1000,
    keepAnimateState: 0,
    dropdownList: ['aaa', 'bbb', 'ccc'],
  };
  topology.canvas.makePen(childPen);
  console.log(childPen);
  topology.pushChildren(pen, [childPen]);
}
