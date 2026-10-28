/**
 * 性能探针数据结构。
 *
 * 探针只做测量，不改变任何行为。目的是在动手改索引/渲染管线之前，
 * 先把「每格多少图元」「有没有图元漏出索引」「图元尺寸跨度多大」
 * 这几个决定方案走向的数量测出来。
 */

export interface Stats {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
}

/** 拾取网格的静态体检报告 */
export interface GridReport {
  penCount: number;

  // ---- 定尺结果 ----
  cellSize: number;
  cols: number;
  rows: number;
  /** 网格原点（世界坐标），即 initPickGrid 的 offsetX/offsetY */
  originX: number;
  originY: number;
  /** 网格覆盖的世界范围 = cols*cellSize × rows*cellSize */
  extentW: number;
  extentH: number;

  // ---- 实际场景范围 ----
  sceneX: number;
  sceneY: number;
  sceneW: number;
  sceneH: number;

  // ---- 覆盖完整性（核心：判断有没有图元漏出索引）----
  /** 包围盒完全落在网格范围内的图元数 */
  pensInsideExtent: number;
  /** 不在任何格子里的图元数。> 0 意味着这些图元永远拾取不到 */
  unindexedPens: number;
  unindexedRatio: number;
  /** 溢出桶 grid[cols*rows] 的长度 */
  overflowBucket: number;
  /** 桶里的 undefined 元素总数。> 0 说明 update() 往格里 push 了 undefined */
  undefinedEntries: number;

  // ---- 占用分布（核心：拾取候选数）----
  totalCells: number;
  nonEmptyCells: number;
  /** 分配了但始终为空的格子占比，用于验证行列数计算是否浪费 */
  deadCellRatio: number;
  /** 仅统计非空格 */
  occupancy: Stats;
  /** Σ 所有桶长度 */
  entryCount: number;
  /** entryCount / penCount，即平均每个图元占几个格。越大说明跨格越严重 */
  avgCellsPerPen: number;

  // ---- 图元尺寸分布（核心：决定要不要按尺寸分层）----
  /** max(width, height) 的分布 */
  size: Stats & { p90: number; p99: number };
  /** size 归一化到 cellSize 的倍数 */
  sizeInCells: { p50: number; p95: number; max: number };
  /** 长边超过 cellSize 的图元数，这些必然跨 ≥4 格 */
  oversizedPens: number;

  /** 第 5.19 步：逐（图元, 格子）对账的完整性自检，见 grid-report.ts 的 checkIntegrity */
  integrity?: GridIntegrity;
}

/**
 * 网格完整性：「应该登记在哪些格子」对「实际登记在哪些格子」逐对核对。
 * 「应该」按 add() / getCells() 自己的口径：未旋转的 x/y/ex/ey 覆盖到的界内格子；越界的还要进溢出桶。
 * 前五项是**不一致**（任何一项 > 0 都说明网格维护有缺陷）；rotUncovered 是**设计缺口**，单独报。
 */
export interface GridIntegrity {
  /** 该在某格却不在的（图元, 格子）对数 —— 会导致重画 / 拾取查不到它（D35 那一类） */
  missing: number;
  missingPens: number;
  /** 包围盒越出网格、却不在溢出桶里的图元数 —— 越界那一部分永远查不到 */
  outsideNoOverflow: number;
  /** 登记在它的框并不覆盖的格子里（旧位置没删掉）—— 多选、多画，不会漏画 */
  extra: number;
  /** 同一个图元在同一个格子里出现不止一次 */
  dup: number;
  /** 格子里的 id 在 penMap 里已经不存在（删除后残留） */
  notInMap: number;
  /** 格子里存的对象不是 penMap 里那一个（副本）；其中几何已经与 penMap 不一致的 */
  copies: number;
  copyDrift: number;
  /** 其中落在溢出桶里的副本数 */
  copiesInOverflow: number;
  /**
   * 同一个 id 在不同格子里的登记**不是同一个对象**（splitIds），其中几何还互相对不上的（splitDrift）。
   * 不拿 penMap 当真值 —— D38（动画路径）会让 penMap 那个对象本身变成停在旧位置的「幽灵」，
   * 这时 extra / copyDrift 都以它为准，看不见幽灵；只有「同 id 各处是否一致」看得见。
   */
  splitIds: number;
  splitDrift: number;
  /** 第 5.23 步：登记记录（penCells）与实际登记不符的图元数 / penMap 里已没有、记录还在的 id 数 */
  recordMismatch?: number;
  recordOrphans?: number;
  /** 带 rotate 的图元，旋转后的外接盒覆盖到了它没登记的格子 —— add() 注明「暂时没有考虑旋转」 */
  rotUncovered: number;
  rotPens: number;
  /** 每类前 5 个 id，定位用 */
  samples: Record<string, string[]>;
}

/** 跨线程消息统计 */
export interface MessageReport {
  /** 采样窗口内的消息总数 */
  total: number;
  /** 按 action 分类计数，键为 WorkerMessage 的数字值 */
  byAction: Record<number, number>;
  /** 按 16.67ms 分箱后的每帧消息数分布 */
  perFrame: Stats;
  /** 采样窗口时长（ms） */
  windowMs: number;
}

/** 耗时统计，单位微秒 */
export interface TimingReport {
  [label: string]: Stats;
}

export interface PerfReport {
  source: 'calc' | 'render' | 'hover' | 'utility' | 'main';
  timestamp: number;
  grid?: GridReport;
  message?: MessageReport;
  timing?: TimingReport;
}
