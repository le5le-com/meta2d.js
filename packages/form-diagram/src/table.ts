<<<<<<< HEAD
import { formPen } from './common';
import { Point } from '../../core/src/point';
import { Rect } from '../../core/src/rect';
<<<<<<< HEAD
=======
import { calcExy } from '@topology/core';
>>>>>>> d7f4457 (modify_onShowInput)

export function table(ctx: CanvasRenderingContext2D, pen: formPen) {
=======
import { calcExy } from "@topology/core";

export function table(ctx: CanvasRenderingContext2D, pen: any) {
<<<<<<< HEAD
>>>>>>> 99df05d (canvasRect not calc again; use calcExy method)
  if (!pen.onDestroy) {
=======
  if (!pen.onAdd) {
>>>>>>> 2620d99 (registerCanvasDraw type)
    pen.onAdd = onAdd;
    pen.onMouseMove = onMouseMove;
    pen.onMouseLeave = onMouseLeave;
    pen.onMouseDown = onMouseDown;
    pen.onShowInput = onShowInput;
    pen.onInput = onInput;
    pen.onValue = onValue;
  }

  const data = pen.calculative.canvas.store.data;
  const options = pen.calculative.canvas.store.options;

  pen.color = pen.color || data.color || options.color;
  pen.activeColor = pen.activeColor || data.activeColor || options.activeColor;
  pen.hoverColor = pen.hoverColor || data.hoverColor || options.hoverColor;
  pen.activeBackground =
    pen.activeBackground || data.activeBackground || options.activeBackground;
  pen.hoverBackground =
    pen.hoverBackground || data.hoverBackground || options.hoverBackground;

  // 画网格线
  drawGridLine(ctx, pen);

  // 画单元格
  drawCell(ctx, pen);
}

function initRect(pen: formPen) {
  const colPos = [];
  const rowPos = [];

  if (!pen.table.rowHeight) {
    pen.table.rowHeight = 40;
  }
  if (!pen.table.colWidth) {
    pen.table.colWidth = 150;
  }
  let width = 0;
  for (const item of pen.table.header.data) {
    width += item.width || pen.table.colWidth;
    colPos.push(width);
  }

  let height = 0;
  // 显示表头
  if (pen.table.header.show != false) {
    height += pen.table.header.height || pen.table.rowHeight;
    rowPos.push(height);
  }

  for (const item of pen.table.data) {
    height += item.height || pen.table.rowHeight;
    rowPos.push(height);
  }

  pen.colPos = colPos;
  pen.rowPos = rowPos;

  pen.tableWidth = width;
  pen.tableHeight = height;

  if (!pen.width) {
    pen.width = width;
    pen.height = height;
    pen.calculative.width = width;
    pen.calculative.height = height;
    pen.calculative.worldRect = {
      x: pen.x,
      y: pen.y,
      height: pen.height,
      width: pen.width,
    };
    calcExy(pen.calculative.worldRect);
  }
}

function drawGridLine(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.colPos) {
    return;
  }
  const worldRect = pen.calculative.worldRect;
  ctx.save();
  ctx.strokeStyle = pen.color;

  // 绘画最外框
  ctx.beginPath();
  ctx.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
  if (pen.background) {
    ctx.fillStyle = pen.background;
    ctx.fill();
  }
  ctx.stroke();

  // 绘画行的线
  let last = pen.rowPos[pen.rowPos.length - 1];
  for (const item of pen.rowPos) {
    if (item === last) {
      continue;
    }
    const y = (item * pen.calculative.worldRect.height) / pen.tableHeight;
    ctx.beginPath();
    ctx.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + y);
    ctx.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + y);
    ctx.stroke();
  }

  // 绘画列的线
  last = pen.colPos[pen.colPos.length - 1];
  pen.colPos.forEach((item: number, i: number) => {
    if (item === last) {
      return;
    }
    const x = (item * pen.calculative.worldRect.width) / pen.tableWidth;
    ctx.beginPath();
    ctx.moveTo(pen.calculative.worldRect.x + x, pen.calculative.worldRect.y);
    ctx.lineTo(pen.calculative.worldRect.x + x, pen.calculative.worldRect.ey);
    ctx.stroke();
  });

  ctx.restore();
}

