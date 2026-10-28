// @ts-ignore
import Stats from 'stats.js'

/**
 * 性能监控工具
 * 使用 Stats.js 实现，与 canvas-benchmark 项目保持一致
 */
export class PerformanceMonitor {
  private fpsStats: Stats
  private firstPaintStats: Stats
  private jsMemoryDiv: HTMLElement
  private firstTimeDiv: HTMLElement
  private backgroundDiv: HTMLElement
  private topOffset: number = 0
  private firstPaintStartTime: number = 0

  constructor() {
    // 创建深色背景容器
    this.backgroundDiv = document.createElement('div')
    this.backgroundDiv.style.position = 'fixed'
    this.backgroundDiv.style.right = '10px'
    this.backgroundDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'
    this.backgroundDiv.style.padding = '10px'
    this.backgroundDiv.style.borderRadius = '4px'
    this.backgroundDiv.style.pointerEvents = 'none'
    this.backgroundDiv.style.zIndex = '9999'
    document.body.appendChild(this.backgroundDiv)

    // 创建 FPS 监控
    this.fpsStats = new Stats()
    const fpsDom = this.fpsStats.dom as HTMLDivElement
    fpsDom.style.pointerEvents = 'none'
    fpsDom.style.position = 'relative'
    fpsDom.style.display = 'flex'
    const fpsChildren = fpsDom.childNodes as any as HTMLCanvasElement[]
    fpsChildren.forEach((item) => { item.style.display = 'block' })
    fpsChildren[1].style.display = 'none'
    this.backgroundDiv.appendChild(fpsDom)

    // 创建 First Paint 监控
    this.firstPaintStats = new Stats()
    this.firstPaintStats.showPanel(1)
    const firstPaintDom = this.firstPaintStats.dom as HTMLDivElement
    firstPaintDom.style.pointerEvents = 'none'
    firstPaintDom.style.position = 'relative'
    firstPaintDom.style.display = 'flex'
    firstPaintDom.style.marginTop = '10px'
    this.backgroundDiv.appendChild(firstPaintDom)

    // 创建 JS Memory 文本显示
    this.jsMemoryDiv = document.createElement('div')
    this.jsMemoryDiv.id = 'js-memory'
    this.jsMemoryDiv.style.position = 'relative'
    this.jsMemoryDiv.style.fontSize = '12px'
    this.jsMemoryDiv.style.color = '#0ff'
    this.jsMemoryDiv.style.fontFamily = 'monospace'
    this.jsMemoryDiv.style.pointerEvents = 'none'
    this.jsMemoryDiv.style.marginTop = '10px'
    this.backgroundDiv.appendChild(this.jsMemoryDiv)

    // 创建 First Time 文本显示
    this.firstTimeDiv = document.createElement('div')
    this.firstTimeDiv.id = 'first-time'
    this.firstTimeDiv.style.position = 'relative'
    this.firstTimeDiv.style.fontSize = '12px'
    this.firstTimeDiv.style.color = '#0f0'
    this.firstTimeDiv.style.fontFamily = 'monospace'
    this.firstTimeDiv.style.pointerEvents = 'none'
    this.firstTimeDiv.style.marginTop = '5px'
    this.backgroundDiv.appendChild(this.firstTimeDiv)

    // 计算 top 偏移量
    this.updateTopOffset()

    // 延迟启动动画循环，确保 DOM 完全渲染和布局计算完成
    setTimeout(() => {
      this.startFPSMonitoring()
      this.startMemoryMonitoring()
    }, 100)
  }

  /**
   * 更新 top 偏移量（根据控制栏高度）
   */
  public updateTopOffset() {
    const controlBar = document.querySelector('.control-bar')
    if (controlBar) {
      const rect = controlBar.getBoundingClientRect()
      this.topOffset = Math.ceil(rect.height)
    } else {
      this.topOffset = 80 // 默认值
    }

    // 更新背景容器的 top 位置
    this.backgroundDiv.style.top = this.topOffset + 'px'
  }

  /**
   * 启动 FPS 监控
   */
  private startFPSMonitoring() {
    // 检查 canvas 是否已正确初始化
    const canvas = this.fpsStats.dom.querySelector('canvas')
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.warn('Stats.js canvas 尚未初始化，延迟启动 FPS 监控')
      setTimeout(() => this.startFPSMonitoring(), 100)
      return
    }

    const animate = () => {
      this.fpsStats.update()
      requestAnimationFrame(animate)
    }
    animate()
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring() {
    const updateMemory = () => {
      const memory = this.getJSMemory()
      this.jsMemoryDiv.textContent = `JS Memory: ${memory.toFixed(2)} MB`
      setTimeout(updateMemory, 1000)
    }
    updateMemory()
  }

  /**
   * 获取 JS 内存使用量（MB）
   */
  getJSMemory(): number {
    if (performance && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024
    }
    return 0
  }

  /**
   * 开始首屏时间计时
   */
  startFirstPaint() {
    this.firstPaintStartTime = performance.now()
    this.firstPaintStats.begin()
  }

  /**
   * 结束首屏时间计时
   */
  endFirstPaint() {
    requestAnimationFrame(() => {
      this.firstPaintStats.end()
      // 计算实际首屏时间
      const firstPaintTime = performance.now() - this.firstPaintStartTime
      this.firstTimeDiv.textContent = `First Time: ${firstPaintTime.toFixed(2)} ms`
    })
  }

  /**
   * 设置首屏时间（毫秒）
   */
  setFirstPaintTime(time: number) {
    this.firstTimeDiv.textContent = `First Time: ${time.toFixed(2)} ms`
  }

  /**
   * 获取当前 FPS
   */
  getCurrentFPS(): number {
    // Stats.js 内部维护 FPS，这里返回一个估算值
    return 60 // 简化实现
  }

  /**
   * 获取所有性能指标
   */
  getMetrics() {
    return {
      fps: this.getCurrentFPS(),
      memory: this.getJSMemory()
    }
  }

  /**
   * 重置监控数据
   */
  reset() {
    this.firstTimeDiv.textContent = 'First Time: 0 ms'
  }

  /**
   * 销毁监控
   */
  destroy() {
    if (this.fpsStats && this.fpsStats.dom) {
      document.body.removeChild(this.fpsStats.dom)
    }
    if (this.firstPaintStats && this.firstPaintStats.dom) {
      document.body.removeChild(this.firstPaintStats.dom)
    }
    if (this.jsMemoryDiv) {
      document.body.removeChild(this.jsMemoryDiv)
    }
    if (this.firstTimeDiv) {
      document.body.removeChild(this.firstTimeDiv)
    }
  }
}
