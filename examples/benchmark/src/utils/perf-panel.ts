import { WorkerMessage } from '@meta2d/core'
// 运行时 vite 把 @meta2d 别名到 ../../packages 源码；但 tsc 会解析到 node_modules 里
// 已发布的 @meta2d/core@2.0.0（不含探针类型），所以类型这里直接引源文件。
import type { PerfReport, Stats } from '../../../../packages/core/src/perf/types'

type Reports = { calc?: PerfReport; hover?: PerfReport; render?: PerfReport; main?: PerfReport }

/**
 * `ViewRendered` = 61。这里写字面量而不是 `WorkerMessage.ViewRendered`：
 * `@meta2d/core` 在这个 example 里解析到的是 node_modules 里**装好的那份**
 * （tsconfig 的 `@meta2d/*` 指向 `../packages/*`，从 examples 出发是不存在的路径），
 * 枚举比源码旧，新加的成员取不到。枚举是追加的，旧成员的数值与源码一致，所以
 * 老的 `WorkerMessage.XXX` 照用，新成员只能写数值。
 */
const ACTION_VIEW_RENDERED = 61

interface Meta2dLike {
  setOptions(opt: any): void
  getPerfReport(opt?: { reset?: boolean; timeout?: number }): Promise<Reports>
  topElement: HTMLElement
  /** 平移画布。**同步执行**（M12 之后编程式调用不再被节流、也不延后到下一帧） */
  translateCanvas(x: number, y: number): void
  scale(scale: number, center?: { x: number; y: number }): void
  data: { x: number; y: number; scale: number }
  /** Mode.Run = 0 / Mode.Edit = 1 */
  setMode(mode: number): void
  options: { mode?: number; disablePickCoalescing?: boolean }
  /** 每次 setViewPosition 都会 emit('translate')，用来数「实际生效了几次平移」 */
  on(evt: string, fn: (...a: any[]) => void): void
  off(evt: string, fn: (...a: any[]) => void): void
  /** 换场景。`getData()` 返回的是深拷贝（structuredClone），可以原样喂回来 */
  open(data?: any): void
  getData(): any
}

/** 与 @meta2d/core 的 Mode 枚举一致，这里不引入以免耦合 */
const MODE_RUN = 0
const MODE_EDIT = 1

/** 墨迹审计场景里每个图元的边长（世界单位） */
const INK_SIZE = 64
/** 每一类审计几条视口。每条都审 ⇒ 每次差异只能由那一步的窄带造成，不会是上一步的残留 */
const INK_STEPS = 6
/** 每步平移（世界单位）。两个轴都动 ⇒ 竖条与横条两条窄带同时受检 */
const INK_DX = 96
const INK_DY = 72

/**
 * 第 5 步要补的那几类「`inkBoxMin` 算不到的墨迹」，**一类一个场景单独审**。
 *
 * 为什么不混成一个场景：审计只知道「哪些像素不一样」，不知道是哪个图元造成的。
 * 一类一场景 ⇒ 差异直接归因到 `inkBox` 的一个分支，这张表才能决定第 5 步写哪几个分支
 * （也才可能得出「某一类根本不用写」这个结论 —— 那是最省的结论）。
 *
 * `overflow` 是这一类墨迹伸出 pen 矩形多远，拿来和 `INK_PAD_MIN = 2` 比：**必须远大于 2**，
 * 否则读到 0 差异说明不了任何事（是余量刚好盖住了，还是这一类墨迹压根没画出来？）。
 */
interface InkKind {
  key: string
  label: string
  /** 墨迹溢出 pen 矩形的距离（世界单位，估算）。和 INK_PAD_MIN = 2 比 */
  overflow: number
  note: string
  /** 把这一类的特征加到基础矩形上。基础矩形已带 x/y/width/height/ex/ey/pivot */
  style: (pen: any) => void
}

const INK_KINDS: InkKind[] = [
  {
    key: 'plain',
    label: '对照组 · 纯矩形',
    overflow: 0,
    note: 'inkBoxMin 完全覆盖 ⇒ 必须 0 差异。它要是也脏了，问题在搬运（blit 偏移 / 接缝取整 / CTM 残留，D16 那一类），根本不在墨迹计算',
    style: () => {},
  },
  {
    key: 'rotate',
    label: 'rotate = 45°',
    // 正方形转 45°：外接圆半径 = 边长·√2/2，比半边长多 (√2−1)/2 ≈ 0.207 倍边长
    overflow: 0.207 * INK_SIZE,
    note: '应取外接圆（最多比锚点框大 √2 倍）。现在按未旋转的矩形算 ⇒ 四个角伸出去的部分不算墨迹',
    style: (pen) => {
      pen.rotate = 45
      pen.background = '#4f8cff'
    },
  },
  {
    key: 'thick',
    label: 'lineWidth = 16',
    // 描边以路径为中心，向外溢出 lineWidth/2
    overflow: 8,
    note: '第五类盲区（文档里原本只列了四类）：描边向外溢出 lineWidth/2 = 8，而 INK_PAD_MIN 只有 2 ⇒ lineWidth > 4 就不够',
    style: (pen) => {
      pen.background = undefined
      pen.color = '#d81b60'
      pen.lineWidth = 16
    },
  },
  {
    key: 'shadow',
    label: 'shadowBlur 24 + 偏移 10',
    // 高斯模糊的可见半径 ≈ blur/2，再加上偏移
    overflow: 22,
    note: '阴影整个画在矩形之外，inkBoxMin 一分没算',
    style: (pen) => {
      pen.background = '#ffb300'
      pen.shadowColor = '#000000'
      pen.shadowBlur = 24
      pen.shadowOffsetX = 10
      pen.shadowOffsetY = 10
    },
  },
  {
    key: 'text',
    label: '外溢文本（不设 textWidth ⇒ 不折行）',
    // 28px × 6 个汉字 ≈ 168 宽，装在 64 宽的框里 ⇒ 两侧各溢出 ~52
    overflow: 52,
    note: '不设 textWidth 就不折行（service.ts:913 只有 textWidth > 0 才折）⇒ 单行横向溢出。这一类自带铁证：render 会为它发 TextOutside(31) 给 calc',
    style: (pen) => {
      pen.background = '#e8eaf6'
      pen.color = '#3949ab'
      pen.text = '溢出溢出溢出'
      pen.fontSize = 28
      pen.textColor = '#1a237e'
    },
  },
  {
    key: 'line',
    label: 'Line + 两端箭头',
    // 箭头三角的半高 = size/3 = 8，描边半宽 3 ⇒ 连线上下各溢出 ~11，而框高只有 4
    overflow: 11,
    note: '连线画在框的上沿（锚点 y = pen.y），箭头与描边全在框外。箭头沿线画（x 不超界）⇒ 只有**横条**那条窄带能查出它',
    style: (pen) => {
      const w = INK_SIZE * 2
      pen.type = 'line'
      pen.category = 1 // PenCategory.Line
      pen.width = w
      // 高度**不能是 0**：calc 的 calcInViewPens 把 width/height < 2 的整个丢掉
      // （calc/worker.ts:644）⇒ 基准那一遍全量重绘根本不画它，这一行量到的就成了
      // 「基准自己的盲区」而不是「箭头墨迹溢出包围盒」。给 4 是刚好过线、又保证
      // 箭头和描边仍然溢出到框外（第十六轮那次读数用的是 0，line 那一行因此不算数）。
      pen.height = 4
      pen.ex = pen.x + w
      pen.ey = pen.y + 4
      pen.background = undefined
      pen.color = '#00897b'
      pen.lineWidth = 6
      pen.fromArrow = 'triangle'
      pen.toArrow = 'triangle'
      pen.fromArrowSize = 24
      pen.toArrowSize = 24
      pen.anchors = [
        { id: pen.id + '-a', penId: pen.id, x: pen.x, y: pen.y },
        { id: pen.id + '-b', penId: pen.id, x: pen.x + w, y: pen.y },
      ]
    },
  },
]

/** 一行体检结论 */
interface Row {
  label: string
  value: string
  expect?: string
  /** true = 达标，false = 不达标，undefined = 仅供参考 */
  pass?: boolean
  note?: string
}

const fmt = (v: number | undefined, digits = 1) =>
  v == undefined || Number.isNaN(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: digits })
const pct = (v: number | undefined) => (v == undefined ? '—' : (v * 100).toFixed(1) + '%')

/**
 * meta2d 性能探针面板。
 *
 * 只在选中 meta2d 时挂载。三个动作分别对应《meta2d 性能重构设计方案》§0.4 的 A/B/C 三条结论：
 * - 网格体检      → 验证 A（世界有界、溢出桶为空）与 B（轴向混算导致的空格率与占用）
 * - 动画累积检测  → 验证 C（updatePenCell 重复插入是否在累积）
 * - 鼠标扫描      → 量 pick 实际耗时与每帧消息数
 */
export class PerfPanel {
  private root: HTMLDivElement
  private body: HTMLDivElement
  private statusEl: HTMLSpanElement
  private meta2d: Meta2dLike | null = null
  private enabled = false
  private busy = false
  /** 最近一次完整报告，供「复制 JSON」使用 */
  private lastRaw: unknown = null

