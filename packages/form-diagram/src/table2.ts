import { formPen, cellData, Pos, ReplaceMode } from './common';
import { Point } from '../../core/src/point';
import { Rect } from '../../core/src/rect';
import { calcRightBottom, calcTextLines, deepClone } from '../../core';

export function table2(ctx: CanvasRenderingContext2D, pen: formPen) {
  if (!pen.onAdd) {
    pen.onAdd = onAdd;
    if (!pen.rowPos || !pen.colPos || !pen.calculative.maxOffsetY) {
      pen.onAdd(pen);
    }
    pen.onMouseMove = onMouseMove;
    pen.onMouseLeave = onMouseLeave;
    pen.onMouseDown = onMouseDown;
    pen.onShowInput = onShowInput;
    pen.onInput = onInput;
    pen.onValue = onValue;
    pen.onBeforeValue = beforeValue;
    pen.onMouseEnter = onMouseEnter;
    pen.onWheel = onWheel;
    pen.onDestroy = onDestroy;
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
  if (!pen.hasHeader) {
    ctx.save();
    ctx.beginPath();
    const { x, y, width, height } = pen.calculative.worldRect;
    ctx.fillStyle = '#fff0';
    ctx.rect(x-1, y-1, width+2, height+2);
    ctx.fill();
    ctx.clip();
  }
  // 画网格线
  drawGridLine(ctx, pen);

  // 画单元格
  drawCell(ctx, pen);

  // 画title
  drawNote(ctx, pen);
  ctx.restore();
  pen.isFirstTime = false;
}

function drawNote(ctx: CanvasRenderingContext2D, pen: any) {
  if (!pen.calculative.hover) {
    return;
  }
  if (!pen.calculative.hoverCell) {
    return;
  }
  if (pen.calculative.isInput) {
    return;
  }
  if (!pen.calculative.isHover) {
    return;
  }
  let rect = pen.calculative.worldRect;
  let mousePos = pen.calculative.canvas.mousePos;
  if (
    !(
      mousePos.x > rect.x &&
      mousePos.x < rect.x + rect.width &&
      mousePos.y > rect.y &&
      mousePos.y < rect.y + rect.height
    )
  ) {
    pen.calculative.hover = false;
    pen.calculative.isHover = false;
    pen.calculative.hoverCell = undefined;
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
  ctx.beginPath();
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
  const colStyle = {};
  if(pen.initWorldRect){
    return;
  }
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

    let style =
      pen.styles &&
      pen.styles.filter((item) => {
        return item.col === i && item.row === undefined;
      });
    if (style) {
      colStyle[i] = style[0];
    }
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
  let finalHight = height;
  for (let j = 0; j < pen.data.length; j++) {
    height +=
      (_rowHeightMap[j] || pen.rowHeight) *
      pen.calculative.canvas.store.data.scale;
    rowPos.push(height);
    if (j < pen.maxNum) {
      finalHight = height;
    }
  }
  pen.colPos = colPos;
  pen.rowPos = rowPos;
  pen.colStyle = colStyle;
  pen.initScale = pen.calculative.canvas.store.data.scale;
  pen.tableWidth = width;
  pen.tableHeight = finalHight || height;
  //   if (!pen.width) {
  pen.calculative.width = width;
  pen.calculative.height = finalHight || height;
  pen.calculative.width = width;
  pen.calculative.height = finalHight || height;
  pen.calculative.maxOffsetY =
    (height - finalHight) / pen.calculative.canvas.store.data.scale;
  if (!pen.height) {
    pen.height = pen.calculative.height;
  }
  if (!pen.width) {
    pen.width = pen.calculative.width;
  }
  let x = pen.x;
  let y = pen.y;
  if (pen.parentId) {
    let parentPen = pen.calculative.canvas.store.pens[pen.parentId];
    x =
      parentPen.calculative.worldRect.x +
      parentPen.calculative.worldRect.width * pen.x;
    y =
      parentPen.calculative.worldRect.y +
      parentPen.calculative.worldRect.height * pen.y;
  }
  pen.calculative.worldRect = {
    x,
    y,
    height: pen.calculative.height,
    width: pen.calculative.width,
    center: {
      x: pen.x + pen.calculative.width / 2,
      y: pen.y + pen.calculative.height / 2,
    },
  };
  pen.width = pen.calculative.width;
  pen.height = pen.calculative.height;
  if(!pen.initWorldRect){
    pen.initWorldRect = {
      width: pen.calculative.worldRect.width,
      height: pen.calculative.worldRect.height,
    }
  }
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
  ctx.beginPath();
  ctx.strokeStyle = pen.color;

  // 绘画最外框
  // ctx.beginPath();
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
  if (pen.bordered !== false) {
    ctx.strokeStyle = pen.borderColor || '#424B61';
    ctx.stroke();
  }
  if (pen.hLine !== false) {
    // 绘画行的线
    let last = pen.rowPos[pen.rowPos.length - 1];
    if (pen.hasHeader) {
      ctx.beginPath();
      ctx.moveTo(
        pen.calculative.worldRect.x,
        pen.calculative.worldRect.y +
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight
      );
      ctx.lineTo(
        pen.calculative.worldRect.ex,
        pen.calculative.worldRect.y +
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight
      );
      ctx.strokeStyle = pen.borderColor || '#424B61';
      ctx.stroke();
    }
    for (const item of pen.rowPos) {
      if (item === last) {
        continue;
      }
      const y =
        (item * pen.calculative.worldRect.height) / pen.tableHeight -
        pen.offsetY * pen.calculative.canvas.store.data.scale;
      if (pen.hasHeader) {
        if (y < 0 + pen.rowPos[0] || y > pen.calculative.worldRect.height) {
          continue;
        }
      } else {
        if (y < 0 || y > pen.calculative.worldRect.height) {
          continue;
        }
      }

      ctx.beginPath();
      ctx.moveTo(pen.calculative.worldRect.x, pen.calculative.worldRect.y + y);
      ctx.lineTo(pen.calculative.worldRect.ex, pen.calculative.worldRect.y + y);
      ctx.strokeStyle = pen.borderColor || '#424B61';
      ctx.stroke();
    }
  }
  if (pen.vLine !== false) {
    // 绘画列的线
    let last = pen.colPos[pen.colPos.length - 1];
    pen.colPos.forEach((item: number, i: number) => {
      if (item === last) {
        return;
      }
      const x = (item * pen.calculative.worldRect.width) / pen.tableWidth;
      ctx.beginPath();
      ctx.moveTo(pen.calculative.worldRect.x + x, pen.calculative.worldRect.y);
      ctx.lineTo(pen.calculative.worldRect.x + x, pen.calculative.worldRect.ey);
      ctx.strokeStyle = pen.borderColor || '#424B61';
      ctx.stroke();
    });
  }

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
    if (pen.hasHeader && i === 1) {
      ctx.save();
      ctx.beginPath();
      const { x, y, width, height } = pen.calculative.worldRect;
      ctx.fillStyle = '#fff0';
      ctx.rect(
        x-1,
        y +
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight-1,
        width+2,
        height -
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight+2
      );
      ctx.fill();
      ctx.clip();
    }
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
      if (pen.stripe) {
        if (pen.hasHeader !== false) {
          if (i % 2 === 1) {
            background = background || pen.stripeColor || '#407FFF1F';
          }
        } else {
          if (i % 2 === 0) {
            background = background || pen.stripeColor || '#407FFF1F';
          }
        }
      }
      // 选中
      if (
        pen.calculative.active &&
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
        pen.calculative.hover &&
        pen.calculative.hoverCell?.row === i &&
        pen.calculative.hoverCell?.col === j
      ) {
        color = pen.hoverColor;
        background = pen.hoverBackground;
        textColor = pen.hoverTextColor || pen.hoverColor;
        activeColor = color;
      }

      const rect = getCellRect(pen, i, j);
      if (
        rect.y + rect.height < pen.calculative.worldRect.y ||
        rect.y > pen.calculative.worldRect.height + pen.calculative.worldRect.y
      ) {
        continue;
      }
      // 有背景
      if (background) {
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = background;
        ctx.fillRect(
          rect.x,
          rect.y,
          rect.width + 0.25 * pen.calculative.canvas.store.data.scale,
          rect.height
        );
        ctx.restore();
      }

      // 选中或hover
      if (activeColor) {
        ctx.save();
        ctx.beginPath();
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
              if (pen.maxNum) {
                if (pen.hasHeader && i >= pen.maxNum) {
                  cell.visible = false;
                }
              }
              let childrenPen = JSON.parse(JSON.stringify(_colPen[0].pens));
              childrenPen.forEach((item: formPen) => {
                Object.assign(item, { row: i, col: j }, cell);
                item.activeBackground = item.background;
                item.hoverBackground = item.background;
                item.activeColor = item.color;
                item.hoverColor = item.color;
                item.activeTextColor = item.textColor;
                item.hoverTextColor = item.textColor;
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
      ctx.beginPath();
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
      let textAlign = pen.colStyle && pen.colStyle[j]?.textAlign;
      if (textAlign) {
        ctx.textAlign = textAlign;
      }
      if (rowText[j].length === 1) {
        if (textAlign === 'left') {
          ctx.fillText(rowText[j][0], rect.x, rect.y + rect.height / 2);
        } else if (textAlign === 'right') {
          ctx.fillText(
            rowText[j][0],
            rect.x + rect.width,
            rect.y + rect.height / 2
          );
        } else {
          ctx.fillText(
            rowText[j][0],
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
        }
      } else {
        const y = 0.55;
        const lineHeight =
          (fontSize || pen.calculative.fontSize) *
          pen.calculative.lineHeight *
          textScale;

        const h = rowText[j].length * lineHeight;
        let top = (rect.height - h) / 2;
        if (textAlign === 'left') {
          rowText[j].forEach((text, i) => {
            ctx.fillText(text, rect.x, rect.y + top + (i + y) * lineHeight);
          });
        } else if (textAlign === 'right') {
          rowText[j].forEach((text, i) => {
            ctx.fillText(
              text,
              rect.x + rect.width,
              rect.y + top + (i + y) * lineHeight
            );
          });
        } else {
          rowText[j].forEach((text, i) => {
            ctx.fillText(
              text,
              rect.x + rect.width / 2,
              rect.y + top + (i + y) * lineHeight
            );
          });
        }
      }
      ctx.restore();
    }
  }
}

// 添加table节点回调
function onAdd(pen: formPen) {
  createInterval(pen);
  if (!pen.children?.length) {
    pen.isFirstTime = true;
  }
  if (!pen.offsetY) {
    pen.offsetY = 0;
  }
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
  createInterval(pen);
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
    if (
      e.y >
      pen.calculative.worldRect.y +
        pen.rowPos[i] * scaleY -
        pen.offsetY * pen.calculative.canvas.store.data.scale
    ) {
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
  let offset = pen.offsetY * pen.calculative.canvas.store.data.scale;
  if (rowIndex === 0 && pen.hasHeader) {
    offset = 0;
  }
  return {
    x: pen.calculative.worldRect.x + x,
    y: pen.calculative.worldRect.y + y - offset,
    ex: pen.calculative.worldRect.x + ex,
    ey: pen.calculative.worldRect.y + ey - offset,
    width: ex - x,
    height: ey - y,
  };
}

// 计算cell子节点的世界坐标区域
function calcChildrenRect(pen: formPen, rect: Rect, children: formPen[]) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;
  let resizeX = 1;
  let resizeY = 1;
  if(pen.initWorldRect){
    if(pen.calculative.worldRect.width !== pen.initWorldRect.width){
      resizeX = pen.calculative.worldRect.width / pen.initWorldRect.width;
    }
    if(pen.calculative.worldRect.height !== pen.initWorldRect.height){
      resizeY = pen.calculative.worldRect.height / pen.initWorldRect.height;
    }
  }
  // 计算子节点需要的宽高
  let height = 0;
  let lastX = 0;
  let lastY = 0;
  const scale = pen.calculative.canvas.store.data.scale;
  if (children.length > 1) {
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
  } else {
    //一个子图元默认水平垂直居中
    children[0].x = rect.x + (rect.width - children[0].width) / 2;
    children[0].y = rect.y + (rect.height - children[0].height) / 2;
  }
  children.forEach((item: formPen) => {
    item.width = item.width * resizeX / scale;
    item.height = item.height * resizeY / scale;
  });
}

function onValue(pen: formPen) {
  if (pen.calculative.isUpdateData) {
    delete pen.calculative.isUpdateData;
    let temChildren = deepClone(pen.children);
    pen.children = [];
    onAdd(pen);
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
  if (pen.swiper !== undefined) {
    if (pen.swiper) {
      createInterval(pen);
    } else {
      delInterval(pen);
    }
  }
  if(value.styles){
    pen.initWorldRect = undefined;
  }
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

    if (value.data || value.styles || value.maxNum) {
      pen.calculative.isUpdateData = true;
    }
    for (let key of Object.keys(value)) {
      if (key.includes('data.')) {
        pen.calculative.isUpdateData = true;
      }
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

//鼠标滚动
function onWheel(pen: formPen, e: WheelEvent) {
  if (!pen.locked && !pen.calculative.canvas.store.data.locked) {
    return;
  }
  if (!pen.maxNum) {
    return;
  }
  let offset = 0;
  if (e.deltaY > 0) {
    offset = 4;
  } else {
    offset = -4;
  }
  scroll(pen, offset);
}

//滚动处理
function scroll(pen: formPen, offset: number) {
  if (!pen.offsetY) {
    pen.offsetY = 0;
  }
  pen.offsetY += offset;
  //滚动的最大偏移值
  if (pen.offsetY > pen.calculative.maxOffsetY) {
    pen.offsetY = pen.calculative.maxOffsetY;
  }
  if (pen.offsetY < 0) {
    pen.offsetY = 0;
  }
  //子节点

  pen.children?.forEach((item) => {
    const _pen: formPen = pen.calculative.canvas.store.pens[item];
    changeChildVisible(pen, _pen);
  });
  pen.calculative.canvas.render();
}

//控制子节点
function changeChildVisible(pen: formPen, _pen: formPen) {
  if (!_pen) {
    return;
  }
  if (!_pen.oldY) {
    _pen.oldY = _pen.y;
  }
  const { y, height } = _pen.calculative.worldRect;
  const { y: penY, height: penH } = pen.calculative.worldRect;
  const scale = pen.calculative.canvas.store.data.scale;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;
  const rowHeight = pen.rowHeight; //*scale;

  //y值更新
  _pen.y = _pen.oldY - (pen.offsetY * scale) / pen.calculative.worldRect.height;
  const oldOffset =
    ((rowHeight * (pen.initScale || 1)) / pen.tableHeight) * pen.maxNum;
  pen.calculative.canvas.updatePenRect(_pen);

  if (pen.hasHeader) {
    if (_pen.y < pen.rowPos[0] / pen.tableHeight) {
      //显示/隐藏
      _pen.calculative.visible = false;
      _pen.visible = false;
      //颜色及位置更新
      if (_pen.y < pen.rowPos[0] / pen.tableHeight / 2) {
        _pen.oldY += oldOffset;

        let row = _pen.row + pen.maxNum;
        if (!pen.data[row]) {
          return;
        }
        let rowStyle = deepClone(pen.data[row][_pen.col]);
        if (rowStyle.background) {
          rowStyle.activeBackground = rowStyle.background;
          rowStyle.hoverBackground = rowStyle.background;
        }
        if (rowStyle.color) {
          rowStyle.hoverColor = rowStyle.color;
          rowStyle.activeColor = rowStyle.color;
        }
        if (rowStyle.textColor) {
          rowStyle.activeTextColor = rowStyle.textColor;
          rowStyle.hoverTextColor = rowStyle.textColor;
        }
        Object.assign(_pen, rowStyle, { row: row });
        Object.assign(_pen.calculative, rowStyle, { row: row });
      }
    } else if (_pen.y + _pen.height > 1) {
      //显示/隐藏
      _pen.calculative.visible = false;
      _pen.visible = false;

      //颜色及位置更新
      if (_pen.y + _pen.height / 2 > 1) {
        _pen.oldY -= oldOffset;
        let row = _pen.row - pen.maxNum;
        if (!pen.data[row]) {
          return;
        }
        let rowStyle = deepClone(pen.data[row][_pen.col]);
        if (rowStyle.background) {
          rowStyle.activeBackground = rowStyle.background;
          rowStyle.hoverBackground = rowStyle.background;
        }
        if (rowStyle.color) {
          rowStyle.hoverColor = rowStyle.color;
          rowStyle.activeColor = rowStyle.color;
        }
        if (rowStyle.textColor) {
          rowStyle.activeTextColor = rowStyle.textColor;
          rowStyle.hoverTextColor = rowStyle.textColor;
        }
        Object.assign(_pen, rowStyle, { row: row });
        Object.assign(_pen.calculative, rowStyle, { row: row });
      }
    } else {
      _pen.visible = true;
      _pen.calculative.visible = true;
    }
  } else {
    if (_pen.y < 0) {
      _pen.calculative.visible = false;
      _pen.visible = false;

      if (_pen.y < -rowHeight / pen.tableHeight / 2) {
        _pen.oldY += oldOffset;

        let row = _pen.row + pen.maxNum;
        if (!pen.data[row]) {
          return;
        }
        let rowStyle = deepClone(pen.data[row][_pen.col]);
        if (rowStyle.background) {
          rowStyle.activeBackground = rowStyle.background;
          rowStyle.hoverBackground = rowStyle.background;
        }
        if (rowStyle.color) {
          rowStyle.hoverColor = rowStyle.color;
          rowStyle.activeColor = rowStyle.color;
        }
        if (rowStyle.textColor) {
          rowStyle.activeTextColor = rowStyle.textColor;
          rowStyle.hoverTextColor = rowStyle.textColor;
        }

        Object.assign(_pen, rowStyle, { row: row });
        Object.assign(_pen.calculative, rowStyle, { row: row });
      }
    } else if (_pen.y + _pen.height > 1) {
      _pen.calculative.visible = false;
      _pen.visible = false;

      if (_pen.y + _pen.height / 2 > 1) {
        _pen.oldY -= oldOffset;
        let row = _pen.row - pen.maxNum;
        if (!pen.data[row]) {
          return;
        }
        let rowStyle = deepClone(pen.data[row][_pen.col]);
        if (rowStyle.background) {
          rowStyle.activeBackground = rowStyle.background;
          rowStyle.hoverBackground = rowStyle.background;
        }
        if (rowStyle.color) {
          rowStyle.hoverColor = rowStyle.color;
          rowStyle.activeColor = rowStyle.color;
        }
        if (rowStyle.textColor) {
          rowStyle.activeTextColor = rowStyle.textColor;
          rowStyle.hoverTextColor = rowStyle.textColor;
        }
        Object.assign(_pen, rowStyle, { row: row });
        Object.assign(_pen.calculative, rowStyle, { row: row });
      }
    } else {
      _pen.calculative.visible = true;
      _pen.visible = true;
    }
  }
}

function onDestroy(pen: any) {
  delInterval(pen);
}

function delInterval(pen: formPen) {
  if (pen.interval) {
    globalThis.clearInterval(pen.interval);
    pen.interval = null;
  }
}

function createInterval(pen: formPen) {
  if (pen.maxNum && pen.swiper) {
    if (pen.interval) {
      return;
    }

    pen.interval = globalThis.setInterval(() => {
      if (pen.offsetY >= pen.calculative.maxOffsetY) {
        pen.offsetY = 0;
        initChildrenStyle(pen);
      } else {
        if (!(pen.offsetY % pen.rowHeight)) {
          //完整一行 停顿
          if (!pen.calculative.stap) {
            pen.calculative.stap = 0;
          }
          pen.calculative.stap += 1;
          if (pen.calculative.stap == 12) {
            pen.calculative.stap = 0;
            scroll(pen, 1);
          }
        } else {
          scroll(pen, 1);
        }
      }
    }, 50);
  }
}

function initChildrenStyle(pen: formPen) {
  pen.children?.forEach((item) => {
    const rowHeight = pen.rowHeight; //*scale;
    const _pen: formPen = pen.calculative.canvas.store.pens[item];
    if (!_pen) {
      return;
    }
    const oldOffset =
      ((rowHeight * (pen.initScale || 1)) / pen.tableHeight) * pen.maxNum;
    _pen.oldY -= oldOffset;
    const row = _pen.row - pen.maxNum;
    if (!pen.data[row]) {
      return;
    }
    let rowStyle = deepClone(pen.data[row][_pen.col]);
    if (rowStyle.background) {
      rowStyle.activeBackground = rowStyle.background;
      rowStyle.hoverBackground = rowStyle.background;
    }
    if (rowStyle.color) {
      rowStyle.hoverColor = rowStyle.color;
      rowStyle.activeColor = rowStyle.color;
    }
    if (rowStyle.textColor) {
      rowStyle.activeTextColor = rowStyle.textColor;
      rowStyle.hoverTextColor = rowStyle.textColor;
    }
    _pen.calculative.visible = true;
    _pen.visible = true;
    Object.assign(_pen, rowStyle, { row: row });
    Object.assign(_pen.calculative, rowStyle, { row: row });
  });

  pen.calculative.canvas.render();
}

function onMouseEnter(pen: formPen) {
  delInterval(pen);
}
