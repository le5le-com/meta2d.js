import { Pos, ReplaceMode } from './common';
import { Point } from '../../core/src/point';
import { Rect } from '../../core/src/rect';
import {
  calcRightBottom,
  calcTextLines,
  deepClone,
  calcCenter,
  Dropdown
} from '../../core';
import { Pen } from '../../core';

let lineGap = 4;

export interface MergeCell {
  row: number;
  col: number;
  rowspan: number;
  colspan: number;
}

export interface Column {
  text:string;
  type:'select'|'numeric'|'date'|'time'|'checkbox',
  dropdownList?:Dropdown[]
}

export interface TablePen extends Pen {
  rowHeaders?: boolean; //行头显示
  colHeaders?: boolean; //列头显示
  colPos?: number[]; //记录列位置
  rowPos?: number[]; //记录行位置
  tableWidth?: number; //表格宽度
  tableHeight?: number; //表格高度
  bordered?: boolean; //是否显示边框
  rowHeadersBackground?:string;//行头背景色
  rowHeadersColor?:string;//行头绘制颜色
  vLine?: boolean;
  hLine?: boolean;
  stripe?: boolean; //是否显示斑马纹
  stripeColor?: string; //斑马纹颜色
  /**
   * @deprecated 改用 colHeaders
   */
  hasHeader?: boolean; //是否显示表头
  rowHeight?: number; //默认行高
  colWidth?: number; //默认列宽
  maxNum?: number; //最大展示数量
  fixedWidth?: boolean; //固定表宽
  colStyle?: any;
  offsetY?: number;
  swiper?: boolean; //是否轮播
  oldY?: number;
  row?: number;
  col?: number;
  interval?: any;
  styles?: {
    //样式
    row?: number;
    col?: number;
    color?: string;
    background?: string;
    width?: number;
    height?: number;
    wheres?: { comparison?: string; key?: string; value?: string }[];
    pens?: TablePen[];
  }[];
  data?: any; //数据
  replaceMode?: ReplaceMode;

  calculative?: {
    maxOffsetY?: number;
    isUpdateData?: boolean;
    texts?: any[];
    activeRow?: number;
    activeCol?: number;
    activeCell?: Pos;
    hoverCell?: Pos;
    inputCell?: Pos;
    isInput?: boolean;
    isHover?: boolean;
    downPos?: { x: number; y: number };
    stap?: number;
    startIndex?: number; //可视范围开始行索引
    endIndex?: number; //可视范围结束行索引
    mergeCell?: MergeCell; //待合并的单元格
    // childrenArr?:Pen[][];//存储子节点
  } & Pen['calculative'];
  initWorldRect?: Rect;
  isFirstTime?: boolean;
  initScale?: number;
  timer?: any;
  mergeCells?: MergeCell[]; //记录table合并的单元格

  insertColLeft?: (index: number) => void;
  insertColRight?: (index: number) => void;
  deleteCol?: (index: number) => void;
  clearCol?: (index: number) => void;
  insertRowAbove?: (index: number) => void;
  insertRowBelow?: (index: number) => void;
  deleteRow?: (index: number) => void;
  clearRow?: (index: number) => void;
}

const rowHeadersWidth = 20;

export function table3(ctx: CanvasRenderingContext2D, pen: TablePen) {
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
    pen.onContextmenu = onContextmenu;
    pen.onResize = onResize;
    pen.onMove = onMove;
  }
  // console.time('table3');
  if (pen.data.length !== pen.rowPos.length) {
    pen.initWorldRect = null;
    pen.calculative.isUpdateData = true;
    pen.onValue(pen);
  }
  if (pen.data[0].length !== pen.colPos.length) {
    pen.initWorldRect = null;
    pen.calculative.isUpdateData = true;
    pen.onValue(pen);
  }

  const data = pen.calculative.canvas.store.data;
  const options = pen.calculative.canvas.store.options;
  pen.colHeaders =
    pen.colHeaders === undefined ? pen.hasHeader : pen.colHeaders;
  pen.color = pen.color || data.color || options.color;
  pen.textColor =
    pen.textColor || pen.color || data.textColor || options.textColor;
  pen.activeColor = pen.activeColor || options.activeColor;
  pen.hoverColor = pen.hoverColor || options.hoverColor;
  pen.activeBackground = pen.activeBackground || options.activeBackground;
  pen.hoverBackground = pen.hoverBackground || options.hoverBackground;
  if (!pen.colHeaders) {
    ctx.save();
    ctx.beginPath();
    const { x, y, width, height } = pen.calculative.worldRect;
    ctx.fillStyle = '#fff0';
    ctx.rect(x - 1, y - 1, width + 2, height + 2);
    ctx.fill();
    ctx.clip();
  }
  // 画网格线
  drawGridLine(ctx, pen);

  // 画单元格
  drawCell(ctx, pen);
  //绘制框选的、待合并的cell
  drawMergeCell(ctx, pen);
  // 画title
  ctx.restore();
  // 画选中列
  drawNote(ctx, pen);
  drawActiceCol(ctx, pen);

  pen.isFirstTime = false;
  // console.timeEnd('table3');
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

