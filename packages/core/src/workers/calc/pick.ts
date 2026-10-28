import { AnchorMode, Mode, WorkerMessage } from '../../types';
import {
  expandRect,
  getBoundary,
  getCurveSegmentPoints,
  hasLineCrossSegment,
  getBoundingCPs,
  onSegment,
  Pen,
  PenCategory,
  Point,
  pointInRect,
  Rect,
  rectInRect,
  rotatePoint,
  ControlPointType,
  rectToPoints,
  getRectOfPoints,
  getAllPens,
} from '../../models';
import { options, paint, penMap, textBoxs, view } from './vars';
import { probe } from '../../perf/probe';

let cellSize: number = 640;

let offsetX = 0; // offsetX、offsetY用于画布没有设置大小的情况。整体画布的pen.x/y会偏离原点和默认尺寸范围外。
let offsetY = 0;

let cols = 1;
let rows = 1;
let grid: Pen[][] = [];

/**
 * 每个图元**实际**登记在哪些格子（grid 下标；溢出桶 = grid.length - 1）。
 *
 * 为什么要记：原来「它现在在哪些格子」是每次拿调用方传进来的几何现算的 ——
 * 调用方传的可能是克隆或新位置（D38）。
 * 只要算出来的和登记时的不一样，删除就落空：旧登记删不掉（幽灵），或者删错格子。
 * 按旋转外接盒登记之后这个风险更大（外接盒随 pivot 变），所以「在哪」改为查记录，
 * 只有「应该在哪」才从几何算（而且只从 penMap 里那个完整对象算）。
 */
let penCells = new Map<string, number[]>();

/** 仅供性能探针只读使用，不要在业务逻辑里调用 */
export function getPickGridInternals() {
  return { grid, cellSize, cols, rows, offsetX, offsetY, cellBox, penCells };
}

/**
 * 图元登记到网格时用的外接盒。带 rotate 的用**旋转后的外接盒**，
 * 算法与 rectInRect 内部一致（getRectOfPoints(rectToPoints())，含 pivot）——
 * 否则旋转后伸出原框的那部分落在没登记的格子里，那一格的查询就找不到它。
 */
export function cellBox(pen: Pen): Rect {
  // 外扩拾取容差。pick() 只看鼠标所在的**那一格**，判命中时却允许鼠标在框外
  // lineWidth / 2 + 5 以内 ⇒ 图元没登记在那一格就漏拾（靠格线的图元边缘悬停不灵）。
  // 登记时把容差算进去，候选只会多，最终判定仍是原来那段精确代码。
  // 旋转图元：外扩后的框转过去，外接盒最多再大 √2 倍 ⇒ 乘 1.5 留余量。
  const b: Rect = pen.rotate ? getRectOfPoints(rectToPoints(pen)) : pen;
  const m = ((pen.lineWidth || 0) / 2 + 5) * (pen.rotate ? 1.5 : 1);
  const ex = b.ex != undefined ? b.ex : b.x + (b.width || 0);
  const ey = b.ey != undefined ? b.ey : b.y + (b.height || 0);
  return { x: b.x - m, y: b.y - m, ex: ex + m, ey: ey + m, width: ex - b.x + 2 * m, height: ey - b.y + 2 * m };
}

/** 旋转外接盒缓存：连同算它时用到的几何一起记下，几何一变就重算 */
interface RotatedBox {
  x: number;
  y: number;
  ex: number;
  ey: number;
  width: number;
  height: number;
  rotate: number;
  px: number;
  py: number;
  box: Rect;
}
const rotatedBoxes = new WeakMap<Rect, RotatedBox>();

/**
 * 与 `rectInRect(source, target)`（不带 allIn）结果逐位相同，只是带 rotate 的外接盒不再每次重算。
 *
 * 查脏区时每个候选都要判一次相交，原来带 rotate 的候选每判一次就 `rectToPoints` 转四个角
 * （四次三角函数 + 几个临时对象）：示例1 有 120 个旋转动画图元，calc 每趟动画的一半多耗在这里。
 * 缓存校验的是 `rectToPoints` 读到的全部字段（x/ex/y/ey/width/height/rotate/pivot），
 * 所以原地改几何（动画、拖拽）也会命中不了缓存而重算，不会拿到旧盒。
 */
function rectHits(source: Rect, target: Rect) {
  let s = source;
  if (source.rotate) {
    const px = source.pivot ? source.pivot.x : NaN;
    const py = source.pivot ? source.pivot.y : NaN;
    let c = rotatedBoxes.get(source);
    if (
      !c ||
      c.x !== source.x ||
      c.y !== source.y ||
      c.ex !== source.ex ||
      c.ey !== source.ey ||
      c.width !== source.width ||
      c.height !== source.height ||
      c.rotate !== source.rotate ||
      // 没有 pivot 记成 NaN，Object.is 才能让「都没有」判相等
      !Object.is(c.px, px) ||
      !Object.is(c.py, py)
    ) {
      c = {
        x: source.x,
        y: source.y,
        ex: source.ex,
        ey: source.ey,
        width: source.width,
        height: source.height,
        rotate: source.rotate,
        px,
        py,
        box: getRectOfPoints(rectToPoints(source)),
      };
      rotatedBoxes.set(source, c);
    }
    s = c.box;
  }
  return !(s.x > target.ex || s.ex < target.x || s.ey < target.y || s.y > target.ey);
}

/** 按登记盒算出应该登记的格子下标；越界的（withOverflow 时）再加溢出桶 */
function cellIndexes(pen: Pen, withOverflow = true): number[] {
  const b = cellBox(pen);
  const minX = Math.floor((b.x - offsetX) / cellSize);
  const minY = Math.floor((b.y - offsetY) / cellSize);
  const maxX = Math.floor((b.ex - offsetX) / cellSize);
  const maxY = Math.floor((b.ey - offsetY) / cellSize);
  const out: number[] = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        out.push(y * cols + x);
      }
    }
  }
  if (withOverflow && (minX < 0 || maxX >= cols || minY < 0 || maxY >= rows)) {
    out.push(grid.length - 1);
  }
  return out;
}

let hover: Pen;

let hoverAnchorId: string;
let activeAnchorId: string;

let activePen: Pen; // 用于判断原始活动图元是否单选图元，避免子图元干扰
let activePens: Pen[]; // 当前活动图元集合，包括子图元
let activeBoundary: Rect;
let boundingCPs: Point[];

let inputtingPen: string;
let drawingLine: string;

export const edgeFns: {
  [key: string]: (pen: Pen, x: number, y: number) => any;
} = {};

const linePoints = new Map<string, Point[]>();

/** 第 5.29 步：分格目标 —— 每格大约登记多少个图元 */
const PICK_TARGET_PER_CELL = 32;

/**
 * @param penCount 按多少个图元定格子边长；默认 penMap.size。分批打开时首批只有视口里的，
 *   要按全部图元数定，否则格子太大、后批补进来每格几百个（见 addPens）
 */
