import { Meta2d } from '../meta2d';
import { Mode } from '../types';

let hasStyle = false;

export enum DialogMode {
  Iframe,
  Meta2d,
}

interface DialogConfig {
  mode?: DialogMode;
  title?: string;
  params?: string;
  url?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  background?: string;
  maskBackground?: string;
  hideClose?: boolean;
  closeTop?: number;
  closeRight?: number;
}

const isolatedEventNames = [
  'mousedown',
  'mouseup',
  'mousemove',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'keydown',
  'keyup',
  'keypress',
] as const;

type IsolatedEventName = (typeof isolatedEventNames)[number];

export class Dialog {
  box: HTMLElement;
  dialog: HTMLElement;
  close: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  iframe!: HTMLIFrameElement;
  meta2dHost!: HTMLDivElement;
  meta2dBox!: HTMLElement;
  /** 弹窗子画布的扩展注册必须完成后才能打开图纸数据。 */
  registerPromise?: Promise<void>;
  private loadRequestId = 0;
  private readonly isolatedEventHandler = (event: Event) => {
    // 让子画布先完成自身事件处理，再阻止事件继续影响弹窗遮罩或父画布。
    event.stopPropagation();
  };

  constructor(public meta2d: Meta2d) {
    this.box = document.createElement('div');
    this.dialog = document.createElement('div');
    let header = document.createElement('div');
    this.title = document.createElement('div');
    this.close = document.createElement('span');
    this.close.innerHTML = `
      <svg fill="none" viewBox="0 0 16 16" width="1em" height="1em">
      <path
        fill="currentColor"
        d="M8 8.92L11.08 12l.92-.92L8.92 8 12 4.92 11.08 4 8 7.08 4.92 4 4 4.92 7.08 8 4 11.08l.92.92L8 8.92z"
        fill-opacity="0.9"
      ></path>
    </svg>`;
    this.body = document.createElement('div');

    this.box.className = 'meta2d-dialog_mask';
    this.dialog.className = 'meta2d-dialog';
    this.body.className = 'meta2d-dialog_body';
    header.className = 'meta2d-dialog_header';
    this.title.className = 'meta2d-dialog-content';
    this.close.className = 'meta2d-dialog-close';

    header.appendChild(this.title);
    header.appendChild(this.close);
    this.dialog.appendChild(header);
    this.dialog.appendChild(this.body);
    this.box.appendChild(this.dialog);

    meta2d.shadowRoot?.appendChild(this.box);

    this.dialog.onclick = (e) => {
      e.stopPropagation();
    };
    this.box.onclick = () => {
      this.hide();
    };
    this.close.onclick = () => {
      this.hide();
    };

    if (!hasStyle) {
      let style = document.createElement('style');
      style.title = 'le5le/dialog';
      style.textContent += `
      .meta2d-dialog_mask {
        display: none;
        position: absolute;
        top: 0%;
        left: 0%;
        width: 100%;
        height: 100%;
        background-color: #0000006f;
        z-index: 9999;
      }
      .meta2d-dialog {
        position: absolute;
        top: 15vh;
        left: 10%;
        width: 80%;
        height: 420px;
        padding: 16px 20px;
        border-radius: 9px;
        z-index: 19999;
        overflow: auto;
      }

      .meta2d-dialog_header {
        display: flex;
        position: relative;
        z-index: 999;
      }

      .meta2d-dialog-content {
        width: calc(100% - 20px);
        font-weight: 600;
        font-size: 14px;
        color: #bdc7db;
        padding-bottom: 8px;
      }

      .meta2d-dialog-close {
        width: 20px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        color: #617b91;
        position: absolute;
        right: 20px;
        top: 2px;
        display: none;
      }
      .meta2d-dialog-close svg {
        width: 18px;
        height: 18px;
      }
      .meta2d-dialog-close :hover {
        cursor: pointer;
      }
      .meta2d-dialog_body {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .meta2d-dialog_body iframe {
        width: 100%;
        height: 100%;
      }
      .meta2d-dialog_body .meta2d-dialog-meta2d-host {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      .meta2d-dialog_body .meta2d-dialog-meta2d {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
      }`;
      meta2d.shadowRoot?.prepend(style);
      hasStyle = true;
    }
  }

