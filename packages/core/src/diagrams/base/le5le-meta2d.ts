import { createMeta2d, type Meta2d } from '../../meta2d';
import type { Pen } from '../../models';
import { Mode } from '../../types';

interface Le5leMeta2dPen extends Pen {
  /** 当前嵌入图纸的数据标识。 */
  dataId?: string;
}

interface LoadState {
  requestId: number;
  dataId?: string;
  registration?: Promise<void>;
  loaded?: boolean;
  fitFrame?: number;
}

const isolatedEventNames = [
  'mousedown',
  'mouseup',
  'mousemove',
  'click',
  'dblclick',
  'contextmenu',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'keydown',
  'keyup',
  'keypress',
] as const;

type IsolatedEventName = (typeof isolatedEventNames)[number];

interface EventHost extends HTMLElement {
  __meta2dEventHandler?: (event: Event) => void;
}

/** 每个父画布中的嵌入图元分别维护请求状态，避免不同图元之间相互覆盖。 */
const loadStates = new WeakMap<Meta2d, Map<string, LoadState>>();

export const le5leMeta2dDefine = {
  type: 'le5le-meta2d',
  create,
  beforeUpdate,
  destroy,
  toPng,
};

function create(this: Meta2d, pen: Pen): HTMLElement | void {
  if (!pen.id) {
    return;
  }

  const existing = this.componentElementMap.get(pen.id);
  if (existing) {
    return existing;
  }

  // 嵌入图元也可以在未由宿主显式调用 createMeta2d 时独立使用。
  if (!globalThis.customElements?.get('le5le-meta2d')) {
    createMeta2d();
  }

  const host = document.createElement('div') as EventHost;
  // 自定义元素默认宽高为宿主的 100%，外层容器负责按图元矩形定位，避免覆盖父画布。
  const scale = this.data.scale || 1;
  host.style.position = 'absolute';
  host.style.left = `${pen.x * scale + this.data.x}px`;
  host.style.top = `${pen.y * scale + this.data.y}px`;
  host.style.width = `${pen.width * scale}px`;
  host.style.height = `${pen.height * scale}px`;
  host.style.overflow = 'hidden';
  // 等待父画布计算 inViewPenIds 后由 setElementStyle 决定是否显示。
  host.style.visibility = 'hidden';
  addEventIsolation(this, host);

  const child = document.createElement('le5le-meta2d') as Meta2d;
  setDataLoader(this, child);
  host.appendChild(child);

  this.componentElementMap.set(pen.id, host);
  appendChild(this, pen, host);

  const state = getLoadState(this, pen.id);
  // 父画布缩放或调整图元尺寸时不会触发 window.resize，需要同步子画布的绘图尺寸。
  child.resizeObserver = new ResizeObserver(() => {
    if (child.isConnected) {
      child.resize();
      scheduleFitView(state, host, child);
    }
  });
  child.resizeObserver.observe(host);

  // 资源由子画布挂载时自动初始化，失败后仍允许打开基础图元。
  state.registration = child.ready.catch(() => {});

  void loadData(this, pen as Le5leMeta2dPen, child, (pen as Le5leMeta2dPen).dataId);
  return host;
}

function beforeUpdate(this: Meta2d, pen: Pen, _oldPen: Pen): boolean {
  const value = pen.__val as Partial<Le5leMeta2dPen> | undefined;
  if (!value || !Object.prototype.hasOwnProperty.call(value, 'dataId') || !pen.id) {
    return true;
  }

  const child = getChild(this, pen.id);
  if (!child) {
    return true;
  }

  const state = getLoadState(this, pen.id);
  // 只有 dataId 真正变化时才重新请求，其他属性更新不触发图纸加载。
  if (state.requestId > 0 && value.dataId === state.dataId) {
    return true;
  }

  setDataLoader(this, child);
  void loadData(this, pen as Le5leMeta2dPen, child, value.dataId);
  return true;
}

function destroy(this: Meta2d, pen: Pen) {
  if (!pen.id) {
    return;
  }

  const host = this.componentElementMap.get(pen.id);
  const child = getChild(this, pen.id);
  child?.resizeObserver?.disconnect();
  if (child) {
    child.resizeObserver = undefined;
  }
  const state = loadStates.get(this)?.get(pen.id);
  if (state?.fitFrame !== undefined) {
    cancelAnimationFrame(state.fitFrame);
  }
  removeEventIsolation(host as EventHost);
  host?.remove();
  this.componentElementMap.delete(pen.id);
  loadStates.get(this)?.delete(pen.id);
}

