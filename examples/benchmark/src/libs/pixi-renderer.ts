import { Application, Assets, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { BaseRenderer } from './base-renderer'

/**
 * PixiJS 渲染器
 */
export class PixiRenderer extends BaseRenderer {
  private app: Application
  private animationTicker?: (delta: number) => void
  private ready: Promise<void>

  constructor(canvasId: string) {
    super(canvasId)
    this.app = new Application()
    this.ready = this.init()
  }

  private async init() {
    await this.app.init({
      canvas: this.canvas,
      width: this.width,
      height: this.height,
      backgroundColor: 0xfafcff
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
    await this.ready // 等待初始化完成
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

      const graphics = new Graphics()

      graphics.rect(0, 0, size, size)
      graphics.fill('#58cc84')
      graphics.x = x
      graphics.y = y
      graphics.eventMode = 'static'
      graphics.cursor = 'pointer'

      // 保存尺寸信息用于动画
      ;(graphics as any).rectSize = size

      this.primitives.push(graphics)
      this.app.stage.addChild(graphics)
    }
  }

  async renderImages(count: number): Promise<void> {
    await this.ready // 等待初始化完成
    this.images = []

    const size = this.calculateSize(count)
    const gap = 5
    const itemWidth = size + gap
    const cols = Math.floor(this.width / itemWidth)

    // 使用 Assets API 加载图片（PixiJS v7+ 推荐方式）
    let texture: Texture
    try {
      texture = await Assets.load('/img/test.svg')
      console.log('PixiJS 图片加载成功:', texture)
    } catch (error) {
      console.error('PixiJS 图片加载失败:', error)
      return
    }

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * itemWidth
      const y = row * itemWidth

      const sprite = new Sprite(texture)
      sprite.x = x
      sprite.y = y
      sprite.width = size
      sprite.height = size

      this.images.push(sprite)
      this.app.stage.addChild(sprite)
    }

    console.log(`PixiJS 已添加 ${count} 个图片精灵`)
  }

  async renderTexts(count: number): Promise<void> {
    await this.ready // 等待初始化完成
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
        text: this.randomValue().toString(),
        style: {
          fontSize: Math.max(8, size - 2),
          fill: 0xffffff
        }
      })
      text.x = x
      text.y = y

      this.texts.push(text)
      this.app.stage.addChild(text)
    }
  }

  updateTexts(): void {
    this.texts.forEach((text: any) => {
      text.text = this.randomValue().toString()
    })
  }

  async startAnimations(count: number): Promise<void> {
    await this.ready // 等待初始化完成
    this.animations = []

    const animationCount = Math.min(count, this.primitives.length)

    for (let i = 0; i < animationCount; i++) {
      const graphics = this.primitives[i] as any
      graphics.originalY = graphics.y
      graphics.animationOffset = 0
      graphics.animationDirection = 1

      // 修改带动画的矩形颜色
      const size = graphics.rectSize || 20
      graphics.clear()
      graphics.rect(0, 0, size, size)
      graphics.fill('#ff595999')

      this.animations.push(graphics)
    }

    // 使用 ticker 执行动画
    this.app.ticker.add(() => {
      this.animations.forEach((graphics: any) => {
        // 上下跳动动画
        graphics.animationOffset += graphics.animationDirection * 0.5

        if (graphics.animationOffset >= 20) {
          graphics.animationDirection = -1
        } else if (graphics.animationOffset <= 0) {
          graphics.animationDirection = 1
        }

        graphics.y = graphics.originalY + graphics.animationOffset
      })
    })
  }

  destroy(): void {
    this.app.destroy(true)
    this.primitives = []
    this.images = []
    this.texts = []
    this.animations = []
  }
}
