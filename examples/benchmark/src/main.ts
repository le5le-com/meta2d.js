// 主入口文件
import './style.css'
import { PerformanceMonitor } from './utils/performance-monitor'
import { PerfPanel } from './utils/perf-panel'
import { Meta2dRenderer } from './libs/meta2d-renderer'
import { LeaferRenderer } from './libs/leafer-renderer'
import { PixiRenderer } from './libs/pixi-renderer'
import { KonvaRenderer } from './libs/konva-renderer'
import { FabricRenderer } from './libs/fabric-renderer'
import { G6Renderer } from './libs/g6-renderer'
import type { TextRefreshProp } from './libs/base-renderer'

interface TestConfig {
  library: string
  primitiveCount: number
  imageCount: number
  textCount: number
  textRefreshInterval: number // 毫秒
  textRefreshProp: TextRefreshProp
  animationCount: number
}

class App {
  private config: TestConfig = {
    library: 'meta2d',
    primitiveCount: 5000,
    imageCount: 200,
    textCount: 2000,
    textRefreshInterval: 1000,
    textRefreshProp: 'text',
    animationCount: 400
  }

  private currentRenderer: any = null
  private performanceMonitor: PerformanceMonitor
  private perfPanel: PerfPanel
  private textUpdateTimer: number | null = null

  constructor() {
    this.performanceMonitor = new PerformanceMonitor()
    this.perfPanel = new PerfPanel()
    // 探针测量期间暂停文本定时刷新，否则 setValue 产生的索引更新会混进动画的归因里
    this.perfPanel.onMeasureStart = () => this.stopTextUpdate()
    this.perfPanel.onMeasureEnd = () => this.startTextUpdate()
    this.initUI()
    this.perfPanel.mount()
    this.bindEvents()
    this.loadDefaultLibrary()
  }