export function initPickGrid(width = 1920, height = 1080, _offsetX = 0, _offsetY = 0, penCount?: number) {
  linePoints.clear();
  activePen = undefined;
  activePens = undefined;
  activeBoundary = undefined;
  boundingCPs = undefined;

  offsetX = _offsetX;
  offsetY = _offsetY;

  // 按实际范围与图元数定边长：每格约 PICK_TARGET_PER_CELL 个，四周各留一格余量
  // （动画图元会跳出场景上边、文字外溢与旋转外接盒会越出场景边，余量让它们不进溢出桶）。
  // 原来图元 < 2000 时整张图只有一格 ⇒ 每次查脏区都要扫全部图元：示例1（1394 个、390 个动画）
  // 每帧 390 × 1394 次相交判定，calc 一趟动画 76ms，平移时回不过话来。图元少时这里算出的格子本来就大，不必特判。
  const area = Math.max(1, width * height);
  cellSize = Math.max(16, Math.sqrt((area * PICK_TARGET_PER_CELL) / Math.max(1, penCount ?? penMap.size)));
  offsetX -= cellSize;
  offsetY -= cellSize;
  cols = Math.max(1, Math.ceil(width / cellSize)) + 2;
  rows = Math.max(1, Math.ceil(height / cellSize)) + 2;

  grid = Array.from({ length: cols * rows + 1 }, () => []);
  penCells = new Map();

  for (const [, pen] of penMap) {
    add(pen, true);
  }
}

// 添加pen到grid
export function add(pen: Pen, inView?: boolean) {
  if (pen.ex == undefined) {
    pen.ex = pen.x + pen.width;
    pen.ey = pen.y + pen.height;
  }

  // 方便连线更好的选中
  if (pen.category === PenCategory.Line) {
    expandRect(pen, 5);
  }

  if (pen.rotate && pen.anchors) {
    if (!pen.pivot) {
      pen.pivot = { x: pen.x + pen.width / 2, y: pen.y + pen.height / 2 };
    }
  }

  // 按登记盒（带旋转）登记，并记下登记在哪。越出网格的一律进溢出桶（D37）；
  // inView 参数保留签名，不再影响登记。
  const idx = cellIndexes(pen);
  for (const i of idx) {
    grid[i].push(pen);
  }
  penCells.set(pen.id, idx);
}

/**
 * 分批打开的后批：登记进网格，碰到的格子按层级重排。
 * pick 从格子末尾往前找最上层（见 sortCells），而首批（视口里的）可能比后批层级高 ⇒ 不能只往后追加。
 * 每格本来基本有序，Array.sort 对近乎有序的数组接近线性。
 */
export function addPens(pens: Pen[]) {
  const touched = new Set<Pen[]>();
  for (const pen of pens) {
    add(pen);
    for (const i of penCells.get(pen.id) || []) {
      touched.add(grid[i]);
    }
  }
  sortCells(touched);
}

// 从grid中删除pen
export function remove(pen: Pen) {
  if (pen.id === hover?.id) {
    hover = undefined;
  }
  if (pen.id === activePen?.id) {
    activePen = undefined;
  }
  if (activePens?.length) {
    activePens = activePens.filter((p: Pen) => p.id !== pen.id);
  }

  // 第 5.23 步：按记录删（传进来的是 e.data.remove 里的克隆，几何不一定与登记时一致）
  const idx = penCells.get(pen.id) ?? cellIndexes(pen);
  for (const i of idx) {
    const cell = grid[i];
    const penIndex = cell ? cell.findIndex((p: Pen) => p.id === pen.id) : -1;
    if (penIndex !== -1) {
      cell.splice(penIndex, 1);
    }
  }
  penCells.delete(pen.id);
}

// 更新grid中的pen
// 第 5.23 步：原来按新几何逐格「找到就 Object.assign、找不到就 push(p)」—— 找不到时 p 恒为
// undefined（H2），而且从不删旧格子里的登记。改为：几何写进 penMap 那个对象，再按记录走 updatePenCell。
export function update(pen: Pen) {
  const reg = penMap.get(pen.id) || pen;
  if (reg !== pen) {
    Object.assign(reg, pen);
  }
  updatePenCell(reg, getCells(reg));
}

// 获取pen所在的cell
// 两种问法分开 ——
//   getCells(pen)       「它**现在**登记在哪」：查记录，不看传进来的几何（克隆可能缺 pivot / 是旧位置）；
//   getCells(pen, true) 「它**应该**登记在哪」：按登记盒（带旋转）从几何算。
export function getCells(pen: Pen, holdPalce?: boolean) {
  const cells: { cell: Pen[]; index: number; i: number }[] = [];
  const idx = holdPalce ? cellIndexes(pen) : penCells.get(pen.id) ?? cellIndexes(pen);
  for (const i of idx) {
    const cell = grid[i];
    if (!cell) {
      continue;
    }
    const index = cell.findIndex((item) => item.id === pen.id);
    if (index > -1 || holdPalce) {
      cells.push({ cell, index, i });
    }
  }
  return cells;
}

// 移到pen，并更新设置pen所在的cell
export function updatePenCell(pen: Pen, oldCells: any[]) {
  linePoints.delete(pen.id);

  const newCells = getCells(pen, true);

  // 两遍，各自只做一件事（插入写在「遍历旧格子」里会同格重复登记，D36）：
  // ① 每个新格子恰好处理一次：在就更新，不在就插入。
  for (const cell of newCells) {
    if (cell.index > -1) {
      Object.assign(cell.cell[cell.index], pen);
    } else {
      cell.cell.push(pen);
      cell.index = cell.cell.length - 1;
    }
  }

  // ② 旧格子里不在新格子之列的，删掉这份登记。
  // 按 id 现找现删，不能用 c.index：onPatch 先对所有选中图元一次性存下旧下标，同一格里前一个
  // splice 之后后面的下标都会错位，删掉的就是旁边没被选中的邻居（D35：多选拖拽，旁边图元消失）。
  for (const c of oldCells) {
    if (newCells.some((cell) => cell.cell === c.cell)) {
      continue;
    }
    const i = c.cell.findIndex((item: Pen) => item.id === pen.id);
    if (i > -1) {
      c.cell.splice(i, 1);
    }
  }

  penCells.set(
    pen.id,
    newCells.map((cell) => cell.i),
  );
  return newCells;
}

export function sortCells(cells: Set<Pen[]>) {
  for (const item of cells) {
    item.sort((a, b) => {
      return a.index - b.index;
    });
  }
}

