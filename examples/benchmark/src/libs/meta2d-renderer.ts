import { createMeta2d, type Meta2d } from '@meta2d/core'
import { BaseRenderer, type TextRefreshProp } from './base-renderer'

/** 背景色刷新的取值（预先生成，避免每次刷新都拼 8000 个颜色字符串） */
const REFRESH_COLORS = ['#2f6fdf', '#1e9e6a', '#d9822b', '#c23b5a', '#7b4fd6', '#3a8fa3']
/** 「混合」模式下按图元下标轮流改的属性 */
const MIXED_PROPS: TextRefreshProp[] = ['text', 'background', 'y']

/**
 * 让图元具备 hover / active 视觉反馈，供手动验证鼠标拾取用。
 *
 * `interactive` 是关键：`meta2d-message.ts:362` 用 `if (this.hover.interactive)`
 * 决定要不要给 render worker 发 Hover 消息。不置位的话拾取照样在跑，但**画面上
 * 完全看不出来** —— 这正是之前无法肉眼验证 M9 的原因。
 *   Style(1) 让 hover/active 换色生效，Event(2) 让默认色也能兜底，一起置上。
 *
 * ⚠ active 只在 Edit 模式下可见：render worker 的判定是 `activeMap[pen.id] > 1`，
 * 而 Run 模式根本不产生选中态（`meta2d-mouse.ts:956` 把拖拽和框选都关了）。
 */
const INTERACTIVE_STYLE = {
  interactive: 3,              // InteractiveType.Style | InteractiveType.Event
  hoverColor: '#ff6b00',       // 悬停描边：橙
  hoverBackground: '#ffd8b0',  // 悬停填充：浅橙
  activeColor: '#d81b60',      // 选中描边：品红
  activeBackground: '#ffc1d9'  // 选中填充：浅粉
}

const npmUrl = (pkg: string): string => {
  // if (import.meta.env.DEV) {
    pkg = pkg.replaceAll('@meta2d/', '');
    return `/npm/${pkg}/index.ts`;
  // }
  // return `/npm/${pkg.replace(/\//g, '_')}.js`;
};

/**
 * Meta2d 渲染器
 * 使用 meta2d.js 的正确方式：createMeta2d + Web Component
 */
export class Meta2dRenderer extends BaseRenderer {
  private meta2d: Meta2d | null = null
  private container: HTMLElement
  private textPenIds: string[] = []
  /** 文本图元的初始 y（位置刷新的基准） */
  private textBaseY: number[] = []
  private animationPenIds: string[] = []

  constructor(canvasId: string) {
    super(canvasId)
    // 替换 canvas 为 meta2d 的 Web Component
    this.container = this.canvas.parentElement!
    this.container.innerHTML = '<le5le-meta2d></le5le-meta2d>'

    // 使用 createMeta2d 初始化
    this.initMeta2d()
  }

  /**
   * 初始化 Meta2d
   */
  private async initMeta2d() {
    createMeta2d()
    const instance = this.container.querySelector('le5le-meta2d') as Meta2d | null
    if (!instance) {
      throw new Error('Meta2d element not found')
    }

    this.meta2d = instance
    // 等待 meta2d 就绪
    await instance.ready
    this.meta2d.register(npmUrl('@meta2d/form')),
    globalThis.meta2d = this.meta2d;
    // 确保 meta2d 已完全初始化
    if (!this.meta2d.getData) {
      throw new Error('Meta2d not fully initialized')
    }
  }

  /**
   * 暴露底层实例，供性能探针面板使用
   */
  getMeta2d(): Meta2d | null {
    return this.meta2d
  }

  /** 首屏真正画出来（见 waitFirstPaint）；在 open 之前开始监听 */
  private firstPaint: Promise<void> | null = null

