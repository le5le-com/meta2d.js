import { Pen } from '../core/src/pen';

declare const window: any;
export function table(pen: any) {
  if (!pen.onDestroy) {
    pen.onAdd = add;
  }
  const path = new Path2D();

  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  var col = pen.configure.col;
  // path.strokeStyle = pen.configure.lineStyle;
  // path.fillStyle = pen.configure.fillStyle;
  let header = pen.configure.header;
  let rowCount = pen.configure.rowCount;
  let currentPage = pen.currentPage;
  let rowLength = pen.configure.row.length;

  let total = Math.ceil(rowLength / rowCount);
  // window.topology.setValue(pen.id, total, 'totalPage');
  var radioArray = col.filter((e) => e.radio != undefined && e.radio != '');
  //如果所有的radio都没设置，则宽度为实际设置宽度
  //如果有某一列的radio有值，未设置的radio默认为1

  let temX = 0;
  let beforeX = 0;

  let halfXObj = {};
  let colWObj = {};
  if (radioArray.length > 0) {
    var sum = col.reduce(function (prev, cur) {
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
  // path.beginPath();
  // if (header.fillColor) {
  //   path.fillStyle = header.fillColor;
  // }
  // if (header.transparency) {
  //   path.globalAlpha = header.transparency;
  // }
  if (header.height) {
    path.rect(x, y, w, header.height);
  } else {
    path.rect(x, y, w, pen.configure.rowHeight);
  }
  // path.stroke();
  // path.fill();
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
      // if (oneCol.fillColor) {
      //   path.fillStyle = oneCol.fillColor;
      // } else {
      //   path.fillStyle = pen.configure.fillStyle;
      // }
      // if (oneCol.transparency) {
      //   path.globalAlpha = oneCol.transparency;
      // } else {
      //   path.globalAlpha = pen.configure.transparency;
      // }
    } else {
      beforeY = temY;
      temY += pen.configure.rowHeight;
      // path.fillStyle = pen.configure.fillStyle;
      // path.globalAlpha = pen.configure.transparency;
    }
    // path.beginPath();
    path.moveTo(x, y + temY);
    path.lineTo(x + w, y + temY);
    if (
      x < pen.currentClickX &&
      pen.currentClickX < x + w &&
      pen.currentClickY > y + beforeY &&
      pen.currentClickY < y + temY
    ) {
      // path.fillStyle = pen.configure.selectStyle;
      // window.topology.setValue(pen.id, JSON.stringify(oneCol), 'currentData');
    }
    path.rect(x, y + beforeY, w, temY - beforeY);
    // path.stroke();
    // path.fill();
    // pen.fillStyle = pen.configure.fillStyle;
    path.closePath();
    // path.beginPath();
    // path.textAlign = 'center';
    // path.textBaseline = 'middle';
    // path.fillStyle = pen.configure.textStyle;
    // path.font = pen.fontSize + 'px Arial';
    let halfY = (beforeY + temY) / 2;
    // path.globalAlpha = 1;
    if (oneCol) {
      // if (oneCol.textColor) {
      //   path.fillStyle = oneCol.textColor;
      // } else {
      //   path.fillStyle = pen.configure.textStyle;
      // }
      if (oneCol.font) {
        // path.font = oneCol.font;
      }
      // for (let j in oneCol) {
      //   if (halfXObj[j]) {
      //     let temText = '';
      //     if (path.measureText(oneCol[j]).width < colWObj[j]) {
      //       temText = oneCol[j];
      //     } else {
      //       let fenmu = path.measureText(oneCol[j]).width;
      //       let fenzhi = colWObj[j];
      //       let to = parseInt((oneCol[j].length * fenzhi) / fenmu + '');
      //       temText = oneCol[j].slice(0, to - 3) + '...';
      //     }
      //     path.fillText(temText, x + halfXObj[j], y + halfY);
      //     path.fill();
      //   }
      // }
    }
    let beginIndex = pen.configure.header.beginIndex;
    if (halfXObj['index']) {
      // path.fillText(
      //   i + (beginIndex === undefined ? 0 : beginIndex) + '',
      //   x + halfXObj['index'],
      //   y + halfY
      // );
      // path.fill();
    }
    path.closePath();
    if (halfXObj['operation'] && oneCol) {
      // path.beginPath();
      // path.fillStyle = operation.fillStyle;
      if (
        x + halfXObj['operation'] - operation.width / 2 < pen.currentClickX &&
        pen.currentClickX <
          x + halfXObj['operation'] + operation.width / 2 + w &&
        pen.currentClickY > y + halfY - operation.height / 2 &&
        pen.currentClickY < y + halfY + operation.height / 2
      ) {
        // path.fillStyle = operation.btnPressColor;

        if (pen.clickBtnY === 0 && pen.clickBtnX == 0) {
          // window.topology.setValue(pen.id, halfXObj['operation'], 'clickBtnY');
          // window.topology.setValue(pen.id, halfY, 'clickBtnY');
          // window.topology.setValue(pen.id, 1, 'isOperation');
          // window.topology.setValue(pen.id, 0, 'isOperation');
        }
      }
      // window.topology.setValue(pen.id, 0, 'isOperation');
      path.rect(
        x + halfXObj['operation'] - operation.width / 2,
        y + halfY - operation.height / 2,
        operation.width,
        operation.height
      );
      // path.fill();
      path.closePath();
      // path.beginPath();
      // path.fillStyle = operation.textColor;
      // path.font = operation.font;
      // path.fillText(operation.text, x + halfXObj['operation'], y + halfY);
      // path.fill();
    }
    path.closePath();
    // path.globalAlpha = pen.configure.transparency;
    // path.font = pen.fontSize + 'px Arial';
  }
  let realH = temY;
  //绘制列
  // path.beginPath();
  // path.textAlign = 'center';
  // path.textBaseline = 'middle';
  // path.fillStyle = pen.configure.header.textColor;
  if (pen.configure.header.font) {
    // path.font = pen.configure.header.font;
  } else {
    // path.font = pen.fontSize + 'px Arial';
  }
  // path.globalAlpha = 1;
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
    // path.fillText(col[i].name, x + halfX, y + halfY);
    path.moveTo(x + temWidth, y);
    path.lineTo(x + temWidth, y + realH);
    // path.stroke();
    if (col[i].fillColor) {
      // path.beginPath();
      // path.fillStyle = col[i].fillColor;
      // path.globalAlpha = 0.1;
      path.rect(
        x + beforeWidth,
        y + header.height,
        gapWidth,
        realH - header.height
      );
      // path.fill();
      path.closePath();
      // path.fillStyle = pen.configure.header.textColor;
      // path.globalAlpha = 1;
    }
  }
  path.closePath();
  return path;
}

function add(topology: any, pen: Pen) {
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
export function tableAnchors(pen: any) {
  pen.anchors.push(
    new window.topologyPoint(pen.rect.x + pen.rect.width / 2, pen.rect.y, 1)
  );
  pen.anchors.push(
    new window.topologyPoint(
      pen.rect.x + pen.rect.width,
      pen.rect.y + pen.rect.height / 2,
      2
    )
  );
  pen.anchors.push(
    new window.topologyPoint(pen.rect.x, pen.rect.y + pen.rect.height / 2, 3)
  );
}
