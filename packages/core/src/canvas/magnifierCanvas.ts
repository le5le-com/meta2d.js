import { Meta2dStore } from '../store';
import { Canvas } from './canvas';
import { createOffscreen } from './offscreen';

export class MagnifierCanvas {
  canvas = document.createElement('canvas');
  magnifierScreen = createOffscreen();
  offscreen = createOffscreen();
  domOffscreen = createOffscreen();
  private magnifierSize: number = 300;
  magnifier: boolean;

  constructor(
    public parentCanvas: Canvas,
    public parentElement: HTMLElement,
    public store: Meta2dStore
  ) {
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

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.offscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.domOffscreen.width = w;
    this.domOffscreen.height = h;
    this.domOffscreen.getContext('2d').scale(this.store.dpiRatio, this.store.dpiRatio);
    this.domOffscreen.getContext('2d').textBaseline = 'middle';

    this.magnifierScreen.width = this.magnifierSize + 5;
    this.magnifierScreen.height = this.magnifierSize + 5;
  }

  /**
   * 绘制到 该画布的 离屏层
   */
  private renderMagnifier() {
    if (!this.magnifier) {
      return;
    }

    const r = this.magnifierSize / 2;
    const size = this.magnifierSize + 5;

    const ctx = this.magnifierScreen.getContext(
      '2d'
    ) as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = 5;

    ctx.save();
    ctx.translate(2.5, 2.5);

    ctx.save();
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.clip();
    // ctx.fillStyle =
    //   this.store.data.background || this.store.options.background || '#f4f4f4';
    // ctx.fillRect(0, 0, size, size);
    ctx.translate(-r, -r);
    ctx.scale(2, 2);
    const pt = {
      x:
        (this.parentCanvas.mousePos.x + this.store.data.x) *
        this.store.dpiRatio,
      y:
        (this.parentCanvas.mousePos.y + this.store.data.y) *
        this.store.dpiRatio,
    };
    const drawOffscreens = [
      this.parentCanvas.canvasTemplate.bgOffscreen,
      this.parentCanvas.canvasTemplate.offscreen,
      this.parentCanvas.canvasImageBottom.offscreen,
      this.parentCanvas.canvasImageBottom.animateOffsScreen,
      this.parentCanvas.offscreen,
      this.parentCanvas.canvasImage.offscreen,
      this.parentCanvas.canvasImage.animateOffsScreen,
      this.domOffscreen //dom元素的绘制层
    ];
    drawOffscreens.forEach((offscreen) => {
      ctx.drawImage(
        offscreen,
        pt.x - r,
        pt.y - r,
        this.magnifierSize,
        this.magnifierSize,
        0,
        0,
        this.magnifierSize,
        this.magnifierSize
      );
    });

    ctx.restore();

    ctx.beginPath();
    const gradient = ctx.createRadialGradient(r, r, r - 5, r, r, r);
    gradient.addColorStop(0, 'rgba(0,0,0,0.2)');
    gradient.addColorStop(0.8, 'rgb(200,200,200)');
    gradient.addColorStop(0.9, 'rgb(200,200,200)');
    gradient.addColorStop(1.0, 'rgba(200,200,200,0.9)');
    ctx.strokeStyle = gradient;
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.restore();

    const offscreenCtx = this.offscreen.getContext('2d');
    offscreenCtx.drawImage(
      this.magnifierScreen,
      0,
      0,
      this.magnifierSize + 5,
      this.magnifierSize + 5,
      (pt.x - r - 2.5) / this.store.dpiRatio,
      (pt.y - r - 2.5) / this.store.dpiRatio,
      (this.magnifierSize + 5) / this.store.dpiRatio,
      (this.magnifierSize + 5) / this.store.dpiRatio
    );
  }

  updateDomOffscreen(){
    const domCtx =  this.domOffscreen.getContext('2d');
    domCtx.clearRect(0, 0, this.domOffscreen.width, this.domOffscreen.height);
    for (const pen of this.store.data.pens) {
      if(pen.externElement||pen.name==='gif'){
        if(pen.calculative.img){
          domCtx.save();
          domCtx.translate(this.store.data.x, this.store.data.y);
          const { x, y, width, height } = pen.calculative.worldRect;
          domCtx.drawImage(pen.calculative.img as HTMLImageElement, x, y, width, height);
          domCtx.restore();
        }
      }
    }
  }

  render() {
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderMagnifier();
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
  }
}