function appendChild(parent: Meta2d, pen: Pen, child: HTMLElement) {
  if (pen.isBottom) {
    parent.bottomElement.appendChild(child);
  } else {
    parent.topElement.appendChild(child);
  }
}

function addEventIsolation(parent: Meta2d, host: EventHost) {
  const handler = (event: Event) => {
    // 使用冒泡阶段拦截，保证子画布内部先完成自身事件处理。
    if (parent.options.mode === Mode.Run) {
      event.stopPropagation();
    }
  };
  host.__meta2dEventHandler = handler;
  isolatedEventNames.forEach((eventName: IsolatedEventName) => {
    host.addEventListener(eventName, handler);
  });
}

function removeEventIsolation(host: EventHost | undefined) {
  if (!host?.__meta2dEventHandler) {
    return;
  }
  isolatedEventNames.forEach((eventName: IsolatedEventName) => {
    host.removeEventListener(eventName, host.__meta2dEventHandler);
  });
  delete host.__meta2dEventHandler;
}

function setDataLoader(parent: Meta2d, child: Meta2d) {
  if (parent.getMeta2dData) {
    child.getMeta2dData = parent.getMeta2dData.bind(parent);
  } else {
    child.getMeta2dData = undefined;
  }
}

function getLoadState(meta2d: Meta2d, penId: string): LoadState {
  let states = loadStates.get(meta2d);
  if (!states) {
    states = new Map<string, LoadState>();
    loadStates.set(meta2d, states);
  }

  let state = states.get(penId);
  if (!state) {
    state = { requestId: 0 };
    states.set(penId, state);
  }
  return state;
}

function scheduleFitView(state: LoadState, host: HTMLElement, child: Meta2d) {
  if (!state.loaded) return;
  if (state.fitFrame !== undefined) {
    cancelAnimationFrame(state.fitFrame);
  }
  state.fitFrame = requestAnimationFrame(() => {
    state.fitFrame = undefined;
    if (child.isConnected && host.contains(child)) {
      child.fitView(true);
    }
  });
}

async function loadData(meta2d: Meta2d, pen: Le5leMeta2dPen, child: Meta2d, dataId?: string) {
  if (!pen.id) {
    return;
  }

  const state = getLoadState(meta2d, pen.id);
  const requestId = ++state.requestId;
  state.dataId = dataId;

  // 空标识表示不切换图纸，同时使之前尚未完成的请求失效。
  if (!dataId || !meta2d.getMeta2dData) {
    return;
  }

  try {
    await state.registration;
    const data = await meta2d.getMeta2dData(dataId);

    // 异步请求返回时再次校验，防止旧请求覆盖最新的 dataId。
    if (
      state.requestId !== requestId ||
      state.dataId !== dataId ||
      !meta2d.componentElementMap.get(pen.id)?.contains(child) ||
      !data
    ) {
      return;
    }
    child.setMode(Mode.Run);
    child.open(data);
    state.loaded = true;
    child.resize();
    scheduleFitView(state, meta2d.componentElementMap.get(pen.id), child);
  } catch (error) {
    // 子图纸加载失败不应中断父画布，已有内容保持不变。
    if (state.requestId === requestId) {
      console.warn('加载嵌入图纸失败：', error);
    }
  }
}

function getChild(meta2d: Meta2d, penId: string): Meta2d | undefined {
  const host = meta2d.componentElementMap.get(penId);
  return host?.querySelector('le5le-meta2d') as Meta2d | undefined;
}

function toPng(this: Meta2d, pen: Pen): Promise<ImageBitmap> {
  if (!pen.id) {
    return Promise.resolve(undefined);
  }

  const child = getChild(this, pen.id);
  if (!child) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    try {
      child.toPng({ padding: 0 }, (buffer, error) => {
        if (error || !buffer.byteLength) {
          resolve(undefined);
          return;
        }
        void createImageBitmap(new Blob([buffer], { type: 'image/png' }))
          .then(resolve)
          .catch(() => resolve(undefined));
      });
    } catch {
      // 子图导出失败时跳过当前嵌入图元，保持父画布可导出。
      resolve(undefined);
    }
  });
}