  private initUI() {
    const app = document.getElementById('app')!
    app.innerHTML = `
      <!-- 控制区 -->
      <div class="control-bar">
        <!-- 第一栏：库切换 + 模式切换 -->
        <div class="lib-row" id="libRow">
          <button class="lib-btn active" data-lib="meta2d">
            <span class="lib-dot"></span> meta2d.js
          </button>
          <button class="lib-btn" data-lib="pixi">
            <span class="lib-dot"></span> PixiJS
          </button>
          <button class="lib-btn" data-lib="konva">
            <span class="lib-dot"></span> Konva.js
          </button>
          <button class="lib-btn" data-lib="fabric">
            <span class="lib-dot"></span> Fabric.js
          </button>
          <button class="lib-btn" data-lib="g6">
            <span class="lib-dot"></span> AntV G6
          </button>
          <button class="lib-btn" data-lib="leafer">
            <span class="lib-dot"></span> LeaferJS
          </button>

          <!-- 模式切换按钮 (仅 meta2d 显示) -->
          <button class="mode-btn" id="modeBtn" style="display: none;">
            <span class="mode-icon">▶</span>
            <span class="mode-text">运行</span>
          </button>

        </div>

        <!-- 第二栏：四个维度下拉 -->
        <div class="dim-row" id="dimRow">
          <!-- 图元数量 -->
          <div class="dim-dropdown" data-dim="primitive">
            <button class="dim-trigger" type="button">
              <span class="dim-name">图元数量</span>
              <span class="dim-value">5000</span>
              <span class="arrow"></span>
            </button>
            <div class="dim-panel">
              <div class="preset-wrap">
                <button class="preset-btn selected" data-val="5000">5000</button>
                <button class="preset-btn" data-val="8000">8000</button>
                <button class="preset-btn" data-val="10000">10000</button>
                <button class="preset-btn" data-val="20000">20000</button>
                <button class="preset-btn" data-val="50000">50000</button>
                <button class="preset-btn" data-val="100000">10w</button>
                <button class="preset-btn" data-val="1000000">100w</button>
              </div>
              <div class="custom-row">
                <input type="text" placeholder="自定义" class="custom-input" value="">
                <span class="unit-hint">个</span>
                <button class="apply-btn" type="button">确定</button>
              </div>
            </div>
          </div>

          <!-- 图片数量 -->
          <div class="dim-dropdown" data-dim="image">
            <button class="dim-trigger" type="button">
              <span class="dim-name">图片数量</span>
              <span class="dim-value">200</span>
              <span class="arrow"></span>
            </button>
            <div class="dim-panel">
              <div class="preset-wrap">
                <button class="preset-btn selected" data-val="200">200</button>
                <button class="preset-btn" data-val="500">500</button>
                <button class="preset-btn" data-val="1000">1000</button>
                <button class="preset-btn" data-val="2000">2000</button>
              </div>
              <div class="custom-row">
                <input type="text" placeholder="自定义" class="custom-input" value="">
                <span class="unit-hint">张</span>
                <button class="apply-btn" type="button">确定</button>
              </div>
            </div>
          </div>

          <!-- 文本（数据点） -->
          <div class="dim-dropdown" data-dim="text">
            <button class="dim-trigger" type="button">
              <span class="dim-name">文本 (数据点)</span>
              <span class="dim-value">2000</span>
              <span class="arrow"></span>
            </button>
            <div class="dim-panel">
              <div class="preset-wrap">
                <button class="preset-btn selected" data-val="2000">2000</button>
                <button class="preset-btn" data-val="4000">4000</button>
                <button class="preset-btn" data-val="8000">8000</button>
                <button class="preset-btn" data-val="10000">10000</button>
                <button class="preset-btn" data-val="100000">100k</button>
              </div>
              <div class="custom-row">
                <input type="text" placeholder="自定义" class="custom-input" value="">
                <span class="unit-hint">个</span>
                <button class="apply-btn" type="button">确定</button>
              </div>
              <div class="divider"></div>
              <div class="refresh-section">
                <span class="refresh-label">刷新时间</span>
                <div class="preset-wrap">
                  <button class="preset-btn refresh-preset" data-val="30">30ms</button>
                  <button class="preset-btn refresh-preset" data-val="50">50ms</button>
                  <button class="preset-btn refresh-preset" data-val="100">100ms</button>
                  <button class="preset-btn refresh-preset" data-val="500">500ms</button>
                  <button class="preset-btn refresh-preset selected" data-val="1000">1s</button>
                  <button class="preset-btn refresh-preset" data-val="2000">2s</button>
                </div>
                <div class="custom-row">
                  <input type="text" placeholder="自定义 (≥10)" class="refresh-input" value="">
                  <span class="unit-hint">ms</span>
                  <button class="apply-btn refresh-apply" type="button">确定</button>
                </div>
              </div>
              <div class="refresh-section" id="refreshPropSection">
                <span class="refresh-label">刷新属性（仅 meta2d）</span>
                <div class="preset-wrap">
                  <button class="preset-btn prop-preset selected" data-val="text">文本</button>
                  <button class="preset-btn prop-preset" data-val="background">背景色</button>
                  <button class="preset-btn prop-preset" data-val="y">位置</button>
                  <button class="preset-btn prop-preset" data-val="mixed">混合</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 动画 -->
          <div class="dim-dropdown" data-dim="animation">
            <button class="dim-trigger" type="button">
              <span class="dim-name">动画</span>
              <span class="dim-value">400</span>
              <span class="arrow"></span>
            </button>
            <div class="dim-panel">
              <div class="preset-wrap">
                <button class="preset-btn selected" data-val="400">400</button>
                <button class="preset-btn" data-val="1000">1000</button>
                <button class="preset-btn" data-val="2000">2000</button>
                <button class="preset-btn" data-val="5000">5000</button>
              </div>
              <div class="custom-row">
                <input type="text" placeholder="自定义" class="custom-input" value="">
                <span class="unit-hint">个</span>
                <button class="apply-btn" type="button">确定</button>
              </div>
            </div>
          </div>

          <button class="example-btn" id="exampleBtn" style="display: none;">
            <span>📋</span> 示例1
          </button>
          <button class="example-btn" id="exampleBtn2" style="display: none;">
            <span>📋</span> 示例2
          </button>
          <button class="example-btn" id="exampleBtn3" style="display: none;">
            <span>📋</span> 示例3
          </button>
          <button class="example-btn import-btn" id="importBtn" style="display: none;">
            <span>📁</span> 导入
          </button>
          <input type="file" id="fileInput" accept=".json" style="display: none;">
        </div>
      </div>

      <!-- 画布区域 -->
      <div class="canvas-area" id="canvasArea">
        <div class="canvas-placeholder">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="#b7c5dd" stroke-width="1.5"/>
            <path d="M8 8H16" stroke="#b7c5dd" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 12H14" stroke="#b7c5dd" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 16H12" stroke="#b7c5dd" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="canvas-hint">画布区域 · 渲染性能对比</span>
        </div>
      </div>
    `
  }

