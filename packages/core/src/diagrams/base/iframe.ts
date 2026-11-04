import { Meta2d } from '../../meta2d';
import { Pen } from '../../models';
import { Mode } from '../../types';

const iframes: {
  [key: string]: HTMLElement;
} = {};

export function clearIframes() {
  for (const key in iframes) {
    iframes[key]?.remove();
    iframes[key] = null;
  }
  iframes;
}

export function updateIframes(pens: Pen[]) {
  for (const key in iframes) {
    if (!pens.some((pen) => pen.name == 'iframe' && pen.iframe == key)) {
      iframes[key]?.remove();
      iframes[key] = null;
    }
  }
}

export const iframeDefine = {
  type: 'iframe',
  create,
  mouseMove,
  destroy,
  beforeUpdate,
  toPng,
};

function create(this: Meta2d, pen: Pen) {
  let div = this.componentElementMap.get(pen.id);
  if (div) {
    return div;
  }

  div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.outline = 'none';
  const scale = this.data.scale;
  div.style.left = pen.x * scale + this.data.x + 'px';
  div.style.top = pen.y * scale + this.data.y + 'px';
  div.style.width = pen.width * scale + 'px';
  div.style.height = pen.height * scale + 'px';

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.scrolling = pen.scrolling || 'no';
  iframe.frameBorder = '0';
  iframe.style.border = 'none';
  iframe.src = pen.iframe;
  iframe.allowFullscreen = true;
  div.appendChild(iframe);
  iframe.onload = () => {
    iframe.setAttribute('document.domain', '');
  };
  if (pen.isBottom) {
    this.bottomElement.appendChild(div);
  } else {
    this.topElement.appendChild(div);
  }
  this.componentElementMap.set(pen.id, div);
  generateAroundDiv.call(this, pen);

  iframe.onmouseleave = () => {
    closeOperationalRect(this, div);
  };
}

function mouseMove(this: Meta2d, _pen: Pen, e: any) {
  const pen = this.penMap.get(_pen.id);
  // 与 setElementStyle 一致：运行模式或锁定时 iframe 才可交互
  if (!pen || (this.options.mode === Mode.Edit && !pen.locked)) {
    return;
  }
  if (!initOperationalRect(pen.operationalRect)) {
    return;
  }
  const rect = pen.operationalRect;
  // 鼠标在画布上移入四个 div 包围的矩形区域时，交给 iframe 响应
  if (
    e.x > pen.x + pen.width * rect.x &&
    e.x < pen.x + pen.width * (rect.x + rect.width) &&
    e.y > pen.y + pen.height * rect.y &&
    e.y < pen.y + pen.height * (rect.y + rect.height)
  ) {
    openOperationalRect(this, pen);
  }
}

function beforeUpdate(this: Meta2d, pen: Pen, oldPen: Pen) {
  const value: any = pen.__val;
  if (!value) {
    return;
  }
  const div = this.componentElementMap.get(pen.id);
  if (value.iframe && div) {
    (div.children[0] as HTMLIFrameElement).src = value.iframe;
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
    let _value = structuredClone(value);
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
    if (div) {
      let length = div.children.length;
      if (length === 1) {
        //没有创建
        generateAroundDiv.call(this, pen);
      } else {
        //有更新值
        (div.children[1] as HTMLElement).style.height = pen.operationalRect.y * 100 + '%';
        (div.children[1] as HTMLElement).style.left = pen.operationalRect.x * 100 + '%';
        (div.children[1] as HTMLElement).style.width = pen.operationalRect.width * 100 + '%';
        (div.children[2] as HTMLElement).style.width =
          (1 - pen.operationalRect.x - pen.operationalRect.width) * 100 + '%';

        (div.children[3] as HTMLElement).style.height =
          (1 - pen.operationalRect.y - pen.operationalRect.height) * 100 + '%';
        (div.children[3] as HTMLElement).style.left = pen.operationalRect.x * 100 + '%';
        (div.children[3] as HTMLElement).style.width = pen.operationalRect.width * 100 + '%';

        (div.children[4] as HTMLElement).style.width = pen.operationalRect.x * 100 + '%';
      }
    }
  }
  if (value.blur !== undefined) {
    for (let i = 1; i < 5; i++) {
      div.children[i] && ((div.children[i] as HTMLElement).style.backdropFilter = `blur(${value.blur}px)`);
    }
  }
  if (value.blurBackground !== undefined) {
    for (let i = 1; i < 5; i++) {
      div.children[i] && ((div.children[i] as HTMLElement).style.backgroundColor = value.blurBackground);
    }
  }

  return true;
}

async function toPng(this: Meta2d, pen: Pen): Promise<ImageBitmap> {
  const thumbImg = pen.thumbImg;
  if (!thumbImg) {
    return undefined;
  }

  try {
    const image = new Image();
    image.crossOrigin = pen.crossOrigin || 'anonymous';
    image.src = thumbImg;
    await image.decode();
    return await createImageBitmap(image);
  } catch {
    // 缩略图无法加载时跳过 iframe，不能影响其他图元导出。
    return undefined;
  }
}

function destroy(this: Meta2d, pen: Pen) {
  const div = this.componentElementMap.get(pen.id);
  if (div) {
    div.remove();
    this.componentElementMap.delete(pen.id);
  }
}

