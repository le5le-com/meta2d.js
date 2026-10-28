import { Pen } from './pen';

/**
 * 图元层级（z-order）规划，设计见 .docs/pen-layer-order.md。
 *
 * 不变量 I1（软约束）：图元连同全部子孙按 index 排序后占连续一段，且图元自己在最前（先序）。
 * index 只需保证顺序：getData() 保存时丢掉 index、open 时 dealData 按数组顺序重新编号，
 * 所以这里可以分配小数、负数、留空隙 —— 每次操作只改被移动的块，不给其他图元重新编号。
 *
 * 这里全是纯函数：读 penMap，返回「图元 id → 新 index」，不改任何数据。
 */

/** 相邻两个 index 的最小间隔，小于它就把局部窗口重新铺开 */
export const MIN_INDEX_GAP = 1e-6;

export type IndexPlan = Map<string, number>;

/** 读 index：plan 里已经规划过的以规划值为准（同一次操作里前面的移动会影响后面的判断） */
type IndexOf = (pen: Pen) => number;
// plan 为空时不查 Map：O(n) 扫描对每个图元都要读一次，10 万图元时这次查找占了扫描的大头
const indexReader = (plan: IndexPlan): IndexOf => (pen) => (plan.size ? plan.get(pen.id) ?? pen.index : pen.index);

interface Block {
  pen: Pen;
  /** 先序：图元自己在前，子块按各自 first 排序依次展开 */
  pens: Pen[];
  first: number;
  last: number;
}

/**
 * 块：pen 连同全部子孙。成员以 children 为准（与拖拽、删除一致），children 成环时靠 visited 截断。
 * 顺序是先序，而不是按旧 index 排：旧数据里子图元可能排在父图元下面，按 index 排仍然是子在前，
 * 容器的子图元会继续被容器盖住。数据满足 I1 时两种排法结果相同。
 */
export function getBlock(penMap: Map<string, Pen>, pen: Pen, visited = new Set<string>(), idx: IndexOf = (p) => p.index): Block {
  visited.add(pen.id);
  const kids: Block[] = [];
  pen.children?.forEach((id) => {
    const child = penMap.get(id);
    child && !visited.has(child.id) && kids.push(getBlock(penMap, child, visited, idx));
  });
  kids.sort((a, b) => a.first - b.first);
  let first = idx(pen);
  let last = first;
  const pens = [pen];
  for (const k of kids) {
    k.first < first && (first = k.first);
    k.last > last && (last = k.last);
    pens.push(...k.pens);
  }
  return { pen, pens, first, last };
}

/** 是否按顶层图元处理：没有父图元，或父图元的 children 里没有它（孤儿，数据问题，不修复） */
export function isLayerRoot(penMap: Map<string, Pen>, pen: Pen): boolean {
  if (!pen.parentId) {
    return true;
  }
  const parent = penMap.get(pen.parentId);
  return !parent || !parent.children?.includes(pen.id);
}

/** 参与层级计算的父图元；顶层返回 undefined */
export function layerParent(penMap: Map<string, Pen>, pen: Pen): Pen | undefined {
  return isLayerRoot(penMap, pen) ? undefined : penMap.get(pen.parentId);
}

/** 全局顺序里 > x 的最小 index（排除 exclude）；没有则 undefined。O(n) */
function nextIndex(penMap: Map<string, Pen>, x: number, exclude: Set<string>, idx: IndexOf) {
  let best: number;
  for (const p of penMap.values()) {
    if (exclude.has(p.id)) {
      continue;
    }
    const i = idx(p);
    if (i > x && (best === undefined || i < best)) {
      best = i;
    }
  }
  return best;
}

/** 全局顺序里 < x 的最大 index（排除 exclude）；没有则 undefined。O(n) */
function prevIndex(penMap: Map<string, Pen>, x: number, exclude: Set<string>, idx: IndexOf) {
  let best: number;
  for (const p of penMap.values()) {
    if (exclude.has(p.id)) {
      continue;
    }
    const i = idx(p);
    if (i < x && (best === undefined || i > best)) {
      best = i;
    }
  }
  return best;
}

