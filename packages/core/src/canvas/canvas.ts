import { KeydownType } from '../options';
import { calcCenter, LockState, renderPen, TopologyPen } from '../pen';
import { hitPoint, Point } from '../point';
import { pointInRect, Rect } from '../rect';
import { EditType, TopologyStore } from '../store';
import { isMobile, s8 } from '../utils';
import { createOffscreen } from './offscreen';

enum MoveType {
  None,
  Line,
  LineFrom,
  LineTo,
  LineControlPoint,
  Nodes,
  ResizeCP,
  Anchors,
  AutoAnchor,
  Rotate,
  GraffitiReady,
  Graffiti,
  LinesReady,
  Lines
}

export class Canvas {
  canvas = document.createElement('canvas');
  active = createOffscreen();
  hover = createOffscreen();
  animate = createOffscreen();
  offscreen = createOffscreen();
  externalElements = document.createElement('div');
  bounding?: DOMRect;

  rotateCP: { x: number; y: number; id: string; };
  activeRect: Rect;
  sizeCPs: Point[] = [];

  moveType = MoveType.None;
  sizeCP = 0;
  anchor: Point;
  mouseDown: { x: number; y: number; restore?: boolean; };
  cacheNode: TopologyPen;
  touchCenter?: { x: number; y: number; };
  touches?: TouchList;

  rendering = 0;
  lastRender = 0;
  touchStart = 0;
  timer: any;

  beforeAddPen: (pen: TopologyPen) => boolean;
  beforeAddAnchor: (pen: TopologyPen, anchor: Point) => boolean;
  beforeRemovePen: (pen: TopologyPen) => boolean;
  beforeRemoveAnchor: (pen: TopologyPen, anchor: Point) => boolean;

  constructor(public parentElement: HTMLElement, public store: TopologyStore) {
    parentElement.appendChild(this.canvas);

    this.externalElements.style.position = 'absolute';
    this.externalElements.style.left = '0';
    this.externalElements.style.top = '0';
    this.externalElements.style.outline = 'none';
    this.externalElements.style.background = 'transparent';
    parentElement.appendChild(this.externalElements);

    this.listen();

    window && window.addEventListener('resize', this.onResize);
  }

  listen() {
    // ios
    this.externalElements.addEventListener('gesturestart', this.onGesturestart);

    this.externalElements.ondragover = (e: any) => e.preventDefault();
    this.externalElements.ondrop = this.ondrop;
    if (isMobile()) {
      this.store.options.interval = 50;
      this.externalElements.ontouchstart = this.ontouchstart;
      this.externalElements.ontouchmove = this.ontouchmove;
      this.externalElements.ontouchend = this.ontouchend;
    } else {
      this.externalElements.onmousedown = this.onMouseDown;
      this.externalElements.onmousemove = this.onMouseMove;
      this.externalElements.onmouseup = this.onMouseUp;
    }

    this.externalElements.ondblclick = (e: any) => { };
    this.externalElements.onblur = () => { this.mouseDown = undefined; };
    this.externalElements.onwheel = (e: any) => { };

    switch (this.store.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keydown', this.onkey);
        document.addEventListener('keyup', () => {

        });
        break;
      case KeydownType.Canvas:
        this.externalElements.addEventListener('keydown', this.onkey);
        break;
    }
  }

  unListen() {
    // ios
    this.externalElements.removeEventListener('gesturestart', this.onGesturestart);

    this.externalElements.ondragover = (e: any) => e.preventDefault();
    this.externalElements.ondrop = undefined;
    if (isMobile()) {
      this.externalElements.ontouchstart = undefined;
      this.externalElements.ontouchmove = undefined;
      this.externalElements.ontouchend = undefined;
    } else {
      this.externalElements.onmousedown = undefined;
      this.externalElements.onmousemove = undefined;
      this.externalElements.onmouseup = undefined;
    }

    this.externalElements.ondblclick = undefined;

    switch (this.store.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keyup', this.onkey);
        break;
      case KeydownType.Canvas:
        this.externalElements.addEventListener('keyup', this.onkey);
        break;
    }
  }

