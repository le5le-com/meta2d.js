import { Pen, setElemPosition } from '../pen';

export const gifsList: {
  [key: string]: HTMLImageElement;
} = {};

export function gif(pen: Pen): Path2D {
  if (!pen.onDestroy) {
    pen.onDestroy = destory;
    pen.onMove = move;
    pen.onResize = resize;
    pen.onRotate = move;
    pen.onValue = value;
    pen.onChangeId = changeId;
  }

  const path = new Path2D();
  if (!pen.image) {
    return;
  }
  const meta2dId = pen.calculative.canvas.store.id;
  const id = meta2dId+'-'+ pen.id;
  if (!gifsList[id]) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pen.image;
    if (
      pen.calculative.canvas.parent.store.options.cdn &&
      !(
        pen.image.startsWith('http') ||
        pen.image.startsWith('//') ||
        pen.image.startsWith('data:image')
      )
    ) {
      img.src = pen.calculative.canvas.parent.store.options.cdn + pen.image;
    }
    gifsList[id] = img; // 提前赋值，避免重复创建
    img.onload = () => {
      if (gifsList[id] !== img) {
        return;
      }
      pen.calculative.img = img;
      pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
      pen.calculative.imgNaturalHeight = img.naturalHeight || pen.iconHeight;
      // pen.calculative.canvas.externalElements?.appendChild(img);
      pen.calculative.canvas.externalElements?.parentElement.appendChild(img);
      setImagePosition(pen, img);
    };
  }

  if (pen.calculative.patchFlags && gifsList[id]) {
    setImagePosition(pen, gifsList[id]);
  }
  return path;
}

function destory(pen: Pen) {
  const meta2dId = pen.calculative.canvas.store.id;
  const id = meta2dId+'-'+ pen.id;
  if (gifsList[id]) {
    gifsList[id].remove();
    gifsList[id] = undefined;
  }
}

function move(pen: Pen) {
  const meta2dId = pen.calculative.canvas.store.id;
  const id = meta2dId+'-'+ pen.id;
  if (!gifsList[id]) {
    return;
  }
  setImagePosition(pen, gifsList[id]);
}

function resize(pen: Pen) {
  const meta2dId = pen.calculative.canvas.store.id;
  const id = meta2dId+'-'+ pen.id;
  if (!gifsList[id]) {
    return;
  }
  setImagePosition(pen, gifsList[id]);
}

function value(pen: Pen) {
  const meta2dId = pen.calculative.canvas.store.id;
  const id = meta2dId+'-'+ pen.id;
  if (!gifsList[id]) {
    return;
  }
  setImagePosition(pen, gifsList[id]);
  if (gifsList[id].getAttribute('src') !== pen.image) {
    gifsList[id].src = pen.image;
  }
}

function changeId(pen: Pen, oldId: string, newId: string) {
  const meta2dId = pen.calculative.canvas.store.id;
  if (!gifsList[meta2dId+'-'+oldId]) {
    return;
  }
  gifsList[meta2dId+'-'+newId] = gifsList[meta2dId+'-'+oldId];
  delete gifsList[meta2dId+'-'+oldId];
}

/**
 * gif 保持比例，除了更改 position ，还需要是否可保持比例
 * @param pen 画笔
 * @param elem 图片 dom
 */
function setImagePosition(pen: Pen, elem: HTMLImageElement) {
  // meta2d canvas 绘制图片 drawImage 保持比例，是短边填充
  elem.style.objectFit = pen.imageRatio ? 'contain' : 'fill';
  // elem.style.opacity = pen.globalAlpha + '';
  setElemPosition(pen, elem);
}
