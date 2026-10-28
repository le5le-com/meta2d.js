import Konva from 'konva'
import { BaseRenderer } from './base-renderer'

/**
 * Konva.js 渲染器
 */
export class KonvaRenderer extends BaseRenderer {
  private stage: Konva.Stage
  private layer: Konva.Layer
  private animationInstance: Konva.Animation | null = null

  constructor(canvasId: string) {
    super(canvasId)

    // Konva 需要容器而不是 canvas
    const container = this.canvas.parentElement!
    container.removeChild(this.canvas)

    this.stage = new Konva.Stage({
      container: container,
      width: this.width,
      height: this.height
    })

    this.layer = new Konva.Layer()
    this.stage.add(this.layer)
  }

  /**
   * 计算图元大小（根据数量）
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

  async renderPrimitives(count: number): Promise<void> {
    this.primitives = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const rect = new Konva.Rect({
        x: x,
        y: y,
        width: size,
        height: size,
        fill: '#58cc84',
        draggable: true
      })

      this.primitives.push(rect)
      this.layer.add(rect)
    }

    this.layer.batchDraw()
  }

  async renderImages(count: number): Promise<void> {
    this.images = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    // 预加载图片
    const imageObj = new Image()
    await new Promise<void>((resolve) => {
      imageObj.onload = () => resolve()
      imageObj.src = '/img/test.svg'
    })

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const img = new Konva.Image({
        x: x,
        y: y,
        image: imageObj,
        width: size,
        height: size
      })

      this.images.push(img)
      this.layer.add(img)
    }

    this.layer.batchDraw()
  }

  async renderTexts(count: number): Promise<void> {
    this.texts = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const text = new Konva.Text({
        x: x,
        y: y,
        text: this.randomValue().toString(),
        fontSize: Math.max(8, size - 2),
        fill: '#fff'
      })

      this.texts.push(text)
      this.layer.add(text)
    }

    this.layer.batchDraw()
  }

  updateTexts(): void {
    this.texts.forEach((text: any) => {
      text.text(this.randomValue().toString())
    })
    this.layer.batchDraw()
  }

  async startAnimations(count: number): Promise<void> {
    this.animations = []

    const animationCount = Math.min(count, this.primitives.length)

    for (let i = 0; i < animationCount; i++) {
      const rect = this.primitives[i] as any
      rect.originalY = rect.y()
      rect.animationOffset = 0
      rect.animationDirection = 1

      // 修改带动画的矩形颜色
      rect.fill('#ff595999')

      this.animations.push(rect)
    }

    // 重绘以显示颜色变化
    this.layer.batchDraw()

    // 停止之前的动画实例
    if (this.animationInstance) {
      this.animationInstance.stop()
    }

    // 使用 Konva.Animation 配合 layer 自动重绘
    this.animationInstance = new Konva.Animation((frame) => {
      this.animations.forEach((rect: any) => {
        // 上下跳动动画
        rect.animationOffset += rect.animationDirection * 0.5

        if (rect.animationOffset >= 20) {
          rect.animationDirection = -1
        } else if (rect.animationOffset <= 0) {
          rect.animationDirection = 1
        }

        rect.y(rect.originalY + rect.animationOffset)
      })
    }, this.layer)

    this.animationInstance.start()
  }

  destroy(): void {
    // 停止动画
    if (this.animationInstance) {
      this.animationInstance.stop()
      this.animationInstance = null
    }

    this.stage.destroy()
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
  }
}
