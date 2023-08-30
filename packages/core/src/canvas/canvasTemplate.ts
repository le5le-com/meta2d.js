import {
  ctxFlip,
  ctxRotate,
  drawImage,
  Pen,
  setGlobalAlpha,
  getParent,
  renderPen,
} from '../pen';
import { Meta2dStore } from '../store';
import { rgba } from '../utils';
import { createOffscreen } from './offscreen';

export class CanvasTemplate {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  bgOffscreen = createOffscreen();
  patchFlags: boolean;
  bgPatchFlags: boolean;
  constructor(public parentElement: HTMLElement, public store: Meta2dStore) {
    parentElement.appendChild(this.canvas);
    this.canvas.style.backgroundRepeat = 'no-repeat';
    this.canvas.style.backgroundSize = '100% 100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
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
      const x = this.store.data.x || this.store.options.x;
      const y = this.store.data.y || this.store.options.y;
      const background =
        this.store.data.background || this.store.options.background;
      if (background) {
        ctx.save();
        ctx.fillStyle = background;
        if (width && height) {
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
        ctx.drawImage(
          this.store.bkImg,
          this.store.data.origin.x + x,
          this.store.data.origin.y + y,
          width * this.store.data.scale,
          height * this.store.data.scale
        );
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
        if (pen.template && pen.calculative.inView) {
          //非图片
          renderPen(ctx, pen);
          //图片
          if (pen.image && pen.name !== 'gif' && pen.calculative.img) {
            ctx.save();
            ctxFlip(ctx, pen);
            if (pen.calculative.rotate) {
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
    const { grid, gridRotate, gridColor, gridSize, scale } = data;
    if (!(grid ?? options.grid)) {
      // grid false 时不绘制, undefined 时看 options.grid
      return;
    }
    ctx.save();
    const { width, height } = this.canvas;
    if (gridRotate) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((gridRotate * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor || options.gridColor;
    ctx.beginPath();
    const size = (gridSize || options.gridSize) * scale;
    const longSide = Math.max(width, height);
    const count = Math.ceil(longSide / size);
    for (let i = -size * count; i < longSide * 2; i += size) {
      ctx.moveTo(i, -longSide);
      ctx.lineTo(i, longSide * 2);
    }
    for (let i = -size * count; i < longSide * 2; i += size) {
      ctx.moveTo(-longSide, i);
      ctx.lineTo(longSide * 2, i);
    }
    ctx.stroke();
    ctx.restore();
  }
}
