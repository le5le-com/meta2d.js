/** 数据刷新改哪个属性：文本 / 背景色 / 位置（动几何）/ 三种轮流 */
export type TextRefreshProp = 'text' | 'background' | 'y' | 'mixed'

/**
 * 渲染器基类
 * 定义各个渲染库需要实现的通用接口
 */
export abstract class BaseRenderer {
  protected canvas: HTMLCanvasElement
  protected width: number
  protected height: number
  protected primitives: any[] = []
  protected images: any[] = []
  protected texts: any[] = []
  protected animations: any[] = []

  constructor(canvasId: string) {
    const canvasEl = document.getElementById(canvasId)
    if (!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas element with id "${canvasId}" not found`)
    }
    this.canvas = canvasEl
    
    // 获取画布父容器的尺寸
    const parent = this.canvas.parentElement!
    this.width = parent.clientWidth
    this.height = parent.clientHeight
    
    this.canvas.width = this.width
    this.canvas.height = this.height
  }

  /**
   * 渲染图元（矩形）
   */
  abstract renderPrimitives(count: number): Promise<void>

  /**
   * 渲染图片
   */
  abstract renderImages(count: number): Promise<void>

  /**
   * 渲染文本（数据点）
   */
  abstract renderTexts(count: number): Promise<void>

  /**
   * 更新文本内容（模拟数据刷新）
   * @param prop 刷新哪个属性（实时数据可能绑定在任意属性上）。目前只有 meta2d 实现了文本以外的，其余库忽略
   */
  abstract updateTexts(prop?: TextRefreshProp): void

  /**
   * 启动动画
   */
  abstract startAnimations(count: number): Promise<void>

  /**
   * 等到首屏真正画到屏幕上，供 First Time 计时。
   *
   * 各库的 render 调用返回时不一定已经画了：有的在下一帧的 rAF 里画（leafer），有的在 worker 里画（meta2d）。
   * 默认等两帧：第一帧让在 rAF 里画的库画完，第二帧回调时上一帧已提交给合成器。在 worker 里画的库要覆盖它。
   */
  async waitFirstPaint(): Promise<void> {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  }

  /**
   * 销毁渲染器
   */
  abstract destroy(): void

  /**
   * 生成随机颜色
   */
  protected randomColor(): string {
    const hue = Math.floor(Math.random() * 360)
    return `hsl(${hue}, 70%, 50%)`
  }

  /**
   * 生成随机位置
   */
  protected randomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * (this.width - 100),
      y: Math.random() * (this.height - 100)
    }
  }

  /**
   * 创建图片 DataURL（用于测试）
   */
  protected createImageDataUrl(width: number, height: number, text: string, color: string): string {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 填充背景色
    ctx.fillStyle = color
    ctx.fillRect(0, 0, width, height)

    // 绘制一些装饰
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`
      ctx.beginPath()
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        10 + Math.random() * 20,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }

    // 绘制文字
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 40px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, width / 2, height / 2)

    return canvas.toDataURL()
  }

  /**
   * 生成随机数值（用于文本显示）
   */
  protected randomValue(): number {
    return Math.floor(Math.random() * 10000)
  }
}
