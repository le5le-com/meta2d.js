import {Pen, setElemImg, setElemPosition} from "../pen";
import {
  beforeOperationalRectValue,
  generateAroundDiv,
  operationalRectMouseMove,
  updatePointerEvents,
} from './operationalRect';

interface HtmlPen extends Pen {
  html: {
    content: string;
    iframe?: boolean;
    _width: number;
    _height: number;
  },
  calculative: any;
}

export function htmlDom(pen: HtmlPen) {
  const path = new Path2D();
  const worldRect = pen.calculative.worldRect;

  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }
  if (!pen.onDestroy) {
    pen.onDestroy = destroy;
    pen.onResize = onResize;
    pen.onRenderPenRaw = onRenderPenRaw
    pen.onMove = setDomScale;
    pen.onMouseMove = operationalRectMouseMove;
    pen.onBeforeValue = beforeValue;
  }

  if (!pen.calculative.singleton.div) {
    // 外层包裹 div，负责定位与缩放
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';

    const context: HTMLElement = pen.html.iframe
      ? document.createElement('iframe')
      : document.createElement('div');

    if (pen.html.iframe) {
      (context as HTMLIFrameElement).srcdoc = pen.html.content || '';
      (context as HTMLIFrameElement).onload = () => {
        context.style.overflow = 'hidden';
        context.style.border = 'none';
        (context as HTMLIFrameElement).scrolling = 'no';
        updateRawImg(pen);
      };
    } else {
      context.innerHTML = pen.html.content || '';
    }
    context.style.width = '100%';
    context.style.height = '100%';
    context.style.outline = 'none';
    context.style.border = 'none';
    context.style.overflow = 'hidden';

    div.appendChild(context);
    pen.calculative.canvas.externalElements.parentElement.appendChild(div);
    pen.calculative.singleton.div = div;

    generateAroundDiv(pen);
    onResize(pen);
    setElemPosition(pen, div);
  }

  setDomScale(pen);
  return path;
}

function destroy(pen: any) {
  updatePointerEvents(pen);
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    delete pen.calculative.singleton.div;
  }
}

// setValue 更新 html.content 时，同步到页面上真实的 DOM 元素
function beforeValue(pen: HtmlPen, value: any) {
  const content = value.html?.content ?? value['html.content'];
  if (content !== undefined) {
    const dom = pen.calculative.singleton?.div?.children[0] as HTMLElement;
    if (dom) {
      if (pen.html.iframe) {
        // srcdoc 重新赋值会触发 onload，进而更新缩略图
        (dom as HTMLIFrameElement).srcdoc = content;
      } else {
        dom.innerHTML = content;
        dom.onload = ()=>{
          requestAnimationFrame(() => updateRawImg(pen));
        }
      }
    }
  }
  beforeOperationalRectValue(pen, value);
  return value;
}

function onResize(pen: HtmlPen) {
  const {width, height} = (window as any).meta2d.getPenRect(pen);
  pen.calculative.singleton._width = width;
  pen.calculative.singleton._height = height;
  requestAnimationFrame(() => updateRawImg(pen));
}

function setDomScale(pen: HtmlPen) {
  requestAnimationFrame(() => {
    const worldRect = pen.calculative.worldRect;
    const store = pen.calculative.canvas.store;
    const div = pen.calculative.singleton.div;
    if (!div) return;

    div.style.width = pen.calculative.singleton._width + 'px';
    div.style.height = pen.calculative.singleton._height + 'px';
    div.style.left = worldRect.x + store.data.x - 1 / 2 * pen.calculative.singleton._width + 1 / 2 * worldRect.width + 'px';
    div.style.top = worldRect.y + store.data.y - 1 / 2 * pen.calculative.singleton._height + 1 / 2 * worldRect.height + 'px';
    div.style.scale = pen.calculative.canvas.store.data.scale;
  });
}

function updateRawImg(pen: HtmlPen) {
  const div = pen.calculative.singleton?.div;
  if (!div) {
    return;
  }
  // 实际内容元素是包裹 div 的第一个子元素
  const content = div.children[0] as HTMLElement;
  if (!content) {
    return;
  }
  const elem = pen.html.iframe
    ? (content as HTMLIFrameElement).contentDocument?.querySelector('body') as HTMLElement
    : content;
  if (!elem) {
    return;
  }
  setElemImg(pen, elem);
}

function onRenderPenRaw(pen: HtmlPen){
  updateRawImg(pen);
}
