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
import { Meta2dStore } from '../store';
import { rgba } from '../utils';
import { createOffscreen } from './offscreen';

export class CanvasTemplate {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  bgOffscreen = createOffscreen();
  patchFlags: boolean;
  bgPatchFlags: boolean;
  fit: boolean; //是否自适应布局 
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
    const { grid, gridRotate, gridColor, gridSize, scale, origin } = data;
    if (!(grid ?? options.grid)) {
      // grid false 时不绘制, undefined 时看 options.grid
      return;
    }
    ctx.save();
    const width = (data.width || options.width) * scale;
    const height = (data.height || options.height) * scale;
    const startX = (data.x || options.x || 0) + origin.x;
    const startY = (data.y || options.y || 0) + origin.y;
    if (gridRotate) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((gridRotate * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor || options.gridColor;
    ctx.beginPath();
    let size = (gridSize || options.gridSize) * scale;
    size = size < 0 ? 0 : size;
    if (!width || !height) {
      const ratio = this.store.dpiRatio;
      const cW = this.canvas.width / ratio;
      const cH = this.canvas.height / ratio;
      const m = startX / size;
      const n = startY / size;
      const offset = size * 10; //补偿值
      const newX = startX - Math.ceil(m) * size;
      const newY = startY - Math.ceil(n) * size;
      const endX = cW + newX + offset;
      const endY = cH + newY + offset;
      for (let i = newX; i <= endX; i += size) {
        ctx.moveTo(i, newY);
        ctx.lineTo(i, cH + newY + offset);
      }
      for (let i = newY; i <= endY; i += size) {
        ctx.moveTo(newX, i);
        ctx.lineTo(cW + newX + offset, i);
      }
    } else {
      const endX = width + startX;
      const endY = height + startY;
      for (let i = startX; i <= endX; i += size) {
        ctx.moveTo(i, startY);
        ctx.lineTo(i, height + startY);
      }
      for (let i = startY; i <= endY; i += size) {
        ctx.moveTo(startX, i);
        ctx.lineTo(width + startX, i);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}
