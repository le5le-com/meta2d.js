import { KeydownType } from '../options';
import { calcWorldAnchors, calcWorldRects, LockState, PenType, renderPen, TopologyPen } from '../pen';
import { hitPoint, Point } from '../point';
import { calcCenter, pointInRect, Rect } from '../rect';
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
  offscreen = createOffscreen();
  pensLayer = createOffscreen();
  active = createOffscreen();
  hover = createOffscreen();
  animate = createOffscreen();

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

  dirty = false;
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

    this.store.dpiRatio = (window ? window.devicePixelRatio : 0); // + options.extDpiRatio
    if (this.store.dpiRatio < 1) {
      this.store.dpiRatio = 1;
    }

    this.bounding = this.externalElements.getBoundingClientRect();
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
      this.externalElements.onmousedown = (e) => {
        this.onMouseDown({
          x: e.x,
          y: e.y,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
        });
      };
      this.externalElements.onmousemove = (e) => {
        this.onMouseMove({
          x: e.x,
          y: e.y,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
        });
      };
      this.externalElements.onmouseup = (e) => {
        this.onMouseUp({
          x: e.x,
          y: e.y,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
        });
      };
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
    const x = e.changedTouches[0].pageX - (window ? window.scrollX : 0);
    const y = e.changedTouches[0].pageY - (window ? window.scrollY : 0);

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

    const x = event.changedTouches[0].pageX - (window ? window.scrollX : 0);
    const y = event.changedTouches[0].pageY - (window ? window.scrollY : 0);

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

    const x = event.changedTouches[0].pageX - (window ? window.scrollX : 0);
    const y = event.changedTouches[0].pageY - (window ? window.scrollY : 0);

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

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;
    e.x *= this.store.dpiRatio;
    e.y *= this.store.dpiRatio;

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
    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;
    e.x *= this.store.dpiRatio;
    e.y *= this.store.dpiRatio;

    this.getHover(e);
    this.render();
  };

  onMouseUp = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;
    e.x *= this.store.dpiRatio;
    e.y *= this.store.dpiRatio;

    this.mouseDown = undefined;

    if (this.cacheNode) {
      this.cacheNode.x = e.x - this.cacheNode.width / 2;
      this.cacheNode.y = e.y - this.cacheNode.height / 2;


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

  private getHover = (pt: Point) => {
    if (this.store.data.locked === LockState.Disable) {
      this.moveType = MoveType.None;
      return;
    }

    for (let i = this.store.data.pens.length - 1; i >= 0; --i) {
      const pen = this.store.data.pens[i];
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
        if (!this.store.options.disableSize && this.sizeCPs && this.sizeCPs.length === 4) {
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
          const anchors = this.store.worldAnchors.get(pen);
          if (anchors) {
            for (const anchor of anchors) {
              if (hitPoint(pt, anchor, 10)) {
                this.moveType = MoveType.Anchors;
                this.anchor = anchor;
                this.store.hover = pen;
                return;
              }
            }
          }
        }

        if (pointInRect(pt, this.store.worldRects.get(pen))) {
          if (!this.store.data.locked && !pen.locked) {
            this.externalElements.style.cursor = 'move';
          } else {
            this.externalElements.style.cursor = this.store.options.hoverCursor;
          }
          if (pen !== this.store.hover) {
            this.dirty = true;
            this.store.emitter.emit('enter', pen);
          }
          this.store.hover = pen;
          this.moveType = MoveType.Nodes;
          return;
        }
      } else {
        if (pen.from) {
          if (hitPoint(pt, pen.from)) {
            this.moveType = MoveType.LineFrom;
            this.store.hover = pen;
            if (this.store.data.locked || pen.locked) {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            } else {
              this.externalElements.style.cursor = 'move';
            }
            return;
          }

          if (pen.to && hitPoint(pt, pen.to)) {
            this.moveType = MoveType.LineTo;
            this.store.hover = pen;
            if (this.store.data.locked || pen.locked) {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            } else {
              this.externalElements.style.cursor = 'move';
            }
            return;
          }

          if (pen.pointIn && pen.pointIn(pt)) {
            this.moveType = MoveType.LineTo;
            this.store.hover = pen;
            this.externalElements.style.cursor = this.store.options.hoverCursor;
            return;
          }
        }
      }
    }

    if (this.store.hover && !this.mouseDown) {
      this.moveType = MoveType.None;
      this.externalElements.style.cursor = 'default';
      this.store.emitter.emit('leave', this.store.hover);
      this.store.hover = undefined;
      this.dirty = true;
    }
  };

  resize(w?: number, h?: number) {
    w = w || this.parentElement.clientWidth;
    h = h || this.parentElement.clientHeight;

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.externalElements.style.width = w + 'px';
    this.externalElements.style.height = h + 'px';

    w = (w * this.store.dpiRatio) | 0;
    h = (h * this.store.dpiRatio) | 0;

    this.canvas.width = w;
    this.canvas.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.pensLayer.width = w;
    this.pensLayer.height = h;

    this.active.width = w;
    this.active.height = h;

    this.hover.width = w;
    this.hover.height = h;

    this.animate.width = w;
    this.animate.height = h;

    this.bounding = this.externalElements.getBoundingClientRect();

    this.dirtyAll();
    this.render();
  }

  dirtyAll() {
    this.dirty = true;
    this.store.dirty.clear();
    this.store.data.pens.forEach((pen, i) => {
      this.store.dirty.set(pen, i);
      calcWorldRects(this.store.pens, this.store.worldRects, pen);
    });

    this.clearCanvas();
  }

  clearCanvas() {
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.pensLayer.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  addPen(pen: TopologyPen, edited?: boolean) {
    if (pen.beforeAddPen && pen.beforeAddPen(pen) != true) {
      return;
    } else if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
      return;
    }

    if (!pen.id) {
      pen.id = s8();
    }
    this.store.data.pens.push(pen);
    this.store.pens[pen.id] = pen;
    calcCenter(pen);

    this.store.path2dMap.set(pen, this.store.registerPens[pen.name](pen));
    this.rectDirty(pen);

    this.render();
    this.store.emitter.emit('addPen', pen);

    if (edited) {
      if (edited && this.store.data.locked === LockState.None) {
        this.store.histories.push({
          type: EditType.Add,
          data: pen
        });
      }
    }

    return pen;
  }

  propsDirty(pen: TopologyPen) {
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  rectDirty(pen: TopologyPen) {
    const rect = calcWorldRects(this.store.pens, this.store.worldRects, pen);
    calcWorldAnchors(this.store.worldAnchors, pen, rect);
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  render = () => {
    if (!this.dirty) {
      return;
    }

    this.dirty = false;

    const now = performance.now();
    if (now - this.lastRender < this.store.options.interval) {
      requestAnimationFrame(this.render);
      return;
    }
    this.lastRender = now;

    this.renderPens();
    this.renderAnimate();
    this.renderActive();
    this.renderHover();

    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.getContext('2d').drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

    // console.log('render');
    if (this.dirty) {
      requestAnimationFrame(this.render);
    }
  };

  renderPens = () => {
    this.offscreen.getContext('2d').clearRect(0, 0, this.pensLayer.width, this.pensLayer.height);

    // if (!this.store.dirty.size) {
    //   this.offscreen.getContext('2d').drawImage(this.pensLayer, 0, 0, this.pensLayer.width, this.pensLayer.height);
    //   return;
    // }
    const ctx = this.pensLayer.getContext('2d');
    ctx.clearRect(0, 0, this.pensLayer.width, this.pensLayer.height);
    ctx.save();
    ctx.strokeStyle = this.store.options.color;
    this.store.data.pens.forEach((pen: TopologyPen) => {
      if ((this.store.hover === pen && (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground))
        || this.store.active.has(pen)) {
        return;
      }
      renderPen(ctx, pen, this.store.path2dMap.get(pen), this.store.worldRotates.get(pen));
    });
    ctx.restore();
    this.store.dirty.clear();

    this.offscreen.getContext('2d').drawImage(this.pensLayer, 0, 0, this.pensLayer.width, this.pensLayer.height);
  };
  renderActive = () => { };

  renderHover = () => {
    const ctx = this.hover.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.store.hover) {
      this.offscreen.getContext('2d').drawImage(this.hover, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    if (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground) {
      renderPen(
        ctx,
        this.store.hover,
        this.store.path2dMap.get(this.store.hover),
        this.store.worldRotates.get(this.store.hover),
        this.store.hover.hoverColor || this.store.options.hoverColor,
        this.store.hover.hoverBackground || this.store.options.hoverBackground,
      );
    }

    ctx.save();
    if (!this.store.options.disableAnchor && !this.store.hover.disableAnchor) {
      const anchors = this.store.worldAnchors.get(this.store.hover);
      if (anchors) {
        ctx.strokeStyle = this.store.hover.hoverAnchorColor || this.store.options.hoverAnchorColor;
        ctx.fillStyle = this.store.hover.anchorBackground || this.store.options.anchorBackground;
        anchors.forEach((anchor) => {
          ctx.beginPath();
          ctx.arc(anchor.x, anchor.y, anchor.radius || this.store.options.anchorRadius, 0, Math.PI * 2);
          if (anchor.color || anchor.background) {
            ctx.save();
            ctx.strokeStyle = anchor.color;
            ctx.fillStyle = anchor.background;
          }
          ctx.fill();
          ctx.stroke();
          if (anchor.color || anchor.background) {
            ctx.restore();
          }
        });
      }
    }
    ctx.restore();

    this.offscreen.getContext('2d').drawImage(this.hover, 0, 0, this.canvas.width, this.canvas.height);
  };

  renderAnimate = () => { };

  destroy() {
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
        document.removeEventListener('keyup', this.onkey);
        break;
      case KeydownType.Canvas:
        this.externalElements.removeEventListener('keyup', this.onkey);
        break;
    }
    window && window.removeEventListener('resize', this.onResize);
  }
}
