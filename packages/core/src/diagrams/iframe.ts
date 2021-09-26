import { Pen, setElemPosition } from '../pen';

export const iframes: any = {};

export function iframe(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = move;
    pen.onRotate = move;
  }

  if (!iframes[pen.id]) {
    const iframe = document.createElement('iframe');
    iframe.scrolling = 'no';
    iframe.frameBorder = '0';
    iframe.src = pen.iframe;
    iframes[pen.id] = iframe;
    pen.calculative.iframe = pen.iframe;
    pen.calculative.rootElement && pen.calculative.rootElement.appendChild(iframe);
    setElemPosition(pen, iframe);
  } else if (pen.iframe !== pen.calculative.iframe) {
    iframes[pen.id].src = pen.iframe;
    pen.calculative.iframe = pen.iframe;
  }

  if (pen.calculative.dirty) {
    setElemPosition(pen, iframes[pen.id]);
  }
  return new Path2D();
}

function destory(pen: Pen) {
  iframes[pen.id].remove();
  iframes[pen.id] = undefined;
}

function move(pen: Pen) {
  setElemPosition(pen, iframes[pen.id]);
}
