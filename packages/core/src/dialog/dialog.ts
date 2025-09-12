import { Meta2d } from "../core";
import { getMeta2dData } from "../utils";
import { Meta2dStore } from '../store';
export class Dialog {
  box: HTMLElement;
  iframe: HTMLIFrameElement;
  dialog: HTMLElement;
  close: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  x: number;
  y: number;
  url: string;
  meta2dDiv: HTMLElement;
  dialogMeta2d: Meta2d;
  store: Meta2dStore;
  data:any;
  constructor(public parentElement: HTMLElement, store: Meta2dStore) {
    this.store = store;
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
    this.iframe = document.createElement('iframe');
    this.iframe.setAttribute('frameborder', '0');
    this.meta2dDiv = document.createElement('div');

    this.box.className = 'meta2d-dialog_mask';
    this.dialog.className = 'meta2d-dialog';
    this.body.className = 'meta2d-dialog_body';
    header.className = 'meta2d-dialog_header';
    this.title.className = 'meta2d-dialog-content';
    this.close.className = 'meta2d-dialog-close';
    this.meta2dDiv.className = 'meta2d-dialog-meta2d';

    header.appendChild(this.title);
    header.appendChild(this.close);
    this.body.appendChild(this.iframe);
    this.body.appendChild(this.meta2dDiv);
    this.dialog.appendChild(header);
    this.dialog.appendChild(this.body);
    this.box.appendChild(this.dialog);
    parentElement.appendChild(this.box);

    this.dialog.onclick = (e) => {
      e.stopPropagation();
    };
    this.box.onclick = () => {
      this.hide();
    };
    this.close.onclick = () => {
      this.hide();
    };

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com/dialog') {
        sheet = document.styleSheets[i];
      }
    }

    if (!sheet) {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.title = 'le5le.com/dialog';
      document.head.appendChild(style);

      style = document.createElement('style');
      style.type = 'text/css';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule(
        `.meta2d-dialog_mask {
        display: none;
        position: absolute;
        top: 0%;
        left: 0%;
        width: 100%;
        height: 100%;
        background-color: #0000006f;
        z-index: 9999;`
      );
      sheet.insertRule(
        `.meta2d-dialog_mask .meta2d-dialog {
            position: absolute;
            top: 15vh;
            left: 10%;
            width: 80%;
            height:420px;
            padding: 16px 20px;
            border-radius: 9px;
            z-index: 19999;
            overflow: auto;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog_header {
            display: flex;
            position: relative;
            z-index: 999;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog-content {
            width: calc(100% - 20px);
            font-weight: 600;
            font-size: 14px;
            color: #bdc7db;
            padding-bottom:8px;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog-close {
            width: 20px;
            height: 20px;
            line-height: 20px;
            text-align: center;
            color: #617b91;
            position: absolute;
            right:20px;
            top:2px;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog-close svg{
            width: 18px;
            height: 18px;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog-close :hover{
            cursor: pointer;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog_body{
          width: 100%;
          height: 100%;
        } `
      );
      sheet.insertRule(
        `.meta2d-dialog_body iframe{
            width: 100%;
            height: 100%;
        }`
      );
      sheet.insertRule(
        `.meta2d-dialog_body .meta2d-dialog-meta2d{
          width: 100%;
          height: 100%;
          display: none;
      }`
      );
    }
  }

  async show(title?: string, url?: string, rect?:{x:number,y:number,width:number,height:number},data?:any) {
    if(!url){
      return;
    }
    this.data = data;
    const isIframe = this.isUrl(url);
    let urlChange = false;
    if(isIframe){
      this.meta2dDiv.style.display = 'none';
      this.iframe.style.display = 'block';
    }else{
      this.iframe.style.display = 'none';
      this.meta2dDiv.style.display = 'block';
    }
    if(isIframe && url !== this.url){
      this.iframe.setAttribute('src', url);
      this.url = url;
      urlChange = true;
    }
    title && (this.title.innerText = title);
    if(!title){
      this.dialog.style.padding = '0px';
      this.title.style.display = 'none';
      this.body.style.height = '100%';
      this.body.style.overflow= 'hidden';
      this.close.style.top = '18px';
      this.close.style.right = '20px';
      this.body.style.background = 'transparent'
    }else{
      this.dialog.style.padding = '16px 20px';
      this.title.style.display = 'block';
      this.body.style.height = 'calc(100% - 30px)';
      this.close.style.top = '2px';
      this.close.style.right = '2px';
      this.body.style.background = '#1e2430';
    }
    if(rect) {
      const { x, y, width, height } = this.detailRect(rect);
      this.dialog.style.width = width;
      this.dialog.style.height = height;
      this.dialog.style.top = y;
      this.dialog.style.left = x;
      this.dialog.style.translate = `${x === '50%' ? '-50%' : 0} ${y === '50%' ? '-50%' : 0}`;
    }
    // if(isIframe && data && isSameOrigin(url)){
    //   let timeout = 0;
    //   const interval = setInterval(() => {
    //     if((this.iframe.contentWindow as any).meta2d){
    //       clearInterval(interval);
    //       setTimeout(()=>{
    //       this.iframe.contentWindow.postMessage(
    //         JSON.stringify({
    //           name:'dialog',
    //           data
    //         }),
    //       '*');
    //       },100);
    //     }
    //     timeout++;
    //     if(timeout > 50){
    //       clearInterval(interval);
    //     }
    //   },300);
    // }
    this.iframe.onload = () => {
      if(!this.dialogMeta2d||isIframe){
        this.box.style.display = 'block';
      }
    }
    if(!urlChange&&(!this.dialogMeta2d||isIframe)){
     this.box.style.display = 'block';
    }
    if(!isIframe){
      this.meta2dDiv.style.display = 'block';
      if(!this.dialogMeta2d){
        globalThis.mainMeta2d = globalThis.meta2d;
        this.dialogMeta2d =  new Meta2d(this.meta2dDiv);
        globalThis.meta2d = globalThis.mainMeta2d;
      }

      const meta2dData = await getMeta2dData(this.store, url);
      if(meta2dData){
        this.box.style.display = 'block';
        this.dialogMeta2d.clear(true);
        this.dialogMeta2d.open(meta2dData,false);
        this.dialogMeta2d.lock(1);
        this.dialogMeta2d.resize();
        this.dialogMeta2d.fitView(true, 0);
        this.dialogMeta2d.render(true);
      }
    }
  }
  detailRect(rect?:any):{x:string,y:string,width:string,height:string}{
    const keys = ['x','y','width','height']
    if(rect) {
      for(let key of keys) {
        let value = rect[key];
        if(value) {
          if(Number(value)) {
            rect[key] = value + 'px';
          } else if(!value.match(/\d+(px|vh|vw|%)$/)){
            value = parseFloat(value);
            rect[key] = isNaN(value)? undefined: value + 'px';
          }
        }
      }
    }
    return {
      x: rect.x || '50%',
      y: rect.y || '50%',
      width: rect.width || '80%',
      height:rect.height || '420px'
    }
  }
  hide() {
    this.box.style.display = 'none';
  }

  isUrl(url: string) {
    if(url.startsWith('http') ||url.includes('?')||url.includes('/')){
      return true;
    }else{
      return false;
    }
  }

  destroy() {
    this.dialog.onclick = undefined;
    this.box.onclick = undefined;
    this.close.onclick = undefined;
    this.dialogMeta2d?.destroy(true);
  } 
}

function isSameOrigin(url) {
  if (url.startsWith('/')) {
    return true;
  }
  try {
    const _url = new URL(url);
    return (
      location.protocol === _url.protocol &&
      location.hostname === _url.hostname &&
      location.port === _url.port
    );
  } catch (e) {
    return false;
  }
}