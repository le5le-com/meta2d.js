import { Leafer, Rect, Image as LeaferImage, Text } from 'leafer-ui'
import { BaseRenderer } from './base-renderer'

/**
 * LeaferJS 渲染器
 */
export class LeaferRenderer extends BaseRenderer {
  private app: Leafer

  constructor(canvasId: string) {
    super(canvasId)
    this.app = new Leafer({
      view: this.canvas,
      width: this.width,
      height: this.height
    })
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

      const rect = new Rect({
        x: x,
        y: y,
        width: size,
        height: size,
        fill: '#58cc84',
        draggable: true
      })
      this.primitives.push(rect)
      this.app.add(rect)
    }
  }

  async renderImages(count: number): Promise<void> {
    this.images = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const img = new LeaferImage({
        x: x,
        y: y,
        width: size,
        height: size,
        url: '/img/test.svg'
      })
      this.images.push(img)
      this.app.add(img)
    }
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

      const text = new Text({
        x: x,
        y: y,
        text: this.randomValue().toString(),
        fontSize: Math.max(8, size - 2),
        fill: '#fff'
      })
      this.texts.push(text)
      this.app.add(text)
    }
  }

  updateTexts(): void {
    this.texts.forEach((text: any) => {
      text.text = this.randomValue().toString()
    })
  }

  async startAnimations(count: number): Promise<void> {
    this.animations = []

    const animationCount = Math.min(count, this.primitives.length)

    for (let i = 0; i < animationCount; i++) {
      const rect = this.primitives[i] as any
      const originalY = rect.y

      // 修改带动画的矩形颜色
      rect.fill = '#ff595999'

      // 保存原始位置用于上下跳动
      rect.originalY = originalY
      rect.animationOffset = 0
      rect.animationDirection = 1

      this.animations.push(rect)
    }

    const animate = () => {
      this.animations.forEach((rect: any) => {
        // 上下跳动动画
        rect.animationOffset += rect.animationDirection * 0.5

        if (rect.animationOffset >= 20) {
          rect.animationDirection = -1
        } else if (rect.animationOffset <= 0) {
          rect.animationDirection = 1
        }

        rect.y = rect.originalY + rect.animationOffset
      })

      requestAnimationFrame(animate)
    }

    animate()
  }

  destroy(): void {
    this.app.destroy()
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
  }
}
