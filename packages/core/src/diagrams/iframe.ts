import { Pen, setElemPosition } from '../pen';

export const iframes: {
  [id: string]: HTMLIFrameElement;
} = {};

export function iframe(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = move;
    pen.onRotate = move;
    pen.onValue = move;
    pen.onChangeId = changeId;
  }

  if (!iframes[pen.id]) {
    const iframe = document.createElement('iframe');
    iframe.scrolling = pen.scrolling || 'no';
    iframe.frameBorder = '0';
    iframe.src = pen.iframe;
    iframes[pen.id] = iframe;
    pen.calculative.iframe = pen.iframe;
    pen.calculative.canvas.externalElements?.parentElement.appendChild(iframe);
    setElemPosition(pen, iframe);
  } else if (iframes[pen.id].getAttribute('src') !== pen.iframe) {
    iframes[pen.id].src = pen.iframe;
    pen.calculative.iframe = pen.iframe;
  }

  if (pen.calculative.patchFlags) {
    setElemPosition(pen, iframes[pen.id]);
  }
  return new Path2D();
}

function destory(pen: Pen) {
  iframes[pen.id].remove();
  iframes[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!iframes[pen.id]) {
    return;
  }
  setElemPosition(pen, iframes[pen.id]);
  if (iframes[pen.id].getAttribute('src') !== pen.iframe) {
    iframes[pen.id].src = pen.iframe;
  }
}

function changeId(pen: Pen, oldId: string, newId: string) {
  if (!iframes[oldId]) {
    return;
  }
  iframes[newId] = iframes[oldId];
  delete iframes[oldId];
}