function drawCell(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.colPos) {
    return;
  }

  if (!pen.calculative.texts) {
    pen.calculative.texts = [];
  }

  // const textScale = Math.min(
  //   pen.calculative.worldRect.width / pen.tableWidth,
  //   pen.calculative.worldRect.height / pen.tableHeight
  // );

  const textScale = 1;

  for (let i = 0; i < pen.rowPos.length; i++) {
    for (let j = 0; j < pen.colPos.length; j++) {
      let cell = getCell(pen, i, j);
      let color = cell.color || pen.color;
      let background = cell.background;

      let activeColor: any;

      // 选中
      if (
        pen.calculative.activeCell?.row === i &&
        pen.calculative.activeCell?.col === j
      ) {
        color = pen.activeColor;
        background = pen.activeBackground;
        activeColor = color;
      }
      // hover
      if (
        pen.calculative.hoverCell?.row === i &&
        pen.calculative.hoverCell?.col === j
      ) {
        color = pen.hoverColor;
        background = pen.hoverBackground;

        activeColor = color;
      }

      const rect = getCellRect(pen, i, j);

      // 有背景
      if (background) {
        ctx.save();
        ctx.fillStyle = background;
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      }

      // 选中或hover
      if (activeColor) {
        ctx.save();
        ctx.strokeStyle = activeColor;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.restore();
      }

      // 绘画文本
      pen.calculative.worldTextRect = rect;

      let rowText = pen.calculative.texts[i];
      if (!pen.calculative.texts[i]) {
        rowText = [];
        pen.calculative.texts.push(rowText);
      }

      if (rowText[j] == null) {
        if (Array.isArray(cell)) {
          rowText[j] = '';
          //子节点创建后无需再计算位置
          if (!cell[0].id) {
            calcChildrenRect(pen, rect, cell);
            pen.calculative.canvas.parent.pushChildren(pen, cell);
          }
          continue;
        } else {
          rowText[j] = cell.text || cell + '';
        }

        if (!rowText[j]) {
          continue;
        }
        // 计算换行和省略号
        rowText[j] = pen.calculative.canvas.parent.calcTextLines(
          pen,
          rowText[j]
        );
      }

      if (!rowText[j]) {
        continue;
      }

      ctx.save();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font =
        (pen.calculative.fontStyle || '') +
        ' normal ' +
        (pen.calculative.fontWeight || '') +
        ' ' +
        (pen.calculative.fontSize || 12) * textScale +
        'px ' +
        pen.calculative.fontFamily;

      if (rowText[j].length === 1) {
        ctx.fillText(
          rowText[j][0],
          rect.x + rect.width / 2,
          rect.y + rect.height / 2
        );
      } else {
        const y = 0.55;
        const lineHeight =
          pen.calculative.fontSize * pen.calculative.lineHeight * textScale;

        const h = rowText[j].length * lineHeight;
        let top = (rect.height - h) / 2;
        rowText[j].forEach((text, i) => {
          ctx.fillText(
            text,
            rect.x + rect.width / 2,
            rect.y + top + (i + y) * lineHeight
          );
        });
      }
      ctx.restore();
    }
  }
}

// 添加table节点回调
function onAdd(pen: formPen) {
  initRect(pen);
}

function onShowInput(pen: any, e: Point) {
  // 没有活动单元格
  if (!pen.calculative.hoverCell) {
    return;
  }

  const cell = getCell(
    pen,
    pen.calculative.hoverCell.row,
    pen.calculative.hoverCell.col
  );
  // 子节点，非文本
  if (Array.isArray(cell)) {
    return;
  }

  pen.calculative.inputCell = pen.calculative.hoverCell;

  const rect = getCellRect(
    pen,
    pen.calculative.hoverCell.row,
    pen.calculative.hoverCell.col
  );
  pen.calculative.tempText = cell.text || cell + '';
  pen.calculative.canvas.showInput(pen, rect, '#ffffff');
}

//将输入的数据写入到对应的data中
function onInput(pen: formPen, text: string) {
  if (!pen.calculative.inputCell) {
    return;
  }

  setCellText(
    pen,
    pen.calculative.inputCell.row,
    pen.calculative.inputCell.col,
    text
  );
  pen.calculative.canvas.render(Infinity);
}

function onMouseMove(pen: formPen, e: Point) {
  pen.calculative.hoverCell = getCellIndex(pen, e);
  pen.calculative.canvas.render(Infinity);
}

function onMouseLeave(pen: formPen, e: Point) {
  pen.calculative.hoverCell = undefined;
  pen.calculative.canvas.render(Infinity);
}

function onMouseDown(pen: formPen, e: Point) {
  pen.calculative.activeCell = getCellIndex(pen, e);
  pen.calculative.canvas.render(Infinity);
}

