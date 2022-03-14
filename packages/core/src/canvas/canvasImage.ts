import { TopologyStore } from '../store';
import { createOffscreen } from './offscreen';

export class CanvasImage {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  animateOffsScreen = createOffscreen();

  dirty = false;

  constructor(public parent: any, public parentElement: HTMLElement, public store: TopologyStore) {
    parentElement.appendChild(this.canvas);
    this.canvas.style.backgroundRepeat = 'no-repeat';
    this.canvas.style.backgroundSize = '100% 100%';
  }

  render() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.animateOffsScreen, 0, 0, this.canvas.width, this.canvas.height);

    this.dirty = false;
  }
}
