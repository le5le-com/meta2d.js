import { s8 } from '../utils';

const status = {
  success: {
    color: '#2ba471',
    icon: '<svg fill="none" viewBox="0 0 24 24"><path d="M12 23a11 11 0 100-22 11 11 0 000 22zM7.5 10.59l3 3 6-6L17.91 9l-7.41 7.41L6.09 12l1.41-1.41z"></path></svg>',
  },
  info: {
    color: '#0052d9',
    icon: '<svg fill="none" viewBox="0 0 24 24"><path d="M12 23a11 11 0 100-22 11 11 0 000 22zM11 8.5v-2h2v2h-2zm2 1.5v7.5h-2V10h2z"></path></svg>',
  },
  warning: {
    color: '#e37318',
    icon: '<svg fill="none" viewBox="0 0 24 24"><path d="M12 1a11 11 0 110 22 11 11 0 010-22zm-1 13h2V6.5h-2V14zm2 1.5h-2v2h2v-2z"></path></svg>',
  },
  error: {
    color: '#d54941',
    icon: '<svg fill="none" viewBox="0 0 24 24"><path d="M12 1a11 11 0 110 22 11 11 0 010-22zm-1 13h2V6.5h-2V14zm2 1.5h-2v2h2v-2z"></path></svg>',
  },
  question: {
    color: '#0052d9',
    icon: '<svg fill="none" viewBox="0 0 24 24"><path d="M12 23a11 11 0 100-22 11 11 0 000 22zm-.17-11.11c.43-.53.97-.97 1.4-1.32A2 2 0 0012 7a2 2 0 00-1.89 1.33l-.33.95L7.9 8.6l.34-.94a4 4 0 116.24 4.47 7 7 0 00-1.1 1.01c-.27.34-.37.61-.37.85v1.25h-2V14c0-.87.39-1.57.83-2.11zM11 18.25v-2h2v2h-2z"></path></svg>',
  },
};

export type Theme = 'success' | 'info' | 'warning' | 'error' | 'question';

export interface MessageOptions {
  id?: string; //唯一标识
  content?: string;
  theme?: Theme; //主题
  placement?: string; //位置
  duration?: number; //定时销毁时间 为0时不销毁
  closeBtn?: boolean; //是否显示关闭按钮
}

export const messageList: {
  [key: string]: Message;
} = {};

export class Message {
  box: HTMLElement;
  icon: HTMLElement;
  text: HTMLElement;
  closeBtn: HTMLElement;
  duration: number; //定时销毁时间
  content: string;
  theme: Theme; //主题
  placement: string; //位置
  id: string;
  constructor(public parentElement: HTMLElement, options: MessageOptions) {
    this.box = document.createElement('div');
    this.icon = document.createElement('div');
    this.text = document.createElement('div');

    this.box.className = 'meta2d-message';
    this.icon.className = 'icon';
    this.text.className = 'text';
    this.icon.innerHTML = status[options.theme || 'info'].icon;
    this.text.innerHTML = options.content;

    this.box.appendChild(this.icon);
    this.box.appendChild(this.text);

    if (options.closeBtn) {
      this.closeBtn = document.createElement('div');
      this.closeBtn.className = 'close';
      this.closeBtn.innerHTML = 'x';
      this.closeBtn.onclick = () => {
        this.close();
      };
      this.box.appendChild(this.closeBtn);
    }

    parentElement.appendChild(this.box);

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com/message') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/message';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule(
        `.meta2d-message{
           position:absolute;
           z-index:999;
           transform: translateX(-50%); 
           padding:12px 16px;
           max-width:400px;
           background:#fff;
           border-radius:6px;
           box-shadow:0 3px 14px 2px rgba(0, 0, 0, .05),0 8px 10px 1px rgba(0, 0, 0, 6%),0 5px 5px -3px rgba(0, 0, 0, 10%);
           display:flex;
           animation: fadein .5s;}`
      );
      sheet.insertRule(
        `
        @keyframes fadein {
          0% {
              transform: translate(-50%, -100%);
          }
          100% {
              transform: translate(-50%,0);
          }
      }`
      );
      sheet.insertRule('.meta2d-message .icon{width:20px;height:20px;}');
      sheet.insertRule(
        '.meta2d-message .text{color:rgba(0, 0, 0, 0.9);font-size:12px;margin-left:8px;line-height:20px;}'
      );
      sheet.insertRule(
        '.meta2d-message .close{width:20px;height:20px;padding-left: 16px; cursor: pointer;}'
      );
    }

    this.id = options.id || s8();
    this.duration = options.duration ?? 3000;
    this.placement = options.placement || 'top';
    this.theme = options.theme || 'info';
    // this.init();
  }

  init() {
    messageList[this.id] = this;
    if (this.duration) {
      setTimeout(() => {
        this.close();
      }, this.duration);
    }
    let idx = -1;
    Object.keys(messageList).forEach((key) => {
      if (messageList[key]?.placement === this.placement) {
        idx++;
      }
    });
    this.setPosition(this.placement, idx);
    (this.icon.children[0] as HTMLElement).style.fill =
      status[this.theme].color;
  }

  setPosition(placement: string, index: number = 0) {
    switch (placement) {
      case 'top':
        this.box.style.top = `${30 + index * 60}px`;
        this.box.style.left = '50%';
        break;
      case 'bottom':
        this.box.style.bottom = `${30 + index * 60}px`;
        this.box.style.left = '50%';
        break;
      case 'left':
        this.box.style.top = `${30 + index * 60}px`;
        this.box.style.left = '30px';
        break;
      case 'right':
        this.box.style.top = `${30 + index * 60}px`;
        this.box.style.right = '30px';
        break;
    }
  }

  close() {
    Object.keys(messageList).forEach((key) => {
      if (messageList[key]?.placement === this.placement) {
        switch (this.placement) {
          case 'top':
          case 'left':
          case 'right':
            messageList[key].box.style.top =
              parseInt(messageList[key].box.style.top) - 60 + 'px';
            break;
          case 'bottom':
            messageList[key].box.style.bottom =
              parseInt(messageList[key].box.style.bottom) - 60 + 'px';
            break;
        }
      }
    });
    messageList[this.id] = null;
    delete messageList[this.id];
    this.box.remove();
  }
}
