import { Canvas, Rect, Image as FabricImage, Text } from 'fabric'
import { BaseRenderer } from './base-renderer'

/**
 * Fabric.js 渲染器
 */
export class FabricRenderer extends BaseRenderer {
  private fabricCanvas: Canvas

  constructor(canvasId: string) {
    super(canvasId)
    this.fabricCanvas = new Canvas(this.canvas, {
      width: this.width,
      height: this.height,
      backgroundColor: '#fafcff'
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
        left: x,
        top: y,
        width: size,
        height: size,
        fill: '#58cc84',
        selectable: true
      })

      this.primitives.push(rect)
      this.fabricCanvas.add(rect)
    }

    this.fabricCanvas.renderAll()
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

      await new Promise<void>((resolve) => {
        FabricImage.fromURL('/img/test.svg').then((img) => {
          img.set({
            left: x,
            top: y,
            scaleX: size / (img.width || 100),
            scaleY: size / (img.height || 100),
            selectable: false
          })

          this.images.push(img)
          this.fabricCanvas.add(img)
          resolve()
        })
      })
    }

    this.fabricCanvas.renderAll()
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

      const text = new Text(this.randomValue().toString(), {
        left: x,
        top: y,
        fontSize: Math.max(8, size - 2),
        fill: '#fff',
        selectable: false
      })

      this.texts.push(text)
      this.fabricCanvas.add(text)
    }

    this.fabricCanvas.renderAll()
  }

  updateTexts(): void {
    this.texts.forEach((text: any) => {
      text.set({ text: this.randomValue().toString() })
    })
    this.fabricCanvas.renderAll()
  }

  async startAnimations(count: number): Promise<void> {
    this.animations = []

    const animationCount = Math.min(count, this.primitives.length)

    for (let i = 0; i < animationCount; i++) {
      const rect = this.primitives[i] as any
      rect.originalY = rect.top
      rect.animationOffset = 0
      rect.animationDirection = 1

      // 修改带动画的矩形颜色
      rect.set({ fill: '#ff595999' })

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

        rect.set({
          top: rect.originalY + rect.animationOffset
        })
      })

      this.fabricCanvas.renderAll()
      requestAnimationFrame(animate)
    }

    animate()
  }

  destroy(): void {
    this.fabricCanvas.dispose()
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
  }
}