function generateAroundDiv(this: Meta2d, pen: any) {
  if (!initOperationalRect(pen.operationalRect)) {
    return;
  }
  const div = this.componentElementMap.get(pen.id);
  if (!div) {
    return;
  }

  div.childNodes.length > 1 && removeAllButFirst(div);
  const isLinux = navigator.userAgent.indexOf('Linux') > -1; //Kylin OS会闪屏
  const top = document.createElement('div');
  top.style.position = 'absolute';
  top.style.left = pen.operationalRect.x * 100 + '%';
  top.style.top = '0px';
  top.style.width = pen.operationalRect.width * 100 + '%';
  top.style.height = pen.operationalRect.y * 100 + '%';
  top.style.zIndex = '1'; // 确保覆盖在 iframe 上方
  top.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
  if (!isLinux && pen.blur) {
    top.style.backdropFilter = `blur(${pen.blur}px)`;
  }
  top.style.backgroundColor = pen.blurBackground;
  div.appendChild(top);

  const right = document.createElement('div');
  right.style.position = 'absolute';
  right.style.right = '0px';
  right.style.top = '0px';
  right.style.width = (1 - pen.operationalRect.x - pen.operationalRect.width) * 100 + '%';
  right.style.height = '100%';
  right.style.zIndex = '1'; // 确保覆盖在 iframe 上方
  right.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
  if (!isLinux && pen.blur) {
    right.style.backdropFilter = `blur(${pen.blur}px)`;
  }
  right.style.backgroundColor = pen.blurBackground;
  div.appendChild(right);

  const bottom = document.createElement('div');
  bottom.style.position = 'absolute';
  bottom.style.left = pen.operationalRect.x * 100 + '%';
  bottom.style.bottom = '0px';
  bottom.style.width = pen.operationalRect.width * 100 + '%';
  bottom.style.height = (1 - pen.operationalRect.y - pen.operationalRect.height) * 100 + '%';
  bottom.style.zIndex = '1'; // 确保覆盖在 iframe 上方
  bottom.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
  if (!isLinux && pen.blur) {
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
  left.style.zIndex = '1'; // 确保覆盖在 iframe 上方
  left.style.pointerEvents = 'auto'; // 确保能接收鼠标事件
  if (!isLinux && pen.blur) {
    left.style['backdrop-filter'] = `blur(${pen.blur}px)`;
  }
  left.style.backgroundColor = pen.blurBackground;
  div.appendChild(left);

  // 外层容器由样式强制不接收鼠标事件（见 meta2d.ts 中的 [data-operational-rect]），
  // 默认 iframe 和四周 div 也不接收，鼠标事件全部交给画布；移入中间区域时由 mouseMove 打开
  div.setAttribute(OPERATIONAL_RECT_ATTR, '');
  setChildrenPointerEvents(div, 'none');

  // 鼠标从中间区域移到四周 div，或移出容器时，恢复画布默认交互
  const close = () => closeOperationalRect(this, div);
  top.onmouseenter = close;
  bottom.onmouseenter = close;
  right.onmouseenter = close;
  left.onmouseenter = close;
  div.onmouseleave = close;
}

const OPERATIONAL_RECT_ATTR = 'data-operational-rect';

function setChildrenPointerEvents(div: HTMLElement, value: string) {
  for (const child of Array.from(div.children)) {
    (child as HTMLElement).style.pointerEvents = value;
  }
}

// 打开可操作区域：iframe 接收中间区域的事件，四周 div 接收事件用于检测鼠标移出
function openOperationalRect(meta2d: Meta2d, pen: Pen) {
  const div = meta2d.componentElementMap.get(pen.id);
  if (!div?.hasAttribute(OPERATIONAL_RECT_ATTR)) {
    return;
  }
  setChildrenPointerEvents(div, 'auto');
  // 底层 iframe 被画布盖住，需要让画布各层放行鼠标事件
  pen.isBottom && disableOverlayPointerEvents(meta2d);
}

// 关闭可操作区域：鼠标事件重新交给画布
function closeOperationalRect(meta2d: Meta2d, div: HTMLElement) {
  if (div.hasAttribute(OPERATIONAL_RECT_ATTR)) {
    setChildrenPointerEvents(div, 'none');
  }
  enableOverlayPointerEvents(meta2d);
}

function initOperationalRect(operationalRect: any) {
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

function removeAllButFirst(parent) {
  while (parent.childNodes.length > 1) {
    parent.removeChild(parent.lastChild);
  }
}

function disableOverlayPointerEvents(meta2d: Meta2d) {
  meta2d.renderCanvas.style.pointerEvents = 'none';
  meta2d.hoverCanvas.style.pointerEvents = 'none';
  meta2d.ruleCanvas.style.pointerEvents = 'none';
  meta2d.topElement.style.pointerEvents = 'none';
  meta2d.inputElement.parentElement.style.pointerEvents = 'none';
}

function enableOverlayPointerEvents(meta2d: Meta2d) {
  meta2d.renderCanvas.style.pointerEvents = '';
  meta2d.hoverCanvas.style.pointerEvents = '';
  meta2d.ruleCanvas.style.pointerEvents = '';
  meta2d.topElement.style.pointerEvents = '';
  meta2d.inputElement.parentElement.style.pointerEvents = '';
}
