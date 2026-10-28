import { getRectOfPoints, Pen, Rect, rectToPoints } from '../models';
import { GridIntegrity, GridReport, Stats } from './types';

export interface GridInternals {
  grid: Pen[][];
  cellSize: number;
  cols: number;
  rows: number;
  offsetX: number;
  offsetY: number;
  /** 第 5.23 步：登记用的外接盒（带旋转）。缺省时按未旋转的 x/y/ex/ey */
  cellBox?: (pen: Pen) => Rect;
  /** 第 5.23 步：每个图元实际登记在哪些格子的记录 */
  penCells?: Map<string, number[]>;
}

function pct(sorted: number[], p: number): number {
  if (!sorted.length) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function statsOf(sorted: number[]): Stats {
  if (!sorted.length) {
    return { count: 0, avg: 0, p50: 0, p95: 0, max: 0 };
  }
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i];
  }
  return {
    count: sorted.length,
    avg: sum / sorted.length,
    p50: pct(sorted, 0.5),
    p95: pct(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

/**
 * 对当前拾取网格做一次静态体检。纯读取，不修改任何状态。
 *
 * 回答三个问题：
 *   1. 有没有图元漏出索引（unindexedPens / overflowBucket）
 *   2. 一次拾取要线性扫多少个候选（occupancy）
 *   3. 图元尺寸跨度是否大到需要按尺寸分层（size.p95 / size.p50、oversizedPens）
 */
export function reportGrid(internals: GridInternals, penMap: Map<string, Pen>): GridReport {
  const { grid, cellSize, cols, rows, offsetX, offsetY } = internals;

  const totalCells = cols * rows;
  const extentW = cols * cellSize;
  const extentH = rows * cellSize;

  // ---- 遍历所有桶 ----
  const occ: number[] = [];
  let nonEmptyCells = 0;
  let entryCount = 0;
  let undefinedEntries = 0;
  const indexed = new Set<string>();

  // grid 长度为 cols*rows + 1，最后一个是溢出桶，单独统计
  const cellEnd = Math.min(totalCells, grid.length);
  for (let i = 0; i < cellEnd; i++) {
    const bucket = grid[i];
    if (!bucket) {
      continue;
    }
    entryCount += bucket.length;
    if (bucket.length) {
      nonEmptyCells++;
      occ.push(bucket.length);
    }
    for (let j = 0; j < bucket.length; j++) {
      const p = bucket[j];
      if (!p || p.id == undefined) {
        undefinedEntries++;
      } else {
        indexed.add(p.id);
      }
    }
  }

  let overflowBucket = 0;
  if (grid.length > totalCells) {
    const ob = grid[grid.length - 1] || [];
    overflowBucket = ob.length;
    entryCount += ob.length;
    for (let j = 0; j < ob.length; j++) {
      const p = ob[j];
      if (!p || p.id == undefined) {
        undefinedEntries++;
      } else {
        indexed.add(p.id);
      }
    }
  }

  // ---- 遍历 penMap：场景包围盒、尺寸分布、覆盖完整性 ----
  let sx = Infinity;
  let sy = Infinity;
  let sxe = -Infinity;
  let sye = -Infinity;
  let pensInsideExtent = 0;
  let unindexedPens = 0;
  let oversizedPens = 0;
  const sizes: number[] = [];

  for (const [id, pen] of penMap) {
    const x = pen.x;
    const y = pen.y;
    const ex = pen.ex != undefined ? pen.ex : pen.x + (pen.width || 0);
    const ey = pen.ey != undefined ? pen.ey : pen.y + (pen.height || 0);
    if (x < sx) {
      sx = x;
    }
    if (y < sy) {
      sy = y;
    }
    if (ex > sxe) {
      sxe = ex;
    }
    if (ey > sye) {
      sye = ey;
    }

    const d = Math.max(ex - x, ey - y);
    sizes.push(d);
    if (d > cellSize) {
      oversizedPens++;
    }

    // 是否完全落在网格覆盖范围内
    const gx0 = Math.floor((x - offsetX) / cellSize);
    const gy0 = Math.floor((y - offsetY) / cellSize);
    const gx1 = Math.floor((ex - offsetX) / cellSize);
    const gy1 = Math.floor((ey - offsetY) / cellSize);
    if (gx0 >= 0 && gx1 < cols && gy0 >= 0 && gy1 < rows) {
      pensInsideExtent++;
    }

    if (!indexed.has(id)) {
      unindexedPens++;
    }
  }

  const penCount = penMap.size;
  if (!penCount) {
    sx = sy = sxe = sye = 0;
  }

  occ.sort((a, b) => a - b);
  sizes.sort((a, b) => a - b);
  const sizeStats = statsOf(sizes);

  return {
    penCount,

    cellSize,
    cols,
    rows,
    originX: offsetX,
    originY: offsetY,
    extentW,
    extentH,

    sceneX: sx,
    sceneY: sy,
    sceneW: sxe - sx,
    sceneH: sye - sy,

    pensInsideExtent,
    unindexedPens,
    unindexedRatio: penCount ? unindexedPens / penCount : 0,
    overflowBucket,
    undefinedEntries,

    totalCells,
    nonEmptyCells,
    deadCellRatio: totalCells ? 1 - nonEmptyCells / totalCells : 0,
    occupancy: statsOf(occ),
    entryCount,
    avgCellsPerPen: penCount ? entryCount / penCount : 0,

    size: { ...sizeStats, p90: pct(sizes, 0.9), p99: pct(sizes, 0.99) },
    sizeInCells: {
      p50: cellSize ? sizeStats.p50 / cellSize : 0,
      p95: cellSize ? sizeStats.p95 / cellSize : 0,
      max: cellSize ? sizeStats.max / cellSize : 0,
    },
    oversizedPens,
    integrity: checkIntegrity(internals, penMap),
  };
}

/**
 * 第 5.19 步（只量不改行为）：网格完整性自检。
 *
 * 为什么要它：D35（多选拖拽删掉邻居）是被测代码自己的缺陷，**任何耗时读数都看不见它**，
 * 是用户肉眼发现的；而上面的 `unindexedPens` 只问「是否在**某个**格子里」，一个该在两格、
 * 只剩一格的图元它看不出来。下一步要把网格分细（格子边长从几百降到几十），跨格会变得极其
 * 频繁 ⇒ 网格维护的每一个缺陷都会被放大。所以先有这把尺子，再动网格。
 *
 * 口径与 add() / getCells() 完全一致：未旋转的 x/y/ex/ey，界内格子逐个核对；越界的核对溢出桶。
 * 纯读取；O(条目数 + Σ每个图元覆盖的格子数)，只在取报告时跑。
 */
function checkIntegrity(internals: GridInternals, penMap: Map<string, Pen>): GridIntegrity {
  const { grid, cellSize, cols, rows, offsetX, offsetY } = internals;
  const totalCells = cols * rows;
  const r: GridIntegrity = {
    missing: 0,
    missingPens: 0,
    outsideNoOverflow: 0,
    extra: 0,
    dup: 0,
    notInMap: 0,
    copies: 0,
    copyDrift: 0,
    copiesInOverflow: 0,
    splitIds: 0,
    splitDrift: 0,
    recordMismatch: 0,
    recordOrphans: 0,
    rotUncovered: 0,
    rotPens: 0,
    samples: {},
  };
  const note = (k: string, id: string) => {
    const a = r.samples[k] || (r.samples[k] = []);
    a.length < 5 && a.push(id);
  };
  const cellOf = (v: number, o: number) => Math.floor((v - o) / cellSize);
  // 第 5.23 步：「应该登记在哪」与被测代码用同一个登记盒（带旋转）；老版本没有 cellBox 时按未旋转的框
  const boxOf = (pen: Pen) => {
    const b = internals.cellBox ? internals.cellBox(pen) : pen;
    return {
      x: b.x,
      y: b.y,
      ex: b.ex != undefined ? b.ex : b.x + (b.width || 0),
      ey: b.ey != undefined ? b.ey : b.y + (b.height || 0),
    };
  };

  // 每个桶：id → 出现次数（查缺、查重都用它）
  const buckets: Map<string, number>[] = [];
  for (let i = 0; i < grid.length; i++) {
    const m = new Map<string, number>();
    const b = grid[i] || [];
    for (const p of b) {
      if (!p || p.id == undefined) {
        continue; // undefined 已由 undefinedEntries 报过
      }
      const n = (m.get(p.id) || 0) + 1;
      m.set(p.id, n);
      if (n === 2) {
        r.dup++;
        note('dup', p.id);
      }
      const src = penMap.get(p.id);
      if (!src) {
        if (n === 1) {
          r.notInMap++;
          note('notInMap', p.id);
        }
        continue;
      }
      if (p !== src && n === 1) {
        i === grid.length - 1 && i >= totalCells && r.copiesInOverflow++;
        r.copies++;
        if (p.x !== src.x || p.y !== src.y || p.ex !== src.ex || p.ey !== src.ey) {
          r.copyDrift++;
          note('copyDrift', p.id);
        }
      }
      // 登记在它的框并不覆盖的界内格子里
      if (i < totalCells && n === 1) {
        const cx = i % cols;
        const cy = Math.floor(i / cols);
        const sb = boxOf(src);
        if (
          cx < cellOf(sb.x, offsetX) ||
          cx > cellOf(sb.ex, offsetX) ||
          cy < cellOf(sb.y, offsetY) ||
          cy > cellOf(sb.ey, offsetY)
        ) {
          r.extra++;
          note('extra', p.id);
        }
      }
    }
    buckets.push(m);
  }
  const overflow = grid.length > totalCells ? buckets[grid.length - 1] : undefined;

  // 同 id 跨格一致性：第一次见到的登记当参照，之后别的格子里的登记必须是同一个对象
  const firstSeen = new Map<string, Pen>();
  const splitSeen = new Set<string>();
  for (let i = 0; i < grid.length; i++) {
    for (const p of grid[i] || []) {
      if (!p || p.id == undefined) {
        continue;
      }
      const f = firstSeen.get(p.id);
      if (!f) {
        firstSeen.set(p.id, p);
        continue;
      }
      if (f !== p && !splitSeen.has(p.id)) {
        splitSeen.add(p.id);
        r.splitIds++;
        if (f.x !== p.x || f.y !== p.y || f.ex !== p.ex || f.ey !== p.ey) {
          r.splitDrift++;
          note('splitDrift', p.id);
        }
      }
    }
  }

  for (const [id, pen] of penMap) {
    const ex = pen.ex != undefined ? pen.ex : pen.x + (pen.width || 0);
    const ey = pen.ey != undefined ? pen.ey : pen.y + (pen.height || 0);
    const pb = boxOf(pen);
    const gx0 = cellOf(pb.x, offsetX);
    const gy0 = cellOf(pb.y, offsetY);
    const gx1 = cellOf(pb.ex, offsetX);
    const gy1 = cellOf(pb.ey, offsetY);
    let miss = 0;
    for (let cx = Math.max(0, gx0); cx <= Math.min(cols - 1, gx1); cx++) {
      for (let cy = Math.max(0, gy0); cy <= Math.min(rows - 1, gy1); cy++) {
        if (!buckets[cy * cols + cx]?.has(id)) {
          miss++;
        }
      }
    }
    if (miss) {
      r.missing += miss;
      r.missingPens++;
      note('missing', id);
    }
    if ((gx0 < 0 || gx1 >= cols || gy0 < 0 || gy1 >= rows) && !overflow?.has(id)) {
      r.outsideNoOverflow++;
      note('outsideNoOverflow', id);
    }

    if (pen.rotate) {
      r.rotPens++;
      const rr = getRectOfPoints(rectToPoints({ ...pen, ex, ey }));
      let unc = 0;
      for (let cx = Math.max(0, cellOf(rr.x, offsetX)); cx <= Math.min(cols - 1, cellOf(rr.ex, offsetX)); cx++) {
        for (let cy = Math.max(0, cellOf(rr.y, offsetY)); cy <= Math.min(rows - 1, cellOf(rr.ey, offsetY)); cy++) {
          if (!buckets[cy * cols + cx]?.has(id)) {
            unc++;
          }
        }
      }
      if (unc) {
        r.rotUncovered++;
        note('rotUncovered', id);
      }
    }

    // 第 5.23 步：记录（penCells）必须与实际登记逐格相符 —— 删除和「它现在在哪」都靠它
    const rec = internals.penCells?.get(id);
    if (internals.penCells) {
      const actual: number[] = [];
      for (let i = 0; i < buckets.length; i++) {
        buckets[i].has(id) && actual.push(i);
      }
      const want = rec ? [...rec].sort((a, b) => a - b) : [];
      if (want.length !== actual.length || want.some((v, k) => v !== actual[k])) {
        r.recordMismatch++;
        note('recordMismatch', id);
      }
    }
  }
  if (internals.penCells) {
    for (const id of internals.penCells.keys()) {
      if (!penMap.has(id)) {
        r.recordOrphans++;
        note('recordOrphans', id);
      }
    }
  }
  return r;
}
