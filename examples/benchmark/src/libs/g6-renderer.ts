import { Graph } from '@antv/g6'
import { BaseRenderer } from './base-renderer'

/**
 * G6 渲染器
 * 使用 AntV G6 图可视化引擎
 */
export class G6Renderer extends BaseRenderer {
  private graph: Graph | null = null
  private nodeIds: string[] = []
  private imageNodeIds: string[] = []
  private textNodeIds: string[] = []
  private animationNodeIds: string[] = []
  private animationFrameId: number | null = null

  constructor(canvasId: string) {
    super(canvasId)
    this.initGraph()
  }

  /**
   * 初始化 G6 Graph
   */
  private initGraph() {
    // G6 需要一个 div 容器而不是 canvas
    const container = this.canvas.parentElement!
    container.innerHTML = '<div id="g6-container" style="width: 100%; height: 100%;"></div>'

    this.graph = new Graph({
      container: 'g6-container',
      width: this.width,
      height: this.height,
      // 启用拖拽交互
      behaviors: ['drag-element', 'zoom-canvas', 'drag-canvas'],
      // 性能优化配置
      enabledStack: false // 关闭撤销重做栈
    })
  }

  /**
   * 生成节点ID
   */
  private generateId(): string {
    return `node-${Math.random().toString(36).substr(2, 9)}`
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
    if (!this.graph) return

    this.primitives = []
    this.nodeIds = []

    const size = this.calculateSize(count)
    const gap = 20
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    console.log('G6 renderPrimitives:', { count, size, gap, itemWidth, cols, width: this.width })

    const nodes = []
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const id = this.generateId()
      const x = col * itemWidth + size / 2  // 中心点 x
      const y = row * itemWidth + size / 2  // 中心点 y

      // 打印前几个节点的坐标
      if (i < 5) {
        console.log(`Node ${i}:`, { x, y, width: size, height: size })
      }

      const node = {
        id,
        type: 'rect',
        style: {
          x,
          y,
          width: size,
          height: size,
          fill: '#58cc84',
          radius: 0
        }
      }

      nodes.push(node)
      this.nodeIds.push(id)
      this.primitives.push(node)
    }

    // 批量添加节点
    this.graph.addData({ nodes })
    await this.graph.render()
  }

  /**
   * 渲染图片 - 从左上角开始平铺
   */
  async renderImages(count: number): Promise<void> {
    if (!this.graph) return

    this.images = []
    this.imageNodeIds = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    const nodes = []
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const id = this.generateId()
      const node = {
        id,
        type: 'image',
        style: {
          x: col * itemWidth + size / 2,  // 中心点 x
          y: row * itemWidth + size / 2,  // 中心点 y
          width: size,
          height: size,
          src: '/img/test.svg'
        }
      }

      nodes.push(node)
      this.imageNodeIds.push(id)
      this.images.push(node)
    }

    // 批量添加节点
    this.graph.addData({ nodes })
    await this.graph.render()
  }

  /**
   * 渲染文本（数据点）- 从左上角开始平铺
   */
  async renderTexts(count: number): Promise<void> {
    if (!this.graph) return

    this.texts = []
    this.textNodeIds = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)
    const fontSize = Math.max(8, size / 2)

    const nodes = []
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols

      const id = this.generateId()
      const value = this.randomValue()
      const node = {
        id,
        type: 'rect',
        style: {
          x: col * itemWidth + size / 2,  // 中心点 x
          y: row * itemWidth + size / 2,  // 中心点 y
          width: size,
          height: size,
          // fill: '#1890ff',
          radius: 2,
          labelText: value.toString(),
          labelFontSize: fontSize
        },
        data: {
          value: value
        }
      }

      nodes.push(node)
      this.textNodeIds.push(id)
      this.texts.push(node)
    }

    // 批量添加节点
    this.graph.addData({ nodes })
    await this.graph.render()
  }

  /**
   * 更新文本内容（模拟数据刷新）
   */
  updateTexts(): void {
    if (!this.graph) return

    // 批量更新节点文本
    const updates = this.textNodeIds.map(id => ({
      id,
      style: {
        labelText: this.randomValue().toString()
      }
    }))

    this.graph.updateNodeData(updates)
    this.graph.draw() // 手动触发重绘
  }

  /**
   * 启动动画
   */
  async startAnimations(count: number): Promise<void> {
    if (!this.graph) return

    this.animations = []
    this.animationNodeIds = []

    // 给前 count 个矩形添加上下跳动动画
    const animationCount = Math.min(count, this.nodeIds.length)

    for (let i = 0; i < animationCount; i++) {
      const id = this.nodeIds[i]
      this.animationNodeIds.push(id)

      // 修改节点颜色标记为动画节点
      this.graph.updateNodeData([{
        id,
        style: {
          fill: '#ff5959'
        }
      }])
    }

    // 启动动画循环
    this.startAnimationLoop()
  }

  /**
   * 动画循环
   */
  private startAnimationLoop() {
    if (!this.graph) return

    let startTime = Date.now()
    const animationDuration = 400 // 总周期 400ms

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % animationDuration) / animationDuration

      // 计算上下跳动的偏移量（-10 到 +10）
      let offsetY = 0
      if (progress < 0.25) {
        // 0-100ms: 向上到 -10
        offsetY = -10 * (progress / 0.25)
      } else if (progress < 0.5) {
        // 100-200ms: 从 -10 到 +10
        offsetY = -10 + 20 * ((progress - 0.25) / 0.25)
      } else {
        // 200-400ms: 从 +10 回到 -10
        offsetY = 10 - 20 * ((progress - 0.5) / 0.5)
      }

      // 批量更新动画节点位置
      const updates = this.animationNodeIds.map((id, index) => {
        const node = this.primitives[index]
        if (!node || !node.style) return null

        // 计算原始中心点 y 坐标
        const row = Math.floor(index / Math.floor(this.width / ((node.style.width || 20) + 5)))
        const size = node.style.width || 20
        const itemWidth = size + 5
        const originalY = row * itemWidth + size / 2

        return {
          id,
          style: {
            y: originalY + offsetY
          }
        }
      }).filter(Boolean)

      if (updates.length > 0) {
        this.graph!.updateNodeData(updates as any)
      }

      this.animationFrameId = requestAnimationFrame(animate)
    }

    this.animationFrameId = requestAnimationFrame(animate)
  }

  /**
   * 停止动画
   */
  private stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    this.stopAnimation()

    if (this.graph) {
      this.graph.destroy()
      this.graph = null
    }

    this.nodeIds = []
    this.imageNodeIds = []
    this.textNodeIds = []
    this.animationNodeIds = []
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
  }
}
