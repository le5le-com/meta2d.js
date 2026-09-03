import { Pen, setElemPosition } from '../pen';

// 磨砂玻璃（毛玻璃）图元：通过 DOM 的 backdrop-filter 实现背景模糊效果
export function frostedGlassDom(pen: Pen) {
  if (!pen.onDestroy) {
    pen.onDestroy = destroy;
    pen.onMove = move;
    pen.onResize = move;
    pen.onRotate = move;
    pen.onValue = move;
    pen.onBeforeValue = beforeValue;
  }
  if (!pen.calculative.singleton) {
    pen.calculative.singleton = {};
  }

  if (!pen.calculative.singleton.div) {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.outline = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    pen.calculative.canvas.externalElements?.parentElement.appendChild(div);
    pen.calculative.singleton.div = div;
  }

  setStyle(pen);
  setElemPosition(pen, pen.calculative.singleton.div);
  // 装饰性图元，不拦截鼠标，避免遮挡画布交互
  pen.calculative.singleton.div.style.pointerEvents = 'none';
  return new Path2D();
}

function destroy(pen: Pen) {
  if (pen.calculative.singleton && pen.calculative.singleton.div) {
    pen.calculative.singleton.div.remove();
    delete pen.calculative.singleton.div;
  }
}

function move(pen: Pen) {
  pen.calculative.singleton.div &&
    setElemPosition(pen, pen.calculative.singleton.div);
}

function beforeValue(pen: Pen, value: any) {
  if (
    value.blur !== undefined ||
    value.blurBackground !== undefined ||
    value.background !== undefined ||
    value.borderRadius !== undefined
  ) {
    requestAnimationFrame(() => setStyle(pen));
  }
  return value;
}

function setStyle(pen: Pen) {
  const div = pen.calculative.singleton.div;
  if (!div) {
    return;
  }
  const blur = `blur(${pen.blur ?? 10}px)`;
  div.style['backdrop-filter'] = blur;
  div.style['-webkit-backdrop-filter'] = blur;
  // blurBackground 优先；background 直接透传 CSS 值，纯色与 linear-gradient/radial-gradient 渐变均可
  div.style.background =
    pen.blurBackground ??
    pen.calculative.background ??
    pen.background ??
    'rgba(255, 255, 255, 0.25)';
  // 圆角直接按数字（px）处理，随画布缩放保持视觉一致
  const scale = pen.calculative.canvas.store.data.scale || 1;
  const r = (pen.calculative.borderRadius ?? pen.borderRadius ?? 0) * scale;
  div.style.borderRadius = r + 'px';
}
