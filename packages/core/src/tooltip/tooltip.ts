import { Pen } from '../pen';
import { Point } from '../point';

declare const marked: any;

export class Tooltip {
  box: HTMLElement;
  text: HTMLElement;
  arrowUp: HTMLElement;
  arrowDown: HTMLElement;
  constructor(parentElement: HTMLElement) {
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

    // if (!sheet) {
    //   const style = document.createElement('style');
    //   style.title = 'le5le.com/tooltip';
    //   document.head.appendChild(style);
    //   sheet = style.sheet;
    //   sheet.insertRule('.topology-tooltip{display:none;position:absolute;padding:8px 0;z-index:10;}');
    //   sheet.insertRule(
    //     '.topology-tooltip .text{max-width:320px;min-height:30px;max-height:400px;outline:none;padding:8px 16px;border-radius:4px;background:rgba(0,0,0,.6)};color:#ffffff;line-height:1.8;overflow-y:auto;'
    //   );
    //   sheet.insertRule(
    //     '.topology-tooltip .arrow{position:absolute;border:6px solid transparent;background:transparent;top:-4px;left:50%;transform:translateX(-50%)'
    //   );
    // }
  }

  showTip(pen: Pen, pos: Point) {
    // if ()
    // if (marked) {
    //   this.text.innerHTML = marked(text);
    // } else {
    //   text = pen.title;
    // }
  }
}
