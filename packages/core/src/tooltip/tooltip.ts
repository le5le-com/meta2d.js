
export class Tooltip {
  box: HTMLElement;
  text: HTMLElement;
  arrowUp: HTMLElement;
  arrowDown: HTMLElement;
  constructor(parentElement: HTMLElement) {
    this.box = document.createElement('div');
    this.box.className = 'topology-tooltip';
    this.box.style.position = 'fixed';
    this.box.style.zIndex = '-1';
    this.box.style.left = '-9999px';
    this.box.style.padding = '8px 0';

    this.text = document.createElement('div');
    this.text.style.maxWidth = '320px';
    this.text.style.outline = 'none';
    this.text.style.borderRadius = '4px';
    this.text.style.backgroundColor = 'rgba(0,0,0,.6)';
    this.text.style.color = '#fff';
    this.text.style.padding = '8px 16px';
    this.text.style.lineHeight = '1.8';
    this.text.style.overflowY = 'auto';
    this.text.style.minHeight = '30px';
    this.text.style.maxHeight = '400px';
    this.box.appendChild(this.text);

    this.arrowUp = document.createElement('div');
    this.arrowUp.className = 'arrow';
    this.arrowUp.style.position = 'absolute';
    this.arrowUp.style.border = '6px solid transparent';
    this.arrowUp.style.backgroundColor = 'transparent';
    this.arrowUp.style.left = '50%';
    this.arrowUp.style.transform = 'translateX(-50%)';
    this.arrowUp.style.top = '-4px';
    this.box.appendChild(this.arrowUp);

    this.arrowDown = document.createElement('div');
    this.arrowDown.className = 'arrow';
    this.arrowDown.style.position = 'absolute';
    this.arrowDown.style.border = '6px solid transparent';
    this.arrowDown.style.left = '50%';
    this.arrowDown.style.transform = 'translateX(-50%)';
    this.arrowDown.style.backgroundColor = 'transparent';
    this.arrowDown.style.bottom = '-4px';
    this.box.appendChild(this.arrowDown);

    parentElement.appendChild(this.box);
  }


}