  /** 测量期间暂停背景负载（文本定时刷新），避免污染归因 */
  onMeasureStart?: () => void
  onMeasureEnd?: () => void

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'perf-panel'
    this.root.innerHTML = `
      <div class="perf-head">
        <span class="perf-title">性能探针</span>
        <span class="perf-status" id="perfStatus">未开启</span>
        <button class="perf-fold" id="perfFold" type="button" title="折叠">−</button>
      </div>
      <div class="perf-body" id="perfBody">
        <div class="perf-actions">
          <label class="perf-switch">
            <input type="checkbox" id="perfToggle"> 开启采集
          </label>
          <button class="perf-btn" id="perfGrid" type="button" disabled>网格体检</button>
          <button class="perf-btn" id="perfDrift" type="button" disabled>动画累积检测 (10s)</button>
          <button class="perf-btn" id="perfSweep" type="button" disabled>鼠标扫描 (3s)</button>
          <button class="perf-btn" id="perfXform" type="button" disabled>平移缩放 (3s)</button>
          <button class="perf-btn" id="perfPan" type="button" disabled>纯平移 (3s)</button>
          <button class="perf-btn" id="perfWheel" type="button" disabled>滚轮平移 (M12)</button>
          <button class="perf-btn" id="perfPatch" type="button" disabled>文本刷新 (M10)</button>
          <button class="perf-btn" id="perfInk" type="button" disabled>墨迹审计 (第 5 步)</button>
          <button class="perf-btn ghost" id="perfCopy" type="button" disabled>复制 JSON</button>
        </div>
        <div class="perf-actions perf-manual">
          <span class="perf-manual-label">手动验证</span>
          <button class="perf-btn" id="perfMode" type="button">模式：运行</button>
          <button class="perf-btn" id="perfCoalesce" type="button">拾取合并：开</button>
          <span class="perf-manual-hint" id="perfModeHint">悬停高亮可用；选中/拖拽需切到编辑</span>
        </div>
        <div class="perf-out" id="perfOut">
          <p class="perf-hint">勾选「开启采集」后再执行检测。探针关闭时零分配，不影响基线测量。</p>
        </div>
      </div>
    `
    this.body = this.root.querySelector('#perfBody') as HTMLDivElement
    this.statusEl = this.root.querySelector('#perfStatus') as HTMLSpanElement
    this.bind()
  }

  mount(parent: HTMLElement = document.body) {
    parent.appendChild(this.root)
  }

  /** 切库时调用：非 meta2d 传 null，面板自动隐藏并复位 */
  setMeta2d(m: Meta2dLike | null) {
    this.meta2d = m
    this.root.style.display = m ? '' : 'none'
    this.enabled = false
    const toggle = this.root.querySelector('#perfToggle') as HTMLInputElement
    toggle.checked = false
    this.syncButtons()
    this.syncMode()
    this.setStatus('未开启')
    this.out('<p class="perf-hint">勾选「开启采集」后再执行检测。探针关闭时零分配，不影响基线测量。</p>')
  }

  // ---------------------------------------------------------------- 交互

  private bind() {
    const q = <T extends HTMLElement>(id: string) => this.root.querySelector(id) as T

    q<HTMLButtonElement>('#perfFold').addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement
      const folded = this.body.classList.toggle('folded')
      btn.textContent = folded ? '+' : '−'
    })

    q<HTMLInputElement>('#perfToggle').addEventListener('change', (e) => {
      this.enabled = (e.currentTarget as HTMLInputElement).checked
      this.meta2d?.setOptions({ perfProbe: this.enabled })
      this.setStatus(this.enabled ? '采集中' : '未开启')
      this.syncButtons()
    })

    q<HTMLButtonElement>('#perfGrid').addEventListener('click', () => this.run(() => this.checkGrid()))
    q<HTMLButtonElement>('#perfDrift').addEventListener('click', () => this.run(() => this.checkDrift()))
    q<HTMLButtonElement>('#perfSweep').addEventListener('click', () => this.run(() => this.checkSweep()))
    q<HTMLButtonElement>('#perfXform').addEventListener('click', () => this.run(() => this.checkTransform()))
    q<HTMLButtonElement>('#perfPan').addEventListener('click', () => this.run(() => this.checkTransform(true)))
    q<HTMLButtonElement>('#perfWheel').addEventListener('click', () => this.run(() => this.checkWheelPan()))
    // ⚠ 唯一一个必须带着背景负载测的项：文本刷新本身就是被测对象
    q<HTMLButtonElement>('#perfPatch').addEventListener('click', () => this.run(() => this.checkPatch(), true))
    // ⚠ 这一项会**换掉整个场景**（跑完自动还原）。它不是性能项，读的是像素对不对
    q<HTMLButtonElement>('#perfInk').addEventListener('click', () => this.run(() => this.checkInkAudit()))

    q<HTMLButtonElement>('#perfCopy').addEventListener('click', () => {
      if (this.lastRaw) {
        navigator.clipboard.writeText(JSON.stringify(this.lastRaw, null, 2))
        this.setStatus('已复制')
      }
    })

    q<HTMLButtonElement>('#perfMode').addEventListener('click', () => {
      if (!this.meta2d) return
      this.setMode((this.meta2d.options?.mode ?? MODE_RUN) === MODE_EDIT ? MODE_RUN : MODE_EDIT)
    })

    q<HTMLButtonElement>('#perfCoalesce').addEventListener('click', () => {
      if (!this.meta2d) return
      this.meta2d.setOptions({ disablePickCoalescing: !this.meta2d.options?.disablePickCoalescing })
      this.syncMode()
    })
  }

  /**
   * 切换运行/编辑模式。
   *
   * 两个模式覆盖的是**不同的代码路径**，手动验证时都要过一遍：
   * - 运行：`handleMouseMove` 走 `else` 分支 ⇒ 每次移动都 `requestPick`，验的是 M9 合并后
   *   hover 跟不跟手。拖拽和框选在这个模式下被 `meta2d-mouse.ts:956` 关掉。
   * - 编辑：可选中、可拖拽 ⇒ 才会调到 `snapToPen`（M11-c 改的那处），验的是拖动图元时
   *   的对齐辅助线位置对不对。
   *
   * ⚠ 编辑模式下拖拽走的是 `CanvasDragPens` 分支，**不经过 `requestPick`**；
   *   所以「鼠标扫描」探针只在运行模式下测得到 M9，切到编辑模式再测数字会不一样。
   */
  private setMode(mode: number) {
    if (!this.meta2d) return
    this.meta2d.setMode(mode)
    this.syncMode()
  }

  private syncMode() {
    const btn = this.root.querySelector('#perfMode') as HTMLButtonElement
    const hint = this.root.querySelector('#perfModeHint') as HTMLSpanElement
    btn.disabled = !this.meta2d
    const edit = (this.meta2d?.options?.mode ?? MODE_RUN) === MODE_EDIT
    btn.textContent = edit ? '模式：编辑' : '模式：运行'
    btn.classList.toggle('on', edit)
    hint.textContent = edit
      ? '可选中/拖拽/框选 → 验 snapToPen 对齐线；此模式下拖拽不走拾取合并'
      : '悬停高亮可用；选中/拖拽需切到编辑'

    const cb = this.root.querySelector('#perfCoalesce') as HTMLButtonElement
    cb.disabled = !this.meta2d
    const off = !!this.meta2d?.options?.disablePickCoalescing
    cb.textContent = off ? '拾取合并：关' : '拾取合并：开'
    // 「关」= 偏离默认行为，标红提醒，免得拿着非默认配置去测性能
    cb.classList.toggle('on', off)
  }

  private syncButtons() {
    const on = this.enabled && !!this.meta2d && !this.busy
    for (const id of [
      '#perfGrid',
      '#perfDrift',
      '#perfSweep',
      '#perfXform',
      '#perfPan',
      '#perfWheel',
      '#perfPatch',
      '#perfInk',
    ]) {
      ;(this.root.querySelector(id) as HTMLButtonElement).disabled = !on
    }
    ;(this.root.querySelector('#perfCopy') as HTMLButtonElement).disabled = !this.lastRaw
  }

  /**
   * @param keepLoad 保留背景负载（文本定时刷新）。默认 false —— 绝大多数检测都要
   *   把它停掉避免污染归因；但「文本刷新 (M10)」的被测对象就是它，必须传 true。
   */
  private async run(fn: () => Promise<void>, keepLoad = false) {
    if (this.busy) return
    this.busy = true
    this.syncButtons()
    if (!keepLoad) this.onMeasureStart?.()
    try {
      await fn()
    } catch (err) {
      this.out(`<p class="perf-bad">采集失败：${String(err)}</p>`)
    } finally {
      if (!keepLoad) this.onMeasureEnd?.()
      this.busy = false
      this.syncButtons()
    }
  }

  private setStatus(s: string) {
    this.statusEl.textContent = s
  }

  private out(html: string) {
    ;(this.root.querySelector('#perfOut') as HTMLDivElement).innerHTML = html
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms))
  }

  // ---------------------------------------------------------------- 三个检测

  /** A + B：世界是否有界、轴向混算的空格率与占用 */
  private async checkGrid() {
    this.setStatus('采集网格…')
    const r = await this.meta2d!.getPerfReport({ reset: false })
    this.lastRaw = r
    const g = r.calc?.grid
    if (!g) {
      this.out('<p class="perf-bad">calc worker 未返回网格报告。确认已 open 数据且探针已开启。</p>')
      return
    }

    // 场景实际压到几列几行（网格原点可能与场景原点不重合）
    const span = (from: number, len: number, origin: number, limit: number) => {
      if (!g.cellSize) return limit
      const lo = Math.max(0, Math.floor((from - origin) / g.cellSize))
      const hi = Math.min(limit - 1, Math.floor((from + len - origin) / g.cellSize))
      return Math.max(1, hi - lo + 1)
    }
    const coveredCols = span(g.sceneX, g.sceneW, g.originX, g.cols)
    const coveredRows = span(g.sceneY, g.sceneH, g.originY, g.rows)
    const entryPerPen = g.avgCellsPerPen

    const rows: Row[] = [
      { label: '图元总数 n', value: fmt(g.penCount, 0) },
      {
        label: '世界矩形 (S)',
        value: `${fmt(g.sceneW, 0)} × ${fmt(g.sceneH, 0)}`,
        note: '定尺画布 = (0,0,W,H)；自适应 = 全部 pen 的 AABB 并集',
      },
      {
        label: '网格矩形 (extent)',
        value: `${fmt(g.extentW, 0)} × ${fmt(g.extentH, 0)}`,
        note: '大于世界矩形即轴向混算',
      },
      { label: '格边长 cellSize', value: fmt(g.cellSize, 1) },
      { label: '格数 cols × rows', value: `${g.cols} × ${g.rows} = ${fmt(g.totalCells, 0)}` },
      {
        label: '实际覆盖世界的格数',
        value: `${coveredCols} × ${coveredRows} = ${fmt(coveredCols * coveredRows, 0)}`,
      },
      {
        label: '空格率 deadCellRatio',
        value: pct(g.deadCellRatio),
        expect: '< 15%',
        pass: g.deadCellRatio < 0.15,
        note: g.deadCellRatio > 0.5 ? '§0.4-B 轴向混算确认' : undefined,
      },
      {
        label: '平均占用 occupancy.avg',
        value: fmt(g.occupancy?.avg, 1),
        expect: '≤ 32',
        pass: (g.occupancy?.avg ?? 0) <= 32,
      },
      { label: 'p95 占用', value: fmt(g.occupancy?.p95, 0), expect: '≤ 64', pass: (g.occupancy?.p95 ?? 0) <= 64 },
      { label: '最大占用', value: fmt(g.occupancy?.max, 0) },
      {
        label: '溢出桶长度',
        value: fmt(g.overflowBucket, 0),
        expect: '= 0',
        pass: g.overflowBucket === 0,
        note: '§0.4-A：世界有界 ⇒ 建索引时无界外图元',
      },
      {
        label: '未索引图元占比',
        value: pct(g.unindexedRatio),
        expect: '= 0',
        pass: !g.unindexedRatio,
        note: g.unindexedRatio ? '这些 pen 能渲染但拾取不到' : undefined,
      },
      {
        label: 'undefined 入桶数',
        value: fmt(g.undefinedEntries, 0),
        expect: '= 0',
        pass: !g.undefinedEntries,
        note: 'H2：update() 里 grid[i].push(p) 的 p 恒为 undefined',
      },
      // 第 5.19 步：逐（图元, 格子）对账。上面的「未索引」只问在不在**某个**格子里，查不出 D35 那一类
      ...(() => {
        const it = g.integrity
        if (!it) return [] as Row[]
        const s = (k: string) => (it.samples?.[k]?.length ? `（例：${it.samples[k].join(', ')}）` : '')
        return [
          {
            label: '★★ 完整性：该在却不在的（图元, 格子）',
            value: `${fmt(it.missing, 0)} 对 / ${fmt(it.missingPens, 0)} 个图元`,
            expect: '= 0',
            pass: it.missing === 0,
            note: `会导致重画 / 拾取查不到它 —— D35（多选拖拽删掉邻居）就是这一类${s('missing')}`,
          },
          {
            label: '★★ 完整性：越出网格却不在溢出桶',
            value: fmt(it.outsideNoOverflow, 0),
            expect: '= 0',
            pass: it.outsideNoOverflow === 0,
            note: `越界那一部分永远查不到。initPickGrid 调 add(pen, true)，在进溢出桶之前就 return 了${s('outsideNoOverflow')}`,
          },
          {
            label: '★★ 完整性：多余登记 / 同格重复 / penMap 已无 / 几何漂移的副本',
            value: `${fmt(it.extra, 0)} / ${fmt(it.dup, 0)} / ${fmt(it.notInMap, 0)} / ${fmt(it.copyDrift, 0)}（副本 ${fmt(
              it.copies,
              0,
            )}）`,
            expect: '全 0',
            pass: !it.extra && !it.dup && !it.notInMap && !it.copyDrift,
            note: `多余与重复只会多画、不会漏画；重复来自 updatePenCell 跨多格时每个旧格各插一次${s('extra')}${s('dup')}${s(
              'notInMap',
            )}${s('copyDrift')}`,
          },
          {
            label: '★★ 完整性：同 id 各格登记不是同一对象 / 其中几何对不上 · 副本在溢出桶',
            value: `${fmt(it.splitIds, 0)} / ${fmt(it.splitDrift, 0)} · ${fmt(it.copiesInOverflow, 0)}`,
            expect: '= 0',
            pass: !it.splitIds,
            note: `不拿 penMap 当真值：D38（动画路径用临时对象更新网格、且按新位置算旧格子）会让 penMap 那个对象本身变成停在旧格子里的幽灵，\
这时上面几行都以它为准、看不见；只有「同一个 id 在各处是否是同一个对象」看得见${s('splitDrift')}`,
          },
          ...(it.recordMismatch != undefined
            ? [
                {
                  label: '★★ 完整性：登记记录与实际登记不符 / 记录里残留的已删 id',
                  value: `${fmt(it.recordMismatch, 0)} / ${fmt(it.recordOrphans, 0)}`,
                  expect: '= 0',
                  pass: !it.recordMismatch && !it.recordOrphans,
                  note: `第 5.23 步起「它现在在哪」查记录、不再从传进来的几何现算 —— 记录错了，删除就会落空${s(
                    'recordMismatch',
                  )}${s('recordOrphans')}`,
                } as Row,
              ]
            : []),
          {
            label: '完整性（设计缺口）：旋转后伸进没登记的格子',
            value: `${fmt(it.rotUncovered, 0)} / ${fmt(it.rotPens, 0)} 个带旋转的图元`,
            note: `add() 注明「暂时没有考虑旋转」：格子只按未旋转的框登记。不是维护错误，是口径缺口，单独报${s(
              'rotUncovered',
            )}`,
          },
        ]
      })(),
      {
        label: '平均跨格数 entryCount / n',
        value: fmt(entryPerPen, 2),
        expect: '≈ 2.25',
        pass: entryPerPen <= 4,
        note: '用「动画累积检测」看它是否随时间上涨',
      },
      { label: '图元长边 p50 / p95 / max', value: `${fmt(g.size?.p50)} / ${fmt(g.size?.p95)} / ${fmt(g.size?.max)}` },
      {
        label: '跨格数 p50 / p95 / max',
        value: `${fmt(g.sizeInCells?.p50, 0)} / ${fmt(g.sizeInCells?.p95, 0)} / ${fmt(g.sizeInCells?.max, 0)}`,
        expect: 'p95 ≤ 32',
        pass: (g.sizeInCells?.p95 ?? 0) <= 32,
        note: 'p95 > 32 才需要 oversized 表 / 粗层（索引设计 §4.3）',
      },
      {
        label: '长边 > cellSize 的图元数',
        value: `${fmt(g.oversizedPens, 0)}（${pct(g.penCount ? g.oversizedPens / g.penCount : 0)}）`,
        note: '这些必然跨 ≥4 格；占比高说明定尺偏小',
      },
    ]

    // 对照：正确定尺应该是什么
    const S = Math.max(1, g.sceneW * g.sceneH)
    const idealByTarget = Math.sqrt(S / Math.max(1, Math.ceil(g.penCount / 1000)))
    const idealByT32 = Math.max(Math.sqrt((32 * S) / Math.max(1, g.penCount)), g.size?.p50 ?? 0, 8)
    const cells = (c: number) => Math.ceil(g.sceneW / c) * Math.ceil(g.sceneH / c)

    this.out(`
      ${this.table('网格体检', rows)}
      <div class="perf-sub">对照：同样数据下不同定尺的结果</div>
      ${this.table('', [
        {
          label: '现状（轴向混算）',
          value: `c=${fmt(g.cellSize)}，${fmt(g.totalCells, 0)} 格，占用 ${fmt(g.occupancy?.avg)}`,
        },
        {
          label: 'H3 仅修轴向混算（保留 n/1000 目标）',
          value: `c=${fmt(idealByTarget)}，${fmt(cells(idealByTarget), 0)} 格，占用 ${fmt(
            g.penCount / Math.max(1, cells(idealByTarget))
          )}`,
          note: '约 5 行改动',
        },
        {
          label: 'Phase 2 完整定尺 (T=32)',
          value: `c=${fmt(idealByT32)}，${fmt(cells(idealByT32), 0)} 格，占用 ${fmt(
            g.penCount / Math.max(1, cells(idealByT32))
          )}`,
        },
      ])}
    `)
    this.setStatus('网格体检完成')
  }

  /**
   * C：跑 10 秒动画，对比前后的「平均跨格数」。
   * updatePenCell 每次跨格移动会多推 (oldCells.length - 1) 份重复引用，
   * 若该 bug 成立，entryCount / penCount 会单调上涨。
   */
  private async checkDrift() {
    const SECONDS = 10
    this.setStatus('采样 A…')
    const a = (await this.meta2d!.getPerfReport({ reset: true })).calc?.grid
    if (!a) {
      this.out('<p class="perf-bad">calc worker 未返回网格报告。</p>')
      return
    }

    for (let i = SECONDS; i > 0; i--) {
      this.setStatus(`动画累积中… ${i}s`)
      await this.sleep(1000)
    }

    this.setStatus('采样 B…')
    const rB = await this.meta2d!.getPerfReport({ reset: false })
    this.lastRaw = { A: a, B: rB }
    const b = rB.calc?.grid
    if (!b) {
      this.out('<p class="perf-bad">第二次采样未返回网格报告。</p>')
      return
    }

    const ea = a.penCount ? a.entryCount / a.penCount : 0
    const eb = b.penCount ? b.entryCount / b.penCount : 0
    const grew = eb - ea
    const growPct = ea ? grew / ea : 0
    // 图元数没变却多出条目 ⇒ 只可能是重复插入
    const samePenCount = a.penCount === b.penCount
    const confirmed = samePenCount && grew > 0.01

    const rows: Row[] = [
      { label: '图元数 A → B', value: `${fmt(a.penCount, 0)} → ${fmt(b.penCount, 0)}`, note: samePenCount ? '未变' : '变了，本次结论不可用' },
      { label: '桶内条目 entryCount A → B', value: `${fmt(a.entryCount, 0)} → ${fmt(b.entryCount, 0)}` },
      {
        label: '平均跨格数 A → B',
        value: `${fmt(ea, 3)} → ${fmt(eb, 3)}（${grew >= 0 ? '+' : ''}${fmt(grew, 3)}，${pct(growPct)}）`,
        expect: '不变',
        pass: !confirmed,
      },
      { label: '平均占用 A → B', value: `${fmt(a.occupancy?.avg)} → ${fmt(b.occupancy?.avg)}` },
      { label: '最大占用 A → B', value: `${fmt(a.occupancy?.max, 0)} → ${fmt(b.occupancy?.max, 0)}` },
      {
        label: `${SECONDS}s 内 calc 收到的消息`,
        value: fmt(rB.calc?.message?.total, 0),
      },
    ]

    const verdict = !samePenCount
      ? '<p class="perf-hint">采样期间图元数发生变化，请停止文本刷新后重测。</p>'
      : confirmed
        ? `<p class="perf-bad">§0.4-C 确认：图元数未变，平均跨格数却涨了 ${pct(growPct)}。
           按此速率外推，桶长会持续膨胀，拾取与范围查询随动画时长单调劣化。建议先做 Phase H 的 H1。</p>`
        : `<p class="perf-ok">本轮未观察到累积。可能是动画图元未发生跨格移动（位移 ${'<'} 格边长）——
           把动画数量或位移调大后重测，或确认 H1 已修复。</p>`

    this.out(this.table(`动画累积检测（${SECONDS}s）`, rows) + verdict)
    this.setStatus('累积检测完成')
  }

  /**
   * 合成 mousemove 横扫画布，量拾取耗时与消息扇出。
   *
   * ⚠ 派发必须用定时器而不是 rAF：rAF 天然每帧一次，会把「每帧拾取几次」这个
   * 待测量恒等于 1，测不出 G3 / M9 的收益。真实鼠标是 125~1000Hz，与刷新率无关，
   * 所以这里按 4ms 派发（250Hz），另用 rAF 单独数帧，两者相除才是每帧拾取次数。
   */
  private async checkSweep() {
    const el = this.meta2d!.topElement
    if (!el) {
      this.out('<p class="perf-bad">拿不到 meta2d.topElement。</p>')
      return
    }
    const rect = el.getBoundingClientRect()

    this.setStatus('清空计数…')
    await this.meta2d!.getPerfReport({ reset: true })

    this.setStatus('鼠标扫描中…')
    const DURATION = 3000
    const DISPATCH_MS = 4
    let dispatched = 0
    let frames = 0
    const t0 = performance.now()

    await new Promise<void>((resolve) => {
      // 数帧（只数，不派发）
      const countFrame = () => {
        if (performance.now() - t0 >= DURATION) return
        frames++
        requestAnimationFrame(countFrame)
      }
      requestAnimationFrame(countFrame)

      const timer = window.setInterval(() => {
        const t = performance.now() - t0
        if (t >= DURATION) {
          clearInterval(timer)
          return resolve()
        }
        // 斜向来回扫，尽量多穿过不同的格
        const u = (t % 1000) / 1000
        const ox = rect.width * (u < 0.5 ? u * 2 : 2 - u * 2)
        const oy = rect.height * (t / DURATION)
        const ev = new MouseEvent('mousemove', {
          clientX: rect.left + ox,
          clientY: rect.top + oy,
          bubbles: true,
          cancelable: true,
        })
        // handleMouseMove 走的是 e.offsetX/offsetY，合成事件上必须显式给
        Object.defineProperty(ev, 'offsetX', { value: ox })
        Object.defineProperty(ev, 'offsetY', { value: oy })
        el.dispatchEvent(ev)
        dispatched++
      }, DISPATCH_MS)
    })

    const r = await this.meta2d!.getPerfReport({ reset: false })
    this.lastRaw = { sweep: { dispatched, frames, durationMs: DURATION }, ...r }
    const t = r.calc?.timing ?? {}
    const m = r.calc?.message

    const pick = t['pick'] as Stats | undefined
    const perFramePick = frames ? (pick?.count ?? 0) / frames : 0
    const rows: Row[] = [
      {
        label: '派发事件数 / 实际帧数',
        value: `${fmt(dispatched, 0)} / ${fmt(frames, 0)}`,
        note: `${DISPATCH_MS}ms 定时派发（模拟 250Hz 鼠标），rAF 独立数帧`,
      },
      {
        label: '每帧拾取次数（G3）',
        value: fmt(perFramePick, 2),
        expect: '≤ 1',
        pass: perFramePick <= 1.2,
        note: perFramePick > 1.2 ? 'M9 输入帧合并的收益 = 这个倍数' : undefined,
      },
      {
        label: 'pick 次数',
        value: fmt(pick?.count, 0),
        note: `${fmt((pick?.count ?? 0) / (DURATION / 1000), 0)} 次/秒`,
      },
      {
        label: 'pick 耗时 avg / p95 / max (µs)',
        value: `${fmt(pick?.avg)} / ${fmt(pick?.p95)} / ${fmt(pick?.max)}`,
        expect: 'p95 ≤ 3µs',
        pass: (pick?.p95 ?? 0) <= 3,
      },
      {
        label: 'calc → 主线程 每帧消息数 avg / p95 / max',
        value: `${fmt(m?.perFrame?.avg)} / ${fmt(m?.perFrame?.p95, 0)} / ${fmt(m?.perFrame?.max, 0)}`,
        expect: '1',
        pass: (m?.perFrame?.avg ?? 0) <= 1.5,
        note: '主线程还会向 render + hover 各转发一次 ⇒ ×3',
      },
      { label: 'calc 发出消息总数', value: fmt(m?.total, 0), note: `窗口 ${fmt(m?.windowMs, 0)}ms` },
      {
        label: 'hover 整屏 clearRect 次数',
        value: fmt((r.hover?.timing?.['count:hoverFullRender'] as Stats | undefined)?.count, 0),
        note: 'M5 目标：改成局部重绘',
      },
      {
        label: 'calcInViewPens 耗时 avg / p95 (µs)',
        value: `${fmt((t['calcInViewPens'] as Stats | undefined)?.avg)} / ${fmt(
          (t['calcInViewPens'] as Stats | undefined)?.p95
        )}`,
        note: 'M7：每次平移/缩放步全量扫 penMap',
      },
      { label: '视口内图元数 avg', value: fmt((t['inViewCount'] as Stats | undefined)?.avg, 0) },
    ]

    this.out(
      this.table(`鼠标扫描（${DURATION / 1000}s）`, rows) +
        '<div class="perf-sub">按 action 分解（calc worker）</div>' +
        this.actionTable(r.calc) +
        this.renderBlock(r.render)
    )
    this.setStatus('扫描完成')
  }

  /**
   * M7 / G5：平移 + 缩放，量视口裁剪的成本。
   *
   * 「鼠标扫描」测不到这条 —— TranslateScale 只由 translate()/scale() 发出，
   * 而 benchmark 里的矩形 locked:0，拖拽走的是移动图元而不是平移画布。
   * 所以这里直接调 API：translateCanvas 每帧走一步，每 10 帧叠一次缩放，来回抖动使
   * scale 不漂移。
   *
   * ⚠ **这一项测不到 M12**。M12 之后公开 API `translateCanvas` 是同步执行的（`fitView`
   * 里紧跟 `scaleCanvas` 不能延后一帧），根本不经过 `requestTranslate` ⇒ 这里的
   * 「通过率」恒为 100%，什么也没验证。验 M12 用「滚轮平移 (M12)」那一项。
   *
   * ⚠ **`pureOnly = true` 是另一个场景（「纯平移 (3s)」），不是同一个场景的变体。**
   * 第十一轮发现：混着缩放跑时，41 条视口里有 **27 条**因为 `scale` 变了而无法走 M7a 的
   * 搬运快路径（`view:full:sig`，次数与 `scaleCalls = 28` 对得上），M7a 的命中率只有 34%；
   * 而缩放和平移的优化路径完全不同（缩放必须重采样，归 M8/LOD）。
   * 一个场景同时压两条路，读出来的是两者的加权平均，**对谁都不是验收依据**。
   * 所以 `pureOnly` 跳过 `m2d.scale()`，只留平移 —— M7a 的门槛压在这一项上；
   * 带缩放那一项则退化为 M8 的靶子。见文档 §0.5-H15 ④。
   */
  private async checkTransform(pureOnly = false) {
    const m2d = this.meta2d!
    if (typeof m2d.translateCanvas !== 'function') {
      this.out('<p class="perf-bad">当前 meta2d 版本没有 translateCanvas()。</p>')
      return
    }
    const scale0 = m2d.data?.scale ?? 1
    const x0 = m2d.data?.x ?? 0
    const y0 = m2d.data?.y ?? 0

    this.setStatus('清空计数…')
    await m2d.getPerfReport({ reset: true })

    const NAME = pureOnly ? '纯平移' : '平移缩放'
    this.setStatus(`${NAME}中…`)
    const DURATION = 3000
    let panCalls = 0
    let scaleCalls = 0
    let frames = 0
    const t0 = performance.now()

    await new Promise<void>((resolve) => {
      const step = () => {
        const t = performance.now() - t0
        if (t >= DURATION) return resolve()
        frames++
        // 折线平移：每 500ms 换向，保证视口内图元集合不断变化
        const dir = Math.floor(t / 500) % 2 ? -1 : 1
        m2d.translateCanvas(dir * 12, dir * 8)
        panCalls++
        // 每 10 帧缩放一步，偶/奇交替放大缩小，净变化约为 0
        if (!pureOnly && frames % 10 === 0) {
          m2d.scale(scale0 * (frames % 20 === 0 ? 1 : 1.1))
          scaleCalls++
        }
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })

    // 复位视口，别把 benchmark 的画面留在偏移状态
    m2d.scale(scale0)
    m2d.translateCanvas(x0 - (m2d.data?.x ?? 0), y0 - (m2d.data?.y ?? 0))

    const r = await m2d.getPerfReport({ reset: false })
    // 两个场景用不同的 key，免得复制出来的 JSON 分不清是哪一项（第十一轮就差点混起来）
    const key = pureOnly ? 'purePan' : 'transform'
    this.lastRaw = { [key]: { panCalls, scaleCalls, frames, durationMs: DURATION }, ...r }
    const t = r.calc?.timing ?? {}
    const msg = r.calc?.message

    const view = t['calcInViewPens'] as Stats | undefined
    const inView = t['inViewCount'] as Stats | undefined
    const h16 = t[`handle:${WorkerMessage.TranslateScale}`] as Stats | undefined
    const recv16 = (t[`count:recv:${WorkerMessage.TranslateScale}`] as Stats | undefined)?.count
    const n = r.calc?.grid?.penCount ?? 0
    // 全量扫 penMap 的单位成本，用来外推到 100 万
    const perPenNs = view?.avg && n ? (view.avg * 1000) / n : undefined

    const rows: Row[] = [
      {
        label: 'translateCanvas / scale 调用次数',
        value: `${fmt(panCalls, 0)} / ${fmt(scaleCalls, 0)}`,
        note: `${fmt(frames, 0)} 帧；M12 之后 translateCanvas 同步执行、不节流${
          pureOnly
            ? '。<b>本项不缩放</b> ⇒ M7a 的搬运快路径应当近乎全命中（看下面的「纯平移判定命中 / 退回」）'
            : '。混了缩放 ⇒ M7a 会在每次 scale 变化处退回全量重绘，这一项是 M8 的靶子而非 M7a 的'
        }`,
      },
      {
        label: 'calc 实收 TranslateScale',
        value: fmt(recv16, 0),
        note: recv16
          ? `通过率 ${pct(recv16 / Math.max(1, panCalls + scaleCalls))} —— 编程式调用恒为 100%，M12 看「滚轮平移」那一项`
          : '零样本 ⇒ 消息没到 calc，本轮 M7 仍未测出',
      },
      {
        label: 'handle:TranslateScale avg / p95 / max (µs)',
        value: `${fmt(h16?.avg)} / ${fmt(h16?.p95)} / ${fmt(h16?.max)}`,
        expect: 'p95 ≤ 500µs',
        pass: h16 ? (h16.p95 ?? 0) <= 500 : undefined,
        note: '整个平移/缩放处理，含 calcInViewPens',
      },
      {
        label: 'calcInViewPens avg / p95 / max (µs)',
        value: `${fmt(view?.avg)} / ${fmt(view?.p95)} / ${fmt(view?.max)}`,
        expect: 'p95 ≤ 200µs',
        pass: view ? (view.p95 ?? 0) <= 200 : undefined,
        note: 'M7：每步全量扫 penMap，O(n) 而非 O(视口内)',
      },
      {
        label: '单 pen 扫描成本',
        value: perPenNs == undefined ? '—' : `${fmt(perPenNs, 0)} ns（n=${fmt(n, 0)}）`,
        note:
          perPenNs == undefined
            ? undefined
            : `外推 100 万 pen ≈ ${fmt((perPenNs * 1e6) / 1e6, 1)}ms/步 ⇒ ${
                (perPenNs * 1e6) / 1e6 > 16.7 ? 'G5 不达标，M7 必须做' : 'G5 仍有余量'
              }`,
      },
      {
        label: '视口内图元数 avg / max',
        value: `${fmt(inView?.avg, 0)} / ${fmt(inView?.max, 0)}`,
        note: n ? `占总数 ${pct((inView?.avg ?? 0) / n)}；这个比例就是 M7 的理论收益倍数` : undefined,
      },
      {
        label: 'calc → 主线程 每帧消息数 avg / p95 / max',
        value: `${fmt(msg?.perFrame?.avg)} / ${fmt(msg?.perFrame?.p95, 0)} / ${fmt(msg?.perFrame?.max, 0)}`,
        expect: '1',
        pass: (msg?.perFrame?.avg ?? 0) <= 1.5,
      },
      { label: 'calc 发出消息总数', value: fmt(msg?.total, 0), note: `窗口 ${fmt(msg?.windowMs, 0)}ms` },
      {
        label: 'hover 整屏 clearRect 次数',
        value: fmt((r.hover?.timing?.['count:hoverFullRender'] as Stats | undefined)?.count, 0),
        note: 'M5：平移期间 hover 层是否也在整屏重绘',
      },
      // ── 第 4.8 步：calc 的 rAF 动画循环。它不经过 self.onmessage ⇒
      //    此前完全落在 handle:* 之外，是 calc 那 35ms probe:lag 的嫌疑人 ──
      ...(() => {
        const at = (k: string) => r.calc?.timing?.[k] as Stats | undefined
        const loop = at('anim:loop')
        const players = at('anim:players')
        const msgs = at('anim:msgs')
        // 第 5.14 步：anim:loop 拆三段（µs/趟），剩余 = 逐播放器的计算
        const lB = at('anim:loopBoundary')
        const lP = at('anim:loopPost')
        const lQ = at('anim:loopProbe')
        // 第 5.15 步：getPensInPenBoundary 每趟扫了什么
        const bCalls = at('anim:bCalls')
        const bCells = at('anim:bCells')
        const bItems = at('anim:bCellItems')
        const bRot = at('anim:bRotated')
        const bOver = at('anim:bOverflow')
        const bText = at('anim:bText')
        const bHits = at('anim:bHits')
        const civ = at('calcInViewPens')
        if (!(loop?.count ?? 0)) return [] as Row[]
        const loopTotal = ((loop?.avg ?? 0) * (loop?.count ?? 0)) / 1000
        const hAll = Object.entries(r.calc?.timing ?? {}).reduce((acc, [k, v]) => {
          if (!/^handle:\d+$/.test(k)) return acc
          const s = v as Stats
          return acc + (s.avg * s.count) / 1000
        }, 0)
        const penCount = r.calc?.grid?.penCount ?? 0
        return [
          {
            label: '★★ calc 动画循环 anim:loop (ms/趟 · 总计)',
            value: `${fmt((loop?.avg ?? 0) / 1000, 2)} × ${fmt(loop?.count, 0)} 趟 = ${fmt(
              loopTotal,
              0,
            )}ms`,
            note: `每趟 ${fmt(players?.avg, 0)} 个播放器、发 ${fmt(
              msgs?.avg,
              0,
            )} 条 RenderAnimation（p95 ${fmt(msgs?.p95, 0)}）。\
<b>这一段由 requestAnimationFrame 驱动，不经过 onmessage ⇒ 此前完全落在 handle:* 之外</b>：\
Σhandle:* 只有 ${fmt(hAll, 0)}ms，加上这 ${fmt(loopTotal, 0)}ms 才是 calc 的真实占用。\
calc 的 probe:lag 一直对不上账（第十五轮 35ms vs 11% 占用），差的就是它`,
          },
          ...(lB?.count
            ? (() => {
                const L = loop?.avg ?? 0
                const b = lB?.avg ?? 0
                const p = lP?.avg ?? 0
                const q = lQ?.avg ?? 0
                const rest = L - b - p - q
                const sameN = lB.count === (loop?.count ?? 0) && lP?.count === lB.count && lQ?.count === lB.count
                const share = (v: number) => pct(v / Math.max(1, L))
                return [
                  {
                    label: '★★ anim:loop 拆账：查格子 / postMessage / 探针自身 / 剩余计算（ms/趟）',
                    value: `${fmt(b / 1000, 2)} (${share(b)}) / ${fmt(p / 1000, 2)} (${share(p)}) / ${fmt(
                      q / 1000,
                      2,
                    )} (${share(q)}) / ${fmt(rest / 1000, 2)} (${share(rest)})${
                      sameN ? '' : '　【⚠ 四栏采样趟数不同 ⇒ 相减读不得】'
                    }${rest < 0 ? '　【⚠ 剩余为负 ⇒ 计时量化误差吃掉了结论，这一行作废】' : ''}`,
                    pass: !sameN || rest < 0 ? false : undefined,
                    note: `<b>M4（按帧合并）只改「每个播放器一条消息」</b>：${fmt(
                      msgs?.avg,
                      0,
                    )} 条变 1 条，省的是 postMessage 那一栏（以及主线程转发、render/hover 各自的逐条固定开销）。<b>查格子</b>那一栏 M4 不一定省 —— 合并前仍要知道每个脏区盖住了谁。<b>剩余</b>那一栏 M4 完全不碰。⇒ 哪一栏最大，calc 这条饱和线程的下一刀就落在哪里。探针自身那一栏是量出来的虚胖，关探针时不存在`,
                  },
                  ...(bCalls?.count
                    ? (() => {
                        const n = Math.max(1, bCalls?.avg ?? 0)
                        const per = (v?: Stats) => (v?.avg ?? 0) / n
                        const scanned = per(bItems) + per(bOver) + per(bText)
                        const unitNs = (b / n) * 1000 / Math.max(1, scanned)
                        const yard = civ?.avg && penCount ? (civ.avg * 1000) / penCount : undefined
                        const callsOk = (bCalls?.avg ?? 0) === (msgs?.avg ?? -1) && bCalls.count === (loop?.count ?? 0)
                        return [
                          {
                            label: '★★ 查格子每次扫了什么：格子数 / 格内图元 / 其中带旋转 / 溢出桶 / textBoxs / 命中',
                            value: `${fmt(per(bCells), 2)} / ${fmt(per(bItems), 0)} / ${fmt(per(bRot), 0)} / ${fmt(
                              per(bOver),
                              0,
                            )} / ${fmt(per(bText), 0)} / ${fmt(per(bHits), 1)}　⇒　${fmt(
                              scanned,
                              0,
                            )} 次判定/次查询，折合 ${fmt(unitNs, 1)} ns/判定（同轮标尺 calcInViewPens ${fmt(
                              yard,
                              1,
                            )} ns/图元）${callsOk ? '' : '　【⚠ 查询次数 ≠ 消息条数 ⇒ 有别的调用混进来，读不得】'}`,
                            pass: callsOk ? undefined : false,
                            note: `三种解释、三种修法：<b>格内图元</b>大 ⇒ 网格太粗，细分；<b>textBoxs</b> 大 ⇒ 它每次全扫、与查询位置无关，单独建索引；<b>单价</b>远高于标尺且<b>带旋转</b>多 ⇒ rectInRect 对旋转图元每次都 rectToPoints + getRectOfPoints，缓存旋转外接盒。⚠ 数旋转要多扫一遍格子，所以开着这组探针时查格子那一栏会略高`,
                          },
                          // 第 5.16 步：textBoxs 走索引。影子比对是这一步「输出逐位不变」的唯一现场证据
                          (() => {
                            const ct = (k: string) =>
                              (r.calc?.timing?.[k] as Stats | undefined)?.count ?? 0
                            const shadow = ct('count:pick:textShadow')
                            const shadowBad = ct('count:pick:textShadowBad')
                            const stale = ct('count:pick:textStale')
                            const fb = at('anim:bTextFallback')
                            const sh = at('anim:bShadow')
                            return {
                              label: '★★ textBoxs 索引（第 5.16 步）：影子比对 次数 / 不一致 · 陈旧自愈 · 退回全扫',
                              value: `${fmt(shadow, 0)} / ${fmt(shadowBad, 0)} · ${fmt(stale, 0)} · ${fmt(
                                per(fb),
                                2,
                              )} 次/查询　（影子那一遍每次查询摊 ${fmt(per(sh), 0)} 次判定，不在上一行的 textBoxs 里）`,
                              expect: '不一致 = 0，且影子次数 > 0',
                              pass: shadowBad > 0 ? false : shadow > 0 ? true : undefined,
                              note: `开探针时每 32 次查询顺带跑一次原来的全扫、逐项比对 id 与 index 的顺序。<b>不一致只要出现一次，这一步就是错的，回滚</b>。\
陈旧自愈 = 候选里出现了已删除的 id（有一处写 textBoxs 没标脏）⇒ 那一次退回全扫，结果仍对，但漏标的地方要找出来。\
影子次数为 0 ⇒ 这一轮没有证据，不能判通过`,
                            } as Row
                          })(),
                        ]
                      })()
                    : []),
                ]
              })()
            : []),
        ] as Row[]
      })(),
    ]

    const verdict = recv16
      ? ''
      : `<p class="perf-bad">calc 没收到 TranslateScale。检查 setOptions({ perfProbe: true }) 是否在 open 之后、
         以及 data.locked 是否阻止了平移。</p>`

    this.out(
      this.table(`${NAME}（${DURATION / 1000}s）`, rows) +
        verdict +
        '<div class="perf-sub">按 action 分解（calc worker）</div>' +
        this.actionTable(r.calc) +
        this.renderBlock(r.render) +
        // 主线程的窗口得自己传：它没有 message.windowMs（见 mainRows 的注释）
        this.mainBlock(r.main, DURATION)
    )
    this.setStatus(`${NAME}完成`)
  }

  /**
   * M12 验收：滚轮平移。
   *
   * **为什么不能用「平移缩放 (3s)」测 M12。** 那一项调的是公开 API
   * `meta2d.translateCanvas(x, y)`，而 M12 刻意让编程式调用保持**同步**
   * （`fitView` 里紧跟 `scaleCanvas` 不能延后一帧）⇒ 它根本不经过
   * `requestTranslate`，测出来永远是 100% 通过，什么也没验证。
   *
   * **而且原来的验收指标「节流通过率」已经不存在了** —— 那个 30ms 节流被整个
   * 删掉了，没有「通过率」可言。所以这里换成两个等价但可测的判据：
   *
   * 1. **生效次数 / 帧数 ≈ 1.0**（改前 33Hz / 120Hz ≈ 0.28）。
   *    数法：`setViewPosition` 每次都 `emit('translate')`，监听即可。
   * 2. **位移守恒 = 100%**（改前约 33%，2/3 的滚动量被静默吞掉）。
   *    这条是**正确性**判据，不是耗时判据 —— 不受 100µs 计时器精度影响，
   *    也不受机器快慢影响，是这次验收里最硬的一个数。
   *
   * 分两段反向滚动，每段自己算守恒率，结束时视口回到原位。
   */
  private async checkWheelPan() {
    const m2d = this.meta2d!
    const el = m2d.topElement
    if (!el) {
      this.out('<p class="perf-bad">拿不到 meta2d.topElement。</p>')
      return
    }
    // handleWheel 要求 e.target === topElement，且状态机空闲
    const rect = el.getBoundingClientRect()
    const DISPATCH_MS = 4 // 250Hz，与「鼠标扫描」一致
    const PHASE_MS = 700
    const STEP = 2 // px/事件，整数以免 (dx*scale)|0 的截断混进守恒率

    await m2d.getPerfReport({ reset: true })

    let applied = 0
    const onTranslate = () => {
      applied++
    }
    m2d.on('translate', onTranslate)

    /** 单向滚一段，返回 {派发数, 期望位移, 实际位移, 生效次数, 帧数} */
    const phase = async (sign: number) => {
      const x0 = m2d.data.x
      const y0 = m2d.data.y
      const scale = m2d.data.scale
      applied = 0
      let dispatched = 0
      let frames = 0
      // 「有输入待处理的帧数」—— applied 的理论上限。
      //
      // 不能拿 applied / frames 判定：setInterval 在主线程被动画洪流挤住时抖动很大，
      // 实测 700ms 只派发出 104 个事件（149Hz，不是 250Hz），于是约 13% 的帧里
      // 压根没有事件到达，那些帧本来就不该有平移生效。拿 frames 当分母会把
      // 「输入没来」误判成「合并把它吃了」。
      let framesWithInput = 0
      let hadInput = false
      const t0 = performance.now()

      await new Promise<void>((resolve) => {
        const countFrame = () => {
          if (performance.now() - t0 >= PHASE_MS) return
          frames++
          if (hadInput) {
            framesWithInput++
            hadInput = false
          }
          requestAnimationFrame(countFrame)
        }
        requestAnimationFrame(countFrame)

        const timer = window.setInterval(() => {
          if (performance.now() - t0 >= PHASE_MS) {
            clearInterval(timer)
            return resolve()
          }
          const ev = new WheelEvent('wheel', {
            // handleWheel 取 -deltaX/-deltaY 作为位移 ⇒ 取负号使画布朝 sign 方向走
            deltaX: -sign * STEP,
            deltaY: -sign * STEP,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          })
          el.dispatchEvent(ev)
          dispatched++
          // 置位 → 下一帧的计数回调消费它。少了这一行 framesWithInput 恒为 0。
          hadInput = true
        }, DISPATCH_MS)
      })

      // 冲刷可能挂起的最后一帧
      await new Promise<void>((r) => requestAnimationFrame(() => r()))

      const expect = dispatched * sign * STEP * scale
      return {
        dispatched,
        applied,
        frames,
        framesWithInput,
        expect,
        gotX: m2d.data.x - x0,
        gotY: m2d.data.y - y0,
      }
    }

    this.setStatus('滚轮平移 →')
    const a = await phase(1)
    this.setStatus('滚轮平移 ←')
    const b = await phase(-1)
    m2d.off('translate', onTranslate)

    const r = await m2d.getPerfReport({ reset: false })
    this.lastRaw = { wheelPan: { a, b }, ...r }

    const sum = (k: 'dispatched' | 'applied' | 'frames' | 'framesWithInput') => a[k] + b[k]
    // 守恒率按绝对值累加，两段反向不会互相抵消
    const expectAbs = Math.abs(a.expect) + Math.abs(b.expect)
    const gotAbs = Math.abs(a.gotX) + Math.abs(b.gotX)
    const keep = expectAbs ? gotAbs / expectAbs : 0
    // 分母是「有输入到达的帧」而不是全部帧 —— 见 phase() 里 framesWithInput 的注释
    const perInputFrame = sum('framesWithInput') ? sum('applied') / sum('framesWithInput') : 0
    const perFrame = sum('frames') ? sum('applied') / sum('frames') : 0
    const coalesce = sum('applied') ? sum('dispatched') / sum('applied') : 0
    const recv16 = (r.calc?.timing?.[`count:recv:${WorkerMessage.TranslateScale}`] as Stats | undefined)?.count
    const h16 = r.calc?.timing?.[`handle:${WorkerMessage.TranslateScale}`] as Stats | undefined

    const rows: Row[] = [
      {
        label: 'wheel 事件派发数 / 实际帧数',
        value: `${fmt(sum('dispatched'), 0)} / ${fmt(sum('frames'), 0)}`,
        note: `${DISPATCH_MS}ms 定时派发（250Hz），两段各 ${PHASE_MS}ms 反向`,
      },
      {
        label: '★ 位移守恒率',
        value: `${pct(keep)}（期望 ${fmt(expectAbs, 0)}px，实际 ${fmt(gotAbs, 0)}px）`,
        expect: '= 100%',
        pass: keep >= 0.99 && keep <= 1.01,
        note:
          keep < 0.9
            ? '有位移被丢弃 —— 这是 30ms 节流的症状，M12 应该已经消除'
            : '滚轮/双指是纯增量语义，合并时必须累加而不是覆盖',
      },
      {
        label: '★ 生效平移次数 / 有输入的帧数',
        value: `${fmt(perInputFrame, 2)}（${fmt(sum('applied'), 0)} / ${fmt(sum('framesWithInput'), 0)}）`,
        expect: '≈ 1.0',
        // 分母为 0 是探针坏了，不是系统不达标 —— 不要打 ✗ 冒充结论
        pass: sum('framesWithInput') ? perInputFrame >= 0.9 && perInputFrame <= 1.1 : undefined,
        note: !sum('framesWithInput')
          ? '⚠ 分母零样本 ⇒ 这一行无效，不是「不达标」'
          : perInputFrame < 0.5
            ? `仍被限流在 ${fmt(sum('applied') / ((PHASE_MS * 2) / 1000), 0)}Hz 左右`
            : '有输入的帧恰好各生效一次 ⇒ 跟随刷新率，不再写死 33Hz',
      },
      {
        label: '（参考）生效次数 / 全部帧数',
        value: `${fmt(perFrame, 2)}（空转 ${fmt(sum('frames') - sum('framesWithInput'), 0)} 帧）`,
        note: '空转帧 = setInterval 被主线程挤住、那一帧根本没有事件到达，不是合并吃掉的',
      },
      {
        label: '合并比（派发 / 生效）',
        value: fmt(coalesce, 2),
        note: '250Hz 输入 ÷ 屏幕刷新率；120Hz 屏应 ≈ 2.1，60Hz 屏应 ≈ 4.2',
      },
      {
        label: '实际平移帧率',
        value: `${fmt(sum('applied') / ((PHASE_MS * 2) / 1000), 0)} Hz`,
        note: `对照：改前写死 33Hz；本机 rAF 实测 ${fmt(sum('frames') / ((PHASE_MS * 2) / 1000), 0)}Hz`,
      },
      {
        label: 'calc 实收 TranslateScale',
        value: fmt(recv16, 0),
        note: recv16 ? `= 生效次数 ${fmt(sum('applied'), 0)} 则链路无额外放大` : '零样本 ⇒ 消息没到 calc',
      },
      {
        // ⚠ 这一行不是 M12 的判据：M12 决定「一帧发几条」，这里量的是「calc 收到一条
        // 要花多久」，后者由 calcInViewPens 全量遍历 22200 个图元决定 ⇒ 属于 M7。
        // 放在这里只是顺手看一眼平移链路的下游成本，别名的达标与否算在 M7 头上。
        label: 'handle:TranslateScale avg / p95 (µs)　※M7 的指标',
        value: `${fmt(h16?.avg)} / ${fmt(h16?.p95)}`,
        note: 'M11 改前这里是 273ms/步；剩下的是 calcInViewPens 的全量遍历（M7 视口裁剪）',
      },
      {
        label: '分段明细（→ / ←）',
        value: `守恒 ${pct(a.expect ? Math.abs(a.gotX / a.expect) : 0)} / ${pct(
          b.expect ? Math.abs(b.gotX / b.expect) : 0
        )}`,
        note: `生效 ${fmt(a.applied, 0)}/${fmt(a.frames, 0)} 帧 · ${fmt(b.applied, 0)}/${fmt(b.frames, 0)} 帧`,
      },
    ]

    this.out(
      this.table('滚轮平移（M12 验收）', rows) +
        `<p class="perf-hint">带 ★ 的两行是 M12 的判据。位移守恒率是正确性指标，不受机器快慢与
         100µs 计时器精度影响 —— 它不达标就是 bug，不是「性能不够」。</p>` +
        this.renderBlock(r.render)
    )
    this.setStatus('滚轮平移完成')
  }

  /**
   * M10 验收：文本刷新（`setValue` → `patchQueue` → 一条 Patch 带 2000 个图元）。
   *
   * **这一项必须带着背景负载测**（`run(fn, true)`），因为被测对象就是那个每秒一次的
   * 文本刷新定时器 —— 其余检测都会先 `stopTextUpdate()`。
   *
   * 除了 `handle:Patch` 的耗时，还读三个**机制**指标，用来区分「数字变小了」和
   * 「改对了」：
   * - `patch:rectPens` —— 本批里真正改了几何的图元数。改 `patchFlag` 来源之前
   *   它恒等于 `patch:pens`（`Rect` 恒为真），之后纯文本更新应该是 **0**。
   * - `patch:reuseRegion` / `patch:calls` —— 新旧脏区复用命中率，应 ≈ 100%。
   * - `boundaryScan` / `patch:calls` —— 每次 Patch 扫了几遍全场景，2 → **1**。
   * - `patch:skipOldPass` —— Phase 1.0a：复用命中时不发 old 那一组，render 少画一整遍
   *   （实测省 35.1ms / 次）。要和 render 侧的 `count:patch:samePass` 归零对着看。
   */
  private async checkPatch() {
    const m2d = this.meta2d!
    const SECONDS = 5

    this.setStatus('清空计数…')
    await m2d.getPerfReport({ reset: true })

    for (let i = SECONDS; i > 0; i--) {
      this.setStatus(`文本刷新采集中… ${i}s`)
      await this.sleep(1000)
    }

    const r = await m2d.getPerfReport({ reset: false })
    this.lastRaw = { patch: { durationMs: SECONDS * 1000 }, ...r }
    const t = r.calc?.timing ?? {}
    const st = (k: string) => t[k] as Stats | undefined

    const hPatch = st(`handle:${WorkerMessage.Patch}`)
    const hText = st(`handle:${WorkerMessage.TextOutside}`)
    const calls = st('count:patch:calls')?.count ?? 0
    const reuse = st('count:patch:reuseRegion')?.count ?? 0
    const scans = st('count:boundaryScan')?.count ?? 0
    const skipOld = st('count:patch:skipOldPass')?.count ?? 0
    const pens = st('patch:pens')
    const rectPens = st('patch:rectPens')
    const indexPens = st('patch:indexPens')
    const boundary = st('getPensInPenBoundary')
    const apply = st('patch:apply')
    const post = st('patch:post')
    const penIds = st('patch:penIds')

    if (!calls) {
      this.out(
        `<p class="perf-bad">${SECONDS}s 内 calc 一次 Patch 都没收到。确认文本刷新已开启
         （主面板的 textRefreshInterval），且当前库是 meta2d。</p>`
      )
      return
    }

    const reuseRate = reuse / calls
    const scanPerCall = scans / calls
    const rows: Row[] = [
      {
        label: `${SECONDS}s 内 Patch 批次数`,
        value: fmt(calls, 0),
        note: `每批 ${fmt(pens?.avg, 0)} 个图元（max ${fmt(pens?.max, 0)}）；setValue 经 patchQueue 按帧聚批`,
      },
      {
        label: '★ handle:Patch avg / p95 / max (µs)',
        value: `${fmt(hPatch?.avg)} / ${fmt(hPatch?.p95)} / ${fmt(hPatch?.max)}`,
        expect: 'avg < 3000µs',
        pass: (hPatch?.avg ?? Infinity) < 3000,
        note: `改前实测 61,000µs（61ms）；当前 ${fmt((hPatch?.avg ?? 0) / 1000, 1)}ms`,
      },
      {
        label: 'handle:TextOutside avg / p95 (µs)',
        value: `${fmt(hText?.avg)} / ${fmt(hText?.p95)}`,
        expect: 'avg < 1000µs',
        pass: hText ? (hText.avg ?? Infinity) < 1000 : undefined,
        note: '改前实测 4,810µs',
      },
      {
        label: '★ 真正改了几何的图元数 patch:rectPens',
        value: `${fmt(rectPens?.avg, 1)} / 批（max ${fmt(rectPens?.max, 0)}）`,
        expect: '= 0',
        pass: (rectPens?.max ?? 1) === 0,
        note:
          (rectPens?.max ?? 1) === 0
            ? 'patchFlag 现在按「这次改了什么」算 ⇒ 纯文本更新不再维护索引'
            : '仍有图元被判为改了几何 —— 若本批确实只改 text，说明 flag 来源还没修对',
      },
      {
        label: '改了层级的图元数 patch:indexPens',
        value: `${fmt(indexPens?.avg, 1)} / 批`,
        expect: '= 0',
        pass: (indexPens?.max ?? 1) === 0,
        note: 'Index 置位会让 penIds 的排序失效 ⇒ 新旧脏区不可复用',
      },
      {
        label: '★ 脏区复用命中率',
        value: `${pct(reuseRate)}（${fmt(reuse, 0)} / ${fmt(calls, 0)}）`,
        expect: '≈ 100%',
        pass: reuseRate >= 0.95,
        note: '无增删、无几何/层级变化 ⇒ 新旧 penIds 逐位相同，省掉第二次全场景扫描',
      },
      {
        label: '每批全场景扫描次数',
        value: fmt(scanPerCall, 2),
        expect: '= 1',
        pass: scanPerCall <= 1.05,
        note: '改前 2（oldPens 与 newPens 各一次）',
      },
      {
        // Phase 1.0a：脏区复用命中时不再把 oldPensIds/oldBoundary 发给 render，
        // render 的 `if (e.data.oldBoundary)` 自然跳过那一遍白画。
        // 这一行是「机制生效了」的正向信号，配合 render 侧 count:patch:samePass 归零看。
        label: '★ 跳过 render 白画一遍 patch:skipOldPass',
        value: `${fmt(skipOld, 0)} / ${fmt(calls, 0)}`,
        expect: '= 脏区复用命中数',
        pass: skipOld === reuse,
        note:
          skipOld === reuse
            ? '实测 render 侧 patch:old 这一遍要 35.1ms，占 handle:Patch 的 48%，现已省掉'
            : '与复用命中数不符 —— 说明 newPenIds 为空（本批没有 update）或条件写错了',
      },
      {
        label: 'getPensInPenBoundary avg / p95 / max (µs)',
        value: `${fmt(boundary?.avg)} / ${fmt(boundary?.p95)} / ${fmt(boundary?.max)}`,
        note: `${fmt(boundary?.count, 0)} 次；2000 个文本的并集 = 整个世界 ⇒ 退化成扫全部格子（M2/DirtyRegion 的活）`,
      },
      {
        // 首轮实测 handle:Patch 17.0ms 而 getPensInPenBoundary 只占 4.9ms ⇒ 12ms 无归属。
        // 下面三行就是为了把这 12ms 落到具体的段上，而不是继续猜。
        label: '　├ patch:apply avg (µs)',
        value: fmt(apply?.avg),
        note: '逐图元 patchClone + Object.assign + 索引维护（rectPens=0 时不含 updatePenCell）',
      },
      {
        label: '　└ patch:post avg (µs)',
        value: fmt(post?.avg),
        note: `postMessage 的结构化克隆；随行 newPenIds ${fmt(penIds?.avg, 0)} 个 id + 四个图元数组 ⇒ 这一段大就是 M3（协议 v2）的依据`,
      },
      {
        label: '未归属耗时 = handle:Patch − 上面三段 (µs)',
        value: fmt(
          (hPatch?.avg ?? 0) - (boundary?.avg ?? 0) * scanPerCall - (apply?.avg ?? 0) - (post?.avg ?? 0)
        ),
        note: '剩得多说明还有没埋点的热点（如 remove/beforeUpdate 的 getCells）',
      },
      {
        label: 'calc → 主线程 每帧消息数 avg / p95 / max',
        value: `${fmt(r.calc?.message?.perFrame?.avg)} / ${fmt(r.calc?.message?.perFrame?.p95, 0)} / ${fmt(
          r.calc?.message?.perFrame?.max,
          0
        )}`,
        note: '这里仍含动画的 RenderAnimation 洪流，是 Phase 1 的指标，不是 M10 的',
      },
    ]

    const verdict =
      (rectPens?.max ?? 1) === 0 && (hPatch?.avg ?? Infinity) < 3000
        ? `<p class="perf-ok">M10 达标：纯文本更新不再触发索引维护（rectPens = 0），
           脏区复用命中 ${pct(reuseRate)}，handle:Patch ${fmt((hPatch?.avg ?? 0) / 1000, 2)}ms。</p>`
        : (rectPens?.max ?? 1) === 0
          ? `<p class="perf-bad">机制生效了（rectPens = 0）但耗时仍高 ⇒ 剩下的开销不在索引维护。
             分段：扫描 ${fmt(boundary?.avg)}µs × ${fmt(scanPerCall, 1)}/批 ·
             apply ${fmt(apply?.avg)}µs · post ${fmt(post?.avg)}µs。
             最大的一段决定下一步：扫描 ⇒ M2/DirtyRegion；post ⇒ M3/协议 v2。都不是 M10 的范围。</p>`
          : `<p class="perf-bad">rectPens ≠ 0 ⇒ 仍有图元被判为改了几何。检查
             meta2d.ts valsToPens 的 patchFlag 是否在读 val 而不是 pen。</p>`

    this.out(
      this.table(`文本刷新（M10 验收，${SECONDS}s，背景负载保持开启）`, rows) +
        verdict +
        '<div class="perf-sub">按 action 分解（calc worker）</div>' +
        this.actionTable(r.calc) +
        this.renderBlock(r.render)
    )
    this.setStatus('文本刷新完成')
  }

  /**
   * 第 5 步的取证场景：**一类墨迹一个场景**，铺在「接下来这几步平移会扫过的那片世界」上。
   *
   * 两个设计点决定了这个场景能不能取到证：
   * - **图元必须压在窄带的边界上。** 漏选只可能发生在那里：pen 的矩形在窄带外、墨迹却伸进
   *   窄带 ⇒ 窄带重绘时它没入选 ⇒ 少画。铺在视口正中间的图元一个都测不到 ——
   *   它们的像素是搬过来的，本来就对。
   * - **每行错开 13px、每列错开 11px。** 一步平移里，几百个图元就给出几百个不同的
   *   「矩形边界距窄带边界多远」，必有若干落在几个像素之内。不错开的话整张网格与窄带
   *   步长同相，可能整轮都没有一个图元卡在临界位置上 —— 那时读到的 0 差异是假的。
   */
  private inkScene(kind: InkKind, view: { left: number; top: number; w: number; h: number }) {
    const pens: any[] = []
    const GAP = 110
    // 平移 (+INK_DX, +INK_DY) 是把「视口左上方」那片世界扫进来，所以往左上多铺出这么多
    const x0 = view.left - INK_STEPS * INK_DX - INK_SIZE * 2
    const y0 = view.top - INK_STEPS * INK_DY - INK_SIZE * 2
    const cols = Math.ceil((view.left + view.w - x0) / GAP)
    const rows = Math.ceil((view.top + view.h - y0) / GAP)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * GAP + r * 13
        const y = y0 + r * GAP + c * 11
        const id = `ink-${kind.key}-${r}-${c}`
        const pen: any = {
          id,
          type: 'rectangle',
          x,
          y,
          width: INK_SIZE,
          height: INK_SIZE,
          ex: x + INK_SIZE,
          ey: y + INK_SIZE,
          pivot: { x: x + INK_SIZE / 2, y: y + INK_SIZE / 2 },
          rotate: 0,
          background: '#58cc84',
          color: '#2e7d5b',
          locked: 0,
        }
        kind.style(pen)
        pens.push(pen)
      }
    }
    return pens
  }

  /**
   * **M7a 第 5 步的取证**（`options.pixelAudit`）：快路径画出来的像素 vs 慢路径基准，逐像素比。
   *
   * 这一项不是性能项 —— 它回答的是「窄带里该画的都画了吗」。之所以必须造新场景：
   * 第 3 步数出来的 `view:bandRotated` = 0，现有 benchmark 的 1.87 万个图元里
   * **一个 rotate / shadow / 粗描边 / 外溢文本 / 带箭头连线都没有** ⇒ 拿它测等于没测
   * （文档 §0.5-H 第 5 步那一行）。这里一类一个场景轮着跑，差异就能归到 `inkBox` 的
   * 某一个分支上，第 5 步只写审计证明有必要的那几个分支。
   *
   * 三处读法上的要紧事：
   * - **窄带内 / 窄带外要分开看。** 窄带内 = 漏选（`inkBoxMin` 没算到这类墨迹）；
   *   窄带外 = 要么是搬运本身错了（对照组会同时脏），要么是**窄带的 clip 把入选图元
   *   伸出窄带的那部分墨迹裁掉了** —— 后者是第 5 步的第二件事：光把图元选进来不够，
   *   clip 也得放大到墨迹范围。对照组干净而特殊类窄带外脏，就是这第二件事的证据。
   * - **0 差异要有自检才算结论。** 一类读到 0，可能是 `INK_PAD_MIN = 2` 刚好盖住了，
   *   也可能是这一类墨迹压根没画出来（pen 字段写错）。所以每一类都同时报
   *   `render:penCount:audit`（基准真的画了几个图元）和这一类的溢出量估值。
   * - **不要拿这一项的耗时当性能数。** 每条审计读两次整屏 ImageData + 全量重绘一遍，
   *   比被测的快路径贵两个数量级。
   */
  private async checkInkAudit() {
    const m2d = this.meta2d!
    // 跑完要还原现场：getData() 是 structuredClone 出来的深拷贝，可以原样喂回 open()
    const saved = m2d.getData()
    // open() 固定把视口复位成 x=0 / y=0 / scale=1（meta2d.ts:899），这里再显式写一遍，
    // 场景的坐标就完全可算：世界原点 = 视口左上角
    const view = {
      left: 0,
      top: 0,
      w: m2d.topElement.clientWidth,
      h: m2d.topElement.clientHeight,
    }

    type KindResult = {
      kind: InkKind
      pens: number
      views: number
      skipViews: number
      clean: number
      textOutside: number
      diff?: Stats
      ppm?: Stats
      inBand?: Stats
      outBand?: Stats
      maxDelta?: Stats
      boxW?: Stats
      boxH?: Stats
      penCount?: Stats
      cost?: Stats
      /** 第 5 步：重画区四块各自脏了多少（v = 进入侧含 pad，vx = 离开侧，h/hx 同理横向） */
      legs?: Record<string, Stats | undefined>
      /** 重画区**外**那些差异的包围盒。贴着重画区内边 = pad 不够宽；散在四处 = 搬运错了 */
      oBoxW?: Stats
      oBoxH?: Stats
      padDev?: Stats
      /** 第 5.1 步：差异的**方向**。miss = 快路径这里比慢路径空（漏画），extra = 比它实（多画） */
      miss?: Stats
      extra?: Stats
      /** alpha 相同、只是颜色不同 ⇒ 同一块墨迹画得不一样（抗锯齿/模糊的后端差异全落这档） */
      tint?: Stats
      /** 第 5.9 步（D28）：miss/extra 里 alpha 差 ≥ 128 的那一档 ⇒ 真·墨迹漏了/多了，验收看这两个 */
      missBig?: Stats
      extraBig?: Stats
      /** 选取集 vs 基准集的差集（**图元个数**，不是像素）。它直接指认 miss/extra 的来源 */
      selMiss?: Stats
      selExtra?: Stats
      /** 漏选是被哪一条子句挡下的：Size = `width/height < 2`，Out = 矩形越界（⇒ 两条路的框不同） */
      selMissSize?: Stats
      selMissOut?: Stats
      /** 越界了多少世界单位。≈ 箭头/描边溢出量 ⇒ calc 那份框被放大过；≈ 0 ⇒ 边界取整/异步错位 */
      selMissGap?: Stats
      /** 越界在哪条边上。只脏一条 ⇒ 视口本身差了一点；四条散着脏 ⇒ 每个 pen 的框两边不一样 */
      selMissL?: Stats
      selMissR?: Stats
      selMissT?: Stats
      selMissB?: Stats
      /** **真实位移往返自拷贝**前后的差异（内区）。手算答案已知 = 0；非 0 ⇒ blit 搬一次损一次 */
      selfBlit?: Stats
      selfBlitMax?: Stats
      /** 往返内区的面积（设备像素）。它太小则上一项的 0 说明不了什么 */
      rtArea?: Stats
      /** 两条路各自认为的画布 CSS 宽高（× 1000），相减 ⇒ 视口到底差不差。与视口位置无关 */
      viewR?: Stats
      viewB?: Stats
      calcViewR?: Stats
      calcViewB?: Stats
      /** 亚像素相位残差（设备像素 × 1000）。0 ⇒ 搬运是相位精确的 */
      resX1k?: Stats
      resY1k?: Stats
      /** 尺子自己的噪声底：同一条视口画两遍全量，逐像素比。它是 `diff` 的**下限** */
      selfPx?: Stats
      selfMax?: Stats
      /** 第三遍 vs 第二遍，只在噪声底非 0 的条上才有。0 ⇒ 只有第一遍是异类 */
      selfPx2?: Stats
      selfMax2?: Stats
      /** 平移等变性：换个设备位置画同一批图元再搬回来。手算答案 = 0 */
      posShift?: Stats
      posMax?: Stats
      /** posShift 里「快路径空、基准有墨」的那一档。≈ posShift ⇒ 比对窗口取错了（D27） */
      posMiss?: Stats
      /** 单程有效区面积。与 rtArea 数值相同，只作分母 */
      posArea?: Stats
      /** 第 5.8 步：给 posShift 与 diff 同一套拆分 —— 窄带内/外、方向。形状对不上就别比大小 */
      posIn?: Stats
      posOut?: Stats
      posExtra?: Stats
      posTint?: Stats
      /** 第 5.10 步：两个实验是不是在**同一批像素**上看见差异。posOnly 大 ⇒ 位置实验在自造差异 */
      posBoth?: Stats
      posOnly?: Stats
      /**
       * 第 5.11 步：带外差异里**位置实验真正检查过**的那一部分（同域的分母，D31）。
       * `outBand` 是整屏的，位置实验只看单程有效区 ⇒ 用 outBand 当分母会把
       * 「实验没看过的那条边」算成「解释不了」。
       */
      outWin?: Stats
      /** 三方都解释不了的那一部分。恒等式 outWin = posBoth + setPxRes + unexp */
      unexp?: Stats
      /** 第 5.11 步：位置不动、把图元集合退回上一条视口（2×2 的最后一格）。单位是**像素** */
      setPx?: Stats
      setPxIn?: Stats
      setPxOut?: Stats
      setPxMax?: Stats
      setPxBoth?: Stats
      /** 位置解释不了、但集合能解释的那一部分残差 */
      setPxRes?: Stats
      /** 相邻两条视口的图元集合差（个数，不是像素） */
      setGone?: Stats
      setNew?: Stats
    }
    const results: KindResult[] = []

    try {
      for (const kind of INK_KINDS) {
        this.setStatus(`墨迹审计：${kind.label}…`)
        await m2d.getPerfReport({ reset: true })

        const pens = this.inkScene(kind, view)
        m2d.open({ x: 0, y: 0, scale: 1, pens })
        await this.sleep(500)

        // open 之后的第一次全量重绘里，render 会把「文字超出 pen 范围」的那几个
        // 用 TextOutside(31) 告诉 calc（worker.ts:1838）。这是外溢文本那一类
        // 「墨迹真的溢出了」的铁证，而它**每个 pen 只发一次**（textLines 算过就不再算），
        // 所以必须在审计开始之前先把这一段计数收掉。
        const r0 = await m2d.getPerfReport({ reset: true })
        const textOutside =
          (r0.calc?.timing?.[`count:recv:${WorkerMessage.TextOutside}`] as Stats | undefined)?.count ?? 0

        // 每条快路径视口都审 ⇒ 每次差异只可能由那一步的窄带造成。审计最后会用全量重绘
        // 把画面修正回来，所以上一步的残缺不会累积到下一步的读数里。
        m2d.setOptions({ pixelAudit: INK_STEPS, pixelAuditTol: 0 })
        // setOptions 会顺带 resetRender（paintedX = NaN）⇒ 紧接着的第一条视口是全量重绘、
        // 不产生审计。所以走 INK_STEPS + 1 步，审到的正好是后面那 INK_STEPS 条快路径。
        for (let i = 0; i <= INK_STEPS; i++) {
          m2d.translateCanvas(INK_DX, INK_DY)
          await this.sleep(280)
        }
        m2d.setOptions({ pixelAudit: 0 })

        const r = await m2d.getPerfReport({ reset: false })
        const t = r.render?.timing ?? {}
        const st = (k: string) => t[k] as Stats | undefined
        // calc 的读数在另一张表里（报告按 worker 分开）。第 5.3 步要把两条路各自算的
        // 视口边界相减，必须显式去 calc 那张表取，混用 st() 会静默读到 undefined。
        const tc = r.calc?.timing ?? {}
        const stc = (k: string) => tc[k] as Stats | undefined
        results.push({
          kind,
          pens: pens.length,
          views: st('count:audit:views:pure')?.count ?? 0,
          skipViews: st('count:audit:views:skip')?.count ?? 0,
          clean: st('count:audit:clean:pure')?.count ?? 0,
          textOutside,
          diff: st('audit:diffPx:pure'),
          ppm: st('audit:diffPpm:pure'),
          inBand: st('audit:inBand:pure'),
          outBand: st('audit:outBand:pure'),
          maxDelta: st('audit:maxDelta:pure'),
          boxW: st('audit:boxW:pure'),
          boxH: st('audit:boxH:pure'),
          penCount: st('render:penCount:audit'),
          cost: st('audit:cost'),
          legs: {
            v: st('audit:leg:v:pure'),
            vx: st('audit:leg:vx:pure'),
            h: st('audit:leg:h:pure'),
            hx: st('audit:leg:hx:pure'),
          },
          oBoxW: st('audit:oBoxW:pure'),
          oBoxH: st('audit:oBoxH:pure'),
          padDev: st('audit:padDev:pure'),
          miss: st('audit:miss:pure'),
          extra: st('audit:extra:pure'),
          tint: st('audit:tint:pure'),
          missBig: st('audit:missBig:pure'),
          extraBig: st('audit:extraBig:pure'),
          selMiss: st('audit:selMiss:pure'),
          selExtra: st('audit:selExtra:pure'),
          selMissSize: st('audit:selMissSize:pure'),
          selMissOut: st('audit:selMissOut:pure'),
          selMissGap: st('audit:selMissGap:pure'),
          selMissL: st('audit:selMissL:pure'),
          selMissR: st('audit:selMissR:pure'),
          selMissT: st('audit:selMissT:pure'),
          selMissB: st('audit:selMissB:pure'),
          selfBlit: st('audit:selfBlit:pure'),
          selfBlitMax: st('audit:selfBlitMax:pure'),
          rtArea: st('audit:rtArea:pure'),
          viewR: st('audit:cw1k:pure'),
          viewB: st('audit:ch1k:pure'),
          calcViewR: stc('calc:cw1k'),
          calcViewB: stc('calc:ch1k'),
          resX1k: st('view:resX1k'),
          resY1k: st('view:resY1k'),
          selfPx: st('audit:selfPx:pure'),
          selfMax: st('audit:selfMax:pure'),
          selfPx2: st('audit:selfPx2:pure'),
          selfMax2: st('audit:selfMax2:pure'),
          posShift: st('audit:posShift:pure'),
          posMax: st('audit:posMax:pure'),
          posMiss: st('audit:posMiss:pure'),
          posArea: st('audit:posArea:pure'),
          posIn: st('audit:posIn:pure'),
          posOut: st('audit:posOut:pure'),
          posExtra: st('audit:posExtra:pure'),
          posTint: st('audit:posTint:pure'),
          posBoth: st('audit:posBoth:pure'),
          posOnly: st('audit:posOnly:pure'),
          outWin: st('audit:outWin:pure'),
          unexp: st('audit:unexp:pure'),
          setPx: st('audit:setPx:pure'),
          setPxIn: st('audit:setPxIn:pure'),
          setPxOut: st('audit:setPxOut:pure'),
          setPxMax: st('audit:setPxMax:pure'),
          setPxBoth: st('audit:setPxBoth:pure'),
          setPxRes: st('audit:setPxRes:pure'),
          setGone: st('audit:setGone:pure'),
          setNew: st('audit:setNew:pure'),
        })
      }
    } finally {
      // 不管中途出什么事都要把用户的场景还回去，否则面板上留下的是审计网格
      this.setStatus('还原场景…')
      m2d.open(saved)
    }

    this.lastRaw = { inkAudit: results.map((x) => ({ ...x, kind: x.kind.key })) }

    // 必须与 render worker 里那个 `BIG_DELTA` 同值 —— 它在那边切 missBig/extraBig，
    // 这边拿它切 maxDelta，两边用的不是同一个门槛就等于两个数不在同一件事上算（D27 那一课）。
    const BIG_DELTA = 128

    const rows: Row[] = results.map((x) => {
      const inB = x.inBand?.avg ?? 0
      const outB = x.outBand?.avg ?? 0
      const miss = x.miss?.max ?? 0
      const extra = x.extra?.max ?? 0
      const missBig = x.missBig?.max ?? 0
      const extraBig = x.extraBig?.max ?? 0
      const maxDelta = x.maxDelta?.max ?? 0
      const posOut = x.posOut?.avg ?? 0
      const posBoth = x.posBoth?.avg ?? 0
      const setRes = x.setPxRes?.avg ?? 0
      const unexp = x.unexp?.avg ?? 0
      const outWin = x.outWin?.avg ?? 0
      const selMiss = x.selMiss?.max ?? 0
      const selExtra = x.selExtra?.max ?? 0
      const selfPx = x.selfPx?.avg ?? 0
      const legs = ['v', 'vx', 'h', 'hx']
        .map((k) => `${k} ${fmt(x.legs?.[k]?.avg, 0)}`)
        .join(' · ')
      // ⚠ 验收口径在第十七轮**更正过**（原先是「差异 = 0 @ tol 0」）：那个口径把
      // 「墨迹漏画」和「同一份内容画两遍不一样」混成了一个数。rotate 差 5159 px 而
      // 单通道最大偏差只有 1、shadow 差 19302 px 最大偏差 4 —— 少画一个图元的偏差是
      // 255（line 那一行正是）⇒ 这两类差的根本不是墨迹，是尺子自己不重复。
      // **不是把容差放大了事**（那是事后改口径），而是把噪声底**量出来**当下限，
      // 并且把判据换成「方向」：漏画 0、多画 0、选取集无差，剩下的才允许落在噪声底里。
      // ⚠ **D26（第 5.7 步）：尺子不稳的时候不许下判决。** 噪声底非 0 = 同一条视口、同一批
      // 图元画两遍都不一样 ⇒ 这一类的**像素**读数（漏画 / 多画 / 总差异 / 最大偏差）全部
      // 失去意义，它既证明不了快路径对、也证明不了它错。此前这一行照样判「通过」——
      // 那是「把『不知道』渲染成『知道』」的第四次重犯（D6/D10/D24 一族），第二十轮
      // rotate 噪声底 8px/Δ255 时它就是这么判的。
      // 判 `undefined`（仅供参考）而不是 `false`：这不是被测物不达标，是**没有结论**。
      // 但选取集那两个数是按**图元个数**算的、根本不经过像素 ⇒ 尺子抖不影响它们，
      // 它们非 0 仍然直接判不通过（不许让「尺子坏了」把一个真缺陷洗成「不知道」）。
      // ⚠ **D28（第 5.9 步）：方向判据是幅度盲的。** `miss` 只问「快路径这里的 alpha 是不是更小」，
      // 不问小多少 —— 抗锯齿边差 1 和整个图元没画差 255 在这一列里长得一样。实测两者之间
      // 隔着 60 倍（rotate 的 607 个漏画全是 Δ≤1、shadow 的 9525 个全是 Δ≤4，line 的 1941 个是 Δ255），
      // 所以「漏画 = 0」这个口径要么把 rotate 判成缺陷，要么就得放宽 tol —— 后者是验收口径②
      // 明令禁止的事后改口径。按结论 35 换判据（方向 + 集合 + **最大偏差**）才是正路。
      //
      // 像素那一支的判据因此换成 `maxDelta < 128`：**不是** missBig/extraBig。
      // 理由是后者会漏掉一整类缺陷 —— alpha 相同、颜色差 255（画错色、搬花了），
      // 那是 tint 不是 miss/extra。而 `maxDelta` 覆盖全部四个通道 ⇒ 任何一个像素只要差得
      // 像「少了个图元」，这一行立刻不通过。missBig/extraBig 不进判据、只进读数：
      // 它们的职责是在不通过时说清楚是**哪一类**大偏差（漏 / 多 / 抖色），
      // 以及在通过时证明这刀确实切在空隙上（`miss` 很大而 `missBig` = 0 ⇒ 全是抗锯齿边）。
      //
      // ⚠ 但「小偏差不算缺陷」这份宽容不是白给的，**要由平移等变性那一行挣来**：
      // 只有当「换个设备位置画同一批图元」能复现出同一批带外差异（`posOut` 与 `outBand` 同量级）时，
      // 才有资格说这些差异是光栅化的固有限制而不是搬运的错。复现不出来 ⇒ 这些差异**来路不明**，
      // 判 `undefined`（不判决），不许拿「反正偏差小」把「不知道」渲染成「知道」（D26 一族）。
      // 区间取 [0.5, 2] 倍：这是一个**同量级**检查，刻意粗 —— 它要抓的是第二十三轮 shadow
      // 那种 4.27 倍的形状错位，不是给等变性打分。
      // ⚠ 光比个数还不够（第 5.10 步）：两堆差异**个数相当**完全可以是两拨互不相交的像素，
      // 那时「谁解释谁」这个问法本身就不成立，而只看比值的自检一个字都不会动 ——
      // 正是验收口径㉑ 那个毛病。所以下界改用交集 `posBoth`（同一批像素上两遍都有差异，
      // 同样只统计带外），上界仍用总量 `posOut`（防止位置实验自造出一大堆别处的差异）。
      const noiseFloor = x.selfPx?.max ?? 0
      const setClean = selMiss === 0 && selExtra === 0
      const bigPix = maxDelta >= BIG_DELTA
      const posExplains = outB === 0 || (posBoth >= 0.5 * outB && posOut <= 2 * outB)
      // ⚠ 第 5.11 步：上面这个比值站不站得住，先由两条**恒等式**说话（结论 38 的伴随读数）。
      //   ① `outWin === outBand`：手算过 —— 新暴露带 ⊆ 重画区 ⇒ 带外 ⊆ 画布 − 新暴露带
      //      = 单程有效区 ⇒ 两个域本来就重合，比值的分母**没有**虚高。不等 ⇒ 重画区没盖住
      //      新暴露带（真缺陷）或有效区又推错了（D27）。
      //   ② `posBoth + setPxRes + unexp === outWin`：带外差异的三方记账互斥且穷尽 ——
      //      位置解释掉的、集合额外解释掉的、谁都解释不了的。不等 ⇒ 记账本身写错了。
      // 两条都是**逐位相等**的已知答案，不留余量；只有平均值分母（采样条数）不同时不比，
      // 以及 ② 要留浮点余量（三个平均值相加 ≠ 和的平均值，例如 1/6+2/6+3/6 ≠ 1）。
      // 任一条不成立 ⇒ 判 `undefined`：先查尺子，不改结论（结论 38 那支「以上皆非」）。
      const sameN = (x.outWin?.count ?? 0) === (x.outBand?.count ?? 0)
      const tally = posBoth + setRes + unexp
      // ⚠ **D31（第二十五轮实测命中）：两条恒等式成立，也不代表归属读得出来。**
      // 集合实验要求「上一条视口正好是前一条」（`prevViewSeq === viewSeq - 1`），
      // 一旦某条视口把两步并成一步（主线程合帧），这一条就没有集合读数 —— 而三方记账
      // 是**按视口累加**的，那一条的 `outWin − posBoth` 会**整份落进 `unexp`**。
      // 于是 `unexp` 同时装着两种东西：「位置和集合都问过了、还是解释不了」与
      // 「集合那一格根本没问」。恒等式照样成立（它是按构造成立的），比值照样能算，
      // 自检一个字都不会动 —— 又一次把「没量」印成「量过了但解释不了」（D29 一族）。
      // 第二十五轮 shadow 就是这样：`views` 5 条里有 1 条位移是两步（见下面的 oneStep），
      // `setPxRes` 只采到 4 条，而 `unexp` 采了 5 条 ⇒ 那 13500 px 是**上界**不是读数。
      // 判据里不动它（`posExplains` 不经过 `unexp`，这一行本来就已经是「不判决」），
      // 只把「这个数读不得」说出来 —— 口径㉒：没量出来的东西不许进判据，也不许进结论。
      const setSameN = (x.setPxRes?.count ?? 0) === (x.outWin?.count ?? 0)
      // 每条审计视口的位移是否都是同一步。有效区面积 = (W−|sx|)(H−|sy|) 只取决于位移大小 ⇒
      // avg ≠ max 就说明有视口走了不一样的位移（合帧）。这一轮 shadow avg 5636313.6 /
      // max 5796672，手算 (4×5796672+X)/5 解出 X = 4994880 = (3824−384)(1740−288) ⇒ 正好两步。
      // 这种视口的窄带更宽、集合churn更多、总差异更大，会**悄悄换掉这一轮量的是什么**，
      // 此前只能靠手算均值去发现它（结论 38：自检行必须能被它要防的错误改变）。
      const oneStep = (x.rtArea?.avg ?? 0) === (x.rtArea?.max ?? 0)
      const attrOk = setSameN && oneStep
      const rulerOk =
        outB === 0
          ? true
          : sameN && outWin === outB && Math.abs(tally - outWin) <= 1e-9 * Math.max(1, outWin)
      // 一条都没审到时判 `undefined`：这一行的 value 自己写着「没审到任何一条快路径视口」，
      // 此前它却照样落进 true（各项读数缺省全是 0，处处「干净」）—— 又一次把「没量」印成「没问题」。
      const pass = x.views === 0
        ? undefined
        : !setClean
        ? false
        : !rulerOk
        ? undefined
        : noiseFloor > 0
        ? undefined
        : bigPix
        ? false
        : posExplains
        ? true
        : undefined
      const value =
        x.views === 0
          ? '没审到任何一条快路径视口'
          : `最大偏差 ${fmt(maxDelta, 0)} · 大幅漏画 ${fmt(missBig, 0)} · 大幅多画 ${fmt(extraBig, 0)} · 选取差 ${fmt(selMiss, 0)}/${fmt(selExtra, 0)} 个图元
             ｜ 总差异 ${fmt(x.diff?.avg, 0)} px（漏 ${fmt(miss, 0)} / 多 ${fmt(extra, 0)} / 抖色 ${fmt(x.tint?.avg, 0)}，噪声底 ${fmt(selfPx, 0)}）
             ｜ 区内 ${fmt(inB, 0)} / 区外 ${fmt(outB, 0)}（位置复现 ${fmt(posOut, 0)}，其中同址 ${fmt(posBoth, 0)}）· pad ${fmt(x.padDev?.avg, 0)}px`
      // 判不通过时的说明。两条路走到这里：选取集有差（在尺子之前判），或者像素上出现了
      // Δ≥128 的大偏差（在尺子之后判）—— 两种都是「快路径确实错了」，说辞是同一套。
      const failNote = `${
        selMiss > 0
          ? `**漏选 ${fmt(selMiss, 0)} 个图元**（尺寸子句挡下 ${fmt(x.selMissSize?.max, 0)} 个 · 矩形越界挡下 ${fmt(x.selMissOut?.max, 0)} 个，最深越界 ${fmt(x.selMissGap?.max, 1)} 世界单位；越界的边 左${fmt(x.selMissL?.avg, 1)}/右${fmt(x.selMissR?.avg, 1)}/上${fmt(x.selMissT?.avg, 1)}/下${fmt(x.selMissB?.avg, 1)}）：漏选只可能出自 selectBandPens 的视口过滤（inkHitsBand 两边已是同一段代码）。越界那一支 > 0 ⇒ **两条路手上这个 pen 的矩形不是同一个**。`
          : ''
      }${
        selExtra > 0
          ? `**多选 ${fmt(selExtra, 0)} 个图元**：快路径画了、基准没画 ⇒ 两条路的「在视口内」判得不一样（inViewPenIds 是 calc 异步发来的，可能对应上一条视口）。`
          : ''
      }${
        missBig > 0 && selMiss === 0
          ? `**大幅漏画 ${fmt(missBig, 0)} px（Δ≥${BIG_DELTA}）**但选取集没差 ⇒ 不是漏选，是**画的时候被裁掉了**：墨迹伸到重画区之外（pad 不够宽，看区外的盒 ${fmt(x.oBoxW?.avg, 0)}×${fmt(x.oBoxH?.avg, 0)} 贴不贴内边）。`
          : ''
      }${
        extraBig > 0 && selExtra === 0
          ? `**大幅多画 ${fmt(extraBig, 0)} px（Δ≥${BIG_DELTA}）**但选取集没差 ⇒ 陈迹没擦干净，看 clipBand 的 clearRect 覆盖了没有。`
          : ''
      }${
        bigPix && missBig === 0 && extraBig === 0
          ? `最大偏差 ${fmt(maxDelta, 0)} ≥ ${BIG_DELTA} 却既不是漏也不是多 ⇒ **大幅抖色**：alpha 对得上、颜色差了一大截，同一块墨迹被画成了别的样子（搬花了 / 画错色），这一类 missBig/extraBig 抓不到，正是判据取 maxDelta 而非 missBig 的原因。`
          : ''
      }逐块：${legs}`
      const passNote = `没有任何大偏差（最大 ${fmt(maxDelta, 0)} < ${BIG_DELTA}，大幅漏画/多画均为 0）、选取集无差${
        (x.diff?.avg ?? 0) > 0
          ? `；剩下的 ${fmt(x.diff?.avg, 0)} px 是 Δ≤${fmt(maxDelta, 0)} 的细差（漏 ${fmt(miss, 0)} / 多 ${fmt(extra, 0)} / 抖色 ${fmt(x.tint?.avg, 0)}，全落在抗锯齿边上），且「只换设备位置重画同一批图元」在**同一批像素**上复现出其中 ${fmt(posBoth, 0)} px（带外 ${fmt(outB, 0)} 的 ${fmt(outB > 0 ? posBoth / outB : 0, 2)} 倍，总量 ${fmt(posOut, 0)}）⇒ **这是光栅化对平移不等变的固有产物，不是搬像素搬坏的**`
          : '，且逐像素完全相等'
      }（前提：基准画了 ${fmt(x.penCount?.avg, 0)} 个图元、溢出量估 ${fmt(x.kind.overflow, 0)}px ≫ 2，自检通过）`
      const note =
        x.views === 0
          ? '这一类没读到数 ⇒ 下面的自检表里找原因，这一行的结论不成立'
          : !setClean
          ? failNote
          : !rulerOk
          ? `**尺子的恒等式不成立，这一行不下判决**：带外差异 ${fmt(outB, 0)} px，其中位置实验检查过的 ${fmt(outWin, 0)} px（这两个数手算应当**逐位相等**：新暴露带 ⊆ 重画区 ⇒ 带外 ⊆ 单程有效区），三方记账合计 ${fmt(tally, 0)} px（位置 ${fmt(posBoth, 0)} + 集合 ${fmt(setRes, 0)} + 谁都解释不了 ${fmt(unexp, 0)}，应当等于 ${fmt(outWin, 0)}）${
              sameN ? '' : `，且两个读数的采样条数不同（${fmt(x.outWin?.count, 0)} vs ${fmt(x.outBand?.count, 0)}）⇒ 平均值的分母都不是一个，先别比`
            }。不等只有两种可能：**重画区没盖住新暴露带**（真缺陷，去看 clipBand 的矩形）或**有效区又推错了**（D27 那个坑）。先查尺子，不许读下面的结论。`
          : noiseFloor > 0
          ? `**尺子不稳，这一行不下判决**（噪声底 ${fmt(noiseFloor, 0)}px/Δ${fmt(x.selfMax?.max, 0)}）：同一条视口、同一批图元画两遍都不一样 ⇒ 本类的像素读数（最大偏差 ${fmt(maxDelta, 0)} · 漏画 ${fmt(miss, 0)} · 多画 ${fmt(extra, 0)} · 总差异 ${fmt(x.diff?.avg, 0)}）既证明不了快路径对、也证明不了它错，**不计入验收**。先看自检表的 \`audit:selfPx2\` 分清是「只有第一遍是异类」还是「每遍都在抖」，把尺子修好再重跑。选取集那两个数按**图元个数**算、不经过像素 ⇒ 仍然可读，且为 0`
          : bigPix
          ? failNote
          : posExplains
          ? passNote
          : `**位置解释不了这些差异，这一行不下判决**：带外差异 ${fmt(outB, 0)} px 全是小偏差（最大 ${fmt(maxDelta, 0)} < ${BIG_DELTA}），但「只换设备位置重画同一批图元」只在同一批像素上复现出 ${fmt(posBoth, 0)} px（${fmt(outB > 0 ? posBoth / outB : 0, 2)} 倍 < 0.5），或自造出 ${fmt(posOut, 0)} px（${fmt(outB > 0 ? posOut / outB : 0, 2)} 倍 > 2）⇒ 这些差异**来路不明**。小偏差之所以能不算缺陷，靠的就是「它是光栅化换了位置的固有产物」这个解释；解释对不上，就不能拿「反正偏差小」当通过的理由（D26 一族：别把「不知道」渲染成「知道」）。三方记账（第 5.11 步）：位置解释掉 ${fmt(posBoth, 0)} px（${fmt(outB > 0 ? posBoth / outB : 0, 2)}）· **集合**额外解释掉 ${fmt(setRes, 0)} px（${fmt(outB > 0 ? setRes / outB : 0, 2)}，= 位置不动、图元集合退回上一条视口时同址也有差异 ⇒ 指向 **D21**：框出了视口、墨迹还在屏上的图元没被重画，这一档大就**不是固有限制而是缺陷**）· 谁都解释不了 ${fmt(unexp, 0)} px（${fmt(outB > 0 ? unexp / outB : 0, 2)}）。哪一档大就查哪一档；「谁都解释不了」这一档大 ⇒ 位置与集合两格都问过了还剩下东西，那就是**还有第三个变量**，先去找它，别给这些像素派归属。${
              attrOk
                ? ''
                : `\n⚠ **但这三档的归属这一轮读不得（D31）**：${
                    oneStep
                      ? ''
                      : `有视口的位移不是同一步（有效区面积 avg ${fmt(x.rtArea?.avg, 0)} ≠ max ${fmt(x.rtArea?.max, 0)}，两者相减解出那一条走了两步）`
                  }${oneStep || setSameN ? '' : '；'}${
                    setSameN
                      ? ''
                      : `集合实验只采到 ${fmt(x.setPxRes?.count, 0)} 条视口、带外总量却采了 ${fmt(x.outWin?.count, 0)} 条（合帧的那条视口没有上一条相邻视口可比）`
                  } ⇒ 没有集合读数的那条视口，它的「带外 − 位置」**整份计入了「谁都解释不了」**。所以 ${fmt(unexp, 0)} px 是**上界**，不是读数；恒等式照样成立（它按构造成立），但不能据此断定第三个变量的大小。先把这一轮重跑到每条视口都是一步，再读归属。`
            }`
      return {
        label: x.kind.label,
        value,
        expect: `选取集无差 · 最大偏差 < ${BIG_DELTA}（且噪声底 = 0、带外差异能被位置复现，否则不判决）`,
        pass,
        note,
      }
    })

    const totalViews = results.reduce((a, b) => a + b.views, 0)
    const minPenCount = Math.min(...results.map((x) => x.penCount?.avg ?? 0))
    const plain = results.find((x) => x.kind.key === 'plain')
    const text = results.find((x) => x.kind.key === 'text')
    const selfRows: Row[] = [
      {
        label: '审计真的跑了（每类 count:audit:views:pure）',
        value: `${fmt(totalViews, 0)} / ${INK_KINDS.length * INK_STEPS} 条（${results
          .map((x) => `${x.kind.key} ${x.views}`)
          .join(' · ')}）`,
        expect: `= ${INK_KINDS.length * INK_STEPS}`,
        pass: totalViews === INK_KINDS.length * INK_STEPS,
        note: '少了 ⇒ 有视口被背压丢掉或退回了全量（缩放/尺寸变化），把 sleep 调长再跑',
      },
      {
        label: '基准真的画了图元 render:penCount:audit',
        value: results.map((x) => `${x.kind.key} ${fmt(x.penCount?.avg, 0)}`).join(' · '),
        expect: '> 0',
        pass: minPenCount > 0,
        note: `场景每类 ${fmt(results[0]?.pens, 0)} 个图元、视口内约占三分之一。**这一行不过，上表的 0 差异全部无效** —— 那时 0 的意思是「什么都没画」，不是「没有溢出」`,
      },
      {
        label: '★ 对照组干净（tol = 0 够不够严）',
        value: `${fmt(plain?.diff?.max, 0)} px`,
        expect: '= 0',
        pass: (plain?.diff?.max ?? 1) === 0,
        note:
          (plain?.diff?.max ?? 1) === 0
            ? '纯矩形逐像素相等 ⇒ 严格相等这把尺子成立，其余各类的差异都是真差异'
            : '对照组就有零星差异 ⇒ 先用 pixelAuditTol 抬高容差重跑，否则分不清抗锯齿噪声和真漏画',
      },
      {
        label: '外溢文本的铁证 TextOutside(31)',
        value: `${fmt(text?.textOutside, 0)} 条`,
        expect: '> 0',
        pass: (text?.textOutside ?? 0) > 0,
        note: 'render 判定 textBox 超出 pen 范围才会发（worker.ts:1838）⇒ 这一行证明那一类的文字**真的溢出了框**，不是我把 pen 写错了',
      },
      {
        label: 'skip 档审到的条数',
        value: results.map((x) => x.skipViews).reduce((a, b) => a + b, 0) + ' 条',
        note: '这一项每步都真的动了 (96, 72) ⇒ 应为 0。非 0 说明有整数取整后位移为零的条，它的主张（像素已经是对的）也在被审',
      },
      {
        // 第 5.1 步新增。它是**上表「总差异」这一列的下限** —— 尺子自己都不重复的地方，
        // 快路径不可能比它更像。为 0 才说明「tol = 0 严格相等」这个口径在这一类上可达。
        label: '尺子的噪声底 audit:selfPx（同一条视口画两遍全量，逐像素比）',
        value: results.map((x) => `${x.kind.key} ${fmt(x.selfPx?.avg, 0)}px/Δ${fmt(x.selfMax?.max, 0)}`).join(' · '),
        note: '第十七轮设它作对照组，判 rotate/shadow 那 5159 / 19302 px 算不算缺陷，并预先写明「它若为 0 则我的后端噪声解释被证伪」。第十八轮读数：**六类全 0 ⇒ 已证伪，光栅化完全可重复**。它现在的用处是守住验收口径：0 = 「tol 0 严格相等」可达，任何差异都得在 M7a 自己身上找原因。⚠ 它看不见**捕获方式**的不对称（两份都走直读）—— 那是 D23，第 5.2 步已把快路径那边多出来的画布拷贝删掉',
      },
      {
        // 第 5.4 步。**这一行的正确答案仍是手算出来的**：两次整数平移、1:1 无缩放、
        // 关掉插值 ⇒ 落回原位的内区必须逐位复原 = 0。
        // 它替掉了第 5.3 步那个**零位移**测法 —— 零位移是可以被实现特判成恒等的一步，
        // 它证明的是「恒等变换无损」，而快路径做的是跨 192/144 像素的读写同源采样，
        // 两者不是同一段路。这就是上一轮那个对照组的盲区（结论 36）。
        label: 'blit 原语的损耗 audit:selfBlit（**真实位移**往返自拷贝，比内区）',
        value: results
          .map((x) => `${x.kind.key} ${fmt(x.selfBlit?.avg, 0)}px/Δ${fmt(x.selfBlitMax?.max, 0)}`)
          .join(' · '),
        expect: '全 0',
        pass: results.every((x) => (x.selfBlit?.max ?? 0) === 0),
        note: `非 0 ⇒ 画布自拷贝不是无损的（半透明像素的预乘取整），**M7a 每搬一次就损一次**，那是这条快路径的固有代价、要单独记账；单程损 ±1 则往返读到 ≤ 2，而 rotate 那几千个「alpha 相同、颜色差 1」的 tint 正是这个量级 —— 这是它目前唯一还站着的解释。且它应当只在有半透明像素的类上非 0（rotate 的抗锯齿边、shadow 的模糊外圈），若 plain/thick 也非 0 则是另一回事。内区面积 ${fmt((results[0]?.rtArea?.avg ?? 0) / 1e6, 2)} Mpx（整屏 6.65 Mpx）—— 内区若太小，这一行的 0 就说明不了整屏`,
      },
      {
        // 第 5.4 步：尺子在第十九轮突然抖了（rotate 六条里有一条差 8px/Δ255），
        // 而被测物的读数在尺子不稳的时候一个字都不能信 ⇒ 这一行排在解释 rotate 之前。
        label: '噪声底的形状 audit:selfPx2（第三遍 vs 第二遍，只在噪声底非 0 的条上测）',
        value: (() => {
          const ns = results.filter((x) => (x.selfPx?.max ?? 0) > 0)
          if (!ns.length) {
            return '没有一条抖 ⇒ 未触发（尺子稳）'
          }
          return ns
            .map((x) =>
              x.selfPx2
                ? `${x.kind.key} 一二遍差 ${fmt(x.selfPx?.max, 0)}px，二三遍差 ${fmt(x.selfPx2?.max, 0)}px/Δ${fmt(x.selfMax2?.max, 0)}`
                : `${x.kind.key} 抖了但没采到 selfPx2（探针没发出来，别读成 0）`
            )
            .join(' · ')
        })(),
        expect: '要么没触发，要么二三遍差 = 0（只有第一遍是异类）',
        note: '二三遍差 = 0 ⇒ **绘制有首次副作用**（文本度量/字形缓存这类只在第一次画时做的事），基准该取第二遍，而且 `fast` 那一侧同样吃过这一口、比较口径要重定；二三遍差 > 0 ⇒ 光栅化本身不可重复，「逐像素相等」这个验收口径就地作废，换结论 35 那套判据。⚠ 它**看不见**「每遍都一样但都错」这种系统性偏差 —— 那不是噪声，得靠手算答案去抓',
      },
      {
        // 第 5.3 步，预注册②点的题。INK_DX/DY = (96, 72) CSS px、scale 1、dpr 2
        // ⇒ 设备位移 (192, 144) 是**整数**，所以手算答案也是已知的 = 0。
        label: '亚像素相位残差 view:resX1k / resY1k（设备像素 × 1000）',
        value: `x avg ${fmt(results[0]?.resX1k?.avg, 0)} / max ${fmt(results[0]?.resX1k?.max, 0)} · y avg ${fmt(results[0]?.resY1k?.avg, 0)} / max ${fmt(results[0]?.resY1k?.max, 0)}`,
        expect: '0（位移 192/144 设备像素是整数）',
        pass: (results[0]?.resX1k?.max ?? 0) === 0 && (results[0]?.resY1k?.max ?? 0) === 0,
        note: '非 0 ⇒ 整数搬运一个小数位移，每条抗锯齿边最多错半个设备像素，rotate/shadow 的差异有了着落；= 0 ⇒ 搬运是相位精确的，差异只能出在上一行那个原语上',
      },
      {
        // 第 5.5 步：M7a 这条快路径的**全部前提**，第一次被单独量。
        // 除了「在哪个设备位置光栅化」之外什么都没变（同一批图元、同一份数据、没有 blit 历史）。
        label: '平移等变性 audit:posShift（退回上一条视口的位置画同一批图元，再搬回来）',
        value: (() => {
          const ds = results.filter((x) => (x.diff?.max ?? 0) > 0)
          if (!ds.length) {
            return '六类全干净 ⇒ 未触发'
          }
          return ds
            .map((x) =>
              x.posShift
                ? `${x.kind.key} 带外 ${fmt(x.posOut?.avg, 0)}（同址 ${fmt(x.posBoth?.avg, 0)} / 独有 ${fmt(x.posOnly?.avg, 0)}）· 带内 ${fmt(x.posIn?.avg, 0)}，Δ${fmt(x.posMax?.max, 0)}（漏 ${fmt(x.posMiss?.avg, 0)} / 多 ${fmt(x.posExtra?.avg, 0)} / 抖色 ${fmt(x.posTint?.avg, 0)}）｜ 本类带外差异 ${fmt(x.outBand?.avg, 0)}（漏 ${fmt(x.miss?.avg, 0)} / 多 ${fmt(x.extra?.avg, 0)} / 抖色 ${fmt(x.tint?.avg, 0)}）`
                : `${x.kind.key} 有差异但没采到 posShift（别读成 0）`
            )
            .join(' · ')
        })(),
        expect: '要么 0（位置无辜），要么「同址」那一档 ≥ 本类带外差异的一半且总量 ≤ 两倍（且漏/多/抖色三档形状相同）',
        note: '**先看是不是同一批像素，再比形状，最后才比大小**（第 5.8/5.10 步）：「同址」= 这个像素在「快 vs 慢」那一遍里**也**有差异，「独有」= 只有位置实验看得见 —— 两堆差异个数相当却互不相交是完全可能的，那时「谁解释谁」这个问法本身就不成立，而只比个数的自检一个字都不会动（验收口径㉑）。两行各自拆成「带内 / 带外」与「漏 / 多 / 抖色」，只有带外那一档才可比 —— 窄带里的像素在快路径上是**重画**出来的、根本不经过搬运，拿它去问「位置变了有没有影响」是问错了对象；三档的比例对不上就说明两个数压根不在同一件事上算（第二十三轮 shadow 的 4.27 倍卡的就是这里）。形状对上之后才轮到下面两支，**互斥、各自都是结论**：带外 ≈ 本类带外差异 ⇒ **光栅化不是平移等变的**，「搬像素」这个做法的前提不成立 —— 那不是 M7a 的缺陷而是它的固有限制，验收口径按结论 35 改判据（**不是放宽 tol**）；≈ 0 ⇒ 位置无辜，差异只能来自两遍画的**图元集合**不同，去看下一行。⚠「漏」这一档还兼作窗口自检：它 ≈ posShift 总数就说明比对窗口又取错了（**D27**：单程有效区是 `[max(0,s), W+min(0,s))`，与往返内区贴在**相反的角**上且**面积相等**，分母校验抓不到），此时整行作废。⚠ 它刻意把图元集合**钉死**（两遍都用这一条视口的 `inViewPenIds`），所以看不见集合变化那一族',
      },
      {
        // 第 5.11 步：2×2 的最后一格 + 带外差异的三方记账。
        // 位置实验固定集合、只改位置；这一格固定位置、只改集合（退回 `prevViewIds`）。
        // 没有平移 ⇒ 没有几何窗口 ⇒ D27 那个坑在这一路不存在，但为了能与 `posBoth`
        // 一起记账，仍然只在同一个单程有效区内统计。
        label: '带外差异的三方记账 audit:outWin / posBoth / setPxRes / unexp（像素）',
        value: (() => {
          const ds = results.filter((x) => (x.diff?.max ?? 0) > 0)
          if (!ds.length) {
            return '六类全干净 ⇒ 未触发'
          }
          return ds
            .map((x) =>
              x.outWin
                ? `${x.kind.key} 带外 ${fmt(x.outBand?.avg, 0)}（实验看过 ${fmt(x.outWin?.avg, 0)}）= 位置 ${fmt(x.posBoth?.avg, 0)} + 集合 ${fmt(x.setPxRes?.avg, 0)} + 谁都解释不了 ${fmt(x.unexp?.avg, 0)}${
                    (x.setPxRes?.count ?? 0) === (x.outWin?.count ?? 0) &&
                    (x.rtArea?.avg ?? 0) === (x.rtArea?.max ?? 0)
                      ? ''
                      : `【⚠ 视口 ${fmt(x.outWin?.count, 0)} 条、集合实验只跑了 ${fmt(x.setPxRes?.count, 0)} 条，位移${(x.rtArea?.avg ?? 0) === (x.rtArea?.max ?? 0) ? '同步' : '不同步'} ⇒ 末档是上界，归属读不得】`
                  }；集合实验本身 ${fmt(x.setPx?.avg, 0)}（带内 ${fmt(x.setPxIn?.avg, 0)} / 带外 ${fmt(x.setPxOut?.avg, 0)}，Δ${fmt(x.setPxMax?.max, 0)}，与快慢同址 ${fmt(x.setPxBoth?.avg, 0)}）`
                : `${x.kind.key} 有差异但没采到 outWin（别读成 0）`
            )
            .join(' · ')
        })(),
        expect:
          '两条恒等式逐位成立：实验看过 = 带外；位置 + 集合 + 谁都解释不了 = 带外。然后看哪一档大',
        pass: (() => {
          const ds = results.filter((x) => (x.diff?.max ?? 0) > 0 && x.outWin)
          if (!ds.length) {
            return undefined
          }
          // 两级：恒等式不成立 ⇒ **false**（推导或实现真错了，是缺陷）；
          // 恒等式成立但归属读不得（D31：有视口没跑集合实验 / 位移不同步）⇒ **undefined**
          // （被测物没问题，是这一轮的样本不干净，重跑就好）。
          // 两级分开是必要的：混成一个 false 会把「重跑一次的事」印成「代码有错」。
          const idsOk = ds.every((x) => {
            const ob = x.outBand?.avg ?? 0
            const ow = x.outWin?.avg ?? 0
            const t = (x.posBoth?.avg ?? 0) + (x.setPxRes?.avg ?? 0) + (x.unexp?.avg ?? 0)
            return (
              (x.outWin?.count ?? 0) === (x.outBand?.count ?? 0) &&
              ow === ob &&
              Math.abs(t - ow) <= 1e-9 * Math.max(1, ow)
            )
          })
          if (!idsOk) {
            return false
          }
          const readable = ds.every(
            (x) =>
              (x.setPxRes?.count ?? 0) === (x.outWin?.count ?? 0) &&
              (x.rtArea?.avg ?? 0) === (x.rtArea?.max ?? 0)
          )
          return readable ? true : undefined
        })(),
        note: '这一行先是**尺子的自检**，然后才是读数。手算：新暴露带 ⊆ 重画区 ⇒ 带外 ⊆ 画布 − 新暴露带 = 单程有效区 ⇒ 「实验看过」必须**逐位等于**「带外」（原本以为这里有个分母虚高、要去修，手算之后发现两个域恒等，第二十三轮 shadow 的 0.376 因此是**真的**解释不了，不是域错了）；四支互斥且穷尽 ⇒ 三项之和也必须逐位等于它。任一条不成立 ⇒ 重画区没盖住新暴露带（真缺陷）或有效区又推错了（D27），整行作废。自检过了再读归属，**三档各自都是结论**：位置那一档大 ⇒ 光栅化对平移不等变，是搬像素的固有限制（结论 35 改判据，不是放宽 tol）；**集合**那一档大 ⇒ **D21**，框出了视口、墨迹还留在屏上的图元没被重画 —— 这是**缺陷不是限制**，哪怕偏差只有 Δ4（这一轮 shadow 的墨迹尾巴恰好很淡，换个场景就是满强度的陈迹）；「谁都解释不了」那一档大 ⇒ 位置与集合两格都问过了还剩东西，**还有第三个变量**，先去找它，别给这些像素派归属（D26 一族）。⚠ 盲区（结论 36）：集合那一格只把 id 集合退回上一条，`penMap` 里的图元**数据**仍是当前的 ⇒ 它量得到「集合变了」，量不到「同一个图元的框被改了」（`onTextOutside` 会改框，text 类得单独看）；相邻两条都被审计到才可比，否则这一格根本不跑。⚠ **D31（第二十五轮命中）：恒等式成立 ≠ 归属可读。** 集合实验要求上一条视口正好相邻，主线程一合帧（两步并一步）那一条就没有集合读数，而三方记账是按视口累加的 ⇒ 那一条的「带外 − 位置」**整份落进末档**，于是末档同时装着「问过了解释不了」和「根本没问」，恒等式却照样成立（它按构造成立）—— 第二十五轮 shadow 五条视口里有一条走了两步（有效区面积 avg 5636313.6 ≠ max 5796672，解出 4994880 = 3440×1452 = 两步），`setPxRes` 只采到 4 条而末档采了 5 条，那 13500 px 因此是**上界不是读数**。所以这一行分两级：恒等式破 ⇒ 不通过（真缺陷）；恒等式成立但样本不齐 ⇒ **不判决，重跑**',
      },
      {
        // 第 5.5 步的另一半。单位是**个数**不是像素（结论 35）。
        label: '相邻两条视口的图元集合差 audit:setGone / setNew（个）',
        value: results
          .map((x) => `${x.kind.key} 走 ${fmt(x.setGone?.avg, 1)} / 来 ${fmt(x.setNew?.avg, 1)}`)
          .join(' · '),
        note: '搬过来的那片像素是用**上一条**视口的 `inViewPenIds` 画的，而基准用的是这一条的；`selectBandPens` 只在窄带里补差 ⇒ 框刚出视口、墨迹还留在屏上的图元（**D21**：calc 的「在视口内」判定没有墨迹余量）会在**窄带之外**留下陈迹或缺口。手算预期：每步移动 (96, 72) 世界单位、栅距 110 ⇒ 竖边各 ≈ 7 个、横边各 ≈ 11 个，走与来都该在 18 上下。**干净的 plain 是这一行的对照组** —— 它的集合变动量与 rotate 一样大却一个像素不差，那就说明「集合变了」本身不足以造成差异。第二十二轮实测：六类的走/来都落在 16.6~19.0（手算 18 命中），plain 与 rotate **逐项相同**（18.4 / 17.0）而 plain 差异为 0 ⇒ **对照组成立，集合变动本身不是成因**；它仍解释不了 rotate 那种散布全屏（boxW 3566 × boxH 1530）的 Δ1 差异，因为集合变化只发生在视口四边',
      },
      {
        // 第 5.3 步：line 漏选的直接判据。两条路各自算的视口右/下边界，相减。
        label: '两条路认为的画布 CSS 宽高 calc:cw/ch − audit:cw/ch',
        value: (() => {
          const ln = results.find((x) => x.kind.key === 'line')
          const dw = ((ln?.calcViewR?.avg ?? 0) - (ln?.viewR?.avg ?? 0)) / 1000
          const dh = ((ln?.calcViewB?.avg ?? 0) - (ln?.viewB?.avg ?? 0)) / 1000
          return `宽差 ${fmt(dw, 2)} · 高差 ${fmt(dh, 2)}（calc ${fmt((ln?.calcViewR?.avg ?? 0) / 1000, 1)}×${fmt((ln?.calcViewB?.avg ?? 0) / 1000, 1)} vs render ${fmt((ln?.viewR?.avg ?? 0) / 1000, 1)}×${fmt((ln?.viewB?.avg ?? 0) / 1000, 1)}）`
        })(),
        expect: '两个都 0',
        pass: (() => {
          const ln = results.find((x) => x.kind.key === 'line')
          return (
            (ln?.calcViewR?.avg ?? 0) === (ln?.viewR?.avg ?? 0) && (ln?.calcViewB?.avg ?? 0) === (ln?.viewB?.avg ?? 0)
          )
        })(),
        note: 'calc 用 renderCanvas.clientWidth/Height（CSS 像素整数），render 用画布设备像素 ÷ dpr 反推 —— 对不上就会漏选，而且只有墨迹伸出自身框很多的图元（连线箭头）看得见。差值若与 selMissGap 的量级相符（3~4），line 的漏选就实锤在这里，修法是让 render 直接用 calc 那个数，而不是反推',
      },
      {
        label: '单条审计代价 audit:cost avg / max (µs)',
        value: `${fmt(results[0]?.cost?.avg)} / ${fmt(results[0]?.cost?.max)}`,
        note: '三次整屏 getImageData + 两遍全量重绘（第二遍是噪声底那一遍）+ 逐字比对；噪声底非 0 的条再加一遍一读，有差异的条再加两遍一读（平移等变性那一测）。**只作代价参考，不是性能读数**',
      },
    ]

    // D26（第 5.7 步）：**噪声底非 0 = 这一类的像素读数作废，不许进这个判决。**
    // 原先这里是「没有漏画/多画 ⇒ 过」，尺子抖成什么样都照判 —— 第二十轮 rotate 的
    // 噪声底是 8px/Δ255，它仍然会印出「过」。三态改写：
    //   选取集有差            ⇒ **没过**（按图元个数算，不经过像素，尺子抖也影响不了它）
    //   尺子稳 且 有漏画/多画 ⇒ **没过**
    //   尺子不稳 且 其余都干净 ⇒ **不判决**（不是过，也不是没过）
    // ⚠ 第 5.8 步：整体判决**不再自己算一遍判据**，直接按每一行的 `pass` 分档。
    // 原先这里把「漏画/多画 > 0」重写了一遍，与上表各写各的 —— 判据一改（D28 换成
    // 最大偏差）就会有一处漏改，两个数说两种话。这是 D27 那一课的同一个形状：
    // 要对账的两个读数必须**在同一件事上算出来**。rows 与 results 同序 map 而来。
    const bad = results.filter((_, i) => rows[i].pass === false)
    const unsure = results.filter((_, i) => rows[i].pass === undefined)
    const shaky = unsure.filter((x) => x.views > 0 && (x.selfPx?.max ?? 0) > 0)
    const selBad = bad.filter((x) => (x.selMiss?.max ?? 0) > 0 || (x.selExtra?.max ?? 0) > 0)
    const valid = minPenCount > 0 && (plain?.diff?.max ?? 1) === 0 && totalViews > 0
    const verdict = !valid
      ? `<p class="perf-bad">自检没过（见下表）⇒ 这一轮读数不能用来判第 5 步过没过。</p>`
      : bad.length
        ? `<p class="perf-bad">第 5 步的验收（口径第十七轮更正过，见上表注释）：
           <b>${bad.map((x) => x.kind.key).join(' / ')}</b> ⇒ **没过**。
           ${
             selBad.length
               ? `其中 <b>${selBad.map((x) => x.kind.key).join(' / ')}</b> 的**选取集**就与基准不同（差的是图元，不是像素）⇒ 先对齐集合，再谈像素。`
               : '选取集与基准一致 ⇒ 差在「选了但画不全」：pad 宽度或 clip 覆盖。'
           }
           ${unsure.length ? `另有 <b>${unsure.map((x) => x.kind.key).join(' / ')}</b> 没有结论（尺子不稳或位置解释不了），**不在这个判决里**。` : ''}</p>`
        : unsure.length
          ? `<p class="perf-hint">第 5 步 <b>不判决</b>（不是过，也不是没过）：<b>${unsure
              .map((x) =>
                x.views === 0
                  ? `${x.kind.key} 一条也没审到`
                  : (x.selfPx?.max ?? 0) > 0
                  ? `${x.kind.key} 噪声底 ${fmt(x.selfPx?.max, 0)}px/Δ${fmt(x.selfMax?.max, 0)}`
                  : (x.outWin?.avg ?? 0) !== (x.outBand?.avg ?? 0)
                  ? `${x.kind.key} 尺子的恒等式不成立（实验看过 ${fmt(x.outWin?.avg, 0)} ≠ 带外 ${fmt(x.outBand?.avg, 0)}）`
                  : `${x.kind.key} 带外 ${fmt(x.outBand?.avg, 0)}px = 位置 ${fmt(x.posBoth?.avg, 0)} + 集合 ${fmt(x.setPxRes?.avg, 0)} + 谁都解释不了 ${fmt(x.unexp?.avg, 0)}`
              )
              .join(' · ')}</b>。
             ${shaky.length ? '尺子不稳的那些类，像素读数既证明不了快路径对、也证明不了它错 —— 先用自检表的 `audit:selfPx2` 分清「只有第一遍是异类」还是「每遍都在抖」。' : ''}
             位置解释不了的那些类，差异虽小但**来路不明**：小偏差能不算缺陷，全靠「它是光栅化换位置的固有产物」这个解释，解释对不上就不能拿「反正偏差小」当通过的理由。
             其余 ${results.length - unsure.length} 类干净，但**部分类没有结论就不能宣布通过**（D26）。</p>`
          : `<p class="perf-ok">第 5 步的验收（口径第十七轮更正过、第二十三轮按结论 35 换成「方向 + 集合 + 最大偏差」）：
             六类**没有任何 Δ≥${BIG_DELTA} 的偏差**（大幅漏画/多画均为 0），选取集与基准逐个相同，噪声底都是 0，
             且残留的细差都能被「只换设备位置重画同一批图元」复现出来 ⇒ **过**。
             那些细差是光栅化对平移不等变的固有产物，不是搬像素搬坏的。</p>`

    this.out(
      this.table(
        `墨迹审计（第 5 步验收 · 每类一个场景 · 每类 ${INK_STEPS} 条视口 · 判「漏画/多画/选取集」而不是「总差异」）`,
        rows
      ) +
        verdict +
        this.table('自检（这几行不过，上表不成立）', selfRows)
    )
    this.setStatus('墨迹审计完成')
  }

  // ---------------------------------------------------------------- 渲染

  /**
   * render worker 的探针行，附在每个检测结果后面。
   *
   * 这个线程之前**一个埋点都没有** —— hover 慢半拍慢在哪、「局部重绘」是不是真的局部，
   * 全靠猜。三个数决定 Phase 1 怎么做：
   * - `render:clipPct` / `render:clipRaw`：一次重绘实际覆盖了全画布的百分之几（前者与
   *   画布求交，0~100；后者不裁，>100 表示脏区已甩出视口）。接近 100 说明脏区取并集
   *   已经退化成整屏。（实测后 M2/脏区分组已取消：动画路径 clipPct 仅 0.003%，
   *   Patch 路径拆成 2000 个脏区要付 2000 × 38µs 固定开销 ≈ 76ms，比要省的 37.9ms 还贵。
   *   这一行现在的用途是**排除**面积假设，不是驱动脏区改造。）
   * - `hover:clear` vs `hover:draw`：hover 一步要先擦旧的再画新的，两段相当就意味着
   *   成本翻倍，合并两个脏区能省一半。
   * - `render:penCount`：一次重绘真正画了多少图元。
   * - `patch:old` / `patch:new`：一次 Patch 在渲染线程的两遍全量重绘各占多少。
   * - `probe:lag`：探针消息在队列里排了多久 = 这个线程当前积压了多少。
   *
   * 这些行原本都不打 ✓/✗（取基线用）。现在只有 `probe:lag` 一行有阈值 —— Phase 1.2
   * 视口背压的验收判据，其余仍是基线读数。
   *
   * 读数注意：Sampler 是 4096 容量的环形缓冲，`count` 是总数，而 `avg/p50/p95/max`
   * 只统计**最后 4096 个样本**。count 远大于 4096 时（动画洪流下动辄几万），
   * count × avg 只在负载平稳时才约等于总耗时；少量的大样本（如 5 次 Patch）会被
   * 后续样本挤出窗口，不会体现在 avg 里。
   */
  private renderRows(rep?: PerfReport): Row[] {
    if (!rep) return []
    const t = rep.timing ?? {}
    const st = (k: string) => t[k] as Stats | undefined
    // render:pens / render:penCount 现在按触发它的 action 分组（D12）：不分组时动画路径
    // （~20µs、4 个图元）和视口全量重绘（~44000µs、14000 个图元）挤在同一个 4096 环里，
    // 少数大样本能把均值抬高数倍，动画的真实单价被埋掉。
    const pensAnim = st(`render:pens:${WorkerMessage.RenderAnimation}`)
    const pensView = st(`render:pens:${WorkerMessage.UpdateView}`)
    const clip = st('render:clipPct')
    const clipRaw = st('render:clipRaw')
    const penCount = st(`render:penCount:${WorkerMessage.RenderAnimation}`)
    const penCountView = st(`render:penCount:${WorkerMessage.UpdateView}`)
    // 入站结构化克隆的反序列化，按 action 分开。M1/M3 的帧聚合省掉的正是这一段的
    // N−1 份「每条固定开销」；renderPens 那一段合并后**一次都省不掉**（脏区取并集会
    // 擦掉并集里没进 penIds 的图元，见 §0.5-H12），所以两段的比例就是 M1 的估值。
    const deserAnim = st(`deser:${WorkerMessage.RenderAnimation}`)
    const deserView = st(`deser:${WorkerMessage.UpdateView}`)
    const hClear = st('hover:clear')
    const hDraw = st('hover:draw')
    const hPens = st('hover:pens')
    const noClip = st('count:render:noClip')?.count ?? 0

    // ── M7a（PanBlit）。第 1~3.6 步只量不改画面，第 4 步起是真的快路径。
    //    见文档 §2 M7a / §0.5-H14（方案）/ H15（B 实测）/ H16（窄带实测）──
    const pens5b = st('render:pens:5b')
    const penCount5b = st('render:penCount:5b')
    const blit = st('view:blit')
    const blit4 = st('view:blit:x4')
    const bandPct = st('view:bandPct')
    const bandCount = st('view:bandCount')
    const bandPctPens = st('view:bandPctPens')
    const bandSelect = st('view:bandSelect')
    const bandScan = st('view:bandScan')
    const bandRotated = st('count:view:bandRotated')?.count ?? 0
    const shift = st('view:shift')
    const canvasPx = st('canvas:px')
    const canvasDpr = st('canvas:dpr')
    const viewSig = st('view:sig')
    const viewPure = st('count:view:pure')?.count ?? 0
    const viewFull = (r: string) => st(`count:view:full:${r}`)?.count ?? 0
    const viewFullTotal =
      viewFull('first') + viewFull('resize') + viewFull('sig') + viewFull('zero') + viewFull('far')
    // 第 4.5 步：位移为零的视口一笔都不画。它既不是「命中快路径」也不是「退回全量」，
    // 必须单独一档 —— 混进 viewPure 会让 blendedUs 用窄带成本去代表零成本（低估收益），
    // 混进 viewFullTotal 则会让命中率凭空变差（高估退回）。三档相加才等于视口总条数。
    const viewSkip = st('count:view:skip')?.count ?? 0
    // 第 4.6 步：一圈往返的三截（结论 29）。render 自己那 25% 早就有探针了，
    // 这三个是为剩下那 75% 准备的。
    const tripCalc = st('view:trip:calc')
    const tripPost = st('view:trip:post')
    const tripAck = st('view:trip:ack')
    // D14：view:blit:x4 只在「单次已经读得很便宜」时才采集，是个有选择偏差的子集，
    // 绝不能拿它当头条单价。头条永远用 view:blit.avg（无偏，含首次那一下的同步代价），
    // x4 只当「重复 blit 的边际单价」参考 —— 两者差一个数量级本身就是结论（见 §0.5-H15）。
    const blitUs = blit?.avg ?? 0
    const blitMarginalUs = (blit4?.count ?? 0) > 0 ? (blit4?.avg ?? 0) / 4 : NaN
    const noPen = st('count:hover:noPen')?.count ?? 0
    const anim = st(`handle:${WorkerMessage.RenderAnimation}`)
    const patch = st(`handle:${WorkerMessage.Patch}`)
    const pOld = st('patch:old')
    const pNew = st('patch:new')
    const pOldIds = st('patch:oldIds')
    const pNewIds = st('patch:newIds')
    const samePass = st('count:patch:samePass')?.count ?? 0
    const view = st(`handle:${WorkerMessage.UpdateView}`)
    const lag = st('probe:lag')
    const msg = rep.message
    // 消息之间的空档，按 action 分开。用来定位 Phase 1.2 验收时差的那 380ms（§0.5-H10）：
    // 摊在动画上（~16µs × 2.4 万条）还是摊在视口上（~9.7ms × 39 条），两者对 M1/M3 的估值差 46%。
    const gapView = st(`msg:gap:${WorkerMessage.UpdateView}`)
    const gapAnim = st(`msg:gap:${WorkerMessage.RenderAnimation}`)
    /**
     * 该采样器的总量（ms）= avg × count。
     *
     * 注意两条前提：① avg 只覆盖最后 4096 个样本（D8），所以只在该采样器的样本**同质**
     * 且负载平稳时才等于总耗时 —— 这正是把 render:pens 按 action 拆开的理由；
     * ② 单次量级低于 performance.now() 的 100µs 分辨率时 avg 不是单价（D11），
     * 但总量仍可信（第七轮用它把 render 线程配平到 99.5%）。
     */
    const totalMs = (s?: Stats) => ((s?.avg ?? 0) * (s?.count ?? 0)) / 1000
    const gapTotal = totalMs
    // 动画单条 handle 拆三段：反序列化 / 应用 changedProperties / renderPens。
    // 中间那段 = 减出来的余项（含派发本身），没有单独埋点。
    const animApplyMs = Math.max(0, totalMs(anim) - totalMs(deserAnim) - totalMs(pensAnim))

    /**
     * M7a 之后单条视口的预测，以及按命中率混合后的吞吐。
     *
     * 两个容易踩的坑，这里都避开了：
     * ① 本轮 handle:5 被探针自己的 blit 撑大了，所以「其余」必须先把 blit 总量摊回去再减，
     *    否则 blit 被算两次（D8 那类错误）；
     * ② 吞吐不再套第九轮那两个硬编码常数，而是用**本轮自己的** view.count × (avg + gap)
     *    当线程预算 —— 这样代入今天的单条必然还原今天的条数，模型和读数自洽。
     */
    const m7aProj = () => {
      const deserUs = deserView?.avg ?? 0
      const pensUs = pensView?.avg ?? 0
      const todayUs = view?.avg ?? 0
      const gapUs = gapView?.avg ?? 0
      const n0 = view?.count ?? 0
      const blitTotalUs = (blit?.avg ?? 0) * (blit?.count ?? 0) + (blit4?.avg ?? 0) * (blit4?.count ?? 0)
      const perViewBlit = n0 ? blitTotalUs / n0 : 0
      // blit 和窄带选取都**只在命中的那些条上**采样，而 handle:5 是全部条的均值 ——
      // 两者分母不同，必须按总量摊到每条上再减，否则会把探针开销减多（D14 同一类错误）
      const selUs = bandSelect?.avg ?? 0
      const perViewSel = n0 ? (selUs * (bandSelect?.count ?? 0)) / n0 : 0
      /** 一条全量重绘的真实成本 —— 把探针自己加的那两笔摘出去之后 */
      const baseTodayUs = Math.max(0, todayUs - perViewBlit - perViewSel)
      const otherUs = Math.max(0, baseTodayUs - deserUs - pensUs)
      // 窄带成本优先用第 3 步的**真实计数** × 单价；没有计数时才退回「面积占比 × 密度」的估算。
      // 那个估算隐含「窄带内密度 = 画布平均密度」，第十二轮实测**这个假设可以差 1.6 倍**
      // （实测 / 估算 = 0.62×，因为场景的平移幅度≈场景尺寸，窄带常扫在空白上 —— D15），
      // 而**偏哪一边完全看场景**，所以两个值都算出来、都摆上去，用坏的那个判门槛。
      const unitUs = (penCountView?.avg ?? 0) > 0 ? pensUs / (penCountView?.avg ?? 1) : 0
      const measured = (bandCount?.count ?? 0) > 0
      const bandUniformUs = (pensUs * (bandPct?.avg ?? 0)) / 100
      const bandUs = measured ? (bandCount?.avg ?? 0) * unitUs : bandUniformUs
      // selUs 是**新增**的固定开销：它扫全量 penMap，不随窄带变窄而变小
      const projUs = deserUs + otherUs + bandUs + blitUs + selUs
      /** 悲观档：窄带密度退化成画布平均密度（= 平移幅度远小于场景时的正常情形） */
      const projUniformUs = deserUs + otherUs + Math.max(bandUs, bandUniformUs) + blitUs + selUs
      const judged = viewPure + viewFullTotal + viewSkip
      const hitRate = judged ? viewPure / judged : 0
      /** 第 4.5 步跳过的那些条，成本按 0 算（只剩 viewSig + 几个 probe.sample） */
      const skipRate = judged ? viewSkip / judged : 0
      const fullRate = Math.max(0, 1 - hitRate - skipRate)
      // 退回的那些条按「摘掉探针的全量重绘」算，不按被探针撑大的 handle:5 算
      const blendedUs = hitRate * projUs + fullRate * baseTodayUs
      const availMs = (n0 * (todayUs + gapUs)) / 1000
      const n = blendedUs + gapUs > 0 ? (availMs * 1000) / (blendedUs + gapUs) : 0
      const winS = ((msg?.windowMs ?? 3000) || 3000) / 1000
      // 60fps 门槛：命中率 100% 时，单条要便宜到能在同样的线程预算里跑满 60×窗口 条
      const gate60Us = Math.max(0, (availMs * 1000) / (60 * winS) - gapUs)
      const nUniform =
        projUniformUs + gapUs > 0 ? (availMs * 1000) / (hitRate * projUniformUs + fullRate * baseTodayUs + gapUs) : 0
      return {
        deserUs, otherUs, bandUs, bandUniformUs, selUs, unitUs, measured, baseTodayUs,
        projUs, projUniformUs, hitRate, skipRate, blendedUs, availMs,
        n, fps: n / winS, fpsToday: n0 / winS, fpsUniform: nUniform / winS, gate60Us,
      }
    }

    return [
      {
        // Phase 1.2（视口背压）的验收就看这一行：改前平移时 12349ms（render 在画 12.3 秒前的
        // 视口），而主线程同时报 101fps —— 主线程帧率对此完全失明（结论 14）。
        // 背压生效后主线程在收到 ViewRendered 回执前只保留最新的一条待发 ⇒ 队列窗口恒为 1，
        // 这个数应该塌回个位数。它现在是唯一的「消费者是否跟得上」的判据，所以打 ✓/✗。
        label: '★ 队列积压 probe:lag (ms)',
        value: `${fmt(lag?.avg, 0)}ms`,
        expect: '≈ 0',
        pass: (lag?.avg ?? 0) < 200,
        note:
          (lag?.avg ?? 0) > 200
            ? '探针消息排了这么久才被处理 ⇒ 这个线程跟不上投递速度，画面必然慢半拍（平移基线 12349ms）'
            : '队列基本空，线程跟得上',
      },
      {
        // ★ M1/M3（帧聚合）的估值行。动画单条 handle 拆成三段，看能省的那部分占多少：
        //   反序列化  —— N 条合 1 条能省掉 N−1 份「每条固定开销」（按字节的那部分省不掉）
        //   应用属性  —— 总工作量不变，合并后照样要做
        //   renderPens —— 一条也省不掉：每个动画图元的脏区必须单独 clip+clear+draw，
        //                取并集会把并集里没进 penIds 的图元一起擦掉（M2 已因此取消）
        // ⇒ **M1 的天花板 ≈ 反序列化那一段的总量**，不是整个 handle:RenderAnimation。
        label: '★ 动画单条拆解 反序列化 / 应用 / renderPens 总量 (ms)',
        value: `${fmt(totalMs(deserAnim), 0)} / ${fmt(animApplyMs, 0)} / ${fmt(totalMs(pensAnim), 0)}`,
        note: `合计 ${fmt(totalMs(anim), 0)}ms；M1 帧聚合的天花板是第一段 ${fmt(
          totalMs(deserAnim),
          0,
        )}ms，第三段 ${fmt(totalMs(pensAnim), 0)}ms（${fmt(pensAnim?.count, 0)} 次 × ${fmt(
          pensAnim?.avg,
        )}µs）聚合后原样保留`,
      },
      {
        label: '视口全量重绘 renderPens / 反序列化 avg (µs)',
        value: `${fmt(pensView?.avg, 0)} / ${fmt(deserView?.avg, 0)}`,
        note: `${fmt(pensView?.count, 0)} 次，每次画 ${fmt(
          penCountView?.avg,
          0,
        )} 个图元；这一段是 M7a/M8 的靶子（反序列化那部分是 D6 那个盲区的实测值）`,
      },
      // ── M7a（PanBlit）第 1 步：只量不改画面 ──
      {
        label: '★ M7a 整屏自拷贝 view:blit avg (µs)',
        value: `${fmt(blitUs, 0)}`,
        note:
          (blit?.count ?? 0) === 0
            ? '零样本 ⇒ 这一轮没有一条视口走得通「纯平移」判定，看下一行的退回原因'
            : `${fmt(blit?.count, 0)} 次，p50 ${fmt(blit?.p50, 0)} / p95 ${fmt(
                blit?.p95,
                0,
              )}；画布 ${fmt((canvasPx?.avg ?? 0) / 1e6, 2)}Mpx（dpr ${fmt(canvasDpr?.avg, 0)}）${
                Number.isNaN(blitMarginalUs)
                  ? '；没有一次读数低于 300µs'
                  : `；其中 ${fmt(blit4?.count, 0)} 次单读 <300µs，紧跟的 x4 批合计 ${fmt(
                      blit4?.avg,
                      0,
                    )}µs ⇒ 重复 blit 的边际单价只 ${fmt(
                      blitMarginalUs,
                      0,
                    )}µs（D14：这是有偏子集，只当边际价看）`
              }。门槛 ≤4200µs（见 §0.5-H14）${blitUs > 4200 ? ' ⇒ ✗ 超门槛' : blitUs > 0 ? ' ⇒ ✓' : ''}`,
      },
      {
        label: '★ 纯平移判定 命中 / 跳过 / 退回',
        value: `${fmt(viewPure, 0)} / ${fmt(viewSkip, 0)} / ${fmt(viewFullTotal, 0)}`,
        note: `<b>跳过</b> = 位移舍入成 0、画布已经是对的 ⇒ 一笔不画（第 4.5 步；关掉 panBlit 时它会落到下面的「不足半像素」里）。\
退回原因：首帧 ${fmt(viewFull('first'), 0)}、改尺寸 ${fmt(
          viewFull('resize'),
          0,
        )}、签名变(含缩放) ${fmt(viewFull('sig'), 0)}、位移不足半像素 ${fmt(
          viewFull('zero'),
          0,
        )}、位移超过画布 ${fmt(viewFull('far'), 0)}；签名开销 ${fmt(viewSig?.avg, 0)}µs。\
三档相加应当等于 recv:5 的条数 —— 不等就是有分支没计数`,
      },
      {
        label: '★★ 真实重绘 条/s（画面真的变了的那些）',
        value: (() => {
          const winS = (((msg?.windowMs ?? 3000) || 3000) as number) / 1000
          return fmt((viewPure + viewFullTotal) / winS, 1)
        })(),
        note: (() => {
          const winS = (((msg?.windowMs ?? 3000) || 3000) as number) / 1000
          const all = (view?.count ?? 0) / winS
          const real = (viewPure + viewFullTotal) / winS
          return `<b>这一行才是手感</b>：投递 ${fmt(all, 1)} 条/s 里有 ${fmt(
            viewSkip,
            0,
          )} 条是「视口一动没动、一笔不画」的空转，把它们算进帧率是自欺 —— \
第十三轮 114 条里 34 条空转、第十四轮 138 条里 58 条空转，<b>两轮的真实重绘率都是 27 条/s，一模一样</b>。\
第 4.5 步买到的是 render 的线程余量（78% → 50.5%），不是帧率。\
一圈往返 ${fmt((winS * 1000) / Math.max(1, view?.count ?? 1), 1)}ms 里 render 只占 ${fmt(
            ((view?.avg ?? 0) + (gapView?.avg ?? 0)) / 1000,
            2,
          )}ms ⇒ 限制者不在这个线程上（结论 29）`
        })(),
      },
      {
        label: '★★ 一圈往返拆解 回执→下一条 / 主→render / handle:5 (ms，p50)',
        value: `${fmt(tripAck?.p50 ?? 0, 0)} / ${fmt(tripPost?.p50 ?? 0, 0)} / ${fmt(
          (view?.p50 ?? 0) / 1000,
          1,
        )}`,
        note: (() => {
          if (!(tripPost?.count ?? 0)) {
            return '零样本 ⇒ 主线程还没盖 postedAt（第 4.6 步），或这一轮没有视口消息'
          }
          const winMs = ((msg?.windowMs ?? 3000) || 3000) as number
          const cycle = winMs / Math.max(1, view?.count ?? 1)
          // D18：三段**不能相加** —— trip:calc 与 trip:ack 都以 postedAt 为终点，
          // 是同一段等待的两个起点（trip:calc ⊂ trip:ack）。可加的串行链只有这三段：
          //   回执→下一条发出 + 主线程发出→render 入手 + render 自己处理
          // 而且 trip:ack 的 avg 会被极少数几百毫秒的离群点抬高一倍（第十五轮
          // avg 30.5 / p50 13 / max 1978），配平一律用 p50。
          const sum = (tripAck?.p50 ?? 0) + (tripPost?.p50 ?? 0) + (view?.p50 ?? 0) / 1000
          return `单位 ms（<b>Date.now() 跨线程可比，分辨率 1ms</b> —— 只看量级）。\
配平用 p50：${fmt(tripAck?.p50, 0)} + ${fmt(tripPost?.p50, 0)} + ${fmt(
            (view?.p50 ?? 0) / 1000,
            1,
          )} = <b>${fmt(sum, 1)}ms</b> vs 一圈 ${fmt(cycle, 1)}ms（差 ${fmt(cycle - sum, 1)}ms）。\
<b>D18：三段不可相加</b> —— calc→主 ${fmt(
            tripAck?.avg,
            0,
          )}ms 那一段（avg ${fmt(tripCalc?.avg, 0)} / p50 ${fmt(
            tripCalc?.p50,
            0,
          )}）与「回执→下一条」同以 postedAt 收尾，是后者的**子区间**，不是加数。\
<b>D19：主→render 与 msg:gap:5 ${fmt(
            (gapView?.avg ?? 0) / 1000,
            2,
          )}ms 不是同一个量</b> —— 后者从「上一条处理完」起算，含 render 在主线程发出之前就已空闲的那段 ⇒ 应当 ≥ 前者。\
「回执→下一条」占一圈 ${pct((tripAck?.p50 ?? 0) / Math.max(1, cycle))} ⇒ 它大就往主线程查（看主线程那一块的 main:ackWait）`
        })(),
      },
      {
        label: '★ L 形窄带占画布 avg / p95 (%)',
        value: `${fmt(bandPct?.avg)} / ${fmt(bandPct?.p95)}`,
        note: `位移 avg ${fmt(shift?.avg, 0)} / p95 ${fmt(
          shift?.p95,
          0,
        )} 设备像素；第十轮实测 wheelPan 4.67%（预估 5.41%，✓）、平移缩放 7.99%（平移更快）。\
帧率越高位移越小、窄带越窄 ⇒ M7a 自带正反馈`,
      },
      {
        label: '★ 窄带内图元数 avg / p95（实测，非估算）',
        value: `${fmt(bandCount?.avg, 0)} / ${fmt(bandCount?.p95, 0)}`,
        note: (() => {
          if (!(bandCount?.count ?? 0)) {
            return '零样本 ⇒ 没有一条走得通纯平移判定'
          }
          const est = ((penCountView?.avg ?? 0) * (bandPct?.avg ?? 0)) / 100
          const ratio = est > 0 ? (bandCount?.avg ?? 0) / est : 0
          return `占视口内 ${fmt(bandPctPens?.avg)}%（面积占比 ${fmt(
            bandPct?.avg,
          )}%）；按「面积 × 密度」估算是 ${fmt(est, 0)} 个 ⇒ 实测 / 估算 = ${fmt(
            ratio,
            2,
          )}×${
            ratio > 1.4
              ? ' ⚠️ 窄带比画布平均<b>密</b>（图元尺寸跨界／边缘聚集），成本模型必须用实测'
              : ratio > 0 && ratio < 0.8
                ? ' ⚠️ 窄带比画布平均<b>稀</b>：平移幅度接近场景尺寸时窄带扫在空白上（D15），\
这是<b>场景特性不是普遍规律</b> ⇒ 判门槛要用下面那档悲观值，别把这个折扣写进模型'
                : ' ⇒ 估算可用'
          }。其中 rotate≠0 的平均 ${fmt(
            bandRotated / Math.max(1, bandCount?.count ?? 1),
            1,
          )} 个/条（计数器是累计值 ${fmt(bandRotated, 0)}，除以 ${fmt(
            bandCount?.count,
            0,
          )} 条才与上面的 avg 同量纲）—— 最简 inkBox 对它们偏小，第 5 步补外接圆`
        })(),
      },
      {
        label: '★ 窄带选取开销 view:bandSelect avg (µs)',
        value: `${fmt(bandSelect?.avg, 0)}`,
        note: (() => {
          const scanned = bandScan?.avg ?? penCountView?.avg ?? 0
          const nsPer = scanned > 0 ? ((bandSelect?.avg ?? 0) * 1000) / scanned : 0
          const g = m7aProj().gate60Us
          const share = g > 0 ? (bandSelect?.avg ?? 0) / g : 0
          return `扫 ${fmt(scanned, 0)} 个图元 ⇒ <b>${fmt(
            nsPer,
            0,
          )} ns/图元</b>（对照：calc 的 calcInViewPens 连建数组带排序才 33ns ——\
 这是同机同轮的自带标尺，超过它两倍就是实现问题而不是工作量问题）。\
<b>不随窄带变窄而变小</b> ⇒ M7a 新增的固定开销：60fps 下单条预算 ${fmt(
            g / 1000,
          )}ms，它占 ${pct(share)}${
            share > 0.1 ? ' ⚠️ 超一成，必须先改选取再谈 M7a' : ' ✓'
          }`
        })(),
      },
      {
        // 第 4 步起才有样本。有了它，上面那一整套「预测」就只剩校对用途了（结论 16）。
        label: '★ M7a 窄带重绘 render:pens:5b avg (µs) / 图元数',
        value: (pens5b?.count ?? 0)
          ? `${fmt(pens5b?.avg, 0)} / ${fmt(penCount5b?.avg, 0)}（${fmt(pens5b?.count, 0)} 条命中）`
          : '— 快路径未开（options.panBlit === false 或全部退回全量）',
        note: (() => {
          if (!(pens5b?.count ?? 0)) {
            return '第 4 步打开 <code>panBlit</code> 后才有样本。\
A/B：<code>meta2d.setOptions({ panBlit: false })</code> 退回全量重绘，探针读数照采'
          }
          const p = m7aProj()
          const predUs = p.bandUs
          const full = pensView?.avg ?? 0
          const unit5b = (penCount5b?.avg ?? 0) > 0 ? (pens5b?.avg ?? 0) / (penCount5b?.avg ?? 1) : 0
          return `<b>这是实测，不是预测</b>：对照全量那次 render:pens:5 = ${fmt(
            full,
            0,
          )}µs / ${fmt(penCountView?.avg, 0)} 个 ⇒ 省了 ${pct(
            full > 0 ? 1 - (pens5b?.avg ?? 0) / full : 0,
          )}。单价 ${fmt(unit5b, 2)}µs/图元（全量那次 ${fmt(
            p.unitUs,
            2,
          )}）—— <b>两者该相等</b>，差得多说明窄带里的图元不是同一类（D12）。\
上一步的预测是 ${fmt(predUs, 0)}µs ⇒ 预测/实测 = ${fmt(
            (pens5b?.avg ?? 0) > 0 ? predUs / (pens5b?.avg ?? 1) : 0,
            2,
          )}×`
        })(),
      },
      {
        label: (pens5b?.count ?? 0)
          ? '★ M7a 之后单条视口预测 (ms)｜⚠️ 快路径已开，以 handle:5 实测为准'
          : '★ M7a 之后单条视口预测 (ms)',
        value: (() => {
          const p = m7aProj()
          return `${fmt(p.projUs / 1000)}（命中时） ⇒ 混入 ${fmt(
            p.hitRate * 100,
            0,
          )}% 命中 + ${fmt(p.skipRate * 100, 0)}% 跳过（按 0 算）后 ${fmt(
            p.blendedUs / 1000,
          )} ⇒ ${fmt(p.n, 0)} 条/窗口 = ${fmt(p.fps, 0)}fps`
        })(),
        note: (() => {
          const p = m7aProj()
          // 快路径一开，handle:5 就变成「命中的便宜条 + 退回的全量条」的混合，
          // 这一整套拆解的前提（handle:5 = 一次全量重绘）就没了 ⇒ 明说，别让人照读。
          const stale = (pens5b?.count ?? 0)
            ? `<b>⚠️ 这一行现在只能当校对用。</b>快路径已经开着，handle:5（${fmt(
                (view?.avg ?? 0) / 1000,
              )}ms）已是命中条与退回条的混合，不再是「一次全量重绘」——\
下面所有以它为基数的减法都不成立。要读 M7a 的成绩，直接看 handle:5 与上面那行<b>真实重绘 ${fmt(
                (viewPure + viewFullTotal) / (((msg?.windowMs ?? 3000) || 3000) / 1000),
                1,
              )} 条/s</b>（<b>不是</b>投递 ${fmt(
                (view?.count ?? 0) / (((msg?.windowMs ?? 3000) || 3000) / 1000),
                1,
              )} 条/s —— 跳过的那些不改画面）；要重建基数，<code>meta2d.setOptions({ panBlit: false })</code> 再跑一轮。<br>`
            : ''
          return `${stale}命中时拆解：反序列化 ${fmt(p.deserUs / 1000)} + 其余 ${fmt(
            p.otherUs / 1000,
          )} + 窄带 ${fmt(p.bandUs / 1000)}（${
            p.measured
              ? `实测 ${fmt(bandCount?.avg, 0)} 个 × ${fmt(p.unitUs, 2)}µs`
              : '按面积占比估算，窄带密度未必等于画布平均密度'
          }） + blit ${fmt(blitUs / 1000)} + 窄带选取 ${fmt(p.selUs / 1000)}（ms）。吞吐用本轮自己配平：\
线程预算 = ${fmt(p.availMs, 0)}ms（= ${fmt(view?.count, 0)} × (${fmt(
            (view?.avg ?? 0) / 1000,
          )} + ${fmt((gapView?.avg ?? 0) / 1000)})），今天 ${fmt(
            p.fpsToday,
            1,
          )}fps ⇒ 预测 ${fmt(p.fps, 0)}fps；60fps 门槛（命中时）≤${fmt(
            p.gate60Us / 1000,
          )}ms${p.projUs <= p.gate60Us ? ' ⇒ ✓' : ' ⇒ ✗'}。\
<b>悲观档</b>（窄带密度退化成画布平均 ${fmt(p.bandUniformUs / 1000)}ms）：单条 ${fmt(
            p.projUniformUs / 1000,
          )}ms = ${fmt(p.fpsUniform, 0)}fps${
            p.projUniformUs <= p.gate60Us ? ' ⇒ ✓' : ' ⇒ ✗ 过线只因为这个场景的窄带恰好空'
          }。\
退回的那些条按「摘掉探针的全量重绘」${fmt(p.baseTodayUs / 1000)}ms 计（handle:5 是 ${fmt(
            (view?.avg ?? 0) / 1000,
          )}ms，被探针的 blit + 窄带选取撑大了）`
        })(),
      },
      {
        label: '动画每次重绘的图元数 avg / max',
        value: `${fmt(penCount?.avg, 0)} / ${fmt(penCount?.max, 0)}`,
        note: '脏区内的全部图元，不只是变了的那几个',
      },
      {
        label: '★ 重绘面积占全画布 avg / p95（与画布求交）',
        value: `${fmt(clip?.avg)}% / ${fmt(clip?.p95)}%`,
        note:
          (clip?.avg ?? 0) > 50
            ? '接近整屏 ⇒ 「局部重绘」名不副实，脏区并集退化；但拆细脏区更贵（M2 已取消），出路是少发消息（M1/M3）与少重算（M7/M8）'
            : '局部重绘生效；剩下的成本在图元数而不在面积',
      },
      {
        label: '同上，不裁剪 render:clipRaw avg',
        value: `${fmt(clipRaw?.avg)}%`,
        note: '>100 说明脏区包围盒已经甩出视口；与上一行的差就是白算的部分',
      },
      {
        label: '无脏区（不设 clip）的重绘次数',
        value: `${fmt(noClip, 0)} / ${fmt((pensAnim?.count ?? 0) + (pensView?.count ?? 0), 0)}`,
        note: 'UpdateView / Resize / Option 这类整屏重置是正常的，Hover/Patch 出现就不正常',
      },
      {
        label: 'hover 擦旧 / 画新 avg (µs)',
        value: `${fmt(hClear?.avg)} / ${fmt(hDraw?.avg)}`,
        note: `${fmt(hClear?.count, 0)} / ${fmt(hDraw?.count, 0)} 次；两段相当 ⇒ 合并脏区可省一半（移出图元只擦不画 ${fmt(noPen, 0)} 次）`,
      },
      {
        label: 'hover 一步重绘的图元数 avg / max',
        value: `${fmt(hPens?.avg, 0)} / ${fmt(hPens?.max, 0)}`,
        note: '悬停 1 个图元却要连带重绘这么多 ⇒ getPensInPenBoundary 的并集范围',
      },
      {
        label: 'handle:RenderAnimation avg / p95 (µs)',
        value: `${fmt(anim?.avg)} / ${fmt(anim?.p95)}`,
        note: `${fmt(anim?.count, 0)} 次；动画洪流在渲染线程的单条成本，Phase 1 帧聚合的基线`,
      },
      {
        label: '★ handle:Patch avg / max (µs)',
        value: `${fmt(patch?.avg)} / ${fmt(patch?.max)}`,
        note: `${fmt(patch?.count, 0)} 次；M10 只量了 calc 侧，渲染线程这一段才是文本刷新的大头`,
      },
      {
        label: '↳ 擦旧一遍 / 画新一遍 avg (µs)',
        value: `${fmt(pOld?.avg)} / ${fmt(pNew?.avg)}`,
        // Phase 1.0a 的验收就看这一行：改前 pOld 35.1ms / pNew 33.8ms、samePass 5/5；
        // 改后 calc 不再发 oldBoundary ⇒ pOld 整个消失，samePass 必须归零。
        // samePass 仍 >0 说明 calc 侧的 skipOldPass 没生效，光看 handle:Patch 变小会误判。
        note: pOld
          ? `图元数 ${fmt(pOldIds?.avg, 0)} / ${fmt(pNewIds?.avg, 0)}；新旧完全相同而白画一遍 ${fmt(samePass, 0)} 次${
              samePass ? '（Phase 1.0a 未生效）' : ''
            }`
          : `✓ 擦旧那一遍已被 calc 侧跳过（Phase 1.0a）；只画新的 ${fmt(pNewIds?.avg, 0)} 个图元`,
      },
      {
        // 背压（Phase 1.2）不动 avg，只砍 count：43ms/条 ⇒ 能力 ~23 条/s，
        // 3s 采样里画得完的就只有 ~70 条，改前的 332 条是「收下了但排在队里」。
        // ⇒ avg 不变 + count 大幅下降 = 背压生效；avg 变小才是 M7/M8 的战果。
        label: 'handle:UpdateView 次数 · avg / max (µs)',
        value: `${fmt(view?.count, 0)} 次 · ${fmt(view?.avg)} / ${fmt(view?.max)}`,
        note: '平移时每条都是一次全视口重绘（基线 43ms × 332 条 = 14.3s 的活塞进 3s）。背压只让次数降到「画得完」的量，单条成本要靠 M7/M8',
      },
      {
        // 这一行回答「Phase 1.2 之后线程的账为什么差 380ms」。两个候选的读数长得完全不一样：
        //   (a) 每条消息的派发开销 ⇒ 动画那一列约 16µs，总量占大头
        //   (b)/(c) UpdateView 的入站反序列化 或 背压往返空闲 ⇒ 视口那一列约 9.7ms
        // ⚠ 空档里混着真正的空闲，只能用来定位 380ms 摊给了谁，不能当「可省的开销」读。
        label: '★ 消息间空档 msg:gap 视口 / 动画 avg (µs)',
        value: `${fmt(gapView?.avg)} / ${fmt(gapAnim?.avg)}`,
        note: `总量 ${fmt(gapTotal(gapView), 0)}ms（${fmt(gapView?.count, 0)} 条）/ ${fmt(
          gapTotal(gapAnim),
          0,
        )}ms（${fmt(gapAnim?.count, 0)} 条）—— 哪一列的总量大，那 380ms 就摊在它头上`,
      },
      {
        label: 'render → 主线程 每帧消息数 avg / max',
        value: `${fmt(msg?.perFrame?.avg)} / ${fmt(msg?.perFrame?.max, 0)}`,
        note: `共 ${fmt(msg?.total, 0)} 条，窗口 ${fmt(msg?.windowMs, 0)}ms；主要是 TextOutside 回传`,
      },
    ]
  }

  /** render worker 的整块输出（探针行 + 按 action 分解），没有报告时返回空串 */
  /**
   * 主线程探针（第 4.8 步）。
   *
   * 这个线程到第十五轮为止**一个埋点都没有**，而那一轮的结论恰好指向它：一圈往返 20.4ms
   * 里「render 发出回执 → 主线程发出下一条视口」占 16.8ms（82%），render 自己只占 4.7ms
   * （结论 29 / 30）。三个线程的占用分别是 calc 11%、hover 13%、render 51% —— 没有一个
   * 过 60%，限制者只能在剩下那个没被测量的线程上。
   *
   * ⚠ 两条读法：① 主线程没有 `message`（它用 `worker.postMessage`，不走探针钩的
   * `self.postMessage`）⇒ **窗口长度由调用方传**；② 单条动画消息只有几十 µs，落在
   * `performance.now()` 的 100µs 分辨率之下 ⇒ **avg 不是单价（D11）**，只看 avg × count
   * 的总量和占比。
   */
  private mainRows(rep: PerfReport | undefined, windowMs: number): Row[] {
    if (!rep) return []
    const t = rep.timing ?? {}
    const st = (k: string) => t[k] as Stats | undefined
    const totalMs = (s?: Stats) => ((s?.avg ?? 0) * (s?.count ?? 0)) / 1000
    // 主线程在 handler 里花掉的总时间：把所有 main:handle:* 加起来
    let busyMs = 0
    const perAction: Array<[number, number, Stats]> = []
    for (const [k, v] of Object.entries(t)) {
      const m = /^main:handle:(\d+)$/.exec(k)
      if (m) {
        const ms = totalMs(v as Stats)
        busyMs += ms
        perAction.push([Number(m[1]), ms, v as Stats])
      }
    }
    perAction.sort((a, b) => b[1] - a[1])
    const anim = st(`main:handle:${WorkerMessage.RenderAnimation}`)
    const fwdR = st('main:fwd:render')
    const fwdH = st('main:fwd:hover')
    const setVal = st('main:setValue:48')
    const ackWait = st('main:ackWait')
    const hAck = st(`main:handle:${ACTION_VIEW_RENDERED}`)
    const hView = st(`main:handle:${WorkerMessage.UpdateView}`)
    const pending = st('count:view:pending')?.count ?? 0
    const starved = st('count:view:starved')?.count ?? 0
    const dropped = st('count:view:dropped')?.count ?? 0
    const animMs = totalMs(anim)

    return [
      {
        label: '★★ 主线程占用（Σ main:handle:* / 采集窗口）',
        value: `${pct(busyMs / Math.max(1, windowMs))}（${fmt(busyMs, 0)}ms / ${fmt(windowMs, 0)}ms）`,
        expect: '< 60%',
        pass: busyMs / Math.max(1, windowMs) < 0.6,
        note: `按 action 从大到小：${
          perAction
            .slice(0, 4)
            .map(([a, ms, s]) => `${a} ${fmt(ms, 0)}ms(${fmt(s.count, 0)}条)`)
            .join('、') || '无样本'
        }。<b>这不是主线程的全部开销</b> —— rAF 回调、事件监听、样式计算都不在 handler 里 ⇒ \
这一行只是下界，过 60% 就已经确诊`,
      },
      {
        label: '★★ 动画中转占主线程 (ms / 占比)',
        value: `${fmt(animMs, 0)} / ${pct(animMs / Math.max(1, busyMs))}`,
        note: `${fmt(anim?.count, 0)} 条 × ${fmt(anim?.avg, 0)}µs（D11：avg 不是单价，只看总量）。\
拆开：转给 render ${fmt(totalMs(fwdR), 0)}ms + 转给 hover ${fmt(
          totalMs(fwdH),
          0,
        )}ms + setValue ${fmt(totalMs(setVal), 0)}ms。\
<b>每条都要各转发两份</b> ⇒ 按帧合并（M4）在主线程这一侧省掉的正是 (N−1)/N`,
      },
      {
        label: '★★ 回执在主线程队列里排了多久 main:ackWait (ms)',
        value: `${fmt(ackWait?.avg, 1)} / p50 ${fmt(ackWait?.p50, 0)} / p95 ${fmt(ackWait?.p95, 0)}`,
        note: (() => {
          if (!(ackWait?.count ?? 0)) {
            return '零样本 ⇒ render 还没在回执上盖 sentAt（第 4.8 步）'
          }
          return `<b>这是「回执→下一条视口」那一段的第一截</b>（第十五轮整段 p50 13ms、占一圈 82%）。\
它大 ⇒ 主线程被动画洪流堵住，该做 M4；它小而整段还是大 ⇒ 主线程在空等 calc 回话，M4 帮不上。\
主线程处理回执本身只要 ${fmt((hAck?.avg ?? 0), 0)}µs，视口转发 ${fmt((hView?.avg ?? 0), 0)}µs`
        })(),
      },
      {
        label: '★★ 回执到时手上有货 / 空等 / 被替换掉的视口',
        value: `${fmt(pending, 0)} / ${fmt(starved, 0)} / ${fmt(dropped, 0)}`,
        note: `<b>有货</b>（pending）= 回执一到就有待发的视口 ⇒ 圈速受限于主线程自己；\
<b>空等</b>（starved）= 回执到了却没货，要等 calc 下一条 ⇒ 受限于 calc 的节奏。\
前两项相加 = 回执条数；<b>被替换掉</b>（dropped）+ 实发条数应当等于 calc 回的 UpdateView 总数 \
（第十五轮 calc 回 317、render 收 143 ⇒ 应当被替换 174）`,
      },
      {
        label: '★★ 视口消息在主线程拆开 (ms 总量)',
        value: (() => {
          const d = totalMs(st(`main:deser:${WorkerMessage.UpdateView}`))
          const p = totalMs(st('main:view:post'))
          const s = totalMs(st('main:view:set'))
          const i = totalMs(st('main:view:images'))
          return `解码 ${fmt(d, 0)} · 转发 ${fmt(p, 0)} · Set ${fmt(s, 0)} · 图片 ${fmt(i, 0)} · handle ${fmt(totalMs(hView), 0)}`
        })(),
        note: `第五十七轮（只量不改）。解码在 handle 之外（D47），另三段 ⊆ handle。<b>解码 / Set / 图片每条都付，\
包括随后被背压丢掉的</b>；转发只有真发出的那条付（出站克隆）。哪段大就改哪段：解码大 ⇒ 协议（M3，id 换成紧凑编码）；\
Set / 图片大 ⇒ 延到真发出时再做`,
      },
    ]
  }

  private mainBlock(rep: PerfReport | undefined, windowMs: number) {
    if (!rep) return ''
    return (
      '<div class="perf-sub">主线程（第 4.8 步新增：此前唯一没有探针的线程）</div>' +
      this.table('', this.mainRows(rep, windowMs))
    )
  }

  private renderBlock(rep?: PerfReport) {
    if (!rep) return ''
    return (
      '<div class="perf-sub">render worker（基线 + Phase 1.2 背压验收）</div>' +
      this.table('', this.renderRows(rep)) +
      this.actionTable(rep)
    )
  }

  private table(title: string, rows: Row[]) {
    const head = title ? `<div class="perf-sub">${title}</div>` : ''
    const body = rows
      .map((r) => {
        const mark = r.pass === undefined ? '' : r.pass ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'
        return `<tr>
          <td class="k">${r.label}</td>
          <td class="v">${r.value}</td>
          <td class="e">${r.expect ?? ''}</td>
          <td class="m">${mark}</td>
          <td class="n">${r.note ?? ''}</td>
        </tr>`
      })
      .join('')
    return `${head}<table class="perf-table"><tbody>${body}</tbody></table>`
  }

  /** 把 message.byAction 与 timing['handle:N'] 合成一张按消息类型的表 */
  private actionTable(rep?: PerfReport) {
    if (!rep) return ''
    const sent = rep.message?.byAction ?? {}
    const recvCost = new Map<number, Stats>()
    const recvCount = new Map<number, number>()
    for (const [k, v] of Object.entries(rep.timing ?? {})) {
      let mm = /^handle:(\d+)$/.exec(k)
      if (mm) recvCost.set(+mm[1], v as Stats)
      mm = /^count:recv:(\d+)$/.exec(k)
      if (mm) recvCount.set(+mm[1], (v as Stats).count)
    }
    const actions = new Set<number>([
      ...Object.keys(sent).map(Number),
      ...recvCost.keys(),
      ...recvCount.keys(),
    ])
    const rows = [...actions]
      .sort((a, b) => (recvCount.get(b) ?? sent[b] ?? 0) - (recvCount.get(a) ?? sent[a] ?? 0))
      .map((a) => {
        const c = recvCost.get(a)
        return `<tr>
          <td class="k">${(WorkerMessage as any)[a] ?? a}</td>
          <td class="v">收 ${fmt(recvCount.get(a), 0)} / 发 ${fmt(sent[a], 0)}</td>
          <td class="e">${c ? `avg ${fmt(c.avg)}µs` : ''}</td>
          <td class="m"></td>
          <td class="n">${c ? `p95 ${fmt(c.p95)}µs · max ${fmt(c.max)}µs` : ''}</td>
        </tr>`
      })
      .join('')
    return `<table class="perf-table"><tbody>${rows}</tbody></table>`
  }
}
