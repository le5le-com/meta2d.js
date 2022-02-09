import { Canvas } from "../canvas";

export class Map {
  box: HTMLElement;
  img: HTMLImageElement;
  isShow: boolean;
  isDown: boolean;
  constructor(public parent: Canvas) {
    this.box = document.createElement('div');
    this.img = new Image();

    this.box.appendChild(this.img);
    this.parent.externalElements.appendChild(this.box);

    this.box.className = 'topology-map';
    this.box.onmousedown = this.onMouseDown;
    this.box.onmousemove = this.onMouseMove;
    this.box.onmouseup = this.onMouseUp;

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le/map') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/map';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule(
        '.topology-map{display:flex;width:320px;height:180px;background:#f4f4f4;border:1px solid #ffffff;box-shadow: 0px 0px 14px 0px rgba(0,10,38,0.30);border-radius:8px;position:absolute;z-index:20;right:0;bottom:0;justify-content:center;align-items:center;cursor:default;user-select:none;}'
      );
      sheet.insertRule('.topology-map img{max-width:100%;max-height:100%;pointer-events: none;}');
    }
  }

  show() {
    this.box.style.display = 'flex';

    if (this.parent.store.data.pens.length) {
      this.img.style.display = 'block';
      this.img.src = this.parent.toPng();
    } else {
      this.img.style.display = 'none';
    }
    this.isShow = true;
  }

  hide() {
    this.box.style.display = 'none';
    this.isShow = false;
  }

  private onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.isDown = true;
  };

  private onMouseMove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    this.isDown && this.parent.gotoView(e.offsetX / this.box.clientWidth, e.offsetY / this.box.clientHeight);
  };

  private onMouseUp = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.parent.gotoView(e.offsetX / this.box.clientWidth, e.offsetY / this.box.clientHeight);
    this.isDown = false;
  };
}
