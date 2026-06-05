import {
  ctxFlip,
  ctxRotate,
  drawImage,
  Pen,
  setGlobalAlpha,
  getParent,
  renderPen,
  CanvasLayer,
} from '../pen';
import { Meta2dStore, globalStore, GridDrawerContext } from '../store';
import { defaultGridDrawer, dotGridDrawer } from '../grid';
import { createOffscreen } from './offscreen';
import {Canvas} from "./canvas";

export class CanvasTemplate {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  bgOffscreen = createOffscreen();
  patchFlags: boolean;
  bgPatchFlags: boolean;
  parentCanvas: Canvas;  // 可通过 this.parent.mousePos 获取鼠标 x, y 坐标
  fit: boolean; //是否自适应布局
  constructor(public parentElement: HTMLElement, public store: Meta2dStore, parentCanvas: Canvas) {
    parentElement.appendChild(this.canvas);
    this.parentCanvas = parentCanvas;
    this.canvas.style.backgroundRepeat = 'no-repeat';
    this.canvas.style.backgroundSize = '100% 100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';

    if (!globalStore.gridDrawers['default']) {
      globalStore.gridDrawers['default'] = defaultGridDrawer;
    }
    if (!globalStore.gridDrawers['dot']) {
      globalStore.gridDrawers['dot'] = dotGridDrawer;
    }
  }

  resize(w?: number, h?: number) {
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    w = (w * this.store.dpiRatio) | 0;
    h = (h * this.store.dpiRatio) | 0;

    this.canvas.width = w;
    this.canvas.height = h;

    this.bgOffscreen.width = w;
    this.bgOffscreen.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.bgOffscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.bgOffscreen.getContext('2d').textBaseline = 'middle';

    this.offscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.init();
  }

  init() {
    this.bgOffscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.patchFlags = true;
    this.bgPatchFlags = true;

    // for (const pen of this.store.data.pens) {
    //   if (this.hasImage(pen)) {
    //     // 只影响本层的
    //     pen.calculative.imageDrawed = false;
    //   }
    // }
    // this.store.patchFlagsBackground = true;
    // this.store.patchFlagsTop = true;
  }

  hidden() {
    this.canvas.style.display = 'none';
  }

  show() {
    this.canvas.style.display = 'block';
  }

  clear() {
    this.bgOffscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.bgPatchFlags = true;
    this.patchFlags = true;
  }

  render() {
    if (this.bgPatchFlags) {
      const ctx = this.bgOffscreen.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      const width = this.store.data.width || this.store.options.width;
      const height = this.store.data.height || this.store.options.height;
      const x = this.store.data.x || this.store.options.x || 0;
      const y = this.store.data.y || this.store.options.y || 0;
      const background =  this.store.data.background || this.store.styles.background;
      // this.store.data.background || this.store.options.background;
      if (background) {
        ctx.save();
        ctx.fillStyle = background;
        ctx.globalAlpha = this.store.data.globalAlpha ?? this.store.options.globalAlpha;
        if (width && height&& !this.fit) {
          ctx.shadowOffsetX = this.store.options.shadowOffsetX;
          ctx.shadowOffsetY = this.store.options.shadowOffsetY;
          ctx.shadowBlur = this.store.options.shadowBlur;
          ctx.shadowColor = this.store.options.shadowColor;
          ctx.fillRect(
            this.store.data.origin.x + x,
            this.store.data.origin.y + y,
            width * this.store.data.scale,
            height * this.store.data.scale
          );
        } else {
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        ctx.restore();
      }
      if (width && height && this.store.bkImg) {
        ctx.save();
        if(this.fit){
          ctx.drawImage(this.store.bkImg,0, 0, this.canvas.offsetWidth, this.canvas.offsetHeight);
        }else{
          ctx.drawImage(
            this.store.bkImg,
            this.store.data.origin.x + x,
            this.store.data.origin.y + y,
            width * this.store.data.scale,
            height * this.store.data.scale
          );
        }
        ctx.restore();
      }
      this.renderGrid(ctx);
    }
    if (this.patchFlags) {
      const ctx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.translate(this.store.data.x, this.store.data.y);
      for (const pen of this.store.data.pens) {
        if (!isFinite(pen.x)) {
          continue;
        }
        if (
          // pen.template
          pen.canvasLayer===CanvasLayer.CanvasTemplate
          && pen.calculative.inView) {
          // if (pen.name === 'combine' && !pen.draw){
          //   continue;
          // }
          //非图片
          renderPen(ctx, pen);
          //图片
          if (pen.image && pen.name !== 'gif' && pen.calculative.img) {
            ctx.save();
            ctxFlip(ctx, pen);
            if (pen.rotateByRoot || pen.calculative.rotate) {
              ctxRotate(ctx, pen);
            }

            setGlobalAlpha(ctx, pen);
            drawImage(ctx, pen);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    if (this.patchFlags || this.bgPatchFlags) {
      const ctxCanvas = this.canvas.getContext('2d');
      ctxCanvas.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctxCanvas.drawImage(
        this.bgOffscreen,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      ctxCanvas.drawImage(
        this.offscreen,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      this.patchFlags = false;
      this.bgPatchFlags = false;
    }
  }

  renderGrid(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  ) {
    const { data, options } = this.store;
    const mousePos = {
      x: this.parentCanvas.mousePos.x + this.parentCanvas.store.data.x,
      y: this.parentCanvas.mousePos.y + this.parentCanvas.store.data.y
    }
    const { grid } = data;
    if (!(grid ?? options.grid)) {
      // grid false 时不绘制, undefined 时看 options.grid
      return;
    }
    const context: GridDrawerContext = {
      store: this.store,
      canvas: this.canvas,
    };
    const gridType = data.gridType || options.gridType || 'default';
    const drawer = globalStore.gridDrawers[gridType] || globalStore.gridDrawers['default'];
    if (drawer) {
      this.parentCanvas.store.options.gridAlwaysRender = drawer(ctx, context, mousePos)
    }
  }
}
