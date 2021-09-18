import { commonPens } from './diagrams';
import { EventType, Handler } from 'mitt';
import { Canvas } from './canvas';
import { Options } from './options';
import { calcTextLines, facePen, getParent, LockState, Pen, PenType } from './pen';
import { Point } from './point';
import { clearStore, EditAction, globalStore, TopologyData, TopologyStore, useStore } from './store';
import { Tooltip } from './tooltip';
import { s8 } from './utils';
import { calcRelativeRect, getRect } from './rect';
import { deepClone } from './utils/clone';

import * as mqtt from 'mqtt/dist/mqtt.min.js';

import pkg from '../package.json';

declare const window: any;

export class Topology {
  store: TopologyStore;
  input = document.createElement('textarea');
  tooltip: Tooltip;
  canvas: Canvas;
  websocket: WebSocket;
  mqttClient: any;
  socketFn: Function;
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
  set beforeAddPen(fn: (pen: Pen) => boolean) {
    this.canvas.beforeAddPen = fn;
  }
  get beforeAddAnchor() {
    return this.canvas.beforeAddAnchor;
  }
  set beforeAddAnchor(fn: (pen: Pen, anchor: Point) => boolean) {
    this.canvas.beforeAddAnchor = fn;
  }
  get beforeRemovePen() {
    return this.canvas.beforeRemovePen;
  }
  set beforeRemovePen(fn: (pen: Pen) => boolean) {
    this.canvas.beforeRemovePen = fn;
  }
  get beforeRemoveAnchor() {
    return this.canvas.beforeAddAnchor;
  }
  set beforeRemoveAnchor(fn: (pen: Pen, anchor: Point) => boolean) {
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

  addPen(pen: Pen, history?: boolean) {
    return this.canvas.addPen(pen, history);
  }

  addPens(pens: Pen[], history?: boolean) {
    const list: Pen[] = [];
    for (let pen of pens) {
      const p = this.canvas.addPen(pen, history);
      p && list.push(p);
    }
    return list;
  }

  render(now?: number) {
    this.canvas.render(now);
  }

  open(data?: TopologyData) {
    clearStore(this.store);
    if (data && data.mqttOptions && !data.mqttOptions.customClientId) {
      data.mqttOptions.clientId = s8();
    }

    if (data) {
      this.store.data = Object.assign({}, data);
      this.store.data.pens = [];
      for (let pen of data.pens) {
        this.canvas.makePen(pen);
      }
    }
    this.canvas.render(Infinity);
    this.listenSocket();
    this.connectSocket();
    this.startAnimate();
    this.doInitJS();
    this.store.emitter.emit('opened');
  }

  connectSocket() {
    this.connectWebsocket();
    this.connectMqtt();
  }

  private doInitJS() {
    if (this.store.data.initJs && this.store.data.initJs.trim()) {
      // 字符串类型存在
      const fn = new Function(this.store.data.initJs);
      fn();
    }
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

  // customDock return:
  // {
  //   xDock: {x, y, step, prev},
  //   yDock: {x, y, step, prev},
  // }
  // xDock，yDock - 水平或垂直方向的参考线
  // prev - 参考线的起点
  // x,y - 参考线的终点
  // step - 自动吸附需要的偏移量
  registerDock(customeDock?: Function) {
    this.canvas.customeDock = customeDock;
  }

  find(idOrTag: string) {
    return this.store.data.pens.filter((pen) => {
      return pen.id == idOrTag || (pen.tags && pen.tags.indexOf(idOrTag) > -1);
    });
  }

  startAnimate(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[];
    if (!idOrTagOrPens) {
      pens = this.store.data.pens.filter((pen) => {
        return (pen.type || pen.frames) && pen.autoPlay;
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      if (pen.calculative.pause) {
        const d = Date.now() - pen.calculative.pause;
        pen.calculative.pause = undefined;
        pen.calculative.frameStart += d;
        pen.calculative.frameEnd += d;
      } else {
        this.store.animates.add(pen);
      }
    });
    this.canvas.animate();
  }

  pauseAnimate(idOrTagOrPens?: string | Pen[]) {
    let pens: Pen[] = [];
    if (!idOrTagOrPens) {
      this.store.animates.forEach((pen) => {
        pens.push(pen);
      });
    } else if (typeof idOrTagOrPens === 'string') {
      pens = this.find(idOrTagOrPens);
    } else {
      pens = idOrTagOrPens;
    }
    pens.forEach((pen) => {
      if (!pen.calculative.pause) {
        pen.calculative.pause = Date.now();
      }
    });
  }

  stopAnimate(pens?: Pen[]) {
    if (!pens) {
      pens = this.store.data.pens;
    }
    pens.forEach((pen) => {
      pen.calculative.pause = undefined;
      pen.calculative.start = 0;
    });
  }

  calcAnimateDuration(pen: Pen) {
    pen.calculative.duration = 0;
    for (const f of pen.frames) {
      pen.calculative.duration += f.duration;
    }
  }

  combine(pens?: Pen[]) {
    if (!pens) {
      pens = this.store.active;
    }
    if (!pens || !pens.length) {
      return;
    }

    if (pens.length === 1 && pens[0].type) {
      pens[0].type = PenType.Node;
      this.canvas.active(pens);
      this.render();
      return;
    }

    const rect = getRect(pens);
    const id = s8();
    let parent: Pen = {
      id,
      name: 'combine',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      children: [],
    };
    const p = pens.find((pen) => {
      return pen.width === rect.width && pen.height === rect.height;
    });
    if (p) {
      if (!p.children) {
        p.children = [];
      }
      parent = p;
    } else {
      this.canvas.makePen(parent);
    }

    pens.forEach((pen) => {
      if (pen === parent || pen.parentId === parent.id) {
        return;
      }
      parent.children.push(pen.id);
      pen.parentId = parent.id;
      const childRect = calcRelativeRect(pen.calculative.worldRect, rect);
      pen.x = childRect.x;
      pen.y = childRect.y;
      pen.width = childRect.width;
      pen.height = childRect.height;
      pen.locked = LockState.DisableMove;
      pen.type = PenType.Node;
    });
    this.canvas.active([parent]);
    this.render();

    this.store.emitter.emit('add', [parent]);
  }

  uncombine(pen?: Pen) {
    if (!pen && this.store.active) {
      pen = this.store.active[0];
    }
    if (!pen || !pen.children) {
      return;
    }

    pen.children.forEach((id) => {
      const child: Pen = this.store.pens[id];
      child.parentId = undefined;
      child.x = child.calculative.worldRect.x;
      child.y = child.calculative.worldRect.y;
      child.width = child.calculative.worldRect.width;
      child.height = child.calculative.worldRect.height;
      child.locked = LockState.None;
      child.calculative.active = undefined;
    });
    pen.children = undefined;
    if (pen.name === 'combine') {
      this.delete([pen]);
    }
    this.inactive();
  }

  active(pens: Pen[]) {
    this.canvas.active(pens);
  }

  inactive() {
    this.canvas.inactive();
  }

  delete(pens?: Pen[]) {
    this.canvas.delete(pens);
  }

  scale(scale: number, center = { x: 0, y: 0 }) {
    this.canvas.scale(scale, center);
  }

  translate(x: number, y: number) {
    this.canvas.translate(x, y);
  }

  translatePens(pens: Pen[], x: number, y: number) {
    this.canvas.translatePens(pens, x, y);
  }

  getParent(pen: Pen) {
    return getParent(this.store, pen);
  }

  data() {
    const data = deepClone(this.store.data);
    data.version = pkg.version;
    return data;
  }

  copy(pens?: Pen[]) {
    this.canvas.copy(pens);
  }

  cut(pens?: Pen[]) {
    this.canvas.cut(pens);
  }

  paste() {
    this.canvas.paste();
  }

  listenSocket() {
    if (this.socketFn) {
      this.off('socket', this.socketFn as any);
    }
    this.socketFn = undefined;
    if (!this.store.data.socketCbFn && this.store.data.socketCbJs) {
      return false;
    }

    try {
      let socketFn: Function;
      if (this.store.data.socketCbFn) {
        socketFn = window[this.store.data.socketCbFn];
      } else {
        socketFn = new Function('e', this.store.data.socketCbJs);
      }
      if (!socketFn) {
        return false;
      }
      this.on('socket', socketFn as any);
      this.socketFn = socketFn;
    } catch (e) {
      console.error('Create the function for socket:', e);
      return false;
    }

    return true;
  }

  connectWebsocket() {
    this.closeWebsocket();
    this.websocket = new WebSocket(this.store.data.websocket);
    this.websocket.onmessage = (e) => {
      this.doSocket(e.data);
    };

    this.websocket.onclose = () => {
      console.info('Canvas websocket closed and reconneting...');
      this.connectWebsocket();
    };
  }

  closeWebsocket() {
    if (this.websocket) {
      this.websocket.onclose = undefined;
      this.websocket.close();
      this.websocket = undefined;
    }
  }

  connectMqtt() {
    this.mqttClient = mqtt.connect(this.store.data.mqtt, this.store.data.mqttOptions);
    this.mqttClient.on('message', (topic: string, message: any) => {
      this.doSocket(message.toString());
    });

    if (this.store.data.mqttTopics) {
      this.mqttClient.subscribe(this.store.data.mqttTopics.split(','));
    }
  }

  closeMqtt() {
    this.mqttClient && this.mqttClient.close();
  }

  doSocket(message: any) {
    try {
      message = JSON.parse(message);
      if (!Array.isArray(message)) {
        message = [message];
      }
      message.forEach((item: any) => {
        this.setValue(item);
      });
    } catch (error) {
      console.warn('Invalid socket data:', error);
    }

    this.socketFn && this.store.emitter.emit('socket', message);
  }

  setValue(data: any) {
    const pens: Pen[] = this.find(data.id || data.tag) || [];
    pens.forEach((pen) => {
      Object.assign(pen, data);
      if (pen.calculative.text !== pen.text) {
        pen.calculative.text = pen.text;
        calcTextLines(pen);
      }
      for (const k in data) {
        if (typeof pen[k] !== 'object') {
          pen.calculative[k] = data[k];
        }
      }
      if (data.x != null || data.y != null || data.width != null || data.height != null) {
        this.canvas.dirtyPenRect(pen);
        this.canvas.updateLines(pen, true);
      }
    });

    this.render(Infinity);
  }

  pushHistory(action: EditAction) {
    this.canvas.pushHistory(action);
  }

  destroy(global?: boolean) {
    clearStore(this.store);
    this.canvas.destroy();
    // Clear data.
    globalStore[this.store.topologyId] = undefined;
    this.canvas = undefined;

    if (global) {
      globalStore.htmlElements = {};
    }
  }
}