/** 全局最大 / 最小 index（排除 exclude）。O(n) */
function extremeIndex(penMap: Map<string, Pen>, exclude: Set<string>, idx: IndexOf, max: boolean) {
  let best: number;
  for (const p of penMap.values()) {
    if (exclude.has(p.id)) {
      continue;
    }
    const i = idx(p);
    if (best === undefined || (max ? i > best : i < best)) {
      best = i;
    }
  }
  return best;
}

/**
 * 把 pens（已按期望顺序）放进 (lo, hi) 开区间，结果写进 plan。lo / hi 为 undefined 表示没有下界 / 上界。
 * 间隔不够时（同一空隙被反复插入几十次后才会发生），把 lo 之上的一小段图元连同 pens 一起重新铺开，
 * 窗口按 2 倍外扩直到够用 —— 只改这个局部窗口，不做全量重排。
 */
export function allocateBetween(
  penMap: Map<string, Pen>,
  plan: IndexPlan,
  lo: number | undefined,
  hi: number | undefined,
  pens: Pen[],
  exclude: Set<string>,
) {
  const count = pens.length;
  if (!count) {
    return;
  }
  if (lo === undefined && hi === undefined) {
    pens.forEach((p, i) => plan.set(p.id, i));
    return;
  }
  if (lo === undefined) {
    pens.forEach((p, i) => plan.set(p.id, hi - count + i));
    return;
  }
  if (hi === undefined) {
    pens.forEach((p, i) => plan.set(p.id, lo + 1 + i));
    return;
  }
  const step = (hi - lo) / (count + 1);
  if (step >= MIN_INDEX_GAP) {
    pens.forEach((p, i) => plan.set(p.id, lo + step * (i + 1)));
    return;
  }

  // 精度兜底：lo 之上的图元按顺序排好，取前 k 个与 pens 一起在 (lo, 第 k+1 个) 里均匀铺开
  const idx = indexReader(plan);
  const above = [...penMap.values()]
    .filter((p) => !exclude.has(p.id) && idx(p) > lo)
    .sort((a, b) => idx(a) - idx(b));
  for (let k = 1; ; k *= 2) {
    const window = above.slice(0, k);
    const bound = above[k] ? idx(above[k]) : undefined;
    const all = [...pens, ...window];
    if (bound === undefined) {
      all.forEach((p, i) => plan.set(p.id, lo + 1 + i));
      return;
    }
    const s = (bound - lo) / (all.length + 1);
    if (s >= MIN_INDEX_GAP) {
      all.forEach((p, i) => plan.set(p.id, lo + s * (i + 1)));
      return;
    }
  }
}

/** 紧挨在 anchor 块之上的空隙 */
function boundsAbove(penMap: Map<string, Pen>, last: number, exclude: Set<string>, idx: IndexOf) {
  return { lo: last, hi: nextIndex(penMap, last, exclude, idx) };
}

/**
 * 紧挨在 first 之下的空隙，但不越过父图元：
 * 正常数据里父图元在兄弟下面，prev(first) 不会低于它；旧数据里兄弟可能排在父图元下面，这时改为紧挨父图元之后。
 */
function boundsBelow(penMap: Map<string, Pen>, parent: Pen | undefined, first: number, exclude: Set<string>, idx: IndexOf) {
  if (parent && idx(parent) >= first) {
    return boundsAbove(penMap, idx(parent), exclude, idx);
  }
  return { lo: prevIndex(penMap, first, exclude, idx), hi: first };
}

/** 从一组图元里去掉「祖先也在里面」的那些，只留最外层（选中父图元时子图元跟着块走，不能再单独算一次） */
export function outermostPens(penMap: Map<string, Pen>, pens: Pen[]): Pen[] {
  const ids = new Set(pens.map((p) => p.id));
  return pens.filter((pen) => {
    let parentId = pen.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      if (ids.has(parentId)) {
        return false;
      }
      seen.add(parentId);
      parentId = penMap.get(parentId)?.parentId;
    }
    return true;
  });
}