// 根据坐标，计算在哪个cell
function getCellIndex(pen: formPen, e: Point) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  const pos = { row: 0, col: 0 };

  for (let i = 0; i < pen.colPos.length; i++) {
    if (e.x > pen.calculative.worldRect.x + pen.colPos[i] * scaleX) {
      pos.col = i + 1;
    }
  }
  for (let i = 0; i < pen.rowPos.length; i++) {
    if (e.y > pen.calculative.worldRect.y + pen.rowPos[i] * scaleY) {
      pos.row = i + 1;
    }
  }

  return pos;
}

// 根据index获取cell
function getCell(pen: formPen, rowIndex: number, colIndex: number) {
  if (!pen.table.data || !Array.isArray(pen.table.data)) {
    return;
  }

  if (pen.table.header.show == false) {
    const row = pen.table.data[rowIndex];

    if (Array.isArray(row)) {
      return row[colIndex];
    } else if (!row.data || !Array.isArray(row.data)) {
      return;
    }

    return row.data[colIndex];
  }

  // 显示表头
  if (rowIndex === 0) {
    const cell = pen.table.header.data[colIndex];
    cell.fontWeight = pen.table.header.fontWeight;
    return cell;
  }

  const row = pen.table.data[rowIndex - 1];
  if (!row) {
    return;
  } else if (Array.isArray(row)) {
    return row[colIndex];
  } else if (!row.data || !Array.isArray(row.data)) {
    return;
  }

  return row.data[colIndex];
}

// 设置cell的文本
function setCellText(
  pen: formPen,
  rowIndex: number,
  colIndex: number,
  text: string
) {
  if (!pen.table.data || !Array.isArray(pen.table.data)) {
    return;
  }
  //TODO 导致错误
  pen.calculative.texts = undefined;

  let rowData: any;
  // 没有表头
  if (pen.table.header.show == false) {
    rowData = pen.table.data[rowIndex];

    if (Array.isArray(rowData)) {
      // data: [[1,2,3],[a,b,c]]
    } else if (rowData.data && Array.isArray(rowData.data)) {
      // data: [{data:[1,2,3]}, {data:[1,2,3]}]
      rowData = rowData.data;
    }
  } else {
    // 有表头
    if (rowIndex === 0) {
      rowData = pen.table.header.data;
    } else {
      rowData = pen.table.data[rowIndex - 1];
      if (Array.isArray(rowData)) {
        // data: [[1,2,3],[a,b,c]]
      } else if (rowData.data && Array.isArray(rowData.data)) {
        // data: [{data:[1,2,3]}, {data:[1,2,3]}]
        rowData = rowData.data;
      }
    }
  }

  if (!rowData) {
    return;
  }

  if (rowData[colIndex] instanceof Object) {
    rowData[colIndex].text = text;
  } else {
    rowData[colIndex] = text;
  }

  pen.calculative.canvas.store.emitter.emit('valueUpdate', pen);
}

// 计算cell世界坐标区域
function getCellRect(pen: formPen, rowIndex: number, colIndex: number) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  let x = 0;
  let ex = pen.colPos[colIndex] * scaleX;
  if (colIndex > 0) {
    x = pen.colPos[colIndex - 1] * scaleX;
  }

  let y = 0;
  let ey = pen.rowPos[rowIndex] * scaleY;
  if (rowIndex > 0) {
    y = pen.rowPos[rowIndex - 1] * scaleY;
  }

  return {
    x: pen.calculative.worldRect.x + x,
    y: pen.calculative.worldRect.y + y,
    ex: pen.calculative.worldRect.x + ex,
    ey: pen.calculative.worldRect.y + ey,
    width: ex - x,
    height: ey - y,
  };
}

// 计算cell子节点的世界坐标区域
function calcChildrenRect(pen: formPen, rect: Rect, children: formPen[]) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  // 计算子节点需要的宽高
  let height = 0;
  let lastX = 0;
  let lastY = 0;

  for (const item of children) {
    if (lastX + item.width * scaleX + 20 * scaleX < rect.width) {
      item.x = rect.x + lastX + 10 * scaleX;
      item.y = rect.y + lastY + 10 * scaleY;

      lastX += (item.width + 10) * scaleX;
      height = Math.max(height, lastY + (item.height + 10) * scaleY);
    } else {
      // 超出需要换行
      lastX = 0;
      lastY = height;
      item.x = rect.x + lastX + 10 * scaleX;
      item.y = rect.y + lastY + 10 * scaleY;

      height += (item.height + 10) * scaleY;
    }
  }

  // 垂直居中
  if (height + 20 * scaleY < rect.height) {
    const top = (rect.height - height - 10 * scaleY) / 2;
    for (const item of children) {
      item.y += top;
    }
  }
}

function onValue(pen: formPen) {
  pen.calculative.texts = undefined;
}
