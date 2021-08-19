import { commonPens } from './common-diagram';
import { EventType, Handler } from 'mitt';
import { Canvas } from './canvas';
import { Options } from './options';
import { facePen, TopologyPen } from './pen';
import { Point } from './point';
import { clearStore, globalStore, TopologyData, TopologyStore, useStore } from './store';
import { Tooltip } from './tooltip';
import { s8 } from './utils';

declare const window: any;

export class Topology {
  store: TopologyStore;
  input = document.createElement('textarea');
  tooltip: Tooltip;
  canvas: Canvas;
  constructor(parent: string | HTMLElement, opts: Options = {}) {
    this.store = useStore(s8());
    this.setOptions(opts);
    this.init(parent);
    this.register(commonPens());
    if (window) {
      window.topology = this;
    }

    this['facePen'] = facePen;
  }

  get beforeAddPen() {
    return this.canvas.beforeAddPen;
  }
  set beforeAddPen(fn: (pen: TopologyPen) => boolean) {
    this.canvas.beforeAddPen = fn;
  }
  get beforeAddAnchor() {
    return this.canvas.beforeAddAnchor;
  }
  set beforeAddAnchor(fn: (pen: TopologyPen, anchor: Point) => boolean) {
    this.canvas.beforeAddAnchor = fn;
  }
  get beforeRemovePen() {
    return this.canvas.beforeRemovePen;
  }
  set beforeRemovePen(fn: (pen: TopologyPen) => boolean) {
    this.canvas.beforeRemovePen = fn;
  }
  get beforeRemoveAnchor() {
    return this.canvas.beforeAddAnchor;
  }
  set beforeRemoveAnchor(fn: (pen: TopologyPen, anchor: Point) => boolean) {
    this.canvas.beforeAddAnchor = fn;
  }

  setOptions(opts: Options = {}) {
    this.store.options = Object.assign(this.store.options, opts);
  }

  getOptions() {
    return this.store.options;
  }

  private init(parent: string | HTMLElement) {
    if (typeof parent === 'string') {
      this.canvas = new Canvas(document.getElementById(parent), this.store);
    } else {
      this.canvas = new Canvas(parent, this.store);
    }

    this.tooltip = new Tooltip(this.canvas.parentElement);

    this.input.style.position = 'absolute';
    this.input.style.zIndex = '-1';
    this.input.style.left = '-1000px';
    this.input.style.width = '0';
    this.input.style.height = '0';
    this.input.style.outline = 'none';
    this.input.style.border = '1px solid #cdcdcd';
    this.input.style.resize = 'none';
    this.canvas.parentElement.appendChild(this.input);

    this.resize();
    this.canvas.listen();
  }

  resize(width?: number, height?: number) {
    this.canvas.resize(width, height);
    this.canvas.render();
    this.store.emitter.emit('resize', { width, height });
  }

  addPen(pen: TopologyPen, edited?: boolean) {
    return this.canvas.addPen(pen, edited);
  }

  render() {
    this.canvas.render();
  }

  open(data?: TopologyData) {
    clearStore(this.store);
    if (data && data.mqttOptions && !data.mqttOptions.customClientId) {
      data.mqttOptions.clientId = s8();
    }
    this.canvas.render();
    this.store.emitter.emit('open');
  }

  drawLine(lineName?: string) {
    this.canvas.drawingLineName = lineName;
  }

  addDrawLineFn(fnName: string, fn: Function) {
    this.canvas[fnName] = fn;
    this.canvas.drawLineFns.push(fnName);
  }

  removeDrawLineFn(fnName: string) {
    const index = this.canvas.drawLineFns.indexOf(fnName);
    if (index > -1) {
      this.canvas.drawLineFns.splice(index, 1);
    }
  }

  clear() {
    clearStore(this.store);
    this.canvas.clearCanvas();
    this.canvas.render();
  }

  emit(eventType: EventType, data: any) {
    this.store.emitter.emit(eventType, data);
  }

  on(eventType: EventType, handler: Handler) {
    this.store.emitter.on(eventType, handler);
    return this;
  }

  off(eventType: EventType, handler: Handler) {
    this.store.emitter.off(eventType, handler);
    return this;
  }

  register(penPaths: any) {
    this.store.penPaths = Object.assign({}, this.store.penPaths, penPaths);
  }

  registerDraw(name: string, draw?: Function) {
    globalStore.draws[name] = draw;
  }

  registerIndependentDraw(name: string, draw?: Function) {
    globalStore.independentDraws[name] = draw;
  }

  destroy(global?: boolean) {
    this.canvas.destroy();
    // Clear data.
    globalStore[this.store.topologyId] = undefined;
    this.canvas = undefined;

    if (global) {
      globalStore.htmlElements = {};
    }
  }
}