/** 兄弟块：同一父图元下（顶层时为全部顶层图元），按 first 排序 */
function siblingBlocks(penMap: Map<string, Pen>, parent: Pen | undefined, idx: IndexOf): Block[] {
  const siblings = parent
    ? (parent.children || []).map((id) => penMap.get(id)).filter(Boolean)
    : [...penMap.values()].filter((p) => isLayerRoot(penMap, p));
  const visited = new Set<string>(parent ? [parent.id] : []);
  const blocks: Block[] = [];
  for (const pen of siblings) {
    !visited.has(pen.id) && blocks.push(getBlock(penMap, pen, visited, idx));
  }
  return blocks.sort((a, b) => a.first - b.first);
}

/** 把选中图元按参与层级计算的父图元分组 */
function groupByParent(penMap: Map<string, Pen>, pens: Pen[]) {
  const groups = new Map<string, { parent: Pen | undefined; ids: Set<string> }>();
  for (const pen of outermostPens(penMap, pens)) {
    const parent = layerParent(penMap, pen);
    const key = parent?.id ?? '';
    let g = groups.get(key);
    if (!g) {
      g = { parent, ids: new Set() };
      groups.set(key, g);
    }
    g.ids.add(pen.id);
  }
  return [...groups.values()];
}

/** 多个块按 first 排好后依次拼接 */
function concatBlocks(blocks: Block[]): Pen[] {
  return [...blocks].sort((a, b) => a.first - b.first).flatMap((b) => b.pens);
}

const idsOf = (pens: Pen[]) => new Set(pens.map((p) => p.id));

/** 选中数量不超过它时走快速路径（每个单元几次 O(n) 扫描）；更多时一次排好全部兄弟 */
const FAST_MOVE_LIMIT = 8;

/**
 * 上移 / 下移一层（§5.2）：在同一父图元的兄弟间整块移动一格，不跳过视觉上不重叠的兄弟。
 * 相邻的选中兄弟作为一个整体移动；到边界（最上 / 最下，或下面就是父图元）不动。
 */
export function planMoveLayer(penMap: Map<string, Pen>, pens: Pen[], forward: boolean): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  for (const { parent, ids } of groupByParent(penMap, pens)) {
    const units = ids.size <= FAST_MOVE_LIMIT ? unitsNearby(penMap, parent, ids, idx) : unitsFromSiblings(penMap, parent, ids, idx);
    // 上移从最上面的单元开始，下移从最下面的开始：单元之间隔着别的兄弟，互不影响
    forward && units.reverse();
    for (const unit of units) {
      const neighbor = forward ? unit.above : unit.below;
      if (!neighbor) {
        continue;
      }
      const moving = concatBlocks(unit.blocks);
      const exclude = idsOf(moving);
      const { lo, hi } = forward
        ? boundsAbove(penMap, neighbor.last, exclude, idx)
        : boundsBelow(penMap, parent, neighbor.first, exclude, idx);
      allocateBetween(penMap, plan, lo, hi, moving, exclude);
    }
  }
  return plan;
}

interface MoveUnit {
  blocks: Block[];
  below?: Block;
  above?: Block;
}

/** 全部兄弟排好序，相邻选中的合成单元，记下两侧邻居。O(n log n)：选中很多时用 */
function unitsFromSiblings(penMap: Map<string, Pen>, parent: Pen | undefined, ids: Set<string>, idx: IndexOf): MoveUnit[] {
  const sibs = siblingBlocks(penMap, parent, idx);
  const units: MoveUnit[] = [];
  for (let i = 0; i < sibs.length; i++) {
    if (!ids.has(sibs[i].pen.id)) {
      continue;
    }
    const start = i;
    while (i + 1 < sibs.length && ids.has(sibs[i + 1].pen.id)) {
      i++;
    }
    units.push({ blocks: sibs.slice(start, i + 1), below: sibs[start - 1], above: sibs[i + 1] });
  }
  return units;
}

