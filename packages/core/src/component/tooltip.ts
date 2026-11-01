import type { Meta2d } from '../meta2d';
import type { Pen } from '../models/pen/pen';
import type { Point } from '../models/point/point';
import { PenCategory } from '../models/pen/const';
import { AnchorMode, InteractionMode } from '../types';

/** 每个画布实例独立的主线程提示框，样式和事件均限制在当前 Shadow DOM。 */
export class Tooltip {
  readonly box = document.createElement('div');
  readonly text = document.createElement('div');
  private readonly arrow = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly elements = new WeakMap<HTMLElement, string>();
  private scriptSources = new WeakMap<Pen, string>();
  private observer?: ResizeObserver;
  private sourceId?: string;
  private currentId?: string;
  private position?: Point;
  private inside = false;
  private overBox = false;
  private domId?: string;

  constructor(private meta2d: Meta2d) {
    this.box.className = 'meta2d-tooltip';
    this.box.setAttribute('role', 'tooltip');
    this.text.className = 'text';
    this.arrow.className = 'arrow';
    this.box.append(this.text, this.arrow);
    this.box.hidden = true;
    this.style.textContent = `
      .meta2d-tooltip { position:absolute; width:auto; height:auto; padding:8px 0;
        z-index:90; box-sizing:border-box; }
      .meta2d-tooltip[hidden] { display:none; }
      .meta2d-tooltip .text { box-sizing:border-box; max-width:320px; min-height:30px;
        max-height:400px; padding:8px 16px; border-radius:4px; background:#777777;
        color:#ffffff; line-height:1.8; overflow:auto; overflow-wrap:anywhere; }
      .meta2d-tooltip img { max-width:100%; }
      .meta2d-tooltip a { color:inherit; }
      .meta2d-tooltip .arrow { position:absolute; width:0; height:0; border:10px solid transparent;
        left:50%; transform:translateX(-50%); bottom:-11px; border-top-color:#777777; }
      .meta2d-tooltip.below .arrow { bottom:auto; top:-11px; border-top-color:transparent;
        border-bottom-color:#777777; }
    `;
    meta2d.shadowRoot.append(this.style, this.box);
    for (const name of ['mousemove', 'mouseover', 'mouseout', 'pointerdown'] as const) {
      meta2d.shadowRoot.addEventListener(name, this.onPointer, true);
    }
    // 浮层滚动和点击不能触发底下画布的操作，仍保留链接的默认行为。
    for (const name of ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'wheel', 'touchstart', 'touchmove']) {
      this.box.addEventListener(name, (event) => event.stopPropagation());
    }
    meta2d.emitter.on('translate', this.reposition);
    meta2d.emitter.on('scale', this.reposition);
    meta2d.emitter.on('resizeView', this.reposition);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.reposition);
      this.observer.observe(this.text);
    }
  }

  bindElement(element: HTMLElement, id: string) {
    this.elements.set(element, id);
  }

  get active() {
    return !!this.sourceId;
  }

  private blocked() {
    return !!this.meta2d.mousedown || this.meta2d.interactionStateMachine.state !== InteractionMode.None ||
      !!(this.meta2d.options.anchorMode & (AnchorMode.Drawline | AnchorMode.Pencil));
  }

  private onPointer = (event: MouseEvent) => {
    const path = event.composedPath();
    if (path.includes(this.box)) {
      this.overBox = true;
      if (event.type === 'mouseout' && !this.box.contains(event.relatedTarget as Node)) {
        this.overBox = false;
        this.hide();
      }
      return;
    }
    this.overBox = false;
    if (event.type === 'pointerdown') {
      this.hide();
      return;
    }
    if (event.type === 'mouseout') {
      const related = event.relatedTarget as Node;
      if (related && this.box.contains(related)) {
        this.overBox = true;
      } else if (!related || related.getRootNode() !== this.meta2d.shadowRoot) {
        this.inside = false;
        this.domId = undefined;
        this.hide();
      }
      return;
    }
    this.inside = true;
    const rect = this.meta2d.topElement.getBoundingClientRect();
    this.position = {
      x: (event.clientX - rect.left - this.meta2d.data.x) / this.meta2d.data.scale,
      y: (event.clientY - rect.top - this.meta2d.data.y) / this.meta2d.data.scale,
    };
    const root = path.find((node) => this.elements.has(node as HTMLElement)) as HTMLElement;
    const previousDom = this.domId;
    this.domId = root ? this.elements.get(root) : undefined;
    if (this.blocked()) {
      this.hide();
    } else if (this.domId) {
      this.show(this.domId, this.position);
    } else if (previousDom || !this.sourceId) {
      // calc 对同一图元不会重复发送 Pick；离开浮层/画布后重入仍须恢复提示。
      // 使用上次拾取位置，避免旧连线提示跳到新鼠标位置并挡住下一次拾取。
      this.pick(this.meta2d.hoverTopId || this.meta2d.hover?.id);
    }
  };

  pick(id?: string, position = this.meta2d.mousePos) {
    if (!this.inside || this.overBox || this.domId) return;
    if (this.blocked()) return this.hide();
    this.show(id, position);
  }

  private show(id?: string, position?: Point) {
    if (!id) return this.hide();
    if (position) this.position = { x: position.x, y: position.y };
    if (this.sourceId === id) {
      this.reposition();
      return;
    }
    this.sourceId = id;
    this.refresh();
  }

  /** 只有当前命中及其祖先的变化才重新执行用户函数。 */
  refresh(changedIds?: Set<string>) {
    if (!this.sourceId) return;
    let pen = this.meta2d.penMap.get(this.sourceId);
    let owner: Pen;
    const visited = new Set<string>();
    while (pen && !visited.has(pen.id)) {
      visited.add(pen.id);
      if (pen.visible === false) {
        this.box.hidden = true;
        return;
      }
      if (pen.tooltipFn && this.scriptSources.get(pen) !== pen.tooltipJs) delete pen.tooltipFn;
      if (!owner && (pen.tooltipJs || pen.tooltip)) owner = pen;
      pen = this.meta2d.penMap.get(pen.parentId);
    }
    if (changedIds && ![...changedIds].some((id) => visited.has(id) || id === this.sourceId || id === this.currentId)) return;
    this.currentId = owner?.id;
    this.box.hidden = true;
    if (!owner) return;
    try {
      // 与 1.0 一致：鼠标移入后才把脚本编译为临时 tooltipFn。
      if (!owner.tooltipFn && owner.tooltipJs) {
        const fn = new Function('pen', owner.tooltipJs) as Pen['tooltipFn'];
        // 不可枚举，避免缓存进入 Worker、导出数据和历史快照。
        Object.defineProperty(owner, 'tooltipFn', {
          value: fn, writable: true, configurable: true, enumerable: false,
        });
        this.scriptSources.set(owner, owner.tooltipJs);
      }
      const content = owner.tooltipFn ? owner.tooltipFn(owner) : owner.tooltip;
      if (content == null || content === '') return;
      const markdown = (globalThis as any).marked;
      const html = typeof markdown === 'function' ? markdown(String(content)) :
        markdown?.parse ? markdown.parse(String(content)) : String(content);
      if (typeof html !== 'string') throw new TypeError('Tooltip only supports synchronous Markdown rendering');
      this.text.innerHTML = html;
      this.text.querySelectorAll('a').forEach((link) => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      });
      this.box.hidden = false;
      this.reposition();
    } catch (error) {
      console.warn('tooltip error', owner.id, error);
    }
  }

  readonly reposition = () => {
    if (this.box.hidden) return;
    const pen = this.meta2d.penMap.get(this.currentId);
    if (!pen || pen.visible === false) return this.hide();
    const { x, y, scale } = this.meta2d.data;
    const line = pen.category === PenCategory.Line;
    const left = x + (line ? this.position?.x ?? pen.x : pen.x + pen.width / 2) * scale;
    const top = y + (line ? this.position?.y ?? pen.y : pen.y) * scale;
    const height = this.box.offsetHeight;
    const below = top < height;
    this.box.classList.toggle('below', below);
    const width = this.meta2d.topElement.clientWidth;
    const boxLeft = Math.max(0, Math.min(left - this.box.offsetWidth / 2, width - this.box.offsetWidth));
    this.box.style.left = `${boxLeft}px`;
    this.box.style.top = `${below ? top + (line ? 0 : pen.height * scale) : top - height}px`;
    this.arrow.style.left = `${Math.max(10, Math.min(left - boxLeft, this.box.offsetWidth - 10))}px`;
  };

  hide() {
    this.box.hidden = true;
    this.sourceId = this.currentId = undefined;
  }

  reset() {
    this.hide();
    this.scriptSources = new WeakMap();
    this.inside = this.overBox = false;
    this.domId = undefined;
  }

  destroy() {
    this.reset();
    this.observer?.disconnect();
    for (const name of ['mousemove', 'mouseover', 'mouseout', 'pointerdown'] as const) {
      this.meta2d.shadowRoot.removeEventListener(name, this.onPointer, true);
    }
    this.meta2d.emitter.off('translate', this.reposition);
    this.meta2d.emitter.off('scale', this.reposition);
    this.meta2d.emitter.off('resizeView', this.reposition);
    this.box.remove();
    this.style.remove();
  }
}