  createDombyMode(mode?: DialogMode) {
    if (mode === DialogMode.Iframe) {
      if (!this.iframe) {
        this.iframe = document.createElement('iframe');
        this.iframe.setAttribute('frameborder', '0');
        this.body.appendChild(this.iframe);
      }
    } else {
      if (!this.meta2dBox) {
        this.meta2dHost = document.createElement('div');
        this.meta2dHost.className = 'meta2d-dialog-meta2d-host';
        this.meta2dBox = document.createElement('le5le-meta2d');
        this.meta2dBox.setAttribute('id', 'le5le-dialog-meta2d');
        this.meta2dBox.className = 'meta2d-dialog-meta2d';
        this.meta2dHost.appendChild(this.meta2dBox);
        this.body.appendChild(this.meta2dHost);
        isolatedEventNames.forEach((eventName: IsolatedEventName) => {
          this.meta2dHost.addEventListener(eventName, this.isolatedEventHandler);
        });

        const instance = this.meta2dBox as Meta2d;
        // 资源由子画布挂载时自动初始化，失败后仍允许弹窗打开基础图元。
        this.registerPromise = instance.ready.catch(() => {});
        instance.getMeta2dData = this.meta2d.getMeta2dData?.bind(this.meta2d);
      }
    }
  }

  show(title?: string, url?: string, config: DialogConfig = {}) {
    if (!url) {
      return;
    }

    this.title.innerText = title || '';
    if (!title) {
      this.dialog.style.padding = '0px';
      this.title.style.display = 'none';
      this.body.style.height = '100%';
      this.body.style.overflow = 'hidden';
      this.close.style.top = (config.closeTop || 18) + 'px';
      this.close.style.right = (config.closeRight || 20) + 'px';
      this.body.style.background = 'transparent';
    } else {
      this.dialog.style.padding = '16px 20px';
      this.title.style.display = 'block';
      this.body.style.height = 'calc(100% - 30px)';
      this.close.style.top = (config.closeTop || 2) + 'px';
      this.close.style.right = (config.closeRight || 2) + 'px';
      this.dialog.style.background = config.background || '#1e2430';
    }
    this.box.style.display = 'block';

    if (config) {
      const { x, y, width, height } = this.detailRect(config);
      this.dialog.style.width = width;
      this.dialog.style.height = height;
      this.dialog.style.top = y;
      this.dialog.style.left = x;
      this.dialog.style.transform = `translate(${x === '50%' ? '-50%' : 0}, ${y === '50%' ? '-50%' : 0})`;
      this.box.style.background = config.maskBackground || '#0000006f';
    }
    this.createDombyMode(config.mode);

    if (config?.mode === DialogMode.Iframe) {
      this.iframe.setAttribute('src', url);
      this.iframe.style.display = 'block';
      this.meta2dBox && (this.meta2dBox.style.display = 'none');
      this.meta2dHost && (this.meta2dHost.style.display = 'none');

      this.iframe.onload = () => {
        this.close.style.display = config.hideClose ? 'none' : 'block';
        this.box.style.opacity = '1';
      };
    } else {
      this.meta2dBox.style.display = 'block';
      this.meta2dHost.style.display = 'block';
      this.iframe && (this.iframe.style.display = 'none');
      const requestId = ++this.loadRequestId;
      Promise.all([this.registerPromise, this.meta2d.getMeta2dData?.(url)])
        .then(([, data]) => {
          if (!data || requestId !== this.loadRequestId) {
            return;
          }
          const instance = this.meta2d.shadowRoot?.getElementById('le5le-dialog-meta2d') as Meta2d;
          if (instance) {
            instance.setMode(Mode.Run);
            instance.open(data);
            instance.fitView(true);
          }
        })
        .catch((error) => {
          if (requestId === this.loadRequestId) {
            console.warn('加载弹窗子画布失败：', error);
          }
        });

      this.close.style.display = config.hideClose ? 'none' : 'block';
      this.box.style.opacity = '1';
    }
  }
  detailRect(rect?: any): { x: string; y: string; width: string; height: string } {
    const keys = ['x', 'y', 'width', 'height'];
    if (rect) {
      for (let key of keys) {
        let value = rect[key];
        if (value) {
          if (Number(value)) {
            rect[key] = value + 'px';
          } else if (!value.match(/\d+(px|vh|vw|%)$/)) {
            value = parseFloat(value);
            rect[key] = isNaN(value) ? undefined : value + 'px';
          }
        }
      }
    }
    return {
      x: rect.x || '50%',
      y: rect.y || '50%',
      width: rect.width || '80%',
      height: rect.height || '420px',
    };
  }
  hide() {
    this.loadRequestId += 1;
    this.box.style.display = 'none';
    this.box.style.opacity = '0';
    this.iframe?.setAttribute('src', 'about:blank');
  }

  destroy() {
    this.loadRequestId += 1;
    if (this.meta2dHost) {
      isolatedEventNames.forEach((eventName: IsolatedEventName) => {
        this.meta2dHost.removeEventListener(eventName, this.isolatedEventHandler);
      });
      this.meta2dHost.remove();
    }
    this.box.remove();
  }
}
