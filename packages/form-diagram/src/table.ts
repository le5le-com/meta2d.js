import { PrevNextType } from '@topology/core';

declare const window: any;
export function table(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.onDestroy) {
    pen.onAdd = onAdd;
    pen.onDestroy = onDestroy;
    pen.onValue = onValue;
  }

  //绘制表格的横线竖线
  const rowArray = [];
  const colArray = [];
  const x = pen.calculative.worldRect.x;
  const y = pen.calculative.worldRect.y;
  const h = pen.calculative.worldRect.height;
  const w = pen.calculative.worldRect.width;
  let currentW = 0;
  let currentH = 0;
  for (let i = 0; i < pen.table.colCount; i++) {
    colArray.push(currentW);
    if (!pen.table.col[i]) {
      //没有该列
      currentW += pen.table.colWidth;
    } else {
      currentW += pen.table.col[i].width ?? pen.table.colWidth;
    }
  }
  colArray.push(currentW);
  const lastW = currentW;
  rowArray.push(currentH);
  currentH += pen.table.header.height ?? pen.table.rowHeight;
  for (let i = 0; i < pen.table.rowCount; i++) {
    rowArray.push(currentH);
    if (!pen.table.row[i]) {
      currentH += pen.table.rowHeight;
    } else {
      currentH += pen.table.row[i].height ?? pen.table.rowHeight;
    }
  }
  rowArray.push(currentH);
  const lastH = currentH;
  ctx.strokeStyle = pen.color;
  rowArray.forEach((rowRy: number) => {
    ctx.moveTo(x, y + (rowRy / lastH) * h);
    ctx.lineTo(x + w, y + (rowRy / lastH) * h);
  });

  colArray.forEach((colRX: number) => {
    ctx.moveTo(x + (colRX / lastW) * w, y);
    ctx.lineTo(x + (colRX / lastW) * w, y + h);
  });
  ctx.stroke();
  return false;
}

function getRect(pen: any) {
  if (!pen.table.rowCount) {
    pen.table.rowCount = 5;
  }
  if (!pen.table.colCount) {
    pen.table.colCount = 5;
  }
  pen.table.colCount = pen.table.col.length; //强制列数等于列配置长度
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
  // height += pen.table.rowCount; //防止相邻的两个单元格覆盖
  // width += pen.table.colCount;
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
        if (pen.table.row[i - 2]) {
          rect.y += pen.table.row[i - 2].height ?? pen.table.rowHeight;
        } else {
          rect.y += pen.table.rowHeight;
        }
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

  // rect.y += rowIndex * 1; //添加单元格不覆盖偏差
  // rect.x += colIndex * 1;
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
        // width: childRect.width,
        // height: childRect.height,
        text,
        rowInParent: i - 2,
        colInParent: key,
        textColor: '#000000',
        activeColor: '#00000000',
        color: '#00000000',
        hoverColor: '#00000000',
        hoverTextColor: '#000000',
        activeTextColor: '#000000',
        ...headerStyle,
        ...temRow,
        width: childRect.width,
        height: childRect.height,
      };
      pen.calculative.canvas.makePen(childPen);
      childPen.onClick = childPenOnClick;
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
              action: 5,
              name: 'click',
              value: 'console.log(pen.currentData)',
            },
          ],
          borderRadius: 0.2,
          activeBackground: '#40a9ff',
          activeColor: '#40a9ff',
          background: '#1890ff',
          color: '#1890ff',
          hoverBackground: '#40a9ff',
          hoverColor: '#40a9ff',
          textColor: '#ffffff',
          hoverTextColor: '#ffffff',
          activeTextColor: '#ffffff',
          ...pen.table.button,
        };
        pen.calculative.canvas.makePen(btnChildPen);
        // childPen.onDestroy = onDestroy;
        pen.calculative.canvas.parent.pushChildren(childPen, [btnChildPen]);
      }
    }
  }
}
//根据值变化更新视图
function valueChange(pen: any) {
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
      pen.calculative.canvas.parent.setValue({
        id: pen.children[(i - 1) * pen.table.colCount + j - 1],
        x: (childRect.x - pen.x) / pen.width,
        y: (childRect.y - pen.y) / pen.height,
        // width: childRect.width / pen.width,
        // height: childRect.height / pen.height,
        text,
        rowInParent: i - 2,
        colInParent: key,
        ...headerStyle,
        ...temRow,
        width: childRect.width / pen.width,
        height: childRect.height / pen.height,
      });
      // let childPen: any = {
      //   name: 'rectangle',
      //   x: childRect.x,
      //   y: childRect.y,
      //   width: childRect.width,
      //   height: childRect.height,
      //   text,
      //   rowInParent: i - 2,
      //   colInParent: key,
      //   ...headerStyle,
      //   ...temRow,
      // };
      // pen.calculative.canvas.makePen(childPen);

      // if (!childPen.destroy && key !== 'index' && key !== 'operation') {
      //   childPen.onValue = childPenOnValue;
      // }
      // if (i == 1) {
      //   childPen.onValue = headerChildPenOnValue;
      // }
      // pen.calculative.canvas.parent.pushChildren(pen, [childPen]);

      if (key == 'operation' && pen.table.row[i - 2]) {
        let currentChild = pen.calculative.canvas.parent.find(
          pen.children[(i - 1) * pen.table.colCount + j - 1]
        )[0];
        let btn = pen.table.button;
        let obj = {
          id: currentChild.children[0],
          x: (childRect.width - btn.width) / 2 / childRect.width,
          y: (childRect.height - btn.height) / 2 / childRect.height,
          currentData: rowData,
          events: [
            {
              action: 5,
              name: 'click',
              value: 'console.log(pen.currentData)',
            },
          ],
          name: 'button',
          ...pen.table.button,
        };
        pen.calculative.canvas.parent.setValue(obj);
        // let btn = pen.table.button;
        // let btnChildPen: any = {
        //   name: 'button',
        //   x: childRect.x + (childRect.width - btn.width) / 2,
        //   y: childRect.y + (childRect.height - btn.height) / 2,
        //   currentData: rowData,
        //   events: [
        //     {
        //       action: 4,
        //       name: 'click',
        //       value: 'console.log(pen.currentData)',
        //     },
        //   ],
        //   ...pen.table.button,
        // };
        // pen.calculative.canvas.makePen(btnChildPen);
        // // childPen.onDestroy = onDestroy;
        // pen.calculative.canvas.parent.pushChildren(childPen, [btnChildPen]);
      }
    }
  }
}

