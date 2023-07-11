import { formPen, cellData, Pos } from './common';
import { Point } from '../../core/src/point';
import { Rect } from '../../core/src/rect';
import { calcRightBottom, calcTextLines } from '@meta2d/core';
import { ReplaceMode } from './common';

export function table2(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    if (!pen.rowPos || !pen.colPos) {
      pen.onAdd(pen);
      // pen.calculative.canvas.parent.active([pen]);
    }
    pen.onMouseMove = onMouseMove;
    pen.onMouseLeave = onMouseLeave;
    pen.onMouseDown = onMouseDown;
    pen.onShowInput = onShowInput;
    pen.onInput = onInput;
    pen.onValue = onValue;
    pen.onBeforeValue = beforeValue;
  }

  const data = pen.calculative.canvas.store.data;
  const options = pen.calculative.canvas.store.options;

  pen.color = pen.color || data.color || options.color;
  pen.textColor =
    pen.textColor || pen.color || data.textColor || options.textColor;
  pen.activeColor = pen.activeColor || options.activeColor;
  pen.hoverColor = pen.hoverColor || options.hoverColor;
  pen.activeBackground = pen.activeBackground || options.activeBackground;
  pen.hoverBackground = pen.hoverBackground || options.hoverBackground;

  // 画网格线
  drawGridLine(ctx, pen);

  // 画单元格
  drawCell(ctx, pen);

  // 画title
  drawNote(ctx, pen);
  pen.isFirstTime = false;
}

function drawNote(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.calculative.hoverCell) {
    return;
  }
  if (pen.calculative.isInput) {
    return;
  }
  if (!pen.calculative.isHover) {
    return;
  }
  const { row, col } = pen.calculative.hoverCell;
  const { x, y } = pen.calculative.canvas.mousePos;
  if (!pen.data[row]) {
    return;
  }
  let text = pen.data[row][col];
  if (typeof text === 'object' || !text) {
    return;
  }
  ctx.save();
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.font = ctx.font =
    (pen.calculative.fontStyle || '') +
    ' normal ' +
    (pen.calculative.fontWeight || '') +
    ' ' +
    (pen.calculative.fontSize || 12) +
    'px ' +
    pen.calculative.fontFamily;

  const noteWidth = ctx.measureText(text).width;
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.moveTo(x, y);
  ctx.rect(x - 10, y, noteWidth + 20, 20);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = '#000';
  ctx.fillText(text, x, y + 10);
  ctx.restore();
}

function initRect(pen: formPen) {
  const colPos = [];
  const rowPos = [];

  if (!pen.rowHeight) {
    pen.rowHeight = 40;
  }
  if (!pen.colWidth) {
    pen.colWidth = 150;
  }
  let width = 0;
  //获取所有col width
  const _col =
    pen.styles &&
    pen.styles.filter((item) => {
      return item.col !== undefined && item.row === undefined && item.width;
    });
  let _colWidthMap = {};
  _col &&
    _col.forEach((_c) => {
      _colWidthMap[_c.col] = _c.width;
    });
  for (let i = 0; i < pen.data[0].length; i++) {
    width +=
      (_colWidthMap[i] || pen.colWidth) *
      pen.calculative.canvas.store.data.scale;
    colPos.push(width);
  }

  let height = 0;

  //获取所有row height
  const _row =
    pen.styles &&
    pen.styles.filter((item) => {
      return item.col === undefined && item.row !== undefined && item.height;
    });
  let _rowHeightMap = {};
  _row &&
    _row.forEach((_r) => {
      _rowHeightMap[_r.row] = _r.height;
    });
  // 显示表头
  for (let j = 0; j < pen.data.length; j++) {
    height +=
      (_rowHeightMap[j] || pen.rowHeight) *
      pen.calculative.canvas.store.data.scale;
    rowPos.push(height);
  }

  pen.colPos = colPos;
  pen.rowPos = rowPos;

  pen.tableWidth = width;
  pen.tableHeight = height;
  //   if (!pen.width) {
  pen.width = width;
  pen.height = height;
  pen.calculative.width = width;
  pen.calculative.height = height;
  pen.calculative.worldRect = {
    x: pen.x,
    y: pen.y,
    height: pen.height,
    width: pen.width,
    center: {
      x: pen.x + pen.width / 2,
      y: pen.y + pen.height / 2,
    },
  };
  calcRightBottom(pen.calculative.worldRect);
  //   }
}

