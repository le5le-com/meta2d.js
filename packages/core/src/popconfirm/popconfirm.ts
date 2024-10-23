import { Pen } from '../pen';
import { Point } from '../point';
import { Meta2dStore } from '../store';

const status = {
  'success':{

  },
  'info':{
    icon:'<svg fill="none" viewBox="0 0 24 24"><path fill="#0052d9" d="M12 23a11 11 0 100-22 11 11 0 000 22zM11 8.5v-2h2v2h-2zm2 1.5v7.5h-2V10h2z"></path></svg>',
  }, 
  'warning':{

  }, 
  'error':{

  }
};

export class Popconfirm {
  box: HTMLElement;
  text: HTMLElement;
  arrowUp: HTMLElement;
  arrowDown: HTMLElement;
  icon: HTMLElement;
  confirm: HTMLElement;
  cancel: HTMLElement;
  x: number;
  y: number;
  constructor(public parentElement: HTMLElement, private store: Meta2dStore) {
    this.box = document.createElement('div');
    this.text = document.createElement('div');
    this.arrowUp = document.createElement('div');
    this.arrowDown = document.createElement('div');
    this.icon = document.createElement('div');
    this.confirm = document.createElement('button');
    this.cancel = document.createElement('button');

    this.box.className = 'meta2d-popconfirm';
    this.text.className = 'text';
    this.arrowUp.className = 'arrow';
    this.arrowDown.className = 'arrow down';
    this.icon.className = 'icon';
    this.confirm.className = 'confirm';
    this.cancel.className = 'cancel';

    this.confirm.innerHTML = '确定';
    this.cancel.innerHTML = '取消';
    this.icon.innerHTML = status.info.icon;
    this.box.appendChild(this.text);
    this.box.appendChild(this.arrowUp);
    this.box.appendChild(this.arrowDown);
    this.box.appendChild(this.confirm);
    this.box.appendChild(this.cancel);
    this.box.appendChild(this.icon);

    parentElement.appendChild(this.box);

    // this.box.onmouseleave = () => {
    //   this.hide();
    //   this.store.lastHover = undefined;
    // };

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com/popconfirm') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/popconfirm';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule(
        '.meta2d-popconfirm{position:absolute;z-index:999;left: -9999px;top: -9999px;padding:16px;max-width:400px;background:#fff;border-radius:6px;box-shadow:0 3px 14px 2px rgba(0, 0, 0, .05),0 8px 10px 1px rgba(0, 0, 0, 6%),0 5px 5px -3px rgba(0, 0, 0, 10%);}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .text{outline:none;padding:0px 0px 40px 28px;border-radius:4px;color:rgba(0, 0, 0, 0.9);overflow-y:auto;line-height:22px;font-size:13px;}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .arrow{position:absolute;border:10px solid transparent;background:transparent;top:-18px;left:50%;transform:translateX(-50%)}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .arrow.down{top:initial;bottom: -18px;}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .icon{position:absolute;width:22px;height:22px;left:16px;top:16px;}'
      )
      sheet.insertRule(
        '.meta2d-popconfirm .confirm{position:absolute;right:16px;bottom:16px;width:40px;height:24px;text-align:center;background:#4582e6;color:#fff;border-radius:3px;border-color:transparent}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .confirm:hover{background:#003cab;}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .cancel{position:absolute;right:64px;bottom:16px;width:40px;height:24px;text-align:center;background:#dcdcdc;color:rgba(0, 0, 0, 0.9);border-radius:3px;border-color:transparent}'
      );
      sheet.insertRule(
        '.meta2d-popconfirm .cancel:hover{background:#a6a6a6;}'
      );
    }
  }

  show(pen: Pen, pos: Point) {
    if (!pen) {
      return;
    }
    const elemRect = this.box.getBoundingClientRect();
    const rect = pen.calculative.worldRect;
    let x = pen.calculative.canvas.store.data.x + pos.x - elemRect.width / 2;
    let y = pen.calculative.canvas.store.data.y + pos.y - elemRect.height-20;
    if (!pen.type) {
      x =
        pen.calculative.canvas.store.data.x +
        rect.x -
        (elemRect.width - rect.width) / 2;
      y =
        pen.calculative.canvas.store.data.y +
        rect.ey -
        elemRect.height -
        rect.height;
    }

    if (y > 0) {
      this.arrowUp.style.borderBottomColor = 'transparent';
      this.arrowDown.style.borderTopColor = '#fff';
      y-=10;
    } else {
      y += elemRect.height + rect.height + 5;
      y+=10;
      this.arrowUp.style.borderBottomColor = '#fff';
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

  showModal(pen: Pen,pos:Point,title?:string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.text.innerHTML = title || '确认执行操作吗？';
      this.show(pen,pos);
      this.confirm.onclick = () => {
        resolve(true);
        this.hide();
      };
      this.cancel.onclick = () => {
        resolve(false);
        this.hide();
      };
    })
  }

  destroy() {
    this.box = null;
  }
}
