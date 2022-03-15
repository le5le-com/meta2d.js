import { Pen } from '../pen';
import { TopologyStore } from '../store';
import { createOffscreen } from './offscreen';

export class CanvasImage {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  animateOffsScreen = createOffscreen();

  constructor(public parentElement: HTMLElement, public store: TopologyStore, public isBottom?: boolean) {
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

    this.animateOffsScreen.width = w;
    this.animateOffsScreen.height = h;
    this.offscreen.getContext('2d').scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.animateOffsScreen.getContext('2d').scale(this.store.dpiRatio, this.store.dpiRatio);
    this.animateOffsScreen.getContext('2d').textBaseline = 'middle';

    this.initStatus();
  }

  initStatus() {
    this.offscreen.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animateOffsScreen.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const pen of this.store.data.pens) {
      if (this.hasImage(pen)) {   // 只影响本层的
        pen.calculative.imageDrawed = false;
      }
    }
  }

  clear() {
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  hasImage(pen: Pen) {
    pen.calculative.hasImage =
      pen.calculative &&
      pen.calculative.inView &&
      !pen.calculative.isBottom == !this.isBottom &&   // undefined == false 结果 false
      pen.image &&
      pen.calculative.img &&
      pen.name !== 'gif';

    return pen.calculative.hasImage;
  }

  render() {
    let dirty = false;
    let dirtyAnimate = false;
    for (const pen of this.store.data.pens) {
      if (this.hasImage(pen)) {
        if (this.store.animates.has(pen)) {
          dirtyAnimate = true;
        } else if (!pen.calculative.imageDrawed) {
          dirty = true;
        }
      }
    }

    const ctxCanvas = this.canvas.getContext('2d');
    if (dirty || dirtyAnimate) {
      ctxCanvas.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (dirty) {
      const ctx = this.offscreen.getContext('2d');
      ctx.save();
      ctx.translate(this.store.data.x, this.store.data.y);
      for (const pen of this.store.data.pens) {
        if (!pen.calculative.hasImage || pen.calculative.imageDrawed || this.store.animates.has(pen)) {
          continue;
        }
        pen.calculative.imageDrawed = true;

        if (pen.calculative.rotate) {
          ctx.save();
          ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
          let rotate = (pen.calculative.rotate * Math.PI) / 180;
          // 目前只有水平和垂直翻转，都需要 * -1
          pen.calculative.flip && (rotate *= -1);
          ctx.rotate(rotate);
          ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
        }

        const rect = pen.calculative.worldIconRect;
        let x = rect.x;
        let y = rect.y;
        let w = rect.width;
        let h = rect.height;
        if (pen.calculative.iconWidth) {
          w = pen.calculative.iconWidth;
        }
        if (pen.calculative.iconHeight) {
          h = pen.calculative.iconHeight;
        }
        if (pen.calculative.imgNaturalWidth && pen.calculative.imgNaturalHeight && pen.imageRatio) {
          let scaleW = rect.width / pen.calculative.imgNaturalWidth;
          let scaleH = rect.height / pen.calculative.imgNaturalHeight;
          let scaleMin = scaleW > scaleH ? scaleH : scaleW;
          const wDivideH = pen.calculative.imgNaturalWidth / pen.calculative.imgNaturalHeight;
          if (pen.calculative.iconWidth) {
            h = pen.calculative.iconWidth / wDivideH;
          } else if (pen.calculative.iconHeight) {
            w = pen.calculative.iconHeight * wDivideH;
          } else {
            w = scaleMin * pen.calculative.imgNaturalWidth;
            h = scaleMin * pen.calculative.imgNaturalHeight;
          }
        }
        x += (rect.width - w) / 2;
        y += (rect.height - h) / 2;

        switch (pen.iconAlign) {
          case 'top':
            y = rect.y;
            break;
          case 'bottom':
            y = rect.ey - h;
            break;
          case 'left':
            x = rect.x;
            break;
          case 'right':
            x = rect.ex - w;
            break;
          case 'left-top':
            x = rect.x;
            y = rect.y;
            break;
          case 'right-top':
            x = rect.ex - w;
            y = rect.y;
            break;
          case 'left-bottom':
            x = rect.x;
            y = rect.ey - h;
            break;
          case 'right-bottom':
            x = rect.ex - w;
            y = rect.ey - h;
            break;
        }

        if (pen.calculative.iconRotate) {
          ctx.translate(rect.center.x, rect.center.y);
          ctx.rotate((pen.calculative.iconRotate * Math.PI) / 180);
          ctx.translate(-rect.center.x, -rect.center.y);
        }
        ctx.drawImage(pen.calculative.img, x, y, w, h);

        if (pen.calculative.rotate) {
          ctx.restore();
        }
      }
      ctx.restore();
    }
    if (dirtyAnimate) {
      const ctx = this.animateOffsScreen.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.translate(this.store.data.x, this.store.data.y);
      for (const pen of this.store.animates) {
        if (!pen.calculative.hasImage) {
          continue;
        }
        pen.calculative.imageDrawed = true;
        if (pen.calculative.rotate) {
          ctx.save();
          ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
          let rotate = (pen.calculative.rotate * Math.PI) / 180;
          // 目前只有水平和垂直翻转，都需要 * -1
          pen.calculative.flip && (rotate *= -1);
          ctx.rotate(rotate);
          ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
        }

        const rect = pen.calculative.worldIconRect;
        let x = rect.x;
        let y = rect.y;
        let w = rect.width;
        let h = rect.height;
        if (pen.calculative.iconWidth) {
          w = pen.calculative.iconWidth;
        }
        if (pen.calculative.iconHeight) {
          h = pen.calculative.iconHeight;
        }

        if (pen.calculative.imgNaturalWidth && pen.calculative.imgNaturalHeight && pen.imageRatio) {
          let scaleW = rect.width / pen.calculative.imgNaturalWidth;
          let scaleH = rect.height / pen.calculative.imgNaturalHeight;
          let scaleMin = scaleW > scaleH ? scaleH : scaleW;
          const wDivideH = pen.calculative.imgNaturalWidth / pen.calculative.imgNaturalHeight;
          if (pen.calculative.iconWidth) {
            h = pen.calculative.iconWidth / wDivideH;
          } else if (pen.calculative.iconHeight) {
            w = pen.calculative.iconHeight * wDivideH;
          } else {
            w = scaleMin * pen.calculative.imgNaturalWidth;
            h = scaleMin * pen.calculative.imgNaturalHeight;
          }
        }
        x += (rect.width - w) / 2;
        y += (rect.height - h) / 2;

        switch (pen.iconAlign) {
          case 'top':
            y = rect.y;
            break;
          case 'bottom':
            y = rect.ey - h;
            break;
          case 'left':
            x = rect.x;
            break;
          case 'right':
            x = rect.ex - w;
            break;
          case 'left-top':
            x = rect.x;
            y = rect.y;
            break;
          case 'right-top':
            x = rect.ex - w;
            y = rect.y;
            break;
          case 'left-bottom':
            x = rect.x;
            y = rect.ey - h;
            break;
          case 'right-bottom':
            x = rect.ex - w;
            y = rect.ey - h;
            break;
        }

        if (pen.calculative.iconRotate) {
          ctx.translate(rect.center.x, rect.center.y);
          ctx.rotate((pen.calculative.iconRotate * Math.PI) / 180);
          ctx.translate(-rect.center.x, -rect.center.y);
        }
        ctx.drawImage(pen.calculative.img, x, y, w, h);
        if (pen.calculative.rotate) {
          ctx.restore();
        }
      }
      ctx.restore();
    }

    if (dirty || dirtyAnimate) {
      ctxCanvas.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
      ctxCanvas.drawImage(this.animateOffsScreen, 0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
