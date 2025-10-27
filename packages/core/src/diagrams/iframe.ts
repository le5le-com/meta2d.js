import { Pen, setElemPosition } from '../pen';
import { Point } from '../point';
import { deepClone, getRootDomain } from '../utils';

const iframes:{
   [key: string]: HTMLElement;
} = {};

export function clearIframes() {
  for(const key in iframes){
    iframes[key].remove();
    iframes[key] = null;
  }
  iframes;
}

export function updateIframes(pens: Pen[]) {
  for(const key in iframes){
    if (!pens.some((pen) => pen.name == 'iframe' && pen.iframe == key)) {
      iframes[key].remove();
      iframes[key] = null;
    }
  }
}

function matchIframe(pen: Pen) {
  const div = iframes[pen.iframe];
  if (div) {
    pen.calculative.singleton.div = div;
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
    pen.onMouseMove = mouseMove;
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
    document.body.appendChild(div);
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
    pen.calculative.iframe = pen.iframe;
    div.appendChild(iframe);
    generateAroundDiv(pen);
    iframe.onload = () => {
      iframe.setAttribute('document.domain', '');
    };
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
    // pen.calculative.singleton.div.remove();
    iframes[pen.calculative.iframe] = pen.calculative.singleton.div;
    delete pen.calculative.singleton.div;
  }
}

function move(pen: Pen) {
  pen.calculative.singleton.div &&
    setElemPosition(pen, pen.calculative.singleton.div);
}

function beforeValue(pen: Pen, value: any) {
  if (value.iframe) {
    if (pen.calculative.singleton.div) {
      pen.calculative.singleton.div.children[0].src = value.iframe;
      pen.calculative.iframe = value.iframe;
    }
  }

  if (
    value.operationalRect ||
    value['operationalRect.x'] !== undefined ||
    value['operationalRect.y'] !== undefined ||
    value['operationalRect.width'] !== undefined ||
    value['operationalRect.height'] !== undefined
  ) {
    if (!pen.operationalRect) {
      pen.operationalRect = {};
    }
    let _value = deepClone(value);
    if (!_value.operationalRect) {
      _value.operationalRect = {};
    }
    if (_value['operationalRect.x'] !== undefined) {
      _value.operationalRect.x = _value['operationalRect.x'];
    }
    if (_value['operationalRect.y'] !== undefined) {
      _value.operationalRect.y = _value['operationalRect.y'];
    }
    if (_value['operationalRect.width'] !== undefined) {
      _value.operationalRect.width = _value['operationalRect.width'];
    }
    if (_value['operationalRect.height'] !== undefined) {
      _value.operationalRect.height = _value['operationalRect.height'];
    }
    Object.assign(pen.operationalRect, _value.operationalRect);
    if (pen.calculative.singleton.div) {
      let length = pen.calculative.singleton.div.children.length;
      if (length === 1) {
        //没有创建
        generateAroundDiv(pen);
      } else {
        //有更新值
        pen.calculative.singleton.div.children[1].style.height =
          pen.operationalRect.y * 100 + '%';
        pen.calculative.singleton.div.children[1].style.left =
          pen.operationalRect.x * 100 + '%';
        pen.calculative.singleton.div.children[1].style.width =
          pen.operationalRect.width * 100 + '%';
        pen.calculative.singleton.div.children[2].style.width =
          (1 - pen.operationalRect.x - pen.operationalRect.width) * 100 + '%';

        pen.calculative.singleton.div.children[3].style.height =
          (1 - pen.operationalRect.y - pen.operationalRect.height) * 100 + '%';
        pen.calculative.singleton.div.children[3].style.left =
          pen.operationalRect.x * 100 + '%';
        pen.calculative.singleton.div.children[3].style.width =
          pen.operationalRect.width * 100 + '%';

        pen.calculative.singleton.div.children[4].style.width =
          pen.operationalRect.x * 100 + '%';
      }
    }
  }
  if (value.blur !== undefined) {
    for (let i = 1; i < 5; i++) {
      pen.calculative.singleton.div.children[i].style[
        'backdrop-filter'
      ] = `blur(${value.blur}px)`;
    }
  }
  if (value.blurBackground !== undefined) {
    for (let i = 1; i < 5; i++) {
      pen.calculative.singleton.div.children[i].style.backgroundColor =
        value.blurBackground;
    }
  }
  return value;
}

