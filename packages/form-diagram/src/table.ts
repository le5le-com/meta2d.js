import { PrevNextType } from '@topology/core';

declare const window: any;
export function table(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onAdd = onAdd;
    pen.onDestroy = onDestroy;
    pen.onValue = onValue;
  }
  // pen.calculative.height = getRect(pen).height;
  // pen.calculative.width = getRect(pen).width;
  /*
  let x = pen.calculative.worldRect.x;
  let y = pen.calculative.worldRect.y;
  let w = pen.calculative.worldRect.width;
  let col = pen.table.col;
  ctx.strokeStyle = pen.table.lineStyle;
  ctx.fillStyle = pen.table.fillStyle;
  let header = pen.table.header;
  let rowCount = pen.table.rowCount;
  let currentPage = pen.currentPage;
  let rowLength = pen.table.row.length;

  let total = Math.ceil(rowLength / rowCount);
  window.topology.setValue({ id: pen.id, totalPage: total });
  let radioArray = col.filter((e) => e.radio != undefined && e.radio != '');
  //如果所有的radio都没设置，则宽度为实际设置宽度
  //如果有某一列的radio有值，未设置的radio默认为1

  let temX = 0;
  let beforeX = 0;

  let halfXObj = {};
  let colWObj = {};
  let sum = 0;
  if (radioArray.length > 0) {
    sum = col.reduce(function (prev, cur) {
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
    ctx.rect(x, y, w, pen.table.rowHeight);
  }
  ctx.stroke();
  ctx.fill();
  let buttons = pen.table.buttons;
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
      oneCol = pen.table.row[i];
      beforeY = temY;

      if (oneCol.height) {
        temY += oneCol.height;
      } else {
        temY += pen.table.rowHeight;
      }
      if (oneCol.fillColor) {
        ctx.fillStyle = oneCol.fillColor;
      } else {
        ctx.fillStyle = pen.table.fillStyle;
      }
      if (oneCol.transparency) {
        ctx.globalAlpha = oneCol.transparency;
      } else {
        ctx.globalAlpha = pen.table.transparency;
      }
    } else {
      beforeY = temY;
      temY += pen.table.rowHeight;
      ctx.fillStyle = pen.table.fillStyle;
      ctx.globalAlpha = pen.table.transparency;
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
      ctx.fillStyle = pen.table.selectStyle;
      window.topology.setValue({
        id: pen.id,
        currentData: JSON.stringify(oneCol),
      });
    }
    ctx.rect(x, y + beforeY, w, temY - beforeY);
    ctx.stroke();
    ctx.fill();
    pen.fillStyle = pen.table.fillStyle;
    ctx.closePath();
    ctx.beginPath();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pen.table.textStyle;
    ctx.font = pen.fontSize + 'px Arial';
    let halfY = (beforeY + temY) / 2;
    ctx.globalAlpha = 1;
    if (oneCol) {
      if (oneCol.textColor) {
        ctx.fillStyle = oneCol.textColor;
      } else {
        ctx.fillStyle = pen.table.textStyle;
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
    let beginIndex = pen.table.header.beginIndex;
    if (halfXObj['index']) {
      ctx.fillText(
        i + (beginIndex === undefined ? 0 : beginIndex) + '',
        x + halfXObj['index'],
        y + halfY
      );
      ctx.fill();
    }
    ctx.closePath();
    if (halfXObj['buttons'] && oneCol) {
      ctx.beginPath();
      ctx.fillStyle = buttons.fillStyle;
      if (
        x + halfXObj['buttons'] - buttons.width / 2 < pen.currentClickX &&
        pen.currentClickX < x + halfXObj['buttons'] + buttons.width / 2 + w &&
        pen.currentClickY > y + halfY - buttons.height / 2 &&
        pen.currentClickY < y + halfY + buttons.height / 2
      ) {
        ctx.fillStyle = buttons.btnPressColor;

        if (pen.clickBtnY === 0 && pen.clickBtnX == 0) {
          window.topology.setValue({
            id: pen.id,
            clickBtnX: halfXObj['buttons'],
          });
          window.topology.setValue({ id: pen.id, clickBtnY: halfY });
          window.topology.setValue({ id: pen.id, isbuttons: 1 });
          window.topology.setValue({ id: pen.id, isbuttons: 0 });
        }
      }
      // window.topology.setValue(pen.id, 0, 'isbuttons');
      ctx.rect(
        x + halfXObj['buttons'] - buttons.width / 2,
        y + halfY - buttons.height / 2,
        buttons.width,
        buttons.height
      );
      ctx.fill();
      ctx.closePath();
      ctx.beginPath();
      ctx.fillStyle = buttons.textColor;
      ctx.font = buttons.font;
      ctx.fillText(buttons.text, x + halfXObj['buttons'], y + halfY);
      ctx.fill();
    }
    ctx.closePath();
    ctx.globalAlpha = pen.table.transparency;
    ctx.font = pen.fontSize + 'px Arial';
  }
  let realH = temY;
  //绘制列
  ctx.beginPath();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pen.table.header.textColor;
  if (pen.table.header.font) {
    ctx.font = pen.table.header.font;
  } else {
    ctx.font = pen.fontSize + 'px Arial';
  }
  ctx.globalAlpha = 1;
  temX = 0;
  beforeX = 0;
  for (let i = 0; i < col.length; i++) {
    let halfY = pen.table.rowHeight / 2;
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
      ctx.fillStyle = pen.table.header.textColor;
      ctx.globalAlpha = 1;
    }
  }
  ctx.closePath();
*/
  // pen.oldHeight = pen.height;
  // pen.oldWidth = pen.width;
  return false;
}