function drawGridLine(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.colPos) {
    return;
  }
  // const worldRect = pen.calculative.worldRect;
  const { x, y, width, height, ex, ey } = pen.calculative.worldRect;
  ctx.save();
  ctx.strokeStyle = pen.color;

  // 绘画最外框
  ctx.beginPath();
  // ctx.rect(worldRect.x, worldRect.y, worldRect.width, worldRect.height);
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
  ctx.moveTo(x + r, y);
  ctx.arcTo(ex, y, ex, ey, r);
  ctx.arcTo(ex, ey, x, ey, r);
  ctx.arcTo(x, ey, x, y, r);
  ctx.arcTo(x, y, ex, y, r);

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

  const textScale = 1;

  for (let i = 0; i < pen.rowPos.length; i++) {
    let { style: rowStyle } = getRow(pen, i);
    for (let j = 0; j < pen.colPos.length; j++) {
      let { value: cell, style: cellStyle } = getCell(pen, i, j);
      let isSuccess = true;
      //样式条件成立
      if (
        (cellStyle as any).wheres &&
        Array.isArray((cellStyle as any).wheres)
      ) {
        isSuccess = false;
        isSuccess = (cellStyle as any).wheres.every(function (where: any) {
          const fn = new Function(
            'attr',
            `return attr ${where.comparison} ${where.value}`
          );
          return fn(cell);
        });
      }
      let color = pen.color;
      let textColor = pen.textColor || pen.color;
      let background = null;
      let fontSize = null;
      let fontWeight = null;
      let fontStyle = null;
      if (isSuccess) {
        color =
          (cellStyle as any).color || (rowStyle as any).color || pen.color;
        textColor =
          (cellStyle as any).textColor ||
          (rowStyle as any).textColor ||
          pen.textColor;
        background =
          (cellStyle as any).background || (rowStyle as any).background;
        fontSize =
          ((cellStyle as any).fontSize || (rowStyle as any).fontSize || 0) *
          pen.calculative.canvas.store.data.scale;
        fontWeight =
          (cellStyle as any).fontWeight || (rowStyle as any).fontWeight;
        fontStyle = (cellStyle as any).fontStyle || (rowStyle as any).fontStyle;
      }
      let activeColor: any;

      // 选中
      if (
        pen.calculative.activeCell?.row === i &&
        pen.calculative.activeCell?.col === j
      ) {
        color = pen.activeColor;
        background = pen.activeBackground;
        activeColor = color;
        textColor = pen.activeTextColor || pen.activeColor;
      }
      // hover
      if (
        pen.calculative.hoverCell?.row === i &&
        pen.calculative.hoverCell?.col === j
      ) {
        color = pen.hoverColor;
        background = pen.hoverBackground;
        textColor = pen.hoverTextColor || pen.hoverColor;
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
        if (typeof cell === 'object') {
          // TODO 配置 {} 代表添加节点 考虑是否有表头
          const _colPen =
            pen.styles &&
            pen.styles.filter((item) => {
              return item.col === j && item.row === undefined && item.pens;
            });
          if (_colPen.length > 0) {
            rowText[j] = '';
            if (pen.isFirstTime) {
              let childrenPen = JSON.parse(JSON.stringify(_colPen[0].pens));
              childrenPen.forEach((item: formPen) => {
                Object.assign(item, { row: i, col: j });
                item.height *= pen.calculative.canvas.store.data.scale;
                item.width *= pen.calculative.canvas.store.data.scale;
              });
              calcChildrenRect(pen, rect, childrenPen);
              pen.calculative.canvas.parent.pushChildren(pen, childrenPen);
            }
            continue;
          }
        } else if (cell === undefined) {
          rowText[j] = '';
        } else {
          rowText[j] = cell.text || cell + '';
        }

        if (!rowText[j]) {
          continue;
        }
        // 计算换行和省略号
        rowText[j] = calcTextLines(pen, rowText[j]);
      }

      if (!rowText[j]) {
        continue;
      }

      ctx.save();
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font =
        (fontStyle || pen.calculative.fontStyle || '') +
        ' normal ' +
        (fontWeight || pen.calculative.fontWeight || '') +
        ' ' +
        (fontSize || pen.calculative.fontSize || 12) * textScale +
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
          (fontSize || pen.calculative.fontSize) *
          pen.calculative.lineHeight *
          textScale;

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
  pen.isFirstTime = true;
  initRect(pen);
}

function onShowInput(pen: any, e: Point) {
  // 没有活动单元格
  if (!pen.calculative.hoverCell) {
    return;
  }

  const { value: cell } = getCell(
    pen,
    pen.calculative.hoverCell.row,
    pen.calculative.hoverCell.col
  );
  // 子节点，非文本
  if (typeof cell === 'object') {
    return;
  }
  pen.calculative.isHover = false;
  pen.calculative.isInput = true;
  pen.calculative.canvas.render();
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
  pen.calculative.isInput = false;
  pen.calculative.isHover = true;
  pen.calculative.canvas.render();
}

function onMouseMove(pen: formPen, e: Point) {
  if (pen.timer) {
    pen.calculative.isHover = false;
    clearTimeout(pen.timer);
  }
  pen.timer = setTimeout(() => {
    pen.calculative.isHover = true;
    pen.calculative.canvas.render();
  }, 500);
  pen.calculative.hoverCell = getCellIndex(pen, e);
  pen.calculative.canvas.render();
}

function onMouseLeave(pen: formPen, e: Point) {
  pen.calculative.hoverCell = undefined;
  //   pen.calculative.activeCell = undefined;
  pen.calculative.canvas.render();
}

function onMouseDown(pen: formPen, e: Point) {
  pen.calculative.activeCell = getCellIndex(pen, e);
  pen.calculative.canvas.render();
}

// 根据坐标，计算在哪个cell
function getCellIndex(pen: formPen, e: Point): Pos {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  const pos: Pos = { row: 0, col: 0 };

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
  if (!pen.data || !Array.isArray(pen.data)) {
    return;
  }

  const row = pen.data[rowIndex];
  //TODO 没有获取单独设置 某行 某列 的样式
  const style =
    pen.styles &&
    pen.styles.filter((item) => {
      return item.row === rowIndex && item.col === colIndex;
    });
  if (Array.isArray(row)) {
    return { value: row[colIndex], style: style?.length > 0 ? style[0] : {} };
  } else if (!row.data || !Array.isArray(row.data)) {
    return;
  }
}

// 根据index获取getRow
function getRow(pen: formPen, rowIndex: number) {
  if (!pen.data || !Array.isArray(pen.data)) {
    return;
  }

  const row = pen.data[rowIndex];
  //TODO 没有获取单独设置 某行 某列 的样式
  const style =
    pen.styles &&
    pen.styles.filter((item) => {
      return item.row === rowIndex && !item.col;
    });
  if (Array.isArray(row)) {
    return { value: row, style: style?.length > 0 ? style[0] : {} };
  } else if (!row.data || !Array.isArray(row.data)) {
    return;
  }
}

// 设置cell的文本
function setCellText(
  pen: formPen,
  rowIndex: number,
  colIndex: number,
  text: string
) {
  if (!pen.data || !Array.isArray(pen.data)) {
    return;
  }
  pen.isFirstTime = false;
  pen.calculative.texts = undefined;
  let rowData: any = pen.data[rowIndex];
  if (!rowData) {
    return;
  }

  if (rowData[colIndex] instanceof Object) {
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
  const scale = pen.calculative.canvas.store.data.scale;
  for (const item of children) {
    if (lastX + item.width * scaleX + 20 * scale * scaleX < rect.width) {
      item.x = rect.x + lastX + 10 * scale * scaleX;
      item.y = rect.y + lastY + 10 * scale * scaleY;

      lastX += (item.width + 10 * scale) * scaleX;
      height = Math.max(height, lastY + (item.height + 10 * scale) * scaleY);
    } else {
      // 超出需要换行
      lastX = 0;
      lastY = height;
      item.x = rect.x + lastX + 10 * scale * scaleX;
      item.y = rect.y + lastY + 10 * scale * scaleY;

      height += (item.height + 10 * scale) * scaleY;
    }
  }

  // 垂直居中
  if (height + 20 * scale * scaleY < rect.height) {
    const top = (rect.height - height - 10 * scale * scaleY) / 2;
    for (const item of children) {
      item.y += top;
    }
  }
}

function onValue(pen: formPen) {
  if (pen.calculative.isUpdateData) {
    onAdd(pen);
    delete pen.calculative.isUpdateData;
    let temChildren = pen.children;
    pen.children = [];
    temChildren &&
      temChildren.forEach((child: string) => {
        pen.calculative.canvas.delForce(pen.calculative.canvas.findOne(child));
      });
    pen.calculative.texts = undefined;
    // pen.calculative.canvas.active([pen]);
  }
}

function beforeValue(pen: formPen, value: any) {
  pen.calculative.isUpdateData = false;
  if (
    (value as any).table ||
    (value.col == undefined && value.row == undefined)
  ) {
    if (value.dataY) {
      const replaceMode = pen.replaceMode;
      let data = [];
      if (!replaceMode) {
        //追加
        data = pen.data.concat(value.dataY);
      } else if (replaceMode === ReplaceMode.Replace) {
        //替换
        data = pen.data;
        value.dataX &&
          value.dataX.forEach((item: number, index: number) => {
            data[item] = value.dataY[index];
          });
      } else if (replaceMode === ReplaceMode.ReplaceAll) {
        //替换指定
        if (value.dataX) {
          data[0] = value.dataX;
        } else {
          data[0] = pen.data[0];
        }
        data = data.concat(value.dataY);
      }
      delete value.dataX;
      delete value.dataY;
      pen.calculative.isUpdateData = true;
      return Object.assign(value, { data });
    }

    if (value.data || pen.styles) {
      pen.calculative.isUpdateData = true;
    }
    return value;
  }
  let rowData = pen.data[value.row];
  if (!rowData) {
    return value;
  }
  if (rowData[value.col] instanceof Object) {
  } else {
    rowData[value.col] = value.value;
  }
  setCellText(pen, value.row, value.col, value.value);
  pen.calculative.canvas.render();
  delete value.col;
  delete value.row;
  return value;
}