  private bindEvents() {
    // 库切换
    document.querySelectorAll('.lib-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement
        const lib = target.dataset.lib!

        document.querySelectorAll('.lib-btn').forEach(b => b.classList.remove('active'))
        target.classList.add('active')

        this.config.library = lib
        this.switchLibrary(lib)

        // 显示/隐藏示例按钮和模式按钮
        this.toggleExampleButton(lib)
        this.toggleModeButton(lib)
      })
    })

    // 模式切换按钮
    const modeBtn = document.getElementById('modeBtn')
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        this.toggleMode()
      })
    }

    // 示例按钮
    const exampleBtn = document.getElementById('exampleBtn')
    if (exampleBtn) {
      exampleBtn.addEventListener('click', () => {
        this.loadExample('/json/meta2d.json')
      })
    }

    const exampleBtn2 = document.getElementById('exampleBtn2')
    if (exampleBtn2) {
      exampleBtn2.addEventListener('click', () => {
        this.loadExample('/json/meta2d2.json')
      })
    }

    const exampleBtn3 = document.getElementById('exampleBtn3')
    if (exampleBtn3) {
      exampleBtn3.addEventListener('click', () => {
        this.loadExample('/json/meta2d3.json')
      })
    }

    // 导入按钮
    const importBtn = document.getElementById('importBtn')
    const fileInput = document.getElementById('fileInput') as HTMLInputElement
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => {
        fileInput.click()
      })

      fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          this.importJsonFile(file)
        }
      })
    }

    // 维度下拉交互
    this.bindDropdownEvents()
  }

  private bindDropdownEvents() {
    const dropdowns = document.querySelectorAll('.dim-dropdown')

    dropdowns.forEach(dd => {
      const trigger = dd.querySelector('.dim-trigger') as HTMLButtonElement
      const panel = dd.querySelector('.dim-panel') as HTMLDivElement
      const valueEl = trigger.querySelector('.dim-value') as HTMLSpanElement
      const dim = dd.getAttribute('data-dim')!

      // 打开/关闭面板
      trigger.addEventListener('click', (e) => {
        e.stopPropagation()
        const isOpen = panel.classList.contains('show')
        this.closeAllPanels()
        if (!isOpen) {
          panel.classList.add('show')
          trigger.classList.add('open')
        }
      })

      panel.addEventListener('click', (e) => e.stopPropagation())

      // 主数值预设按钮
      const presetBtns = panel.querySelectorAll('.preset-btn:not(.refresh-preset):not(.prop-preset)')
      const customInput = panel.querySelector('.custom-input') as HTMLInputElement
      const applyBtn = panel.querySelector('.apply-btn:not(.refresh-apply)') as HTMLButtonElement

      presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const val = (btn as HTMLButtonElement).dataset.val!
          presetBtns.forEach(b => b.classList.remove('selected'))
          btn.classList.add('selected')
          valueEl.textContent = val
          if (customInput) customInput.value = ''
          this.updateConfig(dim, parseInt(val))
          this.closeAllPanels()
        })
      })

      if (applyBtn && customInput) {
        applyBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          const val = customInput.value.trim()
          if (val && !isNaN(parseInt(val))) {
            valueEl.textContent = val
            presetBtns.forEach(b => b.classList.remove('selected'))
            this.updateConfig(dim, parseInt(val))
            this.closeAllPanels()
          }
        })
      }

      // 刷新时间设置（仅文本维度）
      const refreshPresets = panel.querySelectorAll('.refresh-preset')
      const refreshInput = panel.querySelector('.refresh-input') as HTMLInputElement
      const refreshApply = panel.querySelector('.refresh-apply') as HTMLButtonElement

      if (refreshPresets.length && refreshInput && refreshApply) {
        refreshPresets.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const val = parseInt((btn as HTMLButtonElement).dataset.val!, 10)
            refreshPresets.forEach(b => b.classList.remove('selected'))
            btn.classList.add('selected')
            refreshInput.value = ''
            this.config.textRefreshInterval = val
            this.restartTextUpdate()
          })
        })

        refreshApply.addEventListener('click', (e) => {
          e.stopPropagation()
          const val = parseInt(refreshInput.value.trim(), 10)
          if (!isNaN(val) && val >= 10) {
            refreshPresets.forEach(b => b.classList.remove('selected'))
            this.config.textRefreshInterval = val
            this.restartTextUpdate()
          }
        })
      }

      // 刷新属性（仅文本维度）：实时数据可能绑定在任意属性上，不只是文本
      const propPresets = panel.querySelectorAll('.prop-preset')
      propPresets.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          propPresets.forEach(b => b.classList.remove('selected'))
          btn.classList.add('selected')
          this.config.textRefreshProp = (btn as HTMLButtonElement).dataset.val as TextRefreshProp
        })
      })
    })

    // 点击外部关闭
    document.addEventListener('click', () => this.closeAllPanels())
  }

  private closeAllPanels() {
    document.querySelectorAll('.dim-panel').forEach(p => p.classList.remove('show'))
    document.querySelectorAll('.dim-trigger').forEach(t => t.classList.remove('open'))
  }

  private updateConfig(dim: string, value: number) {
    switch (dim) {
      case 'primitive':
        this.config.primitiveCount = value
        break
      case 'image':
        this.config.imageCount = value
        break
      case 'text':
        this.config.textCount = value
        break
      case 'animation':
        this.config.animationCount = value
        break
    }
    this.reloadRenderer()
  }

  private async loadDefaultLibrary() {
    await this.switchLibrary(this.config.library)
    // 初始化时显示示例按钮和模式按钮（如果是 meta2d）
    this.toggleExampleButton(this.config.library)
    this.toggleModeButton(this.config.library)
  }

  /**
   * 切换示例按钮的显示/隐藏
   */
  private toggleExampleButton(lib: string) {
    const exampleBtn = document.getElementById('exampleBtn')
    const exampleBtn2 = document.getElementById('exampleBtn2')
    const exampleBtn3 = document.getElementById('exampleBtn3')
    const importBtn = document.getElementById('importBtn')
    const display = lib === 'meta2d' ? 'flex' : 'none'

    if (exampleBtn) {
      exampleBtn.style.display = display
    }
    if (exampleBtn2) {
      exampleBtn2.style.display = display
    }
    if (exampleBtn3) {
      exampleBtn3.style.display = display
    }
    if (importBtn) {
      importBtn.style.display = display
    }
  }

  /**
   * 切换模式按钮的显示/隐藏
   */
  private toggleModeButton(lib: string) {
    const modeBtn = document.getElementById('modeBtn')
    if (modeBtn) {
      modeBtn.style.display = lib === 'meta2d' ? 'flex' : 'none'
    }
    const propSection = document.getElementById('refreshPropSection')
    if (propSection) {
      propSection.style.display = lib === 'meta2d' ? 'flex' : 'none'
    }
  }

  /**
   * 切换运行/编辑模式
   */
  private toggleMode() {
    if (this.config.library !== 'meta2d' || !this.currentRenderer) {
      return
    }

    const meta2d = (this.currentRenderer as Meta2dRenderer).getMeta2d()
    if (!meta2d) {
      return
    }

    // 获取当前模式 (0 = Run, 1 = Edit)
    const currentMode = meta2d.options?.mode ?? 0
    const newMode = currentMode === 0 ? 1 : 0

    // 设置新模式
    meta2d.setMode(newMode)

    // 更新按钮状态
    this.updateModeButton(newMode)
  }

  /**
   * 更新模式按钮的显示状态
   */
  private updateModeButton(mode: number) {
    const modeBtn = document.getElementById('modeBtn')
    const modeIcon = modeBtn?.querySelector('.mode-icon')
    const modeText = modeBtn?.querySelector('.mode-text')

    if (!modeBtn || !modeIcon || !modeText) {
      return
    }

    if (mode === 1) {
      // 编辑模式
      modeBtn.classList.add('mode-edit')
      modeIcon.textContent = '✎'
      modeText.textContent = '编辑'
    } else {
      // 运行模式
      modeBtn.classList.remove('mode-edit')
      modeIcon.textContent = '▶'
      modeText.textContent = '运行'
    }
  }

  /**
   * 加载示例 JSON
   */
  private async loadExample(jsonUrl: string) {
    if (this.config.library !== 'meta2d' || !this.currentRenderer) {
      return
    }

    // 停止文本更新定时器
    this.stopTextUpdate()

    // 探针面板先解绑，避免在加载期间产生误导数据
    this.perfPanel.setMeta2d(null)

    const startTime = performance.now()

    try {
      await (this.currentRenderer as Meta2dRenderer).loadExample(jsonUrl)

      // 记录首屏时间
      const firstPaintTime = performance.now() - startTime
      this.performanceMonitor.setFirstPaintTime(firstPaintTime)

      // 重新绑定探针
      this.perfPanel.setMeta2d((this.currentRenderer as Meta2dRenderer).getMeta2d() as any)

      console.log('示例加载完成:', jsonUrl)
    } catch (error) {
      console.error('加载示例失败:', error)
      alert('加载示例失败: ' + error)
    }
  }

  /**
   * 导入本地 JSON 文件
   */
  private async importJsonFile(file: File) {
    if (this.config.library !== 'meta2d' || !this.currentRenderer) {
      return
    }

    // 停止文本更新定时器
    this.stopTextUpdate()

    // 探针面板先解绑，避免在加载期间产生误导数据
    this.perfPanel.setMeta2d(null)

    const startTime = performance.now()

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      await (this.currentRenderer as Meta2dRenderer).loadExampleData(data)

      // 记录首屏时间
      const firstPaintTime = performance.now() - startTime
      this.performanceMonitor.setFirstPaintTime(firstPaintTime)

      // 重新绑定探针
      this.perfPanel.setMeta2d((this.currentRenderer as Meta2dRenderer).getMeta2d() as any)

      console.log('文件导入成功:', file.name)

      // 清空 file input，允许重复导入同一文件
      const fileInput = document.getElementById('fileInput') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (error) {
      console.error('导入文件失败:', error)
      alert('导入文件失败: ' + error)
    }
  }

  private async switchLibrary(lib: string) {
    // 探针面板先解绑，避免指向已销毁的实例
    this.perfPanel.setMeta2d(null)

    // 清理旧渲染器
    if (this.currentRenderer) {
      this.currentRenderer.destroy()
      this.currentRenderer = null
    }

    // 停止文本更新定时器
    this.stopTextUpdate()

    const canvasArea = document.getElementById('canvasArea')!
    canvasArea.innerHTML = '<canvas id="canvas"></canvas>'

    // 重置性能监控
    this.performanceMonitor.reset()
    const startTime = performance.now()

    // 创建新渲染器
    try {
      switch (lib) {
        case 'meta2d':
          this.currentRenderer = new Meta2dRenderer('canvas')
          break
        case 'leafer':
          this.currentRenderer = new LeaferRenderer('canvas')
          break
        case 'pixi':
          this.currentRenderer = new PixiRenderer('canvas')
          break
        case 'konva':
          this.currentRenderer = new KonvaRenderer('canvas')
          break
        case 'fabric':
          this.currentRenderer = new FabricRenderer('canvas')
          break
        case 'g6':
          this.currentRenderer = new G6Renderer('canvas')
          break
      }

      // 渲染内容
      await this.currentRenderer.renderPrimitives(this.config.primitiveCount)
      await this.currentRenderer.renderImages(this.config.imageCount)
      await this.currentRenderer.renderTexts(this.config.textCount)
      await this.currentRenderer.startAnimations(this.config.animationCount)

      // 记录首屏时间：到画面真正出现为止，而不是到上面这些调用返回（见 BaseRenderer.waitFirstPaint）
      const callsDone = performance.now() - startTime
      await this.currentRenderer.waitFirstPaint()
      const firstPaintTime = performance.now() - startTime
      console.log(`[${lib}] 首屏 ${firstPaintTime.toFixed(0)}ms（其中调用返回 ${callsDone.toFixed(0)}ms）`)
      this.performanceMonitor.setFirstPaintTime(firstPaintTime)

      // 只有 meta2d 有探针
      if (lib === 'meta2d') {
        this.perfPanel.setMeta2d((this.currentRenderer as Meta2dRenderer).getMeta2d() as any)
        // 初始化模式按钮状态（默认运行模式）
        this.updateModeButton(0)
      }

      // 启动文本更新
      this.startTextUpdate()

      // 启动性能监控
      this.startPerformanceMonitoring()

    } catch (error) {
      console.error('加载库失败:', error)
      canvasArea.innerHTML = `<div class="error-message">加载 ${lib} 失败: ${error}</div>`
    }
  }

  private async reloadRenderer() {
    await this.switchLibrary(this.config.library)
  }

  private startTextUpdate() {
    this.stopTextUpdate()
    if (!this.currentRenderer) {
      return
    }

    this.textUpdateTimer = window.setInterval(() => {
      if (this.currentRenderer && this.currentRenderer.updateTexts) {
        this.currentRenderer.updateTexts(this.config.textRefreshProp)
      }
    }, this.config.textRefreshInterval)
  }

  private stopTextUpdate() {
    if (this.textUpdateTimer) {
      clearInterval(this.textUpdateTimer)
      this.textUpdateTimer = null
    }
  }

  private restartTextUpdate() {
    this.startTextUpdate()
  }

  private startPerformanceMonitoring() {
    // Stats.js 和性能监控已在 PerformanceMonitor 中自动运行
    // 不需要额外的 DOM 更新逻辑
  }
}

// 启动应用
new App()