  onkey = (e: any) => {
    this.mouseDown = undefined;
  };

  ondrop = (event: any) => {
    if (this.store.data.locked) {
      return;
    }
    try {
      const json = event.dataTransfer.getData('Topology') || event.dataTransfer.getData('Text');
      if (!json) return;
      let obj = JSON.parse(json);
      event.preventDefault();

      obj = Array.isArray(obj) ? obj : [obj];


    } catch { }
  };

  ontouchstart = (e: any) => {
    this.touchStart = performance.now();
    const x = e.changedTouches[0].pageX - (window ? window.scrollX : 0) - (this.bounding.left || this.bounding.x);
    const y = e.changedTouches[0].pageY - (window ? window.scrollY : 0) - (this.bounding.top || this.bounding.y);

    if (e.touches.length > 1) {
      this.touches = e.touches;
      return;
    }

    this.onMouseDown({
      x,
      y,
      ctrlKey: e.ctrlKey || e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      buttons: 1,
    });

  };

  ontouchmove = (event: any) => {
    event.stopPropagation();

    const touches = event.changedTouches;
    const len = touches.length;
    if (!this.touchCenter && len > 1) {
      this.touchCenter = {
        x: touches[0].pageX + (touches[1].pageX - touches[0].pageX) / 2,
        y: touches[0].pageY + (touches[1].pageY - touches[0].pageY) / 2,
      };
    }

    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }
    this.touchStart = now;

    const x = event.changedTouches[0].pageX - (window ? window.scrollX : 0) - (this.bounding.left || this.bounding.x);
    const y = event.changedTouches[0].pageY - (window ? window.scrollY : 0) - (this.bounding.top || this.bounding.y);

    if (len > 1) {
      if (len === 2) {
        const scale =
          (event as any).scale ||
          Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) /
          Math.hypot(
            this.touches[0].pageX - this.touches[1].pageX,
            this.touches[0].pageY - this.touches[1].pageY
          );
        event.preventDefault();
        // this.scaleTo(scale * this.touchScale, this.touchCenter);
      } else if (len === 3) {


        // this.translate(x, y, true);
      }