function getRect(pen: any) {
  if (!pen.table.rowCount) {
    pen.table.rowCount = 5;
  }
  if (!pen.table.colCount) {
    pen.table.colCount = 5;
  }
  if (!pen.table.rowHeight) {
    pen.table.rowHeight = 30;
  }
  if (!pen.table.colWidth) {
    pen.table.colWidth = 100;
  }
  let width = 0;
  let height = pen.table.header?.height ?? pen.table.rowHeight;
  // getRow(pen.table.row, pen.table.rowHeight);
  // getCol(pen.table.col, pen.table.colWidth);
  for (let i = 0; i < pen.table.colCount; i++) {
    if (!pen.table.col[i]) {
      width += pen.table.colWidth;
      // pen.table.col[i] = {};
      // pen.table.col[i].width = pen.table.colWidth;
    } else {
      width += pen.table.col[i].width ?? pen.table.colWidth;
    }
  }
  for (let i = 0; i < pen.table.rowCount; i++) {
    if (!pen.table.row[i]) {
      height += pen.table.rowHeight;
      // pen.table.row[i] = {};
      // pen.table.row[i].height = pen.table.rowHeight;
    } else {
      height += pen.table.row[i].height ?? pen.table.rowHeight;
    }
  }

  return {
    width,
    height,
  };
}

function getRow(row: any, defaultHight: number) {
  row.forEach((e) => {
    if (!e.height) {
      e.height = defaultHight;
    }
  });
}
function getCol(col: any, defaultWidth: number) {
  col.forEach((e) => {
    if (!e.width) {
      e.width = defaultWidth;
    }
  });
}
//主要重新计算worldRect worldAnchors
function calculativeWord(pen: any) {
  let rect = getRect(pen);
  pen.height = rect.height;
  pen.width = rect.width;
  pen.calculative.height = rect.height;
  pen.calculative.width = rect.width;
  pen.calculative.worldRect = {
    ex: pen.x + pen.width,
    ey: pen.y + pen.height,
    height: pen.height,
    width: pen.width,
    x: pen.x,
    y: pen.y,
    rotate: undefined,
  };
  pen.calculative.worldAnchors.forEach((item) => {
    let current = pen.anchors.find((i) => i.id == item.id);
    item.x = pen.x + current.x * pen.width;
    item.y = pen.y + current.y * pen.height;
  });
}