export function pick(
  x: number,
  y: number,
): {
  pen?: Pen;
  anchor?: Point;
  linePoint?: Point;
  cp?: number;
  rotatePoint?: Point;
  sizePoint?: Point;
  sizeDirection?: number;
  top?: Pen;
} {
  if (!grid.length || inputtingPen) return;

  const _x = x;
  const _y = y;
  // 锚点 / 控制点 / 缩放点的命中半径（世界坐标）。它们在 hover 层按固定屏幕尺寸画（半径 / scale），
  // 拾取却用固定 5 个世界单位 ⇒ 缩小到 0.3 时只剩 1.5 个屏幕像素。改成按屏幕像素换算，放大时不小于原来的 5。
  const hr = handleRadius(HANDLE_PICK_PX);

  let pen: Pen;
  let linePoint: Point;

  let pens: any;

  // 判断是否选中了连线锚点
  if (options.mode && !activePen?.locked && activePen?.category === PenCategory.Line) {
    pen = activePen;
    const anchors = pen.anchors || [];

    if (pen.rotate) {
      let pivot = pen.pivot;
      if (!pivot) {
        pivot = {
          x: pen.x + pen.width / 2,
          y: pen.y + pen.height / 2,
        };
      }
      const a = (-pen.rotate * Math.PI) / 180;
      const dx = x - pivot.x;
      const dy = y - pivot.y;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      x = dx * cos - dy * sin + pivot.x;
      y = dx * sin + dy * cos + pivot.y;
    }
    // 锚点存储的是翻转前坐标，拾取时需要将鼠标反向映射到同一坐标系。
    if (pen.flipX) {
      x = pen.x + pen.ex - x;
    }
    if (pen.flipY) {
      y = pen.y + pen.ey - y;
    }

    for (let pt of anchors) {
      // 是否选中控制点
      if (
        pt.id === activeAnchorId &&
        pt.cp1 &&
        Math.abs(x - pt.cp1.x) < hr &&
        Math.abs(y - pt.cp1.y) < hr
      ) {
        return { pen, anchor: pt, cp: 1 };
      }
      if (
        pt.id === activeAnchorId &&
        pt.cp2 &&
        Math.abs(x - pt.cp2.x) < hr &&
        Math.abs(y - pt.cp2.y) < hr
      ) {
        return { pen, anchor: pt, cp: 2 };
      }

      if (Math.abs(x - pt.x) < hr && Math.abs(y - pt.y) < hr) {
        hoverAnchorId = pt.id;
        return { pen, anchor: pt };
      }
    }

    pen = undefined;
  }
  // 活动框的控制点和锚点需要优先于普通图元命中。
  else if (options.mode && activeBoundary) {
    pens = [];
    const allLocked = activePens?.every((p: Pen) => p.locked);
    if (boundingCPs && !allLocked && options.anchorMode < AnchorMode.Drawline) {
      let sizeDirection = 0;
      let r = hr;
      for (const pt of boundingCPs) {
        if (pt.rotate) {
          if (options.disableRotate) {
            break;
          }
          r = handleRadius(ROTATE_PICK_PX, 8);
        }
        if (Math.abs(x - pt.x) < r && Math.abs(y - pt.y) < r) {
          if (pt.rotate) {
            return {
              rotatePoint: pt,
            };
          } else {
            return {
              sizePoint: pt,
              sizeDirection,
            };
          }
        }
        sizeDirection++;
      }
    }

    pens.push(...activePens);
  }
  if (pens) {
    let item: Pen;
    for (let i = pens.length - 1; i >= 0; i--) {
      item = pens[i];
      x = _x;
      y = _y;
      if (item.rotate) {
        let pivot = item.pivot;
        if (!pivot) {
          pivot = {
            x: item.x + item.width / 2,
            y: item.y + item.height / 2,
          };
        }

        const a = (-item.rotate * Math.PI) / 180;
        const dx = x - pivot.x;
        const dy = y - pivot.y;
        const sin = Math.sin(a);
        const cos = Math.cos(a);
        x = dx * cos - dy * sin + pivot.x;
        y = dx * sin + dy * cos + pivot.y;
      }
      // edgeFn 和 anchors 均基于图元翻转前坐标执行拾取。
      if (item.flipX) {
        x = item.x + item.ex - x;
      }
      if (item.flipY) {
        y = item.y + item.ey - y;
      }

      const halfWidth = (item.lineWidth || 0) / 2;
      // 连线的容差随缩放变（见 lineTolerance），外框预筛必须至少放得这么宽，否则 pointOnLine 根本轮不到
      const margin = item.category === PenCategory.Line ? Math.max(halfWidth + 5, lineTolerance(item)) : halfWidth + 5;

      if (
        item.visible !== false &&
        x >= item.x - margin &&
        x <= item.ex + margin &&
        y >= item.y - margin &&
        y <= item.ey + margin
      ) {
        if (!item.locked && (options.anchorMode || item.category === PenCategory.Line)) {
          // 判断是否在锚点上
          const anchors = item.anchors || [];
          for (let pt of anchors) {
            if (Math.abs(x - pt.x) < hr && Math.abs(y - pt.y) < hr) {
              hoverAnchorId = pt.id;
              return { pen: item, anchor: pt };
            }
          }
        }

        // 连线上的动态锚点属于编辑控制项，需要保持优先命中。
        if (item.category === PenCategory.Line) {
          const pt = pointOnLine(item, x, y);
          if (pt && options.anchorMode && item.lineIsEdge) {
            return {
              pen: item,
              anchor: pt,
              linePoint: pt,
            };
          }
        } else if (options.anchorMode && !item.locked && !item.disableAnchor && edgeFns[item.type]) {
          // 判断是否在边上
          const anchor = edgeFns[item.type](item, x, y);
          if (anchor) {
            return { pen: item, anchor };
          }
        }

      }
    }
  }

  // 活动图元主体不在这里提前返回，继续通过全量网格按 index 拾取最上层图元。

  x = _x;
  y = _y;

  let anchor: Point;
  let found: boolean;
  // 编辑态：锁定图元默认穿透（sel 是第一个没锁定的命中，最后换成选中目标）；
  // top 是鼠标处最上层的可见图元，不穿透也不换（Alt 直接选中用），见 paintState。
  const edit = options.mode === Mode.Edit;
  let sel: Pen;
  let selLinePoint: Point;
  let top: Pen;
  let topArea = Infinity;
  let topDone = false;
  let outsideTop: Pen; // 只落在外接框里、形状外
  let groupTop: Pen; // group 不绘制，最后才轮到

  // 连线登记时离中心线留了 lineWidth / 2 + 10（add 里 expandRect 5 + cellBox 5），缩放小于 0.5 时
  // lineTolerance 会超出这段余量 ⇒ 鼠标所在格子里可能没有那条线，要把容差范围内的格子一起查。
  const reach = Math.max(0, LINE_PICK_PX / (view.scale || 1) - 10);
  pens = pickCandidates(x, y, reach);

  let item: Pen;
  for (let i = pens.length - 1; i >= 0; i--) {
    item = pens[i];
    if (item.id === drawingLine) {
      item = undefined;
      continue;
    }
    x = _x;
    y = _y;
    if (item.rotate) {
      let pivot = item.pivot;
      if (!pivot) {
        pivot = {
          x: item.x + item.width / 2,
          y: item.y + item.height / 2,
        };
      }

      const a = (-item.rotate * Math.PI) / 180;
      const dx = x - pivot.x;
      const dy = y - pivot.y;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      x = dx * cos - dy * sin + pivot.x;
      y = dx * sin + dy * cos + pivot.y;
    }
    // 普通网格拾取路径与活动图元拾取路径保持相同的翻转坐标转换。
    if (item.flipX) {
      x = item.x + item.ex - x;
    }
    if (item.flipY) {
      y = item.y + item.ey - y;
    }

    const halfWidth = (item.lineWidth || 0) / 2;
    const margin = item.category === PenCategory.Line ? Math.max(halfWidth + 5, lineTolerance(item)) : halfWidth + 5;
    if (
      item.visible !== false &&
      x >= item.x - margin &&
      x <= item.ex + margin &&
      y >= item.y - margin &&
      y <= item.ey + margin &&
      // 放在外框预筛之后：只有落在框内的子图元才往上查父级
      !(item.parentId && hiddenByParent(item))
    ) {
      found = false;
      // 已有选中目标、只是往下找 top 时不再认锚点，免得覆盖；
      // 例外是 group：它不绘制，不能挡住下面子图元的锚点（连线要连到子图元上）
      if (options.anchorMode && (!sel || sel.type === 'group')) {
        // 判断是否在锚点上
        const anchors = item.anchors || [];
        for (let pt of anchors) {
          if (Math.abs(x - pt.x) < hr && Math.abs(y - pt.y) < hr) {
            pen = item;
            anchor = pt;
            hoverAnchorId = pt.id;
            found = true;
            break;
          }
        }

        if (!found) {
          // 禁止编辑的图元不暴露动态边缘锚点，避免后续生成无法维护的连接关系。
          if (!item.locked && !item.disableAnchor && edgeFns[item.type]) {
            // 判断是否在边上
            const pt = edgeFns[item.type](item, x, y);
            if (pt) {
              pen = item;
              anchor = pt;
              found = true;
            }
          }
        }
      }

      if (!found) {
        // 判断是否在连线上
        if (item.category === PenCategory.Line) {
          const pt = pointOnLine(item, x, y);
          if (pt) {
            pen = item;
            linePoint = pt;
            options.anchorMode && item.lineIsEdge && (anchor = pt);
            found = true;
          }
        }
      }

      if (
        !found &&
        item.category !== PenCategory.Line &&
        x >= item.x - halfWidth &&
        x <= item.ex + halfWidth &&
        y >= item.y - halfWidth &&
        y <= item.ey + halfWidth
      ) {
        pen = item;
      }

      if (pen) {
        if (!edit) {
          break;
        }
        // 锚点是连线用的，不参与穿透与选中目标换算
        if (anchor) {
          sel = pen;
          selLinePoint = linePoint;
          top = top || pen;
          break;
        }
        // 锁定图元默认选不中：穿透到下面继续找
        if (!sel && !isLocked(pen)) {
          sel = pen;
          selLinePoint = linePoint;
        }
        if (!topDone) {
          if (pen.type === 'group') {
            groupTop = groupTop || pen;
          } else {
            // 从上往下：点落在谁的轮廓里谁就是候选，取最具体的（面积最小，线 / 描边上算 0）；
            // 遇到不透明的就停 —— 它下面的都被挡住了
            const state = paintState(pen, x, y);
            if (state === Paint.None) {
              outsideTop = outsideTop || pen;
            } else {
              const area = state === Paint.Stroke ? 0 : pen.width * pen.height;
              if (area < topArea) {
                top = pen;
                topArea = area;
              }
              topDone = state !== Paint.Inside;
            }
          }
        }
        if (sel && topDone) {
          break;
        }
        pen = undefined;
        linePoint = undefined;
      }
    }
  }

  if (edit) {
    top = top || outsideTop || groupTop;
    pen = sel;
    linePoint = selLinePoint;
    if (pen && !anchor) {
      const target = resolveSelectTarget(pen);
      if (target !== pen) {
        pen = target;
        linePoint = undefined;
      }
    }
  }

  hover = pen;

  return { pen, anchor, linePoint, top };
}

