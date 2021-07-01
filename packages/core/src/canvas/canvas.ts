import { createOffscreen } from './offscreen';


export class Canvas {
  active = createOffscreen();
  hover = createOffscreen();
  animate = createOffscreen();
  offscreen = createOffscreen();
  constructor() {

  }

  resize(w: number, h: number) {
    this.active.width = w;
    this.active.height = h;

    this.hover.width = w;
    this.hover.height = h;

    this.animate.width = w;
    this.animate.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;
  }

  render() {

  }
}