function initRect(pen: TablePen) {
  const colPos = [];
  const rowPos = [];
  const colStyle = {};

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
  if (pen.rowHeaders) {
    width = rowHeadersWidth;
  }
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
  pen.calculative.maxOffsetY =
    (height - finalHight) / pen.calculative.canvas.store.data.scale;
  if (pen.initWorldRect) {
    return;
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
  if (!pen.initWorldRect) {
    pen.initWorldRect = {
      width: pen.calculative.worldRect.width,
      height: pen.calculative.worldRect.height,
    };
  }
  calcRightBottom(pen.calculative.worldRect);
  //   }
}

function drawGridLine(ctx: CanvasRenderingContext2D, pen: TablePen) {
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
    if (pen.colHeaders) {
      //绘制表格 bottom的线
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
    for (let i = 0; i < pen.rowPos.length; i++) {
      let item = pen.rowPos[i];
      if (item === last) {
        continue;
      }
      const y =
        (item * pen.calculative.worldRect.height) / pen.tableHeight -
        pen.offsetY * pen.calculative.canvas.store.data.scale;
      if (pen.colHeaders) {
        if (
          y <
            0 +
              (pen.rowPos[0] * pen.calculative.worldRect.height) /
                pen.tableHeight ||
          y > pen.calculative.worldRect.height
        ) {
          continue;
        }
      } else {
        if (y < 0 || y > pen.calculative.worldRect.height) {
          continue;
        }
      }
      let cells = pen.mergeCells?.filter(
        (_cells) => _cells.row <= i && i < _cells.row + _cells.rowspan - 1
      );
      ctx.beginPath();
      ctx.strokeStyle = pen.borderColor || '#424B61';

      if (cells?.length) {
        //合并单元格情况
        cells.sort((a, b) => a.col - b.col);
        ctx.moveTo(
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.y + y
        );
        for (let j = 0; j < cells.length; j++) {
          let endIdx = cells[j].col - 1 + cells[j].colspan;
          if (endIdx >= pen.colPos.length) {
            endIdx = pen.colPos.length - 1;
          }
          let startX =
            (pen.colPos[cells[j].col - 1] * pen.calculative.worldRect.width) /
            pen.tableWidth;
          let endX =
            (pen.colPos[endIdx] * pen.calculative.worldRect.width) /
            pen.tableWidth;
          ctx.lineTo(
            pen.calculative.worldRect.x + startX,
            pen.calculative.worldRect.y + y
          );
          ctx.moveTo(
            pen.calculative.worldRect.x + endX,
            pen.calculative.worldRect.y + y
          );
        }
        ctx.lineTo(
          pen.calculative.worldRect.ex,
          pen.calculative.worldRect.y + y
        );
      } else {
        ctx.moveTo(
          pen.calculative.worldRect.x,
          pen.calculative.worldRect.y + y
        );
        ctx.lineTo(
          pen.calculative.worldRect.ex,
          pen.calculative.worldRect.y + y
        );
      }
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

      let cells = pen.mergeCells?.filter(
        (_cells) => _cells.col <= i && i < _cells.col + _cells.colspan - 1
      );
      ctx.beginPath();
      ctx.strokeStyle = pen.borderColor || '#424B61';
      if (cells?.length) {
        //合并单元格情况
        cells.sort((a, b) => a.row - b.row);
        const x = (item * pen.calculative.worldRect.width) / pen.tableWidth;
        ctx.moveTo(
          pen.calculative.worldRect.x + x,
          pen.calculative.worldRect.y
        );
        if (pen.colHeaders) {
          ctx.lineTo(
            pen.calculative.worldRect.x + x,
            pen.calculative.worldRect.y +
              (pen.rowPos[0] * pen.calculative.worldRect.height) /
                pen.tableHeight
          );
        }
        for (let j = 0; j < cells.length; j++) {
          let endIdx = cells[j].row - 1 + cells[j].rowspan;
          if (endIdx >= pen.rowPos.length) {
            endIdx = pen.rowPos.length - 1;
          }
          let startY =
            (pen.rowPos[cells[j].row - 1] * pen.calculative.worldRect.height) /
              pen.tableHeight -
            pen.offsetY * pen.calculative.canvas.store.data.scale;
          let endY =
            (pen.rowPos[endIdx] * pen.calculative.worldRect.height) /
              pen.tableHeight -
            pen.offsetY * pen.calculative.canvas.store.data.scale;
          if (startY > pen.calculative.worldRect.height) {
            //超出最底
            startY = pen.calculative.worldRect.height;
          }
          if (startY >= 0) {
            ctx.lineTo(
              pen.calculative.worldRect.x + x,
              pen.calculative.worldRect.y + startY
            );
          }
          if (endY > pen.calculative.worldRect.height) {
            endY = pen.calculative.worldRect.height;
          }
          if (endY >= 0) {
            ctx.moveTo(
              pen.calculative.worldRect.x + x,
              pen.calculative.worldRect.y + endY
            );
          }
        }
        ctx.lineTo(
          pen.calculative.worldRect.x + x,
          pen.calculative.worldRect.ey
        );
      } else {
        const x = (item * pen.calculative.worldRect.width) / pen.tableWidth;
        ctx.moveTo(
          pen.calculative.worldRect.x + x,
          pen.calculative.worldRect.y
        );
        ctx.lineTo(
          pen.calculative.worldRect.x + x,
          pen.calculative.worldRect.ey
        );
      }
      ctx.stroke();
    });
  }

  ctx.restore();
}