/**
 * 只描边、无填充时内部透明的基础形状（绘制函数里只在有 fillStyles 时才 fill）。
 * 不在这里的类型（线、图片、第三方图库等）一律当实心，宁可多选中也不漏选。
 */
export const OUTLINE_TYPES = new Set([
  'rectangle',
  'square',
  'leftArrow',
  'rightArrow',
  'twowayArrow',
  'circle',
  'cloud',
  'diamond',
  'file',
  'hexagon',
  'message',
  'pentagon',
  'pentagram',
  'people',
  'triangle',
]);
export const outlineDraws: { [type: string]: (ctx: any, pen: Pen) => void } = {};
/** 决定图元有没有填充 / 其他内容的字段，worker 要同步它们（makePen / onPatch） */
export const PAINT_KEYS = ['background', 'backgrounds', 'gradient', 'icon', 'text', 'progress'];

let hitCtx: OffscreenCanvasRenderingContext2D;

const enum Paint {
  /** 在外接框里，但在形状外（比如箭头外接框的四角） */
  None,
  /** 在空心形状的轮廓里：透明，但点在它圈住的范围内 */
  Inside,
  /** 不透明的填充 / 图片 / 文字等 */
  Filled,
  /** 正好在线或描边上 */
  Stroke,
}

/**
 * (x, y)（已转到图元未旋转、未翻转的坐标系）处图元画成什么样。
 * 空心形状用它自己的绘制函数在 1×1 画布上重建路径，isPointInStroke / isPointInPath 判定，与渲染一致。
 * 只在找 top 时、对外接框命中的图元调用，每次拾取至多几次。
 */
function paintState(pen: Pen, x: number, y: number): Paint {
  if (pen.category === PenCategory.Line) {
    return Paint.Stroke;
  }
  const draw = outlineDraws[pen.type];
  if (
    !draw ||
    paint.penFill ||
    pen.background ||
    pen.backgrounds?.length ||
    pen.gradient ||
    pen.image ||
    pen.icon ||
    pen.progress ||
    (pen.text != undefined && pen.text !== '')
  ) {
    return Paint.Filled;
  }
  if (!hitCtx) {
    if (typeof OffscreenCanvas === 'undefined') {
      return Paint.Filled;
    }
    hitCtx = new OffscreenCanvas(1, 1).getContext('2d');
  }
  // 描边外扩与连线同样的屏幕像素容差
  hitCtx.lineWidth = (pen.lineWidth || 1) + (2 * LINE_PICK_PX) / (view.scale || 1);
  draw(hitCtx, pen);
  if (hitCtx.isPointInStroke(x, y)) {
    return Paint.Stroke;
  }
  return hitCtx.isPointInPath(x, y) ? Paint.Inside : Paint.None;
}

/** 父级隐藏，或父级 showChild 只显示别的子图元 ⇒ 画不出来，也不该被拾取 */
function hiddenByParent(pen: Pen) {
  let p = pen;
  while (p.parentId) {
    const parent = penMap.get(p.parentId);
    if (!parent) {
      return false;
    }
    if (parent.visible === false) {
      return true;
    }
    if (parent.showChild != undefined && parent.children?.[parent.showChild] !== p.id) {
      return true;
    }
    p = parent;
  }
  return false;
}

/** 自己或任一祖先锁定 */
function isLocked(pen: Pen) {
  let p = pen;
  while (p) {
    if (p.locked) {
      return true;
    }
    p = p.parentId ? penMap.get(p.parentId) : undefined;
  }
  return false;
}

/**
 * 点中图元后真正要选中的图元：
 * 父图元是容器（container）或连线（连线文字）⇒ 选中自己，谁在上面选谁；
 * 否则（编组等）一直升到最外层非容器祖先。
 */
function resolveSelectTarget(pen: Pen) {
  let p = pen;
  while (p.parentId) {
    const parent = penMap.get(p.parentId);
    if (!parent || parent.container || parent.category === PenCategory.Line) {
      break;
    }
    p = parent;
  }
  return p;
}

/**
 * pick 的候选：reach 为 0 时就是鼠标所在那一格（与原来一字不差）；
 * 否则把 (x, y) ± reach 覆盖的格子并起来、去重，按 index 升序排好（pick 从尾部往前取，最上层优先）。
 */
function pickCandidates(x: number, y: number, reach: number): Pen[] {
  const minX = Math.floor((x - reach - offsetX) / cellSize);
  const minY = Math.floor((y - reach - offsetY) / cellSize);
  const maxX = Math.floor((x + reach - offsetX) / cellSize);
  const maxY = Math.floor((y + reach - offsetY) / cellSize);
  if (minX === maxX && minY === maxY) {
    if (minX < 0 || minX >= cols || minY < 0 || minY >= rows) {
      return grid[grid.length - 1];
    }
    return grid[minY * cols + minX];
  }

  const seen = new Set<Pen>();
  const out: Pen[] = [];
  const collect = (cell: Pen[]) => {
    for (const pen of cell) {
      if (!seen.has(pen)) {
        seen.add(pen);
        out.push(pen);
      }
    }
  };
  let overflow = false;
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) {
        overflow = true;
      } else {
        collect(grid[cy * cols + cx]);
      }
    }
  }
  overflow && collect(grid[grid.length - 1]);
  out.sort((a, b) => a.index - b.index);
  return out;
}

