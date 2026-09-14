import { Pen } from '../pen';
import { Point } from '../point';
import { deepClone } from '../utils';

/**
 * operationalRect 可操作区域（iframe / htmlDom 等外部元素图元通用）
 * x,y,width,height 均取值 0-1，相对图元自身宽高
 * 原理：在内容元素四周拼接 4 个遮罩 div，围出可操作的“天窗”区域；
 * 锁定模式下再通过切换上层画布的 pointer-events 实现事件穿透
 */

export function initOperationalRect(operationalRect) {
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

export function generateAroundDiv(pen: Pen) {
  if (!initOperationalRect(pen.operationalRect)) {
    return;
  }
  const div = pen.calculative.singleton.div;
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
  if (!isLinux && pen.blur) {
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
  if (!isLinux && pen.blur) {
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
  if (!isLinux && pen.blur) {
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
}

// 遮罩已存在时，按最新 operationalRect 原地更新样式
function updateAroundDiv(pen: Pen) {
  const children = pen.calculative.singleton.div.children;
  children[1].style.height = pen.operationalRect.y * 100 + '%';
  children[1].style.left = pen.operationalRect.x * 100 + '%';
  children[1].style.width = pen.operationalRect.width * 100 + '%';
  children[2].style.width =
    (1 - pen.operationalRect.x - pen.operationalRect.width) * 100 + '%';

  children[3].style.height =
    (1 - pen.operationalRect.y - pen.operationalRect.height) * 100 + '%';
  children[3].style.left = pen.operationalRect.x * 100 + '%';
  children[3].style.width = pen.operationalRect.width * 100 + '%';

  children[4].style.width = pen.operationalRect.x * 100 + '%';
}

export function updatePointerEvents(pen: Pen) {
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

export function operationalRectMouseMove(pen: Pen, e: Point) {
  if (!pen.calculative.canvas.store.data.locked && !pen.locked) {
    return;
  }
  if (initOperationalRect(pen.operationalRect)) {
    if (
      pen.calculative.zIndex < 5 &&
      e.x > pen.x + pen.width * pen.operationalRect.x &&
      e.x <
        pen.x + pen.width * (pen.operationalRect.x + pen.operationalRect.width) &&
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

/**
 * beforeValue 钩子中处理 operationalRect / blur / blurBackground 的公共部分
 * 支持整体传 operationalRect 对象，也支持 operationalRect.x 等平铺字段
 */
export function beforeOperationalRectValue(pen: Pen, value: any) {
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
        updateAroundDiv(pen);
      }
    }
  }
  if (value.blur !== undefined) {
    for (let i = 1; i < 5; i++) {
      pen.calculative.singleton.div.children[i] &&
        (pen.calculative.singleton.div.children[i].style['backdrop-filter'] =
          `blur(${value.blur}px)`);
    }
  }
  if (value.blurBackground !== undefined) {
    for (let i = 1; i < 5; i++) {
      pen.calculative.singleton.div.children[i] &&
        (pen.calculative.singleton.div.children[i].style.backgroundColor =
          value.blurBackground);
    }
  }
}
