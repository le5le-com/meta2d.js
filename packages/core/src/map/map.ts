export class Map {
  box: HTMLElement;
  img: HTMLImageElement;
  x: number;
  y: number;
  constructor(public parentElement: HTMLElement) {
    this.box = document.createElement('div');
    this.img = new Image();

    this.box.appendChild(this.img);
    parentElement.appendChild(this.box);

    this.box.className = 'topology-map';

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
      sheet.insertRule('.topology-map{position:absolute;z-index:20;right:0;bottom:0}');
      sheet.insertRule('.topology-map img{}');
    }
  }

  show() {
    this.box.style.display = 'flex';
  }

  hide() {
    this.box.style.display = 'none';
  }
}