// 判断是否拖拽进了图元内部
export function overDock(x: number, y: number): Pen {
  if (!grid.length) return;

  let pen: Pen;

  // 判断是否选中了活动框内的图元
  if (activeBoundary) {
    for (const item of activePens) {
      if (item.container && item.rotate && !item.container.rotate) {
        item.container.rotate = item.rotate;
        item.container.pivot = item.pivot;
      }
      if (item.container && pointInRect({ x, y }, item.container)) {
        if (!pen || item.index > pen.index) {
          pen = item;
        }
      }
    }
  }

  if (pen) {
    return pen;
  }

  const cellX = Math.floor((x - offsetX) / cellSize);
  const cellY = Math.floor((y - offsetY) / cellSize);

  let pens: Pen[];
  if (cellX < 0 || cellX >= cols || cellY < 0 || cellY >= rows) {
    pens = grid[grid.length - 1];
  } else {
    const cell = cellY * cols + cellX;
    pens = grid[cell];
  }

  for (const item of pens) {
    if (item.container && item.rotate && !item.container.rotate) {
      item.container.rotate = item.rotate;
      item.container.pivot = item.pivot;
    }
    if (item.container && pointInRect({ x, y }, item.container)) {
      if (!pen || item.index > pen.index) {
        pen = item;
      }
    }
  }
  return pen;
}

export function onCalcPenBoundary(e: MessageEvent) {
  inputtingPen = e.data.inputtingPen;
  drawingLine = e.data.drawingLine?.id;

  if (!e.data.pens) {
    return;
  }
  const boundarys = {};
  for (const pen of e.data.pens) {
    let { penIds, boundary } = getPensInPenBoundary(pen);
    boundarys[pen.id] = { penIds, boundary };
  }

  self.postMessage({
    action: WorkerMessage.CalcPenBoundary,
    boundarys,
    drawingLine: e.data.drawingLine,
    render: e.data.render,
    inputtingPen,
  });
}

export function onTextInputting(e: MessageEvent) {
  inputtingPen = e.data.inputtingPen;
}

export function onActive(e: MessageEvent) {
  hoverAnchorId = undefined;

  // 根据pens计算包围盒
  if (e.data.pens?.length && (!e.data.boundary || e.data.calcBoundary)) {
    activePens = getAllPens(penMap, e.data.pens);
    activePen = e.data.pens.length === 1 ? activePens[0] : undefined;

    let { penIds, boundary } = getPensInPenBoundary(activePens);

    // 父子图元的活动盒子以父图元为主
    if (e.data.pens.length === 1 && activePens.length > 1 && !e.data.activeBoundary) {
      e.data.activeBoundary = getBoundary(e.data.pens, textBoxs);
    } else if (e.data.activeBoundary) {
      // 场景1：多选+包围盒旋转时，设置属性，不希望包围盒改变为无旋转角度的新包围盒。理想情况应该重新计算合理的包围盒
      // 场景2：撤销重做的情况下，希望指定包围盒
      // 单选带旋转时 getBoundary 返回「未旋转的矩形 + rotate」，真正的外接盒在它的 `.box` 里；
      // 不拆开的话 render 只擦未旋转的框，旋转伸出去的四个角留在原位（D40）。
      boundary = Object.assign(e.data.activeBoundary, { box: boundary.box || boundary });
    }
    activeBoundary = boundary;

    const activeIds = [];
    for (const pen of e.data.pens) {
      activeIds.push(pen.id);
    }
    self.postMessage({
      action: WorkerMessage.Active,
      boundary,
      penIds, // 局部重绘包围盒中的图元
      activeIds, // 活动图元
      update: e.data.update,
    });
  }
  // 根据包围盒计算局部重绘pens
  else if (e.data.calcBoxPens) {
    activeBoundary = e.data.boundary;
    e.data.activePens && (activePens = getAllPens(penMap, e.data.activePens));
    activePen = activePens?.length === 1 ? activePens[0] : undefined;
    let box = activeBoundary.box || activeBoundary;

    const points: Point[] = rectToPoints(activeBoundary);
    for (const pen of activePens) {
      if (pen.textBox) {
        pen.textBox.index = pen.index;
        textBoxs[pen.id] = pen.textBox;
      }
      // 如果有文字范围，加入文字范围
      let textBox = pen.textBox || textBoxs[pen.id];
      if (textBox) {
        textBox.rotate = pen.rotate;
        points.push(...rectToPoints(textBox));
      }
    }
    // 上面既给 textBoxs 赋了值，又原地改了 rotate（影响 rectInRect 的外接盒）
    markTextBoxsDirty();
    box = getRectOfPoints(points);

    const penIds = getPensInBoundary(getBoundary(activePens, textBoxs));

    const activeIds = [];
    for (const pen of activePens) {
      activeIds.push(pen.id);
    }

    self.postMessage({ action: WorkerMessage.Active, penIds, activeIds, box });
  } else {
    // 取消选中
    activePen = undefined;
    activePens = undefined;
    activeBoundary = undefined;
  }

  updateBoundingCPs();
}

/**
 * 按当前选中框算缩放 / 旋转控制点。旋转点离角的距离按屏幕像素换算（见 handleRadius），
 * 所以缩放变了要重算（onTranslateScale 会调）。
 */
export function updateBoundingCPs() {
  if (activePens?.length && activeBoundary && (!activePen || activePen.category !== PenCategory.Line)) {
    let t = ControlPointType.Rotate;
    if (!activePens[0].textAutoSize || activePens[0].type !== 'text') {
      t += ControlPointType.Size;
    }
    // 旋转点离角 ROTATE_PICK_PX 个屏幕像素：缩小时不和角上的缩放点叠在一起，放大时不跑远
    boundingCPs = getBoundingCPs(activeBoundary, t, handleRadius(ROTATE_PICK_PX, 8));

    if (activeBoundary.rotate) {
      let pivot = activeBoundary.pivot;
      if (!pivot) {
        pivot = {
          x: activeBoundary.x + activeBoundary.width / 2,
          y: activeBoundary.y + activeBoundary.height / 2,
        };
      }
      boundingCPs.forEach((pt) => {
        rotatePoint(pt, activeBoundary.rotate, pivot);
      });
    }
  } else {
    boundingCPs = undefined;
  }
}

export function onActiveAnchor(e: MessageEvent) {
  activeAnchorId = hoverAnchorId;
}

// 计算在penOrPens边界中的其他pens
/**
 * `getPensInPenBoundary` 每次扫了多少东西（格子、格内图元、旋转图元、溢出桶、文本框、命中）。
 * 用来区分「格子太粗 / 文本框全扫 / 旋转图元单价高」这几种慢法（设计文档第二十八 ~ 二十九轮）。
 *
 * 只累加计数（整数加法），调用方（animate.ts）每趟取差值出样本。
 * ⚠ 数 `rotate` 要多遍历一遍格子 ⇒ 开探针时 `anim:loopBoundary` 略高。
 * ⚠ 这里的计数被所有调用者共享（onPatch / onPick / 动画），动画那一趟里没有别的调用者，
 * 所以趟内差值只属于动画；但不要在别处直接读它的绝对值。
 */
export const boundaryScan = {
  calls: 0,
  cells: 0,
  cellItems: 0,
  rotated: 0,
  overflowItems: 0,
  textItems: 0,
  hits: 0,
  /** 第 5.16 步：退回全扫的查询次数 / 影子比对那一遍的判定数（不计入 textItems） */
  textFallback: 0,
  shadowItems: 0,
};