function mouseMove(pen: Pen, e: Point) {
  if (!pen.calculative.canvas.store.data.locked && !pen.locked) {
    return;
  }
  if (initOperationalRect(pen.operationalRect)) {
    if (
      pen.calculative.zIndex < 5 &&
      e.x > pen.x + pen.width * pen.operationalRect.x &&
      e.x <
        pen.x +
          pen.width * (pen.operationalRect.x + pen.operationalRect.width) &&
      e.y > pen.y + pen.height * pen.operationalRect.y &&
      e.y <
        pen.y +
          pen.height * (pen.operationalRect.y + pen.operationalRect.height)
    ) {
      if (pen.calculative.singleton.div) {
        let children: HTMLElement[] =
          pen.calculative.singleton.div.parentNode.children;
        for (let i = 0; i < 6; i++) {
          children[i].style.pointerEvents = 'none';
        }
      }
    }
  }
}

function initOperationalRect(operationalRect) {
  if (operationalRect) {
    if (!operationalRect.width || !operationalRect.height) {
      return false;
    }
    //默认居中
    if (operationalRect.x === undefined) {
      operationalRect.x = (1 - operationalRect.width) / 2;
    }
    if (operationalRect.y === undefined) {
      operationalRect.y = (1 - operationalRect.height) / 2;
    }
    return true;
  } else {
    return false;
  }
}

function generateAroundDiv(pen: Pen) {
  if (!initOperationalRect(pen.operationalRect)) {
    return;
  }
  const div = pen.calculative.singleton.div;
  if (!div) {
    return;
  }
  const isLinux =navigator.userAgent.indexOf('Linux') > -1; //Kylin OS会闪屏
  const top = document.createElement('div');
  top.style.position = 'absolute';
  top.style.left = pen.operationalRect.x * 100 + '%';
  top.style.top = '0px';
  top.style.width = pen.operationalRect.width * 100 + '%';
  top.style.height = pen.operationalRect.y * 100 + '%';
  if(!isLinux && pen.blur){
    top.style['backdrop-filter'] = `blur(${pen.blur}px)`;
  }
  top.style.backgroundColor = pen.blurBackground;
  div.appendChild(top);

  const right = document.createElement('div');
  right.style.position = 'absolute';
  right.style.right = '0px';
  right.style.top = '0px';
  right.style.width =
    (1 - pen.operationalRect.x - pen.operationalRect.width) * 100 + '%';
  right.style.height = '100%';
  if(!isLinux && pen.blur){
    right.style['backdrop-filter'] = `blur(${pen.blur}px)`;
  }
  right.style.backgroundColor = pen.blurBackground;
  div.appendChild(right);

  const bottom = document.createElement('div');
  bottom.style.position = 'absolute';
  bottom.style.left = pen.operationalRect.x * 100 + '%';
  bottom.style.bottom = '0px';
  bottom.style.width = pen.operationalRect.width * 100 + '%';
  bottom.style.height =
    (1 - pen.operationalRect.y - pen.operationalRect.height) * 100 + '%';
  if(!isLinux && pen.blur){
    bottom.style['backdrop-filter'] = `blur(${pen.blur}px)`;
  }
  bottom.style.backgroundColor = pen.blurBackground;
  div.appendChild(bottom);

  const left = document.createElement('div');
  left.style.position = 'absolute';
  left.style.left = '0px';
  left.style.top = '0px';
  left.style.width = pen.operationalRect.x * 100 + '%';
  left.style.height = '100%';
  if(!isLinux && pen.blur){
    left.style['backdrop-filter'] = `blur(${pen.blur}px)`;
  }
  left.style.backgroundColor = pen.blurBackground;
  div.appendChild(left);

  let mouseEnter = () => {
    updatePointerEvents(pen);
  };

  top.onmouseenter = mouseEnter;
  bottom.onmouseenter = mouseEnter;
  right.onmouseenter = mouseEnter;
  left.onmouseenter = mouseEnter;
  div.onmouseleave = mouseEnter;
  // }
}

function updatePointerEvents(pen: Pen) {
  if (!pen.calculative.canvas.store.data.locked && !pen.locked) {
    return;
  }
  if (pen.calculative.zIndex < 5) {
    let children: any = pen.calculative.singleton.div.parentNode.children;
    for (let i = 1; i < 6; i++) {
      children[i].style.pointerEvents = 'initial';
    }
  }
}

function renderPenRaw(pen: Pen) {
  if (pen.thumbImg) {
    if (!pen.calculative.img) {
      const img = new Image();
      img.crossOrigin =
        pen.crossOrigin === 'undefined'
          ? undefined
          : pen.crossOrigin || 'anonymous';
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
  //       // 转成图片，生成图片地址
  //       // imgBase64 = canvas.toDataURL('image/png');
  //       const img = new Image();
  //       img.crossOrigin =
  //         pen.crossOrigin === 'undefined'
  //           ? undefined
  //           : pen.crossOrigin || 'anonymous';
  //       img.src = canvas.toDataURL('image/png', 0.1);
  //       if (img.src.length > 10) {
  //         pen.calculative.img = img;
  //       }
  //     })
  //     .catch((e) => {
  //       console.warn(e);
  //     });
}