/** pen 所属的那个兄弟（parent 的直接子图元；顶层时为顶层图元）；不在 parent 之下返回 undefined */
function siblingOwning(penMap: Map<string, Pen>, pen: Pen, parent: Pen | undefined): Pen | undefined {
  const seen = new Set<string>();
  let p = pen;
  while (p && !seen.has(p.id)) {
    seen.add(p.id);
    const lp = layerParent(penMap, p);
    if (lp === parent) {
      return p;
    }
    if (!lp) {
      return undefined;
    }
    p = lp;
  }
  return undefined;
}

/**
 * 选中少时不必排全部兄弟（10 万图元顶层兄弟就有几万个）：一次扫描求出每个选中块上下紧挨的图元，
 * 再沿父链找到它所属的兄弟，就是邻居。两个选中块之间没有别的图元即为相邻，合成一个单元。
 */
function unitsNearby(penMap: Map<string, Pen>, parent: Pen | undefined, ids: Set<string>, idx: IndexOf): MoveUnit[] {
  const visited = new Set<string>();
  const blocks = [...ids].map((id) => getBlock(penMap, penMap.get(id), visited, idx)).sort((a, b) => a.first - b.first);
  const selected = new Set<string>();
  blocks.forEach((b) => b.pens.forEach((p) => selected.add(p.id)));

  // 每个块：紧挨在上面 / 下面的非选中图元
  const above: Pen[] = new Array(blocks.length);
  const below: Pen[] = new Array(blocks.length);
  for (const p of penMap.values()) {
    if (selected.has(p.id)) {
      continue;
    }
    const i = idx(p);
    for (let k = 0; k < blocks.length; k++) {
      const b = blocks[k];
      if (i > b.last && (!above[k] || i < idx(above[k]))) {
        above[k] = p;
      }
      if (i < b.first && (!below[k] || i > idx(below[k]))) {
        below[k] = p;
      }
    }
  }
  const neighbor = (p: Pen) => {
    const sib = p && siblingOwning(penMap, p, parent);
    return sib && !ids.has(sib.id) ? getBlock(penMap, sib, new Set(), idx) : undefined;
  };

  const units: MoveUnit[] = [];
  for (let k = 0; k < blocks.length; k++) {
    const start = k;
    // 与上一个选中块之间没有非选中图元 ⇒ 相邻
    while (k + 1 < blocks.length && (!above[k] || idx(above[k]) > blocks[k + 1].first)) {
      k++;
    }
    units.push({ blocks: blocks.slice(start, k + 1), below: neighbor(below[start]), above: neighbor(above[k]) });
  }
  return units;
}

/** 置顶 / 置底（§5.3）：整块移到父图元范围的最后 / 最前 */
export function planToFrontOrBack(penMap: Map<string, Pen>, pens: Pen[], toTop: boolean): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  for (const { parent, ids } of groupByParent(penMap, pens)) {
    const visited = new Set<string>();
    const moving = concatBlocks([...ids].map((id) => getBlock(penMap, penMap.get(id), visited, idx)));
    const exclude = idsOf(moving);
    if (!parent) {
      toTop
        ? allocateBetween(penMap, plan, extremeIndex(penMap, exclude, idx, true), undefined, moving, exclude)
        : allocateBetween(penMap, plan, undefined, extremeIndex(penMap, exclude, idx, false), moving, exclude);
      continue;
    }
    const { lo, hi } = toTop
      ? boundsAbove(penMap, parentBlockLast(penMap, parent, exclude, idx), exclude, idx)
      : boundsAbove(penMap, idx(parent), exclude, idx);
    allocateBetween(penMap, plan, lo, hi, moving, exclude);
  }
  return plan;
}

/** 父图元块（去掉 exclude 后）的末端 */
function parentBlockLast(penMap: Map<string, Pen>, parent: Pen, exclude: Set<string>, idx: IndexOf) {
  let last = idx(parent);
  for (const p of getBlock(penMap, parent, new Set(exclude), idx).pens) {
    idx(p) > last && (last = idx(p));
  }
  return last;
}