/**
 * `textBoxs` 的空间索引，**输出与原来的全扫逐位相同**。原来每次查询都要对全场景每个外溢文本框
 * 做一次 `rectInRect`，与查询在哪里无关（设计文档第二十九轮：占动画每次查询的 45%）。
 *
 * 等价性靠四条，缺一条都不是「逐位不变」：
 * 1. **新鲜**：`textBoxs` 的每一处写（worker.ts 的 onPatch / onTextOutside、本文件
 *    calcBoxPens 里的赋值与 `textBox.rotate =` 原地改）都调 `markTextBoxsDirty()`，下一次查询前重建。
 *    `.index` 的原地改不影响几何，查询时现读。
 * 2. **同一个判定**：入格用的外接盒与 `rectInRect` 内部一致（带 rotate 的先
 *    `getRectOfPoints(rectToPoints())`）；候选最后仍然逐个走原来的 `rectInRect`。
 *    坐标非有限、ex < x（`rectInRect` 对这类框的结果不是几何直觉能推的）、或者跨格太多的，
 *    进 `textIdxBig`，每次都扫 —— 宁可多扫，不许漏。
 * 3. **同一个顺序**：候选按重建时 `for…in` 的次序排回去再 push，`index` 相等时后面稳定排序的
 *    结果与原来一样。
 * 4. **最坏情况不变差**：查询框覆盖的格子数超过文本框总数（onPatch 的并集可能是整个世界）⇒ 退回原来的全扫。
 *
 * 取证：开探针时每 32 次查询有一次顺带跑原来的全扫、逐项比对（`count:pick:textShadow` /
 * `count:pick:textShadowBad`）。**Bad 必须恒为 0**；它不为 0，这一步就是错的，回滚。
 * 影子那一遍的判定数单独记在 `boundaryScan.shadowItems`，不混进 textItems。
 */
const TEXT_CELL = 64;
const TEXT_BIG_CELLS = 256;
const TEXT_SHADOW_EVERY = 32;
let textIdxDirty = true;
const textIdxCells = new Map<number, number[]>();
let textIdxIds: string[] = [];
let textIdxBig: number[] = [];
let textIdxStamp = new Uint32Array(0);
let textIdxQuery = 0;
let textShadowTick = 0;
const textCand: number[] = [];

export function markTextBoxsDirty() {
  textIdxDirty = true;
}

// 负坐标也要能进 Map；越界的格子会撞 key，只会多出候选（最后仍逐个 rectInRect），不会漏
function textKey(cx: number, cy: number) {
  return (cy + 32768) * 65536 + (cx + 32768);
}

function rebuildTextIndex() {
  textIdxDirty = false;
  textIdxCells.clear();
  textIdxIds = [];
  textIdxBig = [];
  for (const id in textBoxs) {
    const slot = textIdxIds.length;
    textIdxIds.push(id);
    const tb = textBoxs[id];
    const r: Rect = tb.rotate ? getRectOfPoints(rectToPoints(tb)) : tb;
    if (!(isFinite(r.x) && isFinite(r.y) && isFinite(r.ex) && isFinite(r.ey)) || r.ex < r.x || r.ey < r.y) {
      textIdxBig.push(slot);
      continue;
    }
    const cx0 = Math.floor(r.x / TEXT_CELL);
    const cy0 = Math.floor(r.y / TEXT_CELL);
    const cx1 = Math.floor(r.ex / TEXT_CELL);
    const cy1 = Math.floor(r.ey / TEXT_CELL);
    if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > TEXT_BIG_CELLS) {
      textIdxBig.push(slot);
      continue;
    }
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = textKey(cx, cy);
        let list = textIdxCells.get(k);
        if (!list) {
          list = [];
          textIdxCells.set(k, list);
        }
        list.push(slot);
      }
    }
  }
  if (textIdxStamp.length < textIdxIds.length) {
    textIdxStamp = new Uint32Array(textIdxIds.length * 2);
  } else {
    textIdxStamp.fill(0);
  }
  textIdxQuery = 0;
}

/** 原来那段全扫，一字未改（退回路径与影子比对共用） */
function scanTextBoxsFull(box: Rect, out: Pen[]) {
  for (const id in textBoxs) {
    probe.on && boundaryScan.textItems++;
    if (rectInRect(textBoxs[id], box)) {
      out.push({ id, index: textBoxs[id].index });
    }
  }
}

let verifyQueries = 0;
let verifyBad = 0;

function queryTextBoxs(box: Rect, out: Pen[]) {
  if (options.textBoxIndex === false) {
    scanTextBoxsFull(box, out);
    return;
  }
  if (options.textBoxIndex === 'verify') {
    const start = out.length;
    queryTextBoxsIndexed(box, out);
    const ref: Pen[] = [];
    scanTextBoxsFull(box, ref);
    verifyQueries++;
    let same = ref.length === out.length - start;
    for (let i = 0; same && i < ref.length; i++) {
      same = ref[i].id === out[start + i].id && ref[i].index === out[start + i].index;
    }
    if (!same) {
      verifyBad++;
      if (verifyBad <= 20) {
        const got = out.slice(start).map((p) => p.id);
        const want = ref.map((p) => p.id);
        console.warn('[textBoxIndex verify] 不一致', {
          box: { ...box },
          indexOnly: got.filter((id) => !want.includes(id)),
          fullOnly: want.filter((id) => !got.includes(id)),
          sameSetDifferentOrder: got.length === want.length && got.every((id) => want.includes(id)),
        });
      }
    }
    if (verifyQueries % 500 === 0) {
      console.info(`[textBoxIndex verify] 已比对 ${verifyQueries} 次查询，不一致 ${verifyBad} 次`);
    }
    return;
  }
  queryTextBoxsIndexed(box, out);
}

function queryTextBoxsIndexed(box: Rect, out: Pen[]) {
  if (textIdxDirty) {
    rebuildTextIndex();
  }
  const n = textIdxIds.length;
  if (!n) {
    return;
  }
  const cx0 = Math.floor(box.x / TEXT_CELL);
  const cy0 = Math.floor(box.y / TEXT_CELL);
  const cx1 = Math.floor(box.ex / TEXT_CELL);
  const cy1 = Math.floor(box.ey / TEXT_CELL);
  const cells = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
  if (!(cells > 0 && cells <= n)) {
    // 非有限 / 反向 / 比全扫还贵 ⇒ 原路
    probe.on && boundaryScan.textFallback++;
    scanTextBoxsFull(box, out);
    return;
  }
  if (++textIdxQuery === 0xffffffff) {
    textIdxStamp.fill(0);
    textIdxQuery = 1;
  }
  const q = textIdxQuery;
  textCand.length = 0;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const list = textIdxCells.get(textKey(cx, cy));
      if (!list) {
        continue;
      }
      for (const slot of list) {
        if (textIdxStamp[slot] !== q) {
          textIdxStamp[slot] = q;
          textCand.push(slot);
        }
      }
    }
  }
  for (const slot of textIdxBig) {
    if (textIdxStamp[slot] !== q) {
      textIdxStamp[slot] = q;
      textCand.push(slot);
    }
  }
  textCand.sort((a, b) => a - b);
  const start = out.length;
  for (const slot of textCand) {
    const id = textIdxIds[slot];
    const tb = textBoxs[id];
    if (!tb) {
      // 索引比 textBoxs 旧（有一处删除没标脏）。原来的全扫在这里不可能崩，索引版却会让
      // rectInRect(undefined) 直接打挂 worker —— 等价性考试的对照组正是这样撞出来的。
      // 自愈：这一次按原路重扫（结果仍然正确），下次重建；计一笔让漏标看得见。
      probe.count('pick:textStale');
      textIdxDirty = true;
      out.length = start;
      scanTextBoxsFull(box, out);
      return;
    }
    probe.on && boundaryScan.textItems++;
    if (rectHits(tb, box)) {
      out.push({ id, index: tb.index });
    }
  }

  // 第七十轮：`options.textShadowCheck === false` 关掉影子比对 ⇒ 量出不含它的真实单价（它每 32 次全扫一遍文本框）
  if (probe.on && options.textShadowCheck !== false && ++textShadowTick >= TEXT_SHADOW_EVERY) {
    textShadowTick = 0;
    const ref: Pen[] = [];
    const before = boundaryScan.textItems;
    scanTextBoxsFull(box, ref);
    boundaryScan.shadowItems += boundaryScan.textItems - before;
    boundaryScan.textItems = before;
    probe.count('pick:textShadow');
    let same = ref.length === out.length - start;
    for (let i = 0; same && i < ref.length; i++) {
      same = ref[i].id === out[start + i].id && ref[i].index === out[start + i].index;
    }
    same || probe.count('pick:textShadowBad');
  }
}