function onValue(pen: any) {
  valueChange(pen);
}

//数据行数据修改
function childPenOnValue(pen: any) {
  let parentPen: any = pen.calculative.canvas.parent.find(pen.parentId);
  if (pen.rowInParent < parentPen[0].table.row.length) {
    parentPen[0].table.row[pen.rowInParent][pen.colInParent] = pen.text;
    parentPen[0].children.forEach((cid) => {
      let child: any = pen.calculative.canvas.parent.find(cid)[0];
      if (
        child.colInParent === 'operation' &&
        child.rowInParent === pen.rowInParent
      ) {
        let btnChild: any = pen.calculative.canvas.parent.find(
          child.children[0]
        )[0];
        btnChild.currentData[pen.colInParent] = pen.text;
      }
    });
    // valueChange(parentPen[0]);
    // pen.calculative.canvas.parent.setValue(parentPen[0]);
  }
}

function childPenOnClick(pen: any) {
  let parentPen = pen.calculative.canvas.parent.find(pen.parentId)[0];
  // pen.activeColor = parentPen.table.selectStyle;
  pen.hoverColor = parentPen.table.selectStyle;
  // pen.locked = 0;//TODO:无效操作
  pen.calculative.canvas.parent.setValue(pen);
  parentPen.children.forEach((id) => {
    if (id !== pen.id) {
      let child = pen.calculative.canvas.parent.find(id)[0];
      // child.activeColor = parentPen.hoverColor;
      //pen.calculative.canvas.parent.store.options.activeColor;

      child.hoverColor = parentPen.hoverColor;
      // pen.calculative.canvas.parent.store.options.activeColor;
      // pen.locked = 10;
      pen.calculative.canvas.parent.setValue(child);
    }
  });
  pen.locked = 0;
}

//表头修改
function headerChildPenOnValue(pen: any) {
  let parentPen = pen.calculative.canvas.parent.find(pen.parentId);
  let i = 0;
  for (; i < parentPen[0].table.col.length; i++) {
    if (parentPen[0].table.col[i].key == pen.colInParent) break;
  }
  parentPen[0].table.col[i].name = pen.text;
  // valueChange(parentPen[0]);
  // pen.calculative.canvas.parent.setValue(parentPen[0]);
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
  // pen.calculative.canvas.parent.store.hoverAnchor = undefined;
  // pen.calculative.canvas.parent.store.hover = undefined;
  pen.calculative.canvas.parent.render(Infinity);
  // pen.calculative.canvas.parent.pushHistory({ type: 2, pens: [pen] });
  // pen.calculative.canvas.parent.store.emitter.emit('delete', [pen]);
}
