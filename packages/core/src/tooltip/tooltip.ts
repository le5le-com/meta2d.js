import { Pen } from '../pen';
import { Point } from '../point';

declare const marked: any;

export class Tooltip {
  box: HTMLElement;
  text: HTMLElement;
  arrowUp: HTMLElement;
  arrowDown: HTMLElement;
  constructor(public parentElement: HTMLElement) {
    this.box = document.createElement('div');
    this.text = document.createElement('div');
    this.arrowUp = document.createElement('div');
    this.arrowDown = document.createElement('div');

    this.box.className = 'topology-tooltip';
    this.text.className = 'text';
    this.arrowUp.className = 'arrow';
    this.arrowDown.className = 'arrow';

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
      const style = document.createElement('style');
      style.title = 'le5le.com/tooltip';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule('.topology-tooltip{display:none;position:absolute;padding:8px 0;z-index:10;}');
      sheet.insertRule(
        '.topology-tooltip .text{max-width:320px;min-height:30px;max-height:400px;outline:none;padding:8px 16px;border-radius:4px;background:rgba(0,0,0,.6);color:#ffffff;line-height:1.8;overflow-y:auto;}'
      );
      sheet.insertRule(
        '.topology-tooltip .arrow{position:absolute;border:6px solid transparent;background:transparent;top:-4px;left:50%;transform:translateX(-50%)}'
      );
    }
  }

  showTip(pen: Pen, pos: Point) {
    if (!pen.title) {
      return;
    }

    if (marked) {
      this.text.innerHTML = marked(pen.title);
      const a = this.text.getElementsByTagName('A');
      for (let i = 0; i < a.length; ++i) {
        a[i].setAttribute('target', '_blank');
      }
    } else {
      this.text.innerHTML = pen.title;
    }

    const parentRect = this.parentElement.getBoundingClientRect();
    const elemRect = this.box.getBoundingClientRect();
    const rect = pen.calculative.worldRect;
    let x = (parentRect.left || parentRect.x) + pos.x - (elemRect.width - rect.width) / 2;
    let y = (parentRect.top || parentRect.y) + pos.y - elemRect.height - rect.height;
    if (!pen.type) {
      x =
        (parentRect.left || parentRect.x) +
        pen.calculative.canvas.store.data.x +
        rect.x -
        (elemRect.width - rect.width) / 2;
      y =
        (parentRect.top || parentRect.y) +
        pen.calculative.canvas.store.data.y +
        rect.ey -
        elemRect.height -
        rect.height;
    }

    if (y > 0) {
      this.arrowUp.style.borderBottomColor = 'transparent';
      this.arrowDown.style.borderTopColor = 'rgba(0,0,0,.6)';
    } else {
      if (pen.type) {
        y = (parentRect.top || parentRect.y) + pos.y;
      } else {
        y = (parentRect.top || parentRect.y) + rect.ey + pen.calculative.canvas.store.data.y;
      }

      this.arrowUp.style.borderBottomColor = 'rgba(0,0,0,.6)';
      this.arrowDown.style.borderTopColor = 'transparent';
    }

    this.box.style.display = 'block';
    this.box.style.left = x + 'px';
    this.box.style.top = y + 'px';

    console.log(x, y);
  }
}
