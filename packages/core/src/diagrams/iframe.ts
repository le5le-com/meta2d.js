import { Pen, setElemPosition } from '../pen';
import { getRootDomain } from '../utils';
import {
  beforeOperationalRectValue,
  generateAroundDiv,
  operationalRectMouseMove,
  updatePointerEvents,
} from './operationalRect';

const iframes:{
  [key: string]: HTMLElement;
} = {};

/**
 * 从iframe URL中提取key用于匹配
 * 如果URL中有id参数，返回id值；否则返回完整URL
 */
function getIframeKey(iframeUrl: string): string {
  if (!iframeUrl) {
    return '';
  }
  try {
    const url = new URL(iframeUrl, window.location.href);
    const id = url.searchParams.get('id');
    return id || iframeUrl;
  } catch (e) {
    // 如果URL解析失败，返回原始字符串
    return iframeUrl;
  }
}

export function clearIframes() {
  for(const key in iframes){
    iframes[key]?.remove();
    delete iframes[key];
  }
}

export function updateIframes(pens: Pen[]) {
  for(const key in iframes){
    if (!pens.some((pen) => pen.name == 'iframe' && getIframeKey(pen.iframe) == key)) {
      iframes[key]?.remove();
      delete iframes[key];
    }
  }
}

function matchIframe(pen: Pen) {
  const key = getIframeKey(pen.iframe);
  const div = iframes[key];
  if (div) {
    pen.calculative.singleton.div = div;
    pen.calculative.iframeKey = key;
    generateAroundDiv(pen);
    return true;
  }
  return false;
}

export function iframe(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = move;
    pen.onRotate = move;
    pen.onValue = move;
    pen.onMouseMove = operationalRectMouseMove;
    pen.onBeforeValue = beforeValue;
    pen.onRenderPenRaw = renderPenRaw;
  }
  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }
  const worldRect = pen.calculative.worldRect;

  if (!pen.calculative.singleton.div) {
    if(matchIframe(pen)){
      return
    }
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = worldRect.width + 'px';
    div.style.height = worldRect.height + 'px';
    pen.calculative.canvas.externalElements?.parentElement.appendChild(div);
    setElemPosition(pen, div);
    pen.calculative.singleton.div = div;
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.scrolling = pen.scrolling || 'no';
    iframe.frameBorder = '0';
    iframe.style.border = 'none';
    iframe.src = pen.iframe;
    iframe.allowFullscreen = true;
    pen.calculative.iframe = pen.iframe;
    pen.calculative.iframeKey = getIframeKey(pen.iframe);
    div.appendChild(iframe);
    generateAroundDiv(pen);
  }

  if (pen.calculative.patchFlags) {
    setElemPosition(pen, pen.calculative.singleton.div);
  }
  pen.onRenderPenRaw(pen);
  return new Path2D();
}

function destory(pen: Pen) {
  updatePointerEvents(pen);
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    if (!pen.calculative.canvas.store.data.locked) {
      // 手动删除iframe
      pen.calculative.singleton.div.remove();
      iframes[pen.calculative.iframeKey] = null;
    }else{
      iframes[pen.calculative.iframeKey] = pen.calculative.singleton.div;
      delete pen.calculative.singleton.div;
    }
  }
}

function move(pen: Pen) {
  pen.calculative.singleton.div &&
    setElemPosition(pen, pen.calculative.singleton.div);
}

function beforeValue(pen: Pen, value: any) {
  if (value.iframe) {
    if (pen.calculative.singleton.div) {
      const newKey = getIframeKey(value.iframe);
      const oldKey = pen.calculative.iframeKey;
      // 只有key不同时才切换iframe地址
      if (newKey !== oldKey) {
        pen.calculative.singleton.div.children[0].src = value.iframe;
        pen.calculative.iframe = value.iframe;
        pen.calculative.iframeKey = newKey;
      }
    }
  }
  beforeOperationalRectValue(pen, value);
  return value;
}

function renderPenRaw(pen: Pen) {
  if (pen.thumbImg) {
    if (!pen.calculative.img) {
      const img = new Image();
      img.crossOrigin =
        pen.crossOrigin === 'undefined'
          ? undefined
          : pen.crossOrigin || pen.calculative.canvas.store.options.crossOrigin || 'anonymous';
      if (
        pen.calculative.canvas.store.options.cdn &&
        !(
          pen.thumbImg.startsWith('http') ||
          pen.thumbImg.startsWith('//') ||
          pen.thumbImg.startsWith('data:image')
        )
      ) {
        img.src = pen.calculative.canvas.store.options.cdn + pen.thumbImg;
      } else {
        img.src = pen.thumbImg;
      }
      img.onerror = (e) => {
        img.remove();
        pen.calculative.img = undefined;
      };
      pen.calculative.img = img;
    }
  } else {
    // if (pen.calculative.singleton && pen.calculative.singleton.div) {
    //   try {
    //     // handleSaveImg(pen);
    //   } catch (e) {
    //     console.warn(e);
    //     pen.calculative.img = null;
    //   }
    // }
  }
}

async function handleSaveImg(pen: Pen) {
  let iframeHtml = pen.calculative.singleton.div.children[0].contentWindow;
  const iframeBody = iframeHtml.document.getElementsByTagName('body')[0];
  const iframeScrollY = iframeHtml.document.documentElement.scrollTop;
  const iframeScrollX = iframeHtml.document.documentElement.scrollLeft;
  var fillContent = document.createElement('div');
  // 把需要转换成图片的元素内容赋给创建的元素
  fillContent.innerHTML = iframeBody.outerHTML;
  document.body.appendChild(fillContent);
  iframeHtml.document.domain = getRootDomain();
  if (globalThis.html2canvas) {
    const canvas = await globalThis.html2canvas(fillContent, {
      allowTaint: true,
      useCORS: true,
      width: pen.width, // TODO 截屏按照1920*1080分辨率下的预览窗口宽高
      height: pen.height,
      x: iframeScrollX,
      y: iframeScrollY,
      // foreignObjectRendering: true,
    });
    // canvas.getContext('2d', {
    //   willReadFrequently: true,
    // });
    const img = new Image();
    img.crossOrigin =
      pen.crossOrigin === 'undefined'
        ? undefined
        : pen.crossOrigin || 'anonymous';
    img.src = canvas.toDataURL('image/png', 0.1);
    if (img.src.length > 10) {
      pen.calculative.img = img;
    }
    document.body.removeChild(fillContent);
  }
  // globalThis.html2canvas &&
  //   globalThis
  //     .html2canvas(iframeBody, {
  //       allowTaint: true,
  //       useCORS: true,
  //       width: pen.width, // TODO 截屏按照1920*1080分辨率下的预览窗口宽高
  //       height: pen.height,
  //       x: iframeScrollX,
  //       y: iframeScrollY,
  //       foreignObjectRendering: true,
  //     })
  //     .then((canvas) => {
  //       canvas.getContext('2d', {
  //         willReadFrequently: true,
  //       });
  //       const img = new Image();
  //       img.crossOrigin = pen.crossOrigin || 'anonymous';
  //       img.src = canvas.toDataURL('image/png', 0.1);
  //       if (img.src.length > 10) {
  //         pen.calculative.img = img;
  //       }
  //     })
  //     .catch((e) => {
  //       console.warn(e);
  //     });
}
