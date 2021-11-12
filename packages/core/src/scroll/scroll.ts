export class Scroll {
  h: HTMLElement;
  v: HTMLElement;
  isDownH: number;
  isDownV: number;
  x: number;
  y: number;
  constructor(public parent: any) {
    this.h = document.createElement('div');
    this.v = document.createElement('div');

    this.parent.externalElements.appendChild(this.h);
    this.parent.externalElements.appendChild(this.v);

    this.h.className = 'topology-scroll h';
    this.h.onmousedown = this.onMouseDownH;

    this.v.className = 'topology-scroll v';
    this.v.onmousedown = this.onMouseDownV;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le/scroll') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/scroll';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule(
        '.topology-scroll{position:absolute;width:8px;height:200px;background:#dddddd;border-radius:10px;z-index:20;cursor:default;}'
      );
      sheet.insertRule('.topology-scroll:hover{background:#cccccc;cursor:pointer}');
      sheet.insertRule('.topology-scroll.v{right:0;top:calc(50% - 100px);}');
      sheet.insertRule('.topology-scroll.h{bottom:2px;left:calc(50% - 100px);width:200px;height:8px;}');
    }
  }

  private onMouseDownH = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    this.isDownH = e.x;
    this.x = this.parent.store.data.x || 0;
  };

  private onMouseDownV = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    this.isDownV = e.y;
    this.y = this.parent.store.data.y || 0;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.isDownH) {
      const x = e.x - this.isDownH;
      this.h.style.left = `calc(50% - ${100 - x}px)`;
      this.parent.store.data.x = this.x - x;
      this.parent.dirty = true;
    }

    if (this.isDownV) {
      const y = e.y - this.isDownV;
      this.v.style.top = `calc(50% - ${100 - y}px)`;
      this.parent.store.data.y = this.y - y;
      console.log(123123, y, this.y);
      this.parent.dirty = true;
    }

    this.parent.render();
  };

  private onMouseUp = (e: MouseEvent) => {
    this.isDownH = undefined;
    this.h.style.left = '';

    this.isDownV = undefined;
    this.v.style.top = '';
  };

  destroy() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
