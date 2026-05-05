import {Pen, setElemPosition} from "@meta2d/core";

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
    pen.onMove = setDomScale;
  }

  if (!pen.calculative.singleton.div) {
    const context: HTMLElement = pen.html.iframe
      ? document.createElement('iframe')
      : document.createElement('div');

    if (pen.html.iframe) {
      (context as HTMLIFrameElement).srcdoc = pen.html.content || '';
      (context as HTMLIFrameElement).onload = () => {
        context.style.overflow = 'hidden';
        context.style.border = 'none';
        (context as HTMLIFrameElement).scrolling = 'no';
      };
    } else {
      context.innerHTML = pen.html.content || '';
    }

    context.style.position = 'absolute';
    context.style.outline = 'none';
    context.style.overflow = 'hidden';
    context.style.left = '-9999px';
    context.style.top = '-9999px';

    pen.calculative.canvas.externalElements.parentElement.appendChild(context);

    onResize(pen);
    setElemPosition(pen, context);
    pen.calculative.singleton.div = context;
  }

  setDomScale(pen);
  return path;
}

function destroy(pen: any) {
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    delete pen.calculative.singleton.div;
  }
}

function onResize(pen: HtmlPen) {
  const {width, height} = (window as any).meta2d.getPenRect(pen);
  pen.calculative.singleton._width = width;
  pen.calculative.singleton._height = height;
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
