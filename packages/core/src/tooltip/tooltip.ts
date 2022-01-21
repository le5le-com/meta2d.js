import { Pen } from '../pen';
import { Point } from '../point';

declare const window: any;
declare const global: any;

export class Tooltip {
  box: HTMLElement;
  text: HTMLElement;
  arrowUp: HTMLElement;
  arrowDown: HTMLElement;
  x: number;
  y: number;
  constructor(public parentElement: HTMLElement) {
    this.box = document.createElement('div');
    this.text = document.createElement('div');
    this.arrowUp = document.createElement('div');
    this.arrowDown = document.createElement('div');

    this.box.className = 'topology-tooltip';
    this.text.className = 'text';
    this.arrowUp.className = 'arrow';
    this.arrowDown.className = 'arrow down';

    this.box.appendChild(this.text);
    this.box.appendChild(this.arrowUp);
    this.box.appendChild(this.arrowDown);
    parentElement.appendChild(this.box);

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com/tooltip') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/tooltip';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule('.topology-tooltip{position:absolute;padding:8px 0;z-index:10;left: -9999px;top: -9999px;}');
      sheet.insertRule(
        '.topology-tooltip .text{max-width:320px;min-height:30px;max-height:400px;outline:none;padding:8px 16px;border-radius:4px;background:#777777;color:#ffffff;line-height:1.8;overflow-y:auto;}'
      );
      sheet.insertRule(
        '.topology-tooltip .arrow{position:absolute;border:6px solid transparent;background:transparent;top:-4px;left:50%;transform:translateX(-50%)}'
      );
      sheet.insertRule('.topology-tooltip .arrow.down{top:initial;bottom: 1.5px;}');
    }
  }

  show(pen: Pen, pos: Point) {
    if (!pen.title) {
      return;
    }

    let marked: any;
    if (window) {
      marked = window.marked;
    } else if (global) {
      marked = global.marked;
    }
    if (marked) {
      if (marked.parse) {
        marked = marked.parse;
      }
      this.text.innerHTML = marked(pen.title);
      const a = this.text.getElementsByTagName('A');
      for (let i = 0; i < a.length; ++i) {
        a[i].setAttribute('target', '_blank');
      }
    } else {
      this.text.innerHTML = pen.title;
    }

    const elemRect = this.box.getBoundingClientRect();
    const rect = pen.calculative.worldRect;
    let x = pos.x - elemRect.width / 2;
    let y = pos.y - elemRect.height;
    if (!pen.type) {
      x = pen.calculative.canvas.store.data.x + rect.x - (elemRect.width - rect.width) / 2;
      y = pen.calculative.canvas.store.data.y + rect.ey - elemRect.height - rect.height;
    }

    if (y > 0) {
      this.arrowUp.style.borderBottomColor = 'transparent';
      this.arrowDown.style.borderTopColor = '#777777';
    } else {
      y += elemRect.height + rect.height + 5;
      this.arrowUp.style.borderBottomColor = '#777777';
      this.arrowDown.style.borderTopColor = 'transparent';
    }

    this.x = x;
    this.y = y;
    this.box.style.left = this.x + 'px';
    this.box.style.top = this.y + 'px';
  }

  hide() {
    this.x = -9999;
    this.box.style.left = '-9999px';
  }

  translate(x: number, y: number) {
    if (this.x < -1000) {
      return;
    }
    this.x += x;
    this.y += y;
    this.box.style.left = this.x + 'px';
    this.box.style.top = this.y + 'px';
  }
}