export function getPensInPenBoundary(penOrPens: Pen | Pen[]) {
  const pens = getCompletePens(Array.isArray(penOrPens) ? penOrPens : [penOrPens]);
  const boundary = getBoundary(pens, textBoxs);

  // lineWidth ≤ 1 的图元，render 一律按屏幕 1 像素画（ctx.lineWidth = 1 / scale），还先平移 −0.5。
  // getBoundary 对它们不外扩，缩小后（scale 0.4 时 1 / scale = 2.5 个世界单位）描边伸出框外，
  // 删除 / 移动时最外一列像素擦不到，留下残影。按 render 实际的描边宽度补上。
  const thin = pens.some((p) => !(p.lineWidth > 1));
  if (thin) {
    const r = boundary.box || boundary;
    const pad = 0.5 + 0.5 / (view.scale || 1);
    r.x -= pad;
    r.y -= pad;
    r.ex += pad;
    r.ey += pad;
    r.width = r.ex - r.x;
    r.height = r.ey - r.y;
  }

  let { x, y, ex, ey } = boundary.box || boundary;
  // 扩大2个像素查找pen，避免压在线中间
  x -= 2;
  y -= 2;
  ex += 2;
  ey += 2;

  const box = { x, y, ex, ey };

  // 计算目标 pen 所在的网格范围
  const minCellX = Math.floor((x - offsetX) / cellSize);
  const minCellY = Math.floor((y - offsetY) / cellSize);
  const maxCellX = Math.floor((ex - offsetX) / cellSize);
  const maxCellY = Math.floor((ey - offsetY) / cellSize);

  const penList: Pen[] = [];
  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      if (cellX >= 0 && cellX < cols && cellY >= 0 && cellY < rows) {
        const cellPens = grid[cellY * cols + cellX];
        if (!cellPens) {
          continue;
        }
        if (probe.on) {
          boundaryScan.cells++;
          boundaryScan.cellItems += cellPens.length;
          for (const item of cellPens) {
            item.rotate && boundaryScan.rotated++;
          }
        }
        // 筛选出在目标区域内的其他 pens
        for (const item of cellPens) {
          // 使用包围盒检测来判断是否相交
          if (rectHits(item, box)) {
            penList.push(item);
          }
        }
      }
    }
  }

  // 在默认边界外
  if (minCellX < 0 || maxCellX >= cols || minCellY < 0 || maxCellY >= rows) {
    probe.on && (boundaryScan.overflowItems += grid[grid.length - 1].length);
    for (const item of grid[grid.length - 1]) {
      // 使用包围盒检测来判断是否相交
      if (rectHits(item, box)) {
        penList.push(item);
      }
    }
  }

  // 判断是否在溢出的文字区域（第 5.16 步：走索引，输出与原来的全扫逐位相同，见 queryTextBoxs）
  queryTextBoxs(box, penList);
  if (probe.on) {
    boundaryScan.calls++;
    boundaryScan.hits += penList.length;
  }

  penList.sort((a, b) => {
    return a.index - b.index;
  });
  let penIds = [];
  for (const pen of penList) {
    penIds.push(pen.id);
  }
  penIds = Array.from(new Set(penIds));

  return { penIds, boundary };
}

/**
 * 收集重画图元时，脏区向外找多远（世界坐标）。原来是常数 2，比 render 实际清掉的范围小：
 *   - render 的裁剪 = 脏区外扩 1，再向外取整到设备像素（最多再多 1 个设备像素 ≈ 1 / scale）；
 *   - 邻居的细描边按屏幕 1 像素画、还先平移 −0.5（伸出自身矩形最多 1 / scale）。
 * 两者相加超过 2 时，贴在脏区边上的邻居被清掉一列像素却不在重画清单里（审计：P 透明、T 是邻居的颜色）。
 * 并集框只有四条边，偶尔碰上；分块后边多了，几乎每批都碰上。粗描边另按 lineWidth / 2 补（见 hitsBox）。
 */
function searchMargin() {
  return 1 + 2 / (view.scale || 1);
}

/** rectHits，外加粗描边伸出矩形的 lineWidth / 2（细线的已经算在 searchMargin 里） */
function hitsBox(item: Pen, box: Rect) {
  if (rectHits(item, box)) {
    return true;
  }
  const h = item.lineWidth > 1 ? item.lineWidth / 2 : 0;
  return h > 0 && rectHits(item, { x: box.x - h, y: box.y - h, ex: box.ex + h, ey: box.ey + h } as Rect);
}

/**
 * 分块脏区（第 1 步）：每个图元单独一块，而不是像 getPensInPenBoundary 那样所有图元并成一个框。
 *
 * 一批 setValue 改的点散在全图时（真实的数据点就是这样），并集框铺满整个场景：随机改 8000 个里的 50 个，
 * 重画了 13200 个图元里的 12950 个。逐块收集只重画真正碰到这些块的图元。
 *
 * 每块的算法与 getPensInPenBoundary 对单个图元时逐位相同（getBoundary 单图元分支 + 细线外扩），
 * 所以「块的并集」覆盖的像素与「逐个图元调 getPensInPenBoundary」相同。
 *
 * @returns 各块（世界坐标，与 getPensInPenBoundary 的 boundary 同口径）；pens 为空返回空数组
 */
export function getPenRects(pens: Pen[]): Rect[] {
  const out: Rect[] = [];
  const pad = 0.5 + 0.5 / (view.scale || 1);
  for (const pen of getCompletePens(pens)) {
    const b = getBoundary([pen], textBoxs);
    const r = b.box || b;
    if (!(pen.lineWidth > 1)) {
      // 同 getPensInPenBoundary：细线按屏幕 1 像素画，描边伸出框外
      r.x -= pad;
      r.y -= pad;
      r.ex += pad;
      r.ey += pad;
      r.width = r.ex - r.x;
      r.height = r.ey - r.y;
    }
    out.push(r);
  }
  return out;
}

/**
 * 碰到任意一块的图元（按层级排序、去重），即 drawMergedAnim 在这些块里要重画的清单。
 * 每块的查找与 getPensInPenBoundary 相同（外扩 2 个像素、溢出格、溢出的文字区域）。
 */
export function getPensInRects(rects: Rect[]): string[] {
  // 按 id 去重：网格里的图元和文字索引（queryTextBoxs）里的可能是同一个 id 的不同对象，
  // 按对象去重会让 render 把同一个图元画两遍（抗锯齿的半透明边缘叠深，审计里 P 比 T 更不透明）
  const seen = new Set<string>();
  const hits: Pen[] = [];
  const textHits: Pen[] = [];
  const collect = (item: Pen) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      hits.push(item);
    }
  };
  const m = searchMargin();
  for (const r of rects) {
    const box = { x: r.x - m, y: r.y - m, ex: r.ex + m, ey: r.ey + m };
    const minCellX = Math.floor((box.x - offsetX) / cellSize);
    const minCellY = Math.floor((box.y - offsetY) / cellSize);
    const maxCellX = Math.floor((box.ex - offsetX) / cellSize);
    const maxCellY = Math.floor((box.ey - offsetY) / cellSize);
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        if (cellX >= 0 && cellX < cols && cellY >= 0 && cellY < rows) {
          const cellPens = grid[cellY * cols + cellX];
          if (!cellPens) {
            continue;
          }
          for (const item of cellPens) {
            hitsBox(item, box) && collect(item);
          }
        }
      }
    }
    if (minCellX < 0 || maxCellX >= cols || minCellY < 0 || maxCellY >= rows) {
      for (const item of grid[grid.length - 1]) {
        hitsBox(item, box) && collect(item);
      }
    }
    textHits.length = 0;
    queryTextBoxs(box, textHits);
    for (const item of textHits) {
      collect(item);
    }
  }
  if (probe.on) {
    boundaryScan.calls++;
    boundaryScan.hits += hits.length;
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((p) => p.id);
}