function drawActiceCol(ctx: CanvasRenderingContext2D, pen: TablePen) {
  if (pen.calculative.activeCol !== undefined) {
    //绘制选中列
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = pen.activeColor;
    ctx.fillStyle = '#278df833';

    const colRect = getColRect(pen, pen.calculative.activeCol);
    ctx.rect(
      colRect.x,
      pen.calculative.worldRect.y,
      colRect.width,
      pen.calculative.worldRect.height
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawMergeCell(ctx: CanvasRenderingContext2D, pen: TablePen) {
  if (pen.calculative.mergeCell) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = pen.activeColor;
    ctx.fillStyle = '#278df833';

    const rect = getMergeCellRect(pen, pen.calculative.mergeCell);
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawCell(ctx: CanvasRenderingContext2D, pen: TablePen) {
  if (!pen.colPos) {
    return;
  }

  if (!pen.calculative.texts) {
    pen.calculative.texts = [];
  }
  const scale = pen.calculative.canvas.store.data.scale;
  const textScale = 1;
  // if(!pen.calculative.childrenArr){
  //   //存储子节点
  //   pen.calculative.childrenArr = [];
  // }
  for (let i = 0; i < pen.rowPos.length; i++) {
    // if(! pen.calculative.childrenArr[i]){
    //   pen.calculative.childrenArr[i] = [];
    // }
    if (pen.colHeaders && i === 1) {
      //绘制头部
      ctx.save();
      ctx.beginPath();
      const { x, y, width, height } = pen.calculative.worldRect;
      ctx.fillStyle = '#fff0';
      ctx.rect(
        x - 1,
        y +
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight -
          1,
        width + 2,
        height -
          (pen.rowPos[0] * pen.calculative.worldRect.height) / pen.tableHeight +
          2
      );
      ctx.fill();
      ctx.clip();
    }
    const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

    if (
      i > 0 &&
      pen.offsetY * pen.calculative.canvas.store.data.scale >
        pen.rowPos[i] * scaleY
    ) {
      if (i >= pen.calculative.startIndex) {
        pen.calculative.startIndex = i + 1;
      }
      //跳出 绘制在表头上面的行
      continue;
    }
    if (
      pen.rowPos[i - 1] * scaleY -
        pen.offsetY * pen.calculative.canvas.store.data.scale >
      pen.calculative.worldRect.height
    ) {
      if (i < pen.calculative.endIndex) {
        pen.calculative.endIndex = i - 1;
      }
      //跳出 绘制在表格底部下面的行
      continue;
    }
    let { style: rowStyle } = getRow(pen, i);

    for (let j = 0; j < pen.colPos.length; j++) {
      let { value: cell, style: cellStyle, mergeCell } = getCell(pen, i, j);
      // if(mergeCell){
      //   continue;
      // }
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
        if (pen.colHeaders !== false) {
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
        // ctx.save();
        // ctx.beginPath();
        // ctx.fillStyle = activeColor;
        // ctx.strokeStyle = background;
        // ctx.rect(rect.x+rect.width-5*scale, rect.y+rect.height-5*scale, 5*scale, 5*scale);
        // ctx.fill();
        // ctx.stroke();
        // ctx.restore();
        ctx.restore();
      }

      // 绘画文本
      if (mergeCell) {
        continue;
      }
      pen.calculative.worldTextRect = rect;

      let rowText = pen.calculative.texts[i];
      if (!pen.calculative.texts[i]) {
        rowText = [];
        pen.calculative.texts[i] = rowText;
      }

      if (rowText[j] == null) {
        if (typeof cell === 'object') {
          if(i===0){
            //表头
            rowText[j] = cell.text;
          }else{
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
                  if (pen.colHeaders && i >= pen.maxNum) {
                    cell.visible = false;
                  }
                }
                let childrenPen = JSON.parse(JSON.stringify(_colPen[0].pens));
                childrenPen.forEach((item: TablePen) => {
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
                // pen.calculative.childrenArr[i][j]= childrenPen;
              }
              continue;
            }
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

    if (pen.rowHeaders) {
      //绘制行头
      // if(pen.colHeaders&&i===0){
      //   continue;
      // }
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = pen.rowHeadersBackground||'#407FFF1F';
      ctx.strokeStyle = pen.rowHeadersColor|| '#000';
      const rect = getCellRect(pen, i, -1);
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.fill();
      ctx.stroke();
      ctx.font =
        (pen.calculative.fontSize || 12) * textScale +
        'px ' +
        pen.calculative.fontFamily;
      ctx.fillStyle = pen.textColor||pen.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i + '', pen.x + rect.width / 2, rect.y + rect.height / 2);
      ctx.restore();
    }

    if (pen.calculative.activeRow === i) {
      //绘制选中行
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = pen.activeColor;
      ctx.fillStyle = '#278df833';
      const rowRect = getRowRect(pen, i);
      ctx.rect(rowRect.x, rowRect.y, rowRect.width, rowRect.height);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  }
  // if (pen.calculative.activeCol !== undefined) {
  //   //绘制选中列
  //   ctx.save();
  //   ctx.beginPath();
  //   ctx.strokeStyle = pen.activeColor;
  //   ctx.fillStyle = '#278df833';

  //   const colRect = getColRect(pen, pen.calculative.activeCol);
  //   ctx.rect(
  //     colRect.x,
  //     pen.calculative.worldRect.y,
  //     colRect.width,
  //     pen.calculative.worldRect.height
  //   );
  //   ctx.fill();
  //   ctx.stroke();
  //   ctx.restore();
  // }
}

// 添加table节点回调
function onAdd(pen: TablePen) {
  createInterval(pen);
  if (!pen.children?.length) {
    pen.isFirstTime = true;
  }
  if (!pen.offsetY) {
    pen.offsetY = 0;
  }
  pen.calculative.startIndex = 0;
  pen.calculative.endIndex = pen.data.length;
  initRect(pen);
}

function onShowInput(pen: any, e: Point) {
  // 没有活动单元格
  if (!pen.calculative.hoverCell) {
    return;
  }
  if(pen.calculative.hoverCell.row===undefined||pen.calculative.hoverCell.col===undefined){
    return;
  }

  const { value: cell, mergeCell } = getCell(
    pen,
    pen.calculative.hoverCell.row,
    pen.calculative.hoverCell.col
  );
  // 子节点，非文本
  if (typeof cell === 'object') {
    if(pen.calculative.hoverCell.row !== 0){
      //非表头
      return;
    }
  }
  pen.calculative.isHover = false;
  pen.calculative.isInput = true;
  pen.calculative.canvas.render();
  pen.calculative.inputCell = pen.calculative.hoverCell;
  if (mergeCell) {
    pen.calculative.inputCell = deepClone(mergeCell);
  }
  const rect = getCellRect(
    pen,
    pen.calculative.hoverCell.row,
    pen.calculative.hoverCell.col
  );
  pen.calculative.tempText = cell.text || cell + '';
  pen.dropdownList = undefined;
  pen.inputType = undefined;
  if(pen.calculative.hoverCell.row !== 0){
    let columnCell:Column|string =  pen.data[0][pen.calculative.hoverCell.col];
    if(typeof columnCell=== 'object'){
      if(columnCell.type === 'select'){
        pen.dropdownList = columnCell.dropdownList;
      }else if(columnCell.type === 'numeric'){
        pen.inputType = 'number';
      }
    }
  }
  pen.calculative.canvas.showInput(pen, rect, '#ffffff');
}

//将输入的数据写入到对应的data中
function onInput(pen: TablePen, text: string) {
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

function onMouseMove(pen: TablePen, e: Point) {
  if (pen.timer) {
    pen.calculative.isHover = false;
    clearTimeout(pen.timer);
  }
  pen.timer = setTimeout(() => {
    pen.calculative.isHover = true;
    pen.calculative.canvas.render();
  }, 500);

  if (
    pen.calculative.focus && pen.calculative.canvas.externalElements.style.cursor.indexOf('resize') !==
    -1
  ) {
    //移动表格线
    let scale = pen.calculative.canvas.store.data.scale;
    if (pen.calculative.hoverCell.lineCol) {
      // 移动列线
      let gap = e.x - pen.calculative.downPos.x;
      let colV =
        pen.calculative.hoverCell.lineCol < 2
          ? 0
          : pen.colPos[pen.calculative.hoverCell.lineCol - 2];
      if (
        pen.colPos[pen.calculative.hoverCell.lineCol - 1] + gap <
        colV + lineGap * 2
      ) {
        //不能超过前一个
        return;
      }
      if (
        pen.colPos[pen.calculative.hoverCell.lineCol - 1] + gap >
        pen.colPos[pen.calculative.hoverCell.lineCol] - lineGap * 2
      ) {
        //不能超过后一个
        for (
          let i = pen.calculative.hoverCell.lineCol;
          i < pen.colPos.length;
          i++
        ) {
          pen.colPos[i] += gap;
          //TODO 这里只是通过第一行判断
          // if (typeof pen.data[1][i] === 'object') {
          //   for(let j = 1;j<pen.data.length;j++){
          //     const rect = getCellRect(pen, j, i);
          //     calcChildrenRect(pen, rect, pen.calculative.childrenArr[j][i]);
          //   }
          // }
        }
        pen.calculative.worldRect.width += gap;
        pen.calculative.width += gap;
        pen.width += gap;
        calcRightBottom(pen.calculative.worldRect);
        calcCenter(pen.calculative.worldRect);
        pen.tableWidth += gap * scale;
        pen.calculative.canvas.activeRect = pen.calculative.worldRect;
      }
      for (let i = 0; i < pen.calculative.texts.length; i++) {
        //重新计算改线上下文字布局
        pen.calculative.texts[i][pen.calculative.hoverCell.lineCol - 1] = null;
        pen.calculative.texts[i][pen.calculative.hoverCell.lineCol] = null;
      }
      pen.colPos[pen.calculative.hoverCell.lineCol - 1] += gap;
      pen.calculative.downPos.x = e.x;
    }
    if (pen.calculative.hoverCell.lineRow) {
      //移动行线
      let gap = e.y - pen.calculative.downPos.y;
      let rowV =
        pen.calculative.hoverCell.lineRow < 2
          ? 0
          : pen.rowPos[pen.calculative.hoverCell.lineRow - 2];
      if (
        pen.rowPos[pen.calculative.hoverCell.lineRow - 1] + gap <
        rowV + lineGap * 2
      ) {
        return;
      }
      if (
        pen.rowPos[pen.calculative.hoverCell.lineRow - 1] + gap >
        pen.rowPos[pen.calculative.hoverCell.lineRow] - lineGap * 2
      ) {
        //不能超过后一个
        for (
          let i = pen.calculative.hoverCell.lineRow;
          i < pen.rowPos.length;
          i++
        ) {
          pen.rowPos[i] += gap;
        }
        pen.calculative.worldRect.height += gap * scale;
        pen.calculative.height += gap * scale;
        pen.height += gap * scale;
        calcRightBottom(pen.calculative.worldRect);
        calcCenter(pen.calculative.worldRect);
        pen.tableHeight += gap * scale;
      }
      pen.rowPos[pen.calculative.hoverCell.lineRow - 1] += gap;
      pen.calculative.downPos.y = e.y;
    }
    pen.calculative.canvas.render();
    return;
  }

  if (pen.calculative.focus&& pen.calculative.canvas.mouseDown) {
    if (pen.calculative.activeCell.row <= 0) {
      //表头不允许合并
      return;
    }
    pen.calculative.hoverCell = getCellIndex(pen, e);
    if (!pen.locked && !pen.calculative.canvas.store.data.locked) {
      if (pen.calculative.activeCell) {
        pen.calculative.mergeCell = getMergeCell(pen);
        pen.calculative.canvas.render();
      }
    }
    return;
  }

  pen.calculative.hoverCell = getCellIndex(pen, e);
  if (pen.calculative.focus&&!pen.locked && !pen.calculative.canvas.store.data.locked) {
    if (pen.calculative.hoverCell.lineCol !== undefined) {
      pen.calculative.canvas.externalElements.style.cursor = 'col-resize';
      // pen.calculative.focus = true;
    }
    if (pen.calculative.hoverCell.lineRow !== undefined) {
      pen.calculative.canvas.externalElements.style.cursor = 'row-resize';
      // pen.calculative.focus = true;
    }
    if (pen.calculative.hoverCell.allRow !== undefined) {
      pen.calculative.canvas.externalElements.style.cursor =
        `url("${pen.calculative.canvas.store.options.rightCursor}") 8 8, auto`;
      // pen.calculative.focus = true;
    }

    if (pen.calculative.hoverCell.allCol !== undefined) {
      pen.calculative.canvas.externalElements.style.cursor = `url("${pen.calculative.canvas.store.options.downCursor}") 8 8, auto`;
      // pen.calculative.focus = true;
    }
  }
  pen.calculative.canvas.render();
}

function onMouseLeave(pen: TablePen, e: Point) {
  createInterval(pen);
  // hideScroll(pen);
  pen.calculative.singleton?.tableScroll?.hideScroll();
  // pen.calculative.singleton?.tableScroll?.destroy();
  // pen.calculative.singleton&&(pen.calculative.singleton.tableScroll = undefined);
  // pen.calculative.hoverCell = undefined;
  //   pen.calculative.activeCell = undefined;
  pen.calculative.canvas.render();
}

function onMouseDown(pen: TablePen, e: Point) {
  pen.calculative.downPos = deepClone(e);
  pen.calculative.activeCell = getCellIndex(pen, e);
  // pen.calculative.focus = false;
  // if (pen.calculative.activeCell) {
  //   pen.calculative.focus = true;
  // }
  if (
    pen.calculative.mergeCell &&
    !cellInCell(
      {
        col: pen.calculative.activeCell.col,
        colspan: 1,
        row: pen.calculative.activeCell.row,
        rowspan: 1,
      },
      pen.calculative.mergeCell
    )
  ) {
    pen.calculative.mergeCell = undefined;
  }
  if (
    pen.calculative.focus&&
    pen.calculative.mergeCell === undefined &&
    pen.calculative.activeCell.allRow === undefined
  ) {
    for (let i = 0; i < pen.mergeCells?.length; i++) {
      //选中的就是一个合并单元格
      if (
        cellInCell(
          {
            col: pen.calculative.activeCell.col,
            colspan: 1,
            row: pen.calculative.activeCell.row,
            rowspan: 1,
          },
          pen.mergeCells[i]
        )
      ) {
        pen.calculative.mergeCell = deepClone(pen.mergeCells[i]);
      }
    }
  }
  pen.calculative.activeCol = undefined;
  pen.calculative.activeRow = undefined;
  if (!pen.locked && !pen.calculative.canvas.store.data.locked) {
    if (pen.calculative.singleton?.tableContextMenu) {
      pen.calculative.singleton.tableContextMenu.hide();
    }
    //选中行
    if (pen.calculative.hoverCell?.allRow !== undefined) {
      pen.calculative.activeRow = pen.calculative.hoverCell.allRow;
      // pen.calculative.focus = true;
    }
    //选中列
    if (pen.calculative.hoverCell?.allCol !== undefined) {
      pen.calculative.activeCol = pen.calculative.hoverCell.allCol;
      // pen.calculative.focus = true;
    }
    if (pen.calculative.mergeCell !== undefined) {
      // pen.calculative.focus = true;
    }
  }
  pen.calculative.canvas.render();
}

// 根据坐标，计算在哪个cell
function getCellIndex(pen: TablePen, e: Point): Pos {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  // const pos: Pos = { row: 0, col: 0 };

  // for (let i = 0; i < pen.colPos.length; i++) {
  //   if (e.x > pen.calculative.worldRect.x + pen.colPos[i] * scaleX) {
  //     pos.col = i + 1;
  //   }
  // }
  // for (let i = 0; i < pen.rowPos.length; i++) {
  //   if (
  //     e.y >
  //     pen.calculative.worldRect.y +
  //       pen.rowPos[i] * scaleY -
  //       pen.offsetY * pen.calculative.canvas.store.data.scale
  //   ) {
  //     pos.row = i + 1;
  //   }
  // }

  // return pos;

  const pos: Pos = {
    row: undefined,
    col: undefined,
    lineRow: undefined,
    lineCol: undefined,
    allRow: undefined,
    allCol: undefined,
  };
  for (let i = 0; i < pen.colPos.length; i++) {
    let temX = i === 0 ? 0 : pen.colPos[i - 1] * scaleX;
    if (
      e.x <= pen.calculative.worldRect.x + pen.colPos[i] * scaleX - lineGap &&
      e.x >= pen.calculative.worldRect.x + temX + lineGap
    ) {
      pos.col = i;
    }
    if (i === 0) {
      continue;
    }
    //哪一列线
    if (
      e.x < pen.calculative.worldRect.x + temX + lineGap &&
      e.x > pen.calculative.worldRect.x + temX - lineGap
    ) {
      pos.lineCol = i;
    }
  }
  let start = pen.calculative.startIndex || 0;
  let end = pen.calculative.endIndex || pen.rowPos.length;
  if (pen.colHeaders) {
    //鼠标移动到表头
    if (e.y < pen.calculative.worldRect.y + pen.rowPos[0] * scaleY) {
      pos.row = 0;
    }
  }
  if (pos.row === undefined) {
    for (let i = start; i <= end; i++) {
      let temY = i === 0 ? 0 : pen.rowPos[i - 1] * scaleY;
      if (
        e.y <=
          pen.calculative.worldRect.y +
            pen.rowPos[i] * scaleY -
            pen.offsetY * pen.calculative.canvas.store.data.scale -
            lineGap &&
        e.y >=
          pen.calculative.worldRect.y +
            temY -
            pen.offsetY * pen.calculative.canvas.store.data.scale +
            lineGap
      ) {
        pos.row = i;
      }
      if (i === 0) {
        continue;
      }
      //哪一行线
      // if (!pen.maxNum) {
      //如果有最大行数限制 不允许去调节行
      if (
        e.y <
          pen.calculative.worldRect.y +
            temY -
            pen.offsetY * pen.calculative.canvas.store.data.scale +
            lineGap &&
        e.y >
          pen.calculative.worldRect.y +
            temY -
            pen.offsetY * pen.calculative.canvas.store.data.scale -
            lineGap
      ) {
        if (i < pen.rowPos.length) {
          pos.lineRow = i;
        }
      }
      // }
    }

    //哪一行
    if (
      e.x <
      pen.calculative.worldRect.x +
        lineGap +
        (pen.colHeaders ? rowHeadersWidth : 0)
    ) {
      pos.allRow = 0;
      for (let i = 0; i < pen.rowPos.length; i++) {
        if (
          e.y >
          pen.calculative.worldRect.y +
            pen.rowPos[i] * scaleY -
            pen.offsetY * pen.calculative.canvas.store.data.scale
        ) {
          pos.allRow = i + 1;
        }
      }
    }
  }
  //哪一列
  if (
    e.y <
    pen.calculative.worldRect.y +
      // - pen.offsetY * pen.calculative.canvas.store.data.scale
      lineGap
  ) {
    pos.allCol = 0;
    for (let i = 0; i < pen.rowPos.length; i++) {
      if (e.x > pen.calculative.worldRect.x + pen.colPos[i] * scaleX) {
        pos.allCol = i + 1;
      }
    }
  }
  if (pos.lineCol !== undefined) {
    let cells = [];
    if (pos.row !== undefined) {
      cells = pen.mergeCells?.filter(
        (_cells) =>
          _cells.col < pos.lineCol &&
          pos.lineCol < _cells.col + _cells.colspan &&
          pos.row >= _cells.row &&
          pos.row < _cells.row + _cells.rowspan
      );
    }
    // if(pos.row === undefined){
    //   cells = pen.mergeCells.filter((_cells) => _cells.col < pos.lineCol && pos.lineCol < _cells.col + _cells.colspan);
    // }
    if (pos.lineRow !== undefined) {
      cells = pen.mergeCells?.filter(
        (_cells) =>
          _cells.col < pos.lineCol &&
          pos.lineCol < _cells.col + _cells.colspan &&
          pos.lineRow >= _cells.row &&
          pos.lineRow < _cells.row + _cells.rowspan
      );
    }
    if (cells?.length) {
      pos.lineCol = undefined;
      pos.col = cells[0].col;
    }
  }

  if (pen.maxNum) {
    if (pos.lineRow !== undefined) {
      //有行线
      pos.row = pos.lineRow;
    }
    pos.lineRow = undefined;
  }
  return pos;
}

// 根据index获取cell
function getCell(pen: TablePen, rowIndex: number, colIndex: number) {
  if (!pen.data || !Array.isArray(pen.data)) {
    return;
  }
  let cells = pen.mergeCells?.filter(
    (_cell) =>
      _cell.row <= rowIndex &&
      _cell.row + _cell.rowspan > rowIndex &&
      _cell.col <= colIndex &&
      _cell.col + _cell.colspan > colIndex
  );
  let mergeCell: any = undefined;
  if (cells?.length) {
    //总是取单元格第一个数据
    if (rowIndex !== cells[0].row || colIndex !== cells[0].col) {
      mergeCell = {
        row: cells[0].row,
        col: cells[0].col,
      };
    }
    rowIndex = cells[0].row;
    colIndex = cells[0].col;
  }

  const row = pen.data[rowIndex];
  //TODO 没有获取单独设置 某行 某列 的样式
  const style =
    pen.styles &&
    pen.styles.filter((item) => {
      return item.row === rowIndex && item.col === colIndex;
    });
  if (Array.isArray(row)) {
    return {
      value: row[colIndex],
      style: style?.length > 0 ? style[0] : {},
      mergeCell,
    };
  } else if (!row.data || !Array.isArray(row.data)) {
    return;
  }
}

// 根据index获取getRow
function getRow(pen: TablePen, rowIndex: number) {
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

function getMergeCell(pen: TablePen) {
  // let mergeCell = {
  //   row: pen.calculative.activeCell.row,
  //   col: pen.calculative.activeCell.col,
  //   rowspan: pen.calculative.hoverCell.row - pen.calculative.activeCell.row + 1,
  //   colspan: pen.calculative.hoverCell.col - pen.calculative.activeCell.col + 1,
  // };
  let hoverCell = deepClone(pen.calculative.hoverCell);
  //保证hover格式正确
  if (!hoverCell.col) {
    hoverCell.col = hoverCell.lineCol || 0;
  }
  if (!hoverCell.row) {
    hoverCell.row = hoverCell.lineRow;
  }
  let mergeCell = getBoundingCell([
    { ...pen.calculative.activeCell, rowspan: 1, colspan: 1 },
    { ...hoverCell, rowspan: 1, colspan: 1 },
  ]);
  //框选区域包含合并过的单元格
  // if(pen.mergeCells){
  //   let cells = pen.mergeCells.filter((_cell)=>{
  //     return cellOverlap(mergeCell,_cell);
  //   });
  //   if(cells.length){
  //     mergeCell = getBoundingCell([mergeCell,...cells]);
  //   }
  // }
  if (pen.mergeCells) {
    mergeCell = deepMergeCell(pen, mergeCell);
  }
  return mergeCell;
}

function deepMergeCell(pen: TablePen, mergeCell: MergeCell) {
  let cells = pen.mergeCells?.filter((_cell) => {
    return cellOverlap(_cell, mergeCell);
  });
  if (cells?.length) {
    // mergeCell = getBoundingCell([mergeCell,...cells])
    //TODO 1
    return deepMergeCell(pen, getBoundingCell([mergeCell, ...cells]));
  } else {
    return mergeCell;
  }
}
//cell是否有重叠
function cellOverlap(cell1: MergeCell, cell2: MergeCell) {
  if (cell1.row + cell1.rowspan <= cell2.row) {
    return false;
  }
  if (cell1.row >= cell2.row + cell2.rowspan) {
    return false;
  }
  if (cell1.col + cell1.colspan <= cell2.col) {
    return false;
  }
  if (cell1.col >= cell2.col + cell2.colspan) {
    return false;
  }

  if (cellInCell(cell1, cell2)) {
    return false;
  }
  return true;
}

//cell1是否在cell2中
function cellInCell(cell1: MergeCell, cell2: MergeCell) {
  if (
    cell1.row >= cell2.row &&
    cell1.row + cell1.rowspan <= cell2.row + cell2.rowspan &&
    cell1.col >= cell2.col &&
    cell1.col + cell1.colspan <= cell2.col + cell2.colspan
  ) {
    return true;
  }
  return false;
}

// 获取合并单元格的边界
function getBoundingCell(cells: MergeCell[]) {
  let minX = cells[0].col;
  let minY = cells[0].row;
  let maxX = cells[0].col + cells[0].colspan;
  let maxY = cells[0].row + cells[0].rowspan;
  cells.forEach((cell) => {
    minX = Math.min(minX, cell.col);
    minY = Math.min(minY, cell.row);
    maxX = Math.max(maxX, cell.col + cell.colspan);
    maxY = Math.max(maxY, cell.row + cell.rowspan);
  });
  return { col: minX, row: minY, colspan: maxX - minX, rowspan: maxY - minY };
}

// 设置cell的文本
function setCellText(
  pen: TablePen,
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
    rowData[colIndex].text = text;
  } else {
    rowData[colIndex] = text;
  }

  pen.calculative.canvas.store.emitter.emit('valueUpdate', pen);
}

// 计算cell世界坐标区域
function getCellRect(pen: TablePen, rowIndex: number, colIndex: number) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;
  const cells = pen.mergeCells?.filter(
    (item) =>
      item.col <= colIndex &&
      item.row <= rowIndex &&
      item.col + item.colspan > colIndex &&
      item.row + item.rowspan > rowIndex
  );
  let x = 0;

  let ex = 0;
  if (colIndex > -1) {
    ex = pen.colPos[colIndex] * scaleX;
  } else if (colIndex === -1) {
    if(pen.rowHeaders){
      ex = rowHeadersWidth * scaleX;
    }else{
      ex =0;
    }
  }
  if (colIndex > 0) {
    x = pen.colPos[colIndex - 1] * scaleX;
  }
  if (colIndex === 0 && pen.rowHeaders) {
    x = rowHeadersWidth * scaleX;
  }
  if (cells?.length) {
    if (cells[0].col < 1) {
      if(pen.rowHeaders){
        x = rowHeadersWidth * scaleX;
      }else{
        x = 0;
      }
    } else {
      x = pen.colPos[cells[0].col - 1] * scaleX;
    }
    let endIdx = cells[0].col + cells[0].colspan - 1;
    if (endIdx >= pen.colPos.length) {
      endIdx = pen.colPos.length - 1;
    }
    ex = pen.colPos[endIdx] * scaleX;
  }

  let y = 0;
  let ey = pen.rowPos[rowIndex] * scaleY;
  if (rowIndex > 0) {
    y = pen.rowPos[rowIndex - 1] * scaleY;
  }

  if (cells?.length) {
    y = pen.rowPos[cells[0].row - 1] * scaleY;
    let endIdx = cells[0].row + cells[0].rowspan - 1;
    if (endIdx >= pen.rowPos.length) {
      endIdx = pen.rowPos.length - 1;
    }
    ey = pen.rowPos[endIdx] * scaleY;
  }

  let offset = pen.offsetY * pen.calculative.canvas.store.data.scale;
  if (rowIndex === 0 && pen.colHeaders) {
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

function getColRect(pen: TablePen, colIndex: number) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;

  let x = 0;
  if (pen.rowHeaders) {
    x = rowHeadersWidth * scaleX;
  }
  let ex = pen.colPos[colIndex] * scaleX;
  if (colIndex > 0) {
    x = pen.colPos[colIndex - 1] * scaleX;
  }
  return {
    x: pen.calculative.worldRect.x + x,
    y: pen.calculative.worldRect.y,
    ex: pen.calculative.worldRect.x + ex,
    ey: pen.calculative.worldRect.ey,
    width: ex - x,
    height: pen.calculative.worldRect.height,
  };
}

function getRowRect(pen: TablePen, rowIndex: number) {
  // const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  let y = 0;
  let ey = pen.rowPos[rowIndex] * scaleY;
  if (rowIndex > 0) {
    y = pen.rowPos[rowIndex - 1] * scaleY;
  }
  let offset = pen.offsetY * pen.calculative.canvas.store.data.scale;
  if (rowIndex === 0 && pen.colHeaders) {
    offset = 0;
  }
  return {
    x: pen.calculative.worldRect.x,
    y: pen.calculative.worldRect.y + y - offset,
    ex: pen.calculative.worldRect.ex,
    ey: pen.calculative.worldRect.y + ey - offset,
    width: pen.calculative.worldRect.width,
    height: ey - y,
  };
}

function getMergeCellRect(pen: TablePen, mergeCell: MergeCell) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;

  let x = pen.colPos[mergeCell.col - 1] * scaleX;
  if (mergeCell.col === 0) {
    x = 0;
    if (pen.rowHeaders) {
      x = rowHeadersWidth * scaleX;
    }
  }
  let ex = pen.colPos[mergeCell.col + mergeCell.colspan - 1] * scaleX;

  let y = pen.rowPos[mergeCell.row - 1] * scaleY;
  // if()
  let ey = pen.rowPos[mergeCell.row + mergeCell.rowspan - 1] * scaleY;

  let offset = pen.offsetY * pen.calculative.canvas.store.data.scale;
  // if (mergeCell === 0 && pen.colHeaders) {
  //   offset = 0;
  // }
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
function calcChildrenRect(pen: TablePen, rect: Rect, children: TablePen[]) {
  const scaleX = pen.calculative.worldRect.width / pen.tableWidth;
  const scaleY = pen.calculative.worldRect.height / pen.tableHeight;
  let resizeX = 1;
  let resizeY = 1;
  if (pen.initWorldRect) {
    if (pen.calculative.worldRect.width !== pen.initWorldRect.width) {
      resizeX = pen.calculative.worldRect.width / pen.initWorldRect.width;
    }
    if (pen.calculative.worldRect.height !== pen.initWorldRect.height) {
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
  children.forEach((item: TablePen) => {
    item.width = (item.width * resizeX) / scale;
    item.height = (item.height * resizeY) / scale;
  });
}

function onValue(pen: TablePen) {
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

function beforeValue(pen: TablePen, value: any) {
  pen.calculative.isUpdateData = false;
  if (pen.swiper !== undefined) {
    if (pen.swiper) {
      createInterval(pen);
    } else {
      delInterval(pen);
    }
  }
  if (value.styles) {
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
function onWheel(pen: TablePen, e: WheelEvent) {
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
  // updataScrollHTop(pen);
  pen.calculative.singleton?.tableScroll?.updataScrollHTop();
}

//滚动处理
function scroll(pen: TablePen, offset: number) {
  pen.calculative.startIndex = 0;
  pen.calculative.endIndex = pen.data.length;
  if (!pen.offsetY) {
    pen.offsetY = 0;
  }
  pen.offsetY += offset;
  const timesY = pen.calculative.worldRect.height / pen.initWorldRect.height;
  //滚动的最大偏移值
  if (pen.offsetY > pen.calculative.maxOffsetY * timesY) {
    pen.offsetY = pen.calculative.maxOffsetY * timesY;
  }
  if (pen.offsetY < 0) {
    pen.offsetY = 0;
  }
  //子节点
  pen.children?.forEach((item) => {
    const _pen: any = pen.calculative.canvas.store.pens[item];
    changeChildVisible(pen, _pen);
  });
  pen.calculative.canvas.render();
}

//控制子节点
function changeChildVisible(pen: TablePen, _pen: TablePen) {
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

  if (pen.colHeaders) {
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
  pen.calculative.singleton?.tableScroll?.destroy();
  pen.calculative.singleton?.tableContextMenu?.destroy();
  delInterval(pen);
}

function delInterval(pen: TablePen) {
  if (pen.interval) {
    globalThis.clearInterval(pen.interval);
    pen.interval = null;
  }
}

function createInterval(pen: TablePen) {
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

function initChildrenStyle(pen: TablePen) {
  pen.children?.forEach((item) => {
    const rowHeight = pen.rowHeight; //*scale;
    const _pen: any = pen.calculative.canvas.store.pens[item];
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

function onMouseEnter(pen: TablePen) {
  delInterval(pen);
  if (pen.maxNum && (pen.locked || pen.calculative.canvas.store.data.locked)) {
    // generateScroll(pen);
    if (!pen.calculative.singleton) {
      pen.calculative.singleton = {};
    }
    if (!pen.calculative.singleton.tableScroll) {
      pen.calculative.singleton.tableScroll = new TableScroll(pen);
    }
    pen.calculative.singleton.tableScroll.showScroll();
  }
}

function onContextmenu(pen: TablePen, e: Point) {
  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }
  if (!pen.calculative.singleton.tableContextMenu) {
    pen.calculative.singleton.tableContextMenu = new TableContextMenu(pen);
  }
  if (pen.calculative.mergeCell !== undefined) {
    pen.calculative.singleton.tableContextMenu.updateMenu('merge', e);
  }
  if (pen.calculative.activeRow !== undefined) {
    pen.calculative.singleton.tableContextMenu.updateMenu('row', e);
  }
  if (pen.calculative.activeCol !== undefined) {
    pen.calculative.singleton.tableContextMenu.updateMenu('col', e);
  }
}

function onResize(pen: TablePen) {
  pen.calculative.singleton?.tableScroll?.updataScroll();
}

function onMove(pen: TablePen) {
  pen.calculative.singleton?.tableScroll?.updataScroll();
}

const contextmenu = {
  col: [
    {
      name: '左插入列',
      key: 'insertColLeft',
      disabled: false,
    },
    {
      name: '右插入列',
      key: 'insertColRight',
      disabled: false,
    },
    {
      name: '删除列',
      key: 'deleteCol',
    },
    {
      name: '清空列',
      key: 'clearCol',
    },
  ],
  row: [
    {
      name: '上插入行',
      key: 'insertRowAbove',
      disabled: false,
    },
    {
      name: '下插入行',
      key: 'insertRowBelow',
      disabled: false,
    },
    {
      name: '删除行',
      key: 'deleteRow',
    },
    {
      name: '清空行',
      key: 'clearRow',
    },
  ],
  merge: [
    {
      name: '清空单元格',
      key: 'clearCells',
    },
    {
      name: '取消合并',
      key: 'cancelMerge',
    },
    {
      name: '合并',
      key: 'mergeCell',
    },
  ],
};

export class TableContextMenu {
  options: {
    [key: string]: Array<{ [key: string]: any }>;
  };
  pen: TablePen;
  menu: HTMLElement;
  key: string;

  constructor(pen: TablePen) {
    this.pen = pen;
    this.options = contextmenu;
    this.init();
  }

  init() {
    this.menu = document.createElement('ul');
    this.menu.style.position = 'absolute';
    this.menu.style.zIndex = '999';
    this.menu.style.backgroundColor = '#fff';
    this.menu.style.listStyleType = 'none';
    this.menu.style.border = '1px solid #ccc';
    this.menu.style.display = 'none';

    document.body.appendChild(this.menu);
    this.pen.calculative.canvas.externalElements?.parentElement.appendChild(
      this.menu
    );
    if (!this.pen.calculative.singleton) {
      this.pen.calculative.singleton = {};
    }
    // this.pen.calculative.singleton.contextmenu = this.menu;

    //挂载api
    // this.pen.insertColLeft = this.insertColLeft;
    // this.pen.insertColRight = this.insertColRight;
    // this.pen.deleteCol = this.deleteCol;
    // this.pen.clearCol = this.clearCol;
    // this.pen.insertRowAbove = this.insertRowAbove;
    // this.pen.insertRowBelow = this.insertRowBelow;
    // this.pen.deleteRow = this.deleteRow;
    // this.pen.clearRow = this.clearRow;
    for (let key in this.options) {
      this.options[key].forEach((item) => {
        this.pen[item.key] = this[item.key];
      });
    }
  }

  //更新菜单内容
  updateMenu(key: string, e: Point) {
    if (this.key !== key) {
      this.key = key;
      this.setMenuList();
    }
    this.menu.style.display = 'block';
    this.menu.style.left = e.x + 'px';
    this.menu.style.top = e.y + 'px';
  }

  setMenuList() {
    //删除原有menu项
    while (this.menu.firstChild) {
      this.menu.removeChild(this.menu.firstChild);
    }
    for (let i = 0; i < this.options[this.key].length; i++) {
      const li = document.createElement('li');
      li.style.width = '100px';
      li.style.height = '26px';
      li.style.color = '#373737';
      li.style.paddingLeft = '12px';
      li.style.lineHeight = '26px';
      li.style.cursor = 'pointer';
      li.innerText = this.options[this.key][i].name;
      li.onclick = () => {
        if (['row', 'col'].includes(this.key)) {
          this.pen[this.options[this.key][i].key](
            this.pen.calculative[this.key === 'row' ? 'activeRow' : 'activeCol']
          );
        } else {
          this.pen[this.options[this.key][i].key]();
        }
        this.menu.style.display = 'none';
      };
      li.onmouseover = function () {
        li.style.backgroundColor = '#f5f5f5';
      };
      li.onmouseleave = function () {
        li.style.backgroundColor = '';
      };
      this.menu.appendChild(li);
    }
  }

  hide() {
    this.menu.style.display = 'none';
  }

  insertColLeft = (colIndex: number) => {
    this.pen.data.forEach((item) => {
      item.splice(colIndex, 0, '');
    });
    let colWidth = this.pen.colWidth;
    if (colIndex !== 0) {
      colWidth = this.pen.colPos[colIndex - 1] + this.pen.colWidth;
    }
    this.pen.colPos.splice(colIndex, 0, colWidth);
    for (let i = colIndex + 1; i < this.pen.colPos.length; i++) {
      this.pen.colPos[i] += this.pen.colWidth;
    }
    this.pen.tableWidth += this.pen.colWidth;
    this.pen.calculative.worldRect.width += this.pen.colWidth;
    this.pen.calculative.worldRect.center.x += this.pen.colWidth / 2;
    this.pen.calculative.worldRect.ex += this.pen.colWidth;
    this.pen.initWorldRect.width += this.pen.colWidth;
    this.pen.styles?.forEach((item) => {
      if (item.col >= colIndex) {
        item.col += 1;
      }
    });
    this.pen.calculative.activeCol += 1;
    //有合并单元格
    if (this.pen.mergeCells?.length) {
      this.pen.mergeCells?.forEach((item) => {
        if (item.col < colIndex && colIndex < item.col + item.colspan) {
          item.colspan += 1;
        }
        if (item.col >= colIndex) {
          item.col += 1;
        }
      });
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  insertColRight = (colIndex: number) => {
    this.pen.data.forEach((item) => {
      item.splice(colIndex + 1, 0, '');
    });
    this.pen.colPos.splice(
      colIndex + 1,
      0,
      this.pen.colPos[colIndex] + this.pen.colWidth
    );
    for (let i = colIndex + 2; i < this.pen.colPos.length; i++) {
      this.pen.colPos[i] += this.pen.colWidth;
    }
    this.pen.tableWidth += this.pen.colWidth;
    this.pen.calculative.worldRect.width += this.pen.colWidth;
    this.pen.calculative.worldRect.center.x += this.pen.colWidth / 2;
    this.pen.calculative.worldRect.ex += this.pen.colWidth;
    this.pen.initWorldRect.width += this.pen.colWidth;

    this.pen.styles?.forEach((item) => {
      if (item.col >= colIndex) {
        item.col += 1;
      }
    });
    if (this.pen.mergeCells?.length) {
      this.pen.mergeCells?.forEach((item) => {
        if (item.col < colIndex + 1 && colIndex + 1 < item.col + item.colspan) {
          item.colspan += 1;
        }
        if (item.col >= colIndex + 1) {
          item.col += 1;
        }
      });
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  deleteCol = (colIndex: number) => {
    this.pen.data.forEach((item) => {
      item.splice(colIndex, 1);
    });
    let colWidth = this.pen.colPos[colIndex] - this.pen.colPos[colIndex - 1];
    if (colIndex === 0) {
      colWidth = this.pen.colPos[colIndex];
    }
    this.pen.colPos.splice(colIndex, 1);
    for (let i = colIndex; i < this.pen.colPos.length; i++) {
      this.pen.colPos[i] -= colWidth;
    }
    this.pen.tableWidth -= colWidth;
    this.pen.calculative.worldRect.width -= colWidth;
    this.pen.calculative.worldRect.center.x -= colWidth / 2;
    this.pen.calculative.worldRect.ex -= colWidth;
    this.pen.initWorldRect.width -= colWidth;

    this.pen.styles?.forEach((item) => {
      if (item.col >= colIndex) {
        item.col -= 1;
      }
    });
    if (this.pen.mergeCells?.length) {
      for (let i = 0; i < this.pen.mergeCells?.length; i++) {
        const item = this.pen.mergeCells[i];
        if (item.col <= colIndex && colIndex < item.col + item.colspan) {
          item.colspan -= 1;
        }
        if (item.col > colIndex) {
          item.col -= 1;
        }
        if (item.colspan < 1 || (item.colspan === 1 && item.rowspan === 1)) {
          this.pen.mergeCells.splice(i, 1);
          i--;
        }
      }
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  clearCol = (colIndex: number) => {
    this.pen.data.forEach((item) => {
      item[colIndex] = '';
    });
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  insertRowAbove = (rowIndex: number) => {
    let row = [];
    for (let i = 0; i < this.pen.colPos.length; i++) {
      row.push('');
    }
    //数据
    this.pen.data.splice(rowIndex, 0, row);
    //行位置
    this.pen.rowPos.splice(rowIndex, 0, this.pen.rowPos[rowIndex-1]+this.pen.rowHeight);
    for (let i = rowIndex + 1; i < this.pen.rowPos.length; i++) {
      this.pen.rowPos[i] += this.pen.rowHeight;
    }
    if(this.pen.maxNum){
      this.pen.calculative.maxOffsetY +=
        this.pen.rowHeight * this.pen.calculative.canvas.store.data.scale;
    }else{
      this.pen.tableHeight += this.pen.rowHeight;
      this.pen.height += this.pen.rowHeight;
      this.pen.calculative.worldRect.height += this.pen.rowHeight;
      this.pen.calculative.worldRect.center.y += this.pen.rowHeight / 2;
      this.pen.calculative.worldRect.ey += this.pen.rowHeight;
      this.pen.initWorldRect.height += this.pen.rowHeight;
      this.pen.calculative.endIndex+=1;
    }

    this.pen.calculative.activeRow += 1;
    //有合并单元格情况
    if (this.pen.mergeCells?.length) {
      this.pen.mergeCells.forEach((item) => {
        // 合并之间 增加
        if (item.row < rowIndex && rowIndex < item.row + item.rowspan) {
          item.rowspan += 1;
        }
        //合并之前 下移一位
        if (item.row >= rowIndex) {
          item.row += 1;
        }
      });
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  insertRowBelow = (rowIndex: number) => {
    let row = [];
    for (let i = 0; i < this.pen.colPos.length; i++) {
      row.push('');
    }
    this.pen.data.splice(rowIndex + 1, 0, row);
    //TODO initRect?
    let pos = this.pen.rowPos[rowIndex + 1];
    if(rowIndex === this.pen.rowPos.length - 1){
      pos = this.pen.rowPos[rowIndex] + this.pen.rowHeight;
    }
    this.pen.rowPos.splice(rowIndex + 1, 0, pos);
    for (let i = rowIndex + 2; i < this.pen.rowPos.length; i++) {
      this.pen.rowPos[i] += this.pen.rowHeight;
    }
    // this.pen.tableHeight += this.pen.rowHeight;
    if(this.pen.maxNum){
      this.pen.calculative.maxOffsetY +=
        this.pen.rowHeight * this.pen.calculative.canvas.store.data.scale;
    }else{
      this.pen.tableHeight += this.pen.rowHeight;
      this.pen.height += this.pen.rowHeight;
      this.pen.calculative.worldRect.height += this.pen.rowHeight;
      this.pen.calculative.worldRect.center.y += this.pen.rowHeight / 2;
      this.pen.calculative.worldRect.ey += this.pen.rowHeight;
      this.pen.initWorldRect.height += this.pen.rowHeight;
      this.pen.calculative.endIndex+=1;
    }
    //有合并单元格情况
    if (this.pen.mergeCells?.length) {
      this.pen.mergeCells.forEach((item) => {
        //合并之间 增加
        if (item.row < rowIndex + 1 && rowIndex + 1 < item.row + item.rowspan) {
          item.rowspan += 1;
        }
        //合并之前 下移一位
        if (item.row >= rowIndex + 1) {
          item.row += 1;
        }
      });
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  deleteRow = (rowIndex: number) => {
    this.pen.data.splice(rowIndex, 1);
    this.pen.rowPos.splice(rowIndex, 1);
    for (let i = rowIndex; i < this.pen.rowPos.length; i++) {
      this.pen.rowPos[i] -= this.pen.rowHeight;
    }
    this.pen.calculative.maxOffsetY -=
      this.pen.rowHeight * this.pen.calculative.canvas.store.data.scale;
    //有合并单元格情况
    if (this.pen.mergeCells?.length) {
      for (let i = 0; i < this.pen.mergeCells.length; i++) {
        const item = this.pen.mergeCells[i];
        //合并之间 增加
        if (item.row <= rowIndex && rowIndex < item.row + item.rowspan) {
          item.rowspan -= 1;
        }
        //合并之前 下移一位
        if (item.row > rowIndex) {
          item.row -= 1;
        }
        if (item.rowspan < 1 || (item.colspan === 1 && item.rowspan === 1)) {
          this.pen.mergeCells.splice(i, 1);
          i--;
        }
      }
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  clearRow = (rowIndex: number) => {
    for (let i = 0; i < this.pen.colPos.length; i++) {
      this.pen.data[rowIndex][i] = '';
    }
    this.pen.calculative.texts = undefined;
    this.pen.calculative.canvas.render();
  };

  clearCells = () => {
    if (this.pen.calculative.mergeCell) {
      let mergeCell = this.pen.calculative.mergeCell;
      for (let i = mergeCell.row; i < mergeCell.row + mergeCell.rowspan; i++) {
        for (
          let j = mergeCell.col;
          j < mergeCell.col + mergeCell.colspan;
          j++
        ) {
          this.pen.data[i][j] = '';
        }
      }
      this.pen.calculative.texts = undefined;
      this.pen.calculative.canvas.render();
    }
  };

  cancelMerge = () => {
    if (this.pen.mergeCells?.length) {
      for (let i = 0; i < this.pen.mergeCells.length; i++) {
        if (
          cellInCell(this.pen.mergeCells[i], this.pen.calculative.mergeCell)
        ) {
          this.pen.mergeCells.splice(i, 1);
          i--;
        }
      }
      this.pen.calculative.canvas.render();
    } else {
      console.warn('No cells are merged');
    }
  };

  mergeCell = () => {
    const mergeCell = this.pen.calculative.mergeCell;
    if (mergeCell) {
      let cellV = this.pen.data[mergeCell.row][mergeCell.col];
      this.clearCells();
      this.pen.calculative.texts = undefined;
      this.pen.data[mergeCell.row][mergeCell.col] = cellV;
      if (mergeCell.colspan > 1 || mergeCell.rowspan > 1) {
        for (let i = 0; i < this.pen.mergeCells?.length; i++) {
          if (cellInCell(this.pen.mergeCells[i], mergeCell)) {
            this.pen.mergeCells.splice(i, 1);
            i--;
          }
        }
        if(!this.pen.mergeCells){
          this.pen.mergeCells = [];
        }
        this.pen.mergeCells.push(deepClone(mergeCell));
        this.pen.calculative.canvas.render();
      }
    }
  };

  destroy() {
    this.menu.remove();
  }
}

export class TableScroll {
  pen: TablePen;
  h: HTMLElement;
  w: HTMLElement;
  isDownH: number;
  isDownW: number;
  scrollLength: number = 20;

  constructor(pen: TablePen) {
    this.pen = pen;
    this.init();
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  init() {
    this.h = document.createElement('div');
    this.w = document.createElement('div');
    // if(!this.pen.calculative.singleton){
    // this.pen.calculative.singleton = {};
    // }
    // this.pen.calculative.singleton.h = this.h;
    // this.pen.calculative.singleton.w = this.w;

    // pen.calculative.canvas.externalElements
    this.pen.calculative.canvas.externalElements?.parentElement.appendChild(
      this.h
    );
    this.pen.calculative.canvas.externalElements?.parentElement.appendChild(
      this.w
    );
    this.h.style.position = 'absolute';
    this.h.style.height = '100px';
    this.h.style.width = '5px';
    // h.style.display = 'block';
    this.h.style.borderRadius = `${this.scrollLength}px`;
    this.h.style.backgroundColor = 'rgba(0,0,0)';
    this.h.style.zIndex = '999';
    this.h.style.cursor = 'pointer';

    this.h.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isDownH = e.y;
    };

    this.updataScroll();
  }

  updataScroll() {
    if (this.h) {
      this.h.style.left =
        this.pen.calculative.worldRect.x +
        this.pen.calculative.canvas.store.data.x +
        this.pen.calculative.worldRect.width -
        5 +
        'px';
      this.h.style.height =
        this.scrollLength * this.pen.calculative.canvas.store.data.scale + 'px';
      this.updataScrollHTop();
    }
  }

  updataScrollHTop() {
    if (this.h) {
      const scale = this.pen.calculative.canvas.store.data.scale;
      const timesY =
        this.pen.calculative.worldRect.height / this.pen.initWorldRect.height;
      this.h.style.top =
        this.pen.calculative.worldRect.y +
        this.pen.calculative.canvas.store.data.y +
        (this.pen.offsetY / (this.pen.calculative.maxOffsetY * timesY)) *
          (this.pen.calculative.worldRect.height -
            this.scrollLength * this.pen.calculative.canvas.store.data.scale) +
        'px';
    }
  }

  hideScroll() {
    if (this.h && !this.isDownH) {
      this.h.style.display = 'none';
    }
  }

  showScroll() {
    if (this.h) {
      this.h.style.display = 'block';
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.isDownH) {
      const y = e.y - this.isDownH;
      const timesY =
        this.pen.calculative.maxOffsetY / this.pen.calculative.worldRect.height;
      scroll(this.pen, y * timesY);
      this.updataScrollHTop();
      this.isDownH = e.y;
    }
    // e.preventDefault();
    // e.stopPropagation();
  };

  private onMouseUp = (e: MouseEvent) => {
    this.isDownH = 0;
    this.isDownW = 0;
  };

  destroy() {
    this.h.remove();
    this.w.remove();
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