      return;
    }

    event.preventDefault();

    this.onMouseMove({
      x,
      y,
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      buttons: 1,
    });
  };

  ontouchend = (event: any) => {
    this.touches = undefined;

    const x = event.changedTouches[0].pageX - (window ? window.scrollX : 0) - (this.bounding.left || this.bounding.x);
    const y = event.changedTouches[0].pageY - (window ? window.scrollY : 0) - (this.bounding.top || this.bounding.y);

    this.onMouseUp({
      x,
      y,
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      buttons: 1,
    });
  };

  onGesturestart = (e: any) => {
    e.preventDefault();
  };

  onMouseDown = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    if (e.buttons !== 1 && e.buttons !== 2) return;

    this.mouseDown = e;


    this.render();
  };

  onMouseMove = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    // 防止异常情况导致mouseup事件没有触发
    if (this.mouseDown && !this.mouseDown.restore && (e.buttons !== 1 && e.buttons !== 2)) {
      this.onMouseUp(e);
      return;
    }

    this.getHover(e);
  };

  onMouseUp = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    if (this.cacheNode) {
      this.cacheNode.x = e.x - this.cacheNode.width / 2;
      this.cacheNode.y = e.y - this.cacheNode.height / 2;

      if (this.beforeAddPen && this.beforeAddPen(this.cacheNode) != true) {
        return;
      }

      this.addPen(this.cacheNode);
      this.cacheNode = undefined;
      return;
    }
  };

  onResize = () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.resize();
    }, 100);
  };

  private getHover(pt: Point) {
    this.moveType = MoveType.None;
    this.store.hover.clear();
    if (this.store.data.locked === LockState.Disable) {
      return;
    }
    let i = 0;
    for (const id of this.store.data.layer) {
      const pen = this.store.data.pens[id];
      if (pen.visible == false || pen.locked === LockState.Disable) {
        continue;
      }
      if (!pen.type) {
        if (!this.store.options.disableRotate) {
          // 旋转控制点
          if (this.rotateCP && hitPoint(pt, this.rotateCP, 10)) {
            this.moveType = MoveType.Rotate;
            return;
          }
        }

        // 大小控制点
        if (!this.store.options.disableSize && this.sizeCPs) {
          for (let i = 0; i < 4; i++) {
            if (hitPoint(pt, this.sizeCPs[i], 10)) {
              this.moveType = MoveType.ResizeCP;
              this.sizeCP = i;
              return;
            }
          }
        }

        if (!this.store.options.disableAnchor) {
          // 锚点
          const anchors = this.store.worldAnchor.get(id);
          for (const anchor of anchors) {
            if (hitPoint(pt, anchor, 10)) {
              this.moveType = MoveType.Anchors;
              this.anchor = anchor;
              this.store.hover.set(id, i);
              return;
            }
          }
        }

        if (pointInRect(pt, this.store.worldRect.get(id))) {
          this.store.hover.set(id, i);
          return;
        }
      } else {
        if (pen.from) {
          if (hitPoint(pt, pen.from)) {
            this.moveType = MoveType.LineFrom;
            this.store.hover.set(id, i);
            if (this.store.data.locked || pen.locked) {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            } else {
              this.externalElements.style.cursor = 'move';
            }
            return;
          }

          if (hitPoint(pt, pen.to)) {
            this.moveType = MoveType.LineTo;
            this.store.hover.set(id, i);
            if (this.store.data.locked || pen.locked) {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            } else {
              this.externalElements.style.cursor = 'move';
            }
            return;
          }

          if (pen.pointIn && pen.pointIn(pt)) {
            this.moveType = MoveType.LineTo;
            this.store.hover.set(id, i);
            this.externalElements.style.cursor = this.store.options.hoverCursor;
            return;
          }
        }
      }

      ++i;
    }
  }

  resize(w?: number, h?: number) {
    w = w || this.parentElement.clientWidth;
    h = h || this.parentElement.clientHeight;

    this.canvas.width = w;
    this.canvas.height = h;

    this.active.width = w;
    this.active.height = h;

    this.hover.width = w;
    this.hover.height = h;

    this.animate.width = w;
    this.animate.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.externalElements.style.width = w + 'px';
    this.externalElements.style.height = h + 'px';

    this.bounding = this.externalElements.getBoundingClientRect();
  }

  addPen(pen: TopologyPen) {
    pen.id = s8();
    this.store.data.pens[pen.id] = pen;
    pen.layer = this.store.data.layer.length;
    this.store.data.layer.push(pen.id);
    calcCenter(pen);

    this.store.path2dMap.set(pen.id, this.store.registerPens[pen.name](pen));
    this.store.dirty.push(pen.id);
    if (this.store.data.locked === LockState.None) {
      this.store.histories.push({
        type: EditType.Add,
        data: pen
      });
    }
    this.render();
    this.store.emitter.emit('addPen', pen);
  }

  render = () => {
    if (!this.store.active.size && !this.store.hover.size && !this.store.animate.size && !this.store.dirty.length) {
      return;
    }

    if (this.rendering) {
      cancelAnimationFrame(this.rendering);
      this.rendering = 0;
    }

    const now = performance.now();
    if (now - this.lastRender < this.store.options.interval) {
      requestAnimationFrame(this.render);
      return;
    }
    this.lastRender = now;

    this.renderPens();

    this.canvas.getContext('2d').drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);
    this.rendering = requestAnimationFrame(this.render);
  };

  renderPens = () => {
    const ctx = this.offscreen.getContext('2d');
    ctx.strokeStyle = this.store.options.color;

    this.store.dirty.forEach((id) => {
      renderPen(ctx, this.store.data.pens[id], this.store.path2dMap.get(id), this.store.worldRotate.get(id));
    });

    this.store.dirty = [];
  };
  renderActive = () => { };
  renderHover = () => { };
  renderAnimate = () => { };

  destroy() {
    this.externalElements.removeEventListener('gesturestart', this.onGesturestart);
    document.removeEventListener('keyup', this.onkey);
    this.externalElements.removeEventListener('keyup', this.onkey);
    window && window.removeEventListener('resize', this.onResize);
  }
}