//计算数据行
function getCellRect(rowIndex: number, colIndex: number, pen: any) {
  let rect = { x: pen.x, y: pen.y, width: 0, height: 0 };
  if (rowIndex == 0) {
    rect.y += 0;
    rect.height = pen.table.header.height ?? pen.table.rowHeight;
  }
  for (let i = 0; i < rowIndex; i++) {
    if (i == 0) {
      rect.y += 0;
      rect.height = pen.table.header.height ?? pen.table.rowHeight;
    } else {
      if (i == 1) {
        rect.y += pen.table.header.height ?? pen.table.rowHeight;
      } else {
        rect.y += pen.table.row[i - 2].height ?? pen.table.rowHeight;
      }
      if (pen.table.row[i - 1]) {
        rect.height = pen.table.row[i - 1].height ?? pen.table.rowHeight;
      } else {
        rect.height = pen.table.rowHeight;
      }
    }
  }
  for (let j = 0; j < colIndex; j++) {
    if (j > 0) {
      rect.x += pen.table.col[j - 1].width ?? pen.table.colWidth;
    }
    rect.width = pen.table.col[j].width ?? pen.table.colWidth;
  }
  return rect;
}
function onAdd(pen: any) {
  calculativeWord(pen);
  let key = '';
  let text = '';
  let count = 0;
  let keyArray = [];
  for (let k = 0; k < pen.table.col.length; k++) {
    keyArray.push(pen.table.col[k].key);
  }
  //获取除去数据项的所有属性
  for (let i = 1; i <= pen.table.rowCount + 1; i++) {
    let temRow = Object.assign({}, pen.table.row[i - 2]); ///获取非数据项
    let rowData = {}; //获取数据项
    if (temRow) {
      for (let item = 0; item < keyArray.length; item++) {
        if (temRow[keyArray[item]]) {
          rowData[keyArray[item]] = temRow[keyArray[item]];
          delete temRow[keyArray[item]];
        }
      }
    }
    let headerStyle = {};
    if (i === 1) {
      headerStyle = Object.assign({}, pen.table.header);
    }
    for (let j = 1; j <= pen.table.colCount; j++) {
      count++;
      key = pen.table.col[j - 1].key;
      if (i <= 1) {
        text = pen.table.col[j - 1].name;
      } else {
        if (key == 'index') {
          text = pen.table.header.beginIndex + i - 2 + '';
        } else {
          if (pen.table.row[i - 2]) {
            text = pen.table.row[i - 2][key] ?? '';
          } else {
            text = '';
          }
        }
      }

      let childRect = getCellRect(i, j, pen);
      let childPen: any = {
        name: 'rectangle',
        x: childRect.x,
        y: childRect.y,
        width: childRect.width,
        height: childRect.height,
        text,
        rowInParent: i - 2,
        colInParent: key,
        ...headerStyle,
        ...temRow,
      };
      pen.calculative.canvas.makePen(childPen);
      if (!childPen.destroy && key !== 'index' && key !== 'operation') {
        childPen.onValue = childPenOnValue;
      }
      if (i == 1) {
        childPen.onValue = headerChildPenOnValue;
      }
      pen.calculative.canvas.parent.pushChildren(pen, [childPen]);

      if (key == 'operation' && pen.table.row[i - 2]) {
        let btn = pen.table.button;
        let btnChildPen: any = {
          name: 'button',
          x: childRect.x + (childRect.width - btn.width) / 2,
          y: childRect.y + (childRect.height - btn.height) / 2,
          currentData: rowData,
          events: [
            {
              action: 4,
              name: 'click',
              value: 'console.log(pen.currentData)',
            },
          ],
          ...pen.table.button,
        };
        pen.calculative.canvas.makePen(btnChildPen);
        // childPen.onDestroy = onDestroy;
        pen.calculative.canvas.parent.pushChildren(childPen, [btnChildPen]);
      }
    }
  }
}

function onValue(pen: any) {
  onDestroy(pen);
  onAdd(pen);
}

//数据行数据修改
function childPenOnValue(pen: any) {
  let parentPen = pen.calculative.canvas.parent.find(pen.parentId);
  parentPen[0].table.row[pen.rowInParent][pen.colInParent] = pen.text;
}

//表头修改
function headerChildPenOnValue(pen: any) {
  let parentPen = pen.calculative.canvas.parent.find(pen.parentId);
  let i = 0;
  for (; i < parentPen[0].table.col.length; i++) {
    if (parentPen[0].table.col[i].key == pen.colInParent) break;
  }
  parentPen[0].table.col[i].name = pen.text;
}

function onDestroy(pen: any) {
  if (!pen.children) {
    return;
  }
  pen.children.forEach((p) => {
    const i = pen.calculative.canvas.parent.store.data.pens.findIndex(
      (item) => item.id === p
    );
    if (i > -1) {
      onDestroy(pen.calculative.canvas.parent.store.data.pens[i]);
      pen.calculative.canvas.parent.store.data.pens.splice(i, 1);
      pen.calculative.canvas.parent.store.pens[p] = undefined;
    }
  });
  pen.children = undefined;
}