function getCompletePens(pens: Pen[]) {
  return pens.map((pen) => {
    const cachedPen = penMap.get(pen.id);
    if (!cachedPen) {
      return pen;
    }

    // 样式更新可能只传差量字段，计算渲染脏区时需要补齐图元几何和旧样式。
    return { ...cachedPen, ...pen };
  });
}

// 计算在boundary边界中的其他pens
export function getPensInBoundary(boundary: Rect): any[] {
  // 计算目标 pen 所在的网格范围
  const minCellX = Math.floor((boundary.x - offsetX) / cellSize);
  const minCellY = Math.floor((boundary.y - offsetY) / cellSize);
  const maxCellX = Math.floor((boundary.ex - offsetX) / cellSize);
  const maxCellY = Math.floor((boundary.ey - offsetY) / cellSize);

  const penList: Pen[] = [];
  for (let x = minCellX; x <= maxCellX; x++) {
    for (let y = minCellY; y <= maxCellY; y++) {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        const cellPens = grid[y * cols + x];
        if (!cellPens) {
          continue;
        }

        // 筛选出在目标区域内的其他 pens
        for (const item of cellPens) {
          // 使用包围盒检测来判断是否相交
          if (rectHits(item, boundary)) {
            penList.push(item);
          }
        }
      }
    }
  }

  // 在默认边界外
  if (minCellX < 0 || maxCellX >= cols || minCellY < 0 || maxCellY >= rows) {
    for (const item of grid[grid.length - 1]) {
      // 使用包围盒检测来判断是否相交
      if (rectHits(item, boundary)) {
        penList.push(item);
      }
    }
  }

  penList.sort((a, b) => {
    return a.index - b.index;
  });
  // ⚠ 第 5.29 步：跨多格的图元会被每一格各收一次 —— 原来没去重，这份 id 发给 render 后同一个图元
  // 被画两遍（半透明的颜色会变深）。格子分细后跨格普遍，必须去重（getPensInPenBoundary 本来就去）。
  const penIds = [];
  const seen = new Set<string>();
  for (const pen of penList) {
    if (!seen.has(pen.id)) {
      seen.add(pen.id);
      penIds.push(pen.id);
    }
  }

  return penIds;
}

/** 连线拾取：离线条**可见边缘**这么多屏幕像素以内都算命中 */
const LINE_PICK_PX = 5;
/** 锚点、贝塞尔控制点、缩放点的命中半径（屏幕像素）；画出来的是半径 3~4 像素的点 */
const HANDLE_PICK_PX = 6;
/** 旋转控制点的命中半径（屏幕像素） */
const ROTATE_PICK_PX = 8;

/**
 * 屏幕像素换成世界坐标的命中半径，但不小于 `min` 个世界单位（原来的固定值）——
 * 放大时保持原手感，只修缩小后点不中的问题。
 */
function handleRadius(px: number, min = 5) {
  return Math.max(min, px / (view.scale || 1));
}

/**
 * 连线的拾取容差（世界坐标）= 半线宽 + LINE_PICK_PX 个屏幕像素。
 *
 * 原来是固定 5 个世界单位，既不看线宽也不看缩放：示例的缩放是 0.3~0.4，
 * 5 个世界单位只剩 1.5~2 个屏幕像素，实测能选中的只有线中心 3~5 像素宽的一条；
 * 线宽大于 10 时，点在看得见的线条边上反而选不中。
 */
function lineTolerance(item: Pen) {
  return (item.lineWidth || 1) / 2 + LINE_PICK_PX / (view.scale || 1);
}

function pointOnLine(item: Pen, x: number, y: number, r = lineTolerance(item)) {
  if (item.type === 'curve' || item.type === 'mind' || hasLineCrossSegment(item)) {
    const anchors = item.anchors || [];
    const segmentCount = Math.max(0, anchors.length - 1) + (item.close && anchors.length > 2 ? 1 : 0);

    // 直线段和曲线段一起取最近的：容差放大后，先命中的那段不一定是鼠标下面那段
    let nearest: Point;
    let nearestDistance = Infinity;

    // 先判断是否在直线段
    for (let segment = 0; segment < segmentCount; segment++) {
      const from = anchors[segment];
      const to = anchors[(segment + 1) % anchors.length];
      // 排除掉贝塞尔曲线段
      if (from.cp1 || to.cp2) continue;

      // 判断是否在直线上
      const pt = onSegment(x, y, from, to, r);
      if (pt) {
        const distance = Math.hypot(pt.x - x, pt.y - y);
        if (distance < nearestDistance) {
          pt.segment = segment;
          pt.position = getSegmentPosition(pt, from, to);
          nearest = pt;
          nearestDistance = distance;
        }
      }
    }

    // 再判断是否在曲线的点上
    let points = item.id ? linePoints.get(item.id) : undefined;

    if (!points) {
      const step = Math.max(0.005, Math.min(0.05, Math.round(5000 / (item.length || 100)) / 1000));
      points = getCurveSegmentPoints(item, step, false, true);
      if (item.id) {
        linePoints.set(item.id, points);
      }
    }

    for (let segment = 0; segment < segmentCount; segment++) {
      const segmentPoints = [
        anchors[segment],
        ...points.filter((point) => point.segment === segment && point.id === undefined),
        anchors[(segment + 1) % anchors.length],
      ];
      for (let i = 1; i < segmentPoints.length; i++) {
        const from = segmentPoints[i - 1];
        const to = segmentPoints[i];
        const projected = onSegment(x, y, from, to, r);
        if (projected) {
          const distance = Math.hypot(projected.x - x, projected.y - y);
          if (distance < nearestDistance) {
            const localPosition = getSegmentPosition(projected, from, to);
            nearest = {
              ...projected,
              segment,
              position: Math.max(0, Math.min(1, (i - 1 + localPosition) / (segmentPoints.length - 1))),
            };
            nearestDistance = distance;
          }
        }
      }
    }

    return nearest;
  }

  const anchors = item.anchors || [];
  const segmentCount = Math.max(0, anchors.length - 1) + (item.close && anchors.length > 2 ? 1 : 0);
  // 取最近的一段（原来取第一段命中的）：容差放大后，两段靠得近时第一段不一定是鼠标下面那段，
  // 而 linePoint 的 segment / position 会被拿去在线上加锚点
  let nearest: Point;
  let nearestDistance = Infinity;
  for (let segment = 0; segment < segmentCount; segment++) {
    const from = anchors[segment];
    const to = anchors[(segment + 1) % anchors.length];

    const pt = onSegment(x, y, from, to, r);
    if (pt) {
      const distance = Math.hypot(pt.x - x, pt.y - y);
      if (distance < nearestDistance) {
        pt.segment = segment;
        pt.position = getSegmentPosition(pt, from, to);
        nearest = pt;
        nearestDistance = distance;
      }
    }
  }
  return nearest;
}

function getSegmentPosition(point: Point, from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  return length ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length)) : 0;
}