  /**
   * meta2d 在 worker 里画（OffscreenCanvas）：open() 返回时只是把数据发出去了，worker 还要解析、建索引才画第一帧。
   * 等 render 回报「画了图元」的第一条视口（viewRendered 且 pens > 0）。一个图元都没有时 pens 恒为 0，
   * 所以带超时兜底，不至于一直等下去。
   */
  private listenFirstPaint(): Promise<void> {
    const meta2d = this.meta2d!
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer)
        meta2d.off('viewRendered', onRendered)
        resolve()
      }
      const onRendered = (e: { pens?: number }) => {
        if ((e?.pens ?? 0) > 0) {
          done()
        }
      }
      const timer = setTimeout(done, 120000)
      meta2d.on('viewRendered', onRendered)
    })
  }

  async waitFirstPaint(): Promise<void> {
    if (this.firstPaint) {
      await this.firstPaint
    }
    // worker 画完 → 合成器上屏还要一帧
    await super.waitFirstPaint()
  }

  /**
   * 确保 meta2d 已初始化
   */
  private async ensureMeta2dReady(): Promise<void> {
    if (!this.meta2d) {
      await this.initMeta2d()
    }
  }

  /**
   * 生成图元ID
   */
  private generateId(): string {
    return (((1 + Math.random()) * 0x100000000) | 0).toString(16).substring(1)
  }

  /**
   * 根据图元数量计算合适的大小
   */
  private calculateSize(count: number): number {
    if (count < 2000) {
      return 20
    } else if (count < 5000) {
      return 15
    } else if (count <= 8000) {
      return 10
    } else {
      return 5
    }
  }

  /**
   * 渲染图元（矩形）- 从左上角开始平铺
   */
  async renderPrimitives(count: number): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) {
      throw new Error('Meta2d not initialized')
    }

    this.primitives = []

    const size = this.calculateSize(count) // 根据数量计算大小
    const gap = 5   // 间距
    const itemWidth = size + gap

    // 计算每行可以放多少个
    const cols = Math.floor(this.width / itemWidth)
    console.log("num",count)
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const pen = {
        id: this.generateId(),
        type: 'rectangle',
        x: col * itemWidth,
        y: row * itemWidth,
        width: size,
        height: size,
        background: '#58cc84',
        locked: 0,  // 允许拖拽
        ...INTERACTIVE_STYLE
      }

      this.primitives.push(pen)
    }

    // 不在这里 open，等所有图元生成完成后统一 open
  }

  /**
   * 渲染图片 - 从左上角开始平铺，与矩形大小对齐
   */
  async renderImages(count: number): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) return

    this.images = []

    const size = this.calculateSize(count) // 根据数量计算大小
    const gap = 5   // 间距
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const pen = {
        id: this.generateId(),
        type: 'image',
        image: '/img/test.svg',
        x: x,
        y: y,
        width: size,
        height: size,
        ex: x + size,
        ey: y + size,
        pivot: {
          x: x + size / 2,
          y: y + size / 2
        },
        rotate: 0,
        borderRadius: 0,
        ...INTERACTIVE_STYLE
      }

      this.images.push(pen)
    }

    // 不在这里 open，等所有图元生成完成后统一 open
  }

  /**
   * 渲染文本（数据点）- 从左上角开始平铺，与矩形大小对齐
   */
  async renderTexts(count: number): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) return

    this.texts = []
    this.textPenIds = []
    this.textBaseY = []

    const size = this.calculateSize(count) // 根据数量计算大小
    const gap = 5   // 间距
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)
    const fontSize = Math.max(8, size / 2) // 根据大小调整字体

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const id = this.generateId()
      const pen = {
        id,
        type: 'text',
        text: this.randomValue().toString(),
        x: col * itemWidth,
        y: row * itemWidth,
        width: size,
        height: size,
        fontSize: fontSize,
        color: '#fff',
        ...INTERACTIVE_STYLE,
        textHoverColor: '#ff6b00'  // 文本图元另有独立的 hover 字色（render worker:1113）
      }

      this.texts.push(pen)
      this.textPenIds.push(id)
      this.textBaseY.push(pen.y)
    }

    // 不在这里 open：startAnimations 给矩形加上动画后统一 open 一次。
    // 原来这里和 startAnimations 各 open 一次、两次是同一批图元 ⇒ 主线程的克隆、worker 的解析全做两遍，
    // 100 万图元时多出 ~7s
  }

  /**
   * 更新文本内容（模拟数据刷新）
   */
  updateTexts(prop: TextRefreshProp = 'text'): void {
    if (!this.meta2d) return

    // 使用 setValue 方法更新（模拟绑定在不同属性上的实时数据）
    this.textPenIds.forEach((id, i) => {
      const kind = prop === 'mixed' ? MIXED_PROPS[i % MIXED_PROPS.length] : prop
      if (kind === 'background') {
        this.meta2d!.setValue({ id, background: REFRESH_COLORS[(Math.random() * REFRESH_COLORS.length) | 0] })
      } else if (kind === 'y') {
        // 在原位置上下 0~3px 抖动：动几何，走 calc 的网格维护
        // 基准取 renderTexts 时记下的：this.texts[i] 就是 meta2d 里的图元对象，y 已经被上一次刷新改过
        this.meta2d!.setValue({ id, y: this.textBaseY[i] + ((Math.random() * 4) | 0) })
      } else {
        this.meta2d!.setValue({ id, text: this.randomValue().toString() })
      }
    })
  }

  /**
   * 启动动画
   */
  async startAnimations(count: number): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) return

    this.animations = []
    this.animationPenIds = []

    // 给前 count 个矩形添加上下跳动动画
    const animationCount = Math.min(count, this.primitives.length)

    // 修改图元数据，添加动画配置
    for (let i = 0; i < animationCount; i++) {
      const pen = this.primitives[i]

      // 修改带动画的矩形颜色
      pen.background = '#ff595999'

      // 配置上下跳动动画
      pen.animations = [
        {
          animate: '上下跳动',
          name: '动画1',
          frames: [
            {
              properties: {
                y: -10
              },
              transitional: {
                y: true
              },
              duration: 100,
              timingFunction: 0
            },
            {
              properties: {
                y: 10
              },
              transitional: {
                y: true
              },
              duration: 100,
              timingFunction: 0
            },
            {
              properties: {
                y: -10
              },
              transitional: {
                y: true
              },
              duration: 200,
              timingFunction: 0
            }
          ]
        }
      ]
      pen.currentAnimation = 0
      pen.autoPlay = true

      this.animations.push(pen)
      this.animationPenIds.push(pen.id)
    }

    // 统一 open 一次（含所有图元；动画数为 0 时也要 open）。open 之前就开始等首屏，免得漏掉很快回来的那一条
    this.firstPaint = this.listenFirstPaint()
    this.meta2d.open({
      pens: [...this.primitives, ...this.images, ...this.texts]
    })

    // 启动动画
    if (this.meta2d.startAnimate) {
      this.meta2d.startAnimate()
    }
  }

  /**
   * 加载示例 JSON 文件
   */
  async loadExample(jsonUrl: string): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) {
      throw new Error('Meta2d not initialized')
    }

    try {
      const response = await fetch(jsonUrl)
      if (!response.ok) {
        throw new Error(`加载失败: ${response.statusText}`)
      }
      const data = await response.json()

      // 使用 meta2d.open 加载数据
      this.meta2d.open(data)

      // 清空之前的数据引用（因为现在是加载的外部数据）
      this.primitives = []
      this.images = []
      this.texts = []
      this.animations = []
      this.textPenIds = []
      this.textBaseY = []
      this.animationPenIds = []

      console.log('示例加载成功:', jsonUrl)
    } catch (error) {
      console.error('加载示例失败:', error)
      throw error
    }
  }

  /**
   * 加载示例数据（直接传入 JSON 对象）
   */
  async loadExampleData(data: any): Promise<void> {
    await this.ensureMeta2dReady()

    if (!this.meta2d) {
      throw new Error('Meta2d not initialized')
    }

    try {
      // 使用 meta2d.open 加载数据
      this.meta2d.open(data)

      // 清空之前的数据引用（因为现在是加载的外部数据）
      this.primitives = []
      this.images = []
      this.texts = []
      this.animations = []
      this.textPenIds = []
      this.textBaseY = []
      this.animationPenIds = []

      console.log('数据加载成功')
    } catch (error) {
      console.error('加载数据失败:', error)
      throw error
    }
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    if (this.meta2d && typeof (this.meta2d as any).destroy === 'function') {
      (this.meta2d as any).destroy()
    }
    this.meta2d = null
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
    this.textPenIds = []
    this.textBaseY = []
    this.animationPenIds = []
  }
}
