import { Pen, setElemPosition } from '@topology/core';

export const gifsList: any = {};

export function gif(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
  }

  const path = new Path2D();
  if (!pen.image) {
    return;
  }

  if (!gifsList[pen.id]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pen.image;
    img.onload = () => {
      pen.calculative.img = img;
      pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
      pen.calculative.imgNaturalHeight = img.naturalHeight || pen.iconHeight;
      gifsList[pen.id] = img;
      pen.calculative.canvas.externalElements &&
        pen.calculative.canvas.externalElements.appendChild(img);
      setElemPosition(pen, img);
    };
  }

  if (pen.calculative.dirty && gifsList[pen.id]) {
    setElemPosition(pen, gifsList[pen.id]);
  }
  return path;
}

function destory(pen: Pen) {
  gifsList[pen.id].remove();
  gifsList[pen.id] = undefined;
}

function move(pen: Pen) {
  if (!gifsList[pen.id]) {
    return;
  }
  setElemPosition(pen, gifsList[pen.id]);
}

function resize(pen: Pen) {
  if (!gifsList[pen.id]) {
    return;
  }
  setElemPosition(pen, gifsList[pen.id].div);
}

function value(pen: Pen) {
  if (!gifsList[pen.id] || gifsList[pen.id].src === pen.image) {
    return;
  }
  gifsList[pen.id].src = pen.image;
}