/** 移到目标图元前 / 后（§5.4），两者必须同一父图元（调用方保证） */
export function planMoveRelative(penMap: Map<string, Pen>, pen: Pen, target: Pen, toFront: boolean): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  const moving = getBlock(penMap, pen, new Set(), idx).pens;
  const exclude = idsOf(moving);
  const range = getBlock(penMap, target, new Set(exclude), idx);
  const { lo, hi } = toFront
    ? boundsAbove(penMap, range.last, exclude, idx)
    : boundsBelow(penMap, layerParent(penMap, pen), range.first, exclude, idx);
  allocateBetween(penMap, plan, lo, hi, moving, exclude);
  return plan;
}

/**
 * 把 pens（已是先序排好的完整块，可以是还没进 penMap 的新图元）放到 parent 块的末尾（§5.6 / §5.7）；
 * parent 为 undefined 时放到全局最上面。
 */
export function planAppendToParent(penMap: Map<string, Pen>, parent: Pen | undefined, pens: Pen[]): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  const exclude = idsOf(pens);
  if (!parent) {
    allocateBetween(penMap, plan, extremeIndex(penMap, exclude, idx, true), undefined, pens, exclude);
    return plan;
  }
  const { lo, hi } = boundsAbove(penMap, parentBlockLast(penMap, parent, exclude, idx), exclude, idx);
  allocateBetween(penMap, plan, lo, hi, pens, exclude);
  return plan;
}

/** 放到 anchor 块之后（拖出容器：放在容器上方，§5.6）。pens 为先序排好的完整块 */
export function planAfterBlock(penMap: Map<string, Pen>, anchor: Pen, pens: Pen[]): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  const exclude = idsOf(pens);
  const { lo, hi } = boundsAbove(penMap, parentBlockLast(penMap, anchor, exclude, idx), exclude, idx);
  allocateBetween(penMap, plan, lo, hi, pens, exclude);
  return plan;
}

/**
 * 编组（§5.5）：成员块按原相对顺序，连同新 group（放最前）收拢到最上层成员所在的位置。
 * group 可以还没进 penMap。
 */
export function planGroup(penMap: Map<string, Pen>, group: Pen, members: Pen[]): IndexPlan {
  const plan: IndexPlan = new Map();
  const idx = indexReader(plan);
  const visited = new Set<string>([group.id]);
  const blocks = outermostPens(penMap, members).map((m) => getBlock(penMap, m, visited, idx));
  if (!blocks.length) {
    return plan;
  }
  const moving = concatBlocks(blocks);
  const exclude = idsOf(moving);
  exclude.add(group.id);
  const top = blocks.reduce((a, b) => (b.last > a.last ? b : a));
  allocateBetween(
    penMap,
    plan,
    prevIndex(penMap, top.first, exclude, idx),
    nextIndex(penMap, top.last, exclude, idx),
    [group, ...moving],
    exclude,
  );
  return plan;
}

/**
 * 整份数据整理成满足 I1（§5.9）：兄弟按块当前的 first 排序，先序重新编号 0, 1, 2 …。
 * 块成员以 children 为准；children 数组的顺序不动（showChild 按下标取）；防 children 成环。
 * 只返回 index 真正变了的图元。
 */
export function planNormalizeLayers(penMap: Map<string, Pen>): IndexPlan {
  const visited = new Set<string>();
  const roots: Block[] = [];
  for (const p of penMap.values()) {
    isLayerRoot(penMap, p) && !visited.has(p.id) && roots.push(getBlock(penMap, p, visited));
  }
  const order = concatBlocks(roots);
  // 成环数据里可能有从顶层走不到的图元：按原顺序补在最后
  const rest = [...penMap.values()].filter((p) => !visited.has(p.id)).sort((a, b) => a.index - b.index);
  for (const p of rest) {
    !visited.has(p.id) && order.push(...getBlock(penMap, p, visited).pens);
  }

  const plan: IndexPlan = new Map();
  order.forEach((pen, i) => {
    pen.index !== i && plan.set(pen.id, i);
  });
  return plan;
}
