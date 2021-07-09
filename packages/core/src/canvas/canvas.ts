import { KeydownType } from '../options';
import { calcIconRect, calcTextRect, calcWorldAnchors, calcWorldRects, getParent, LockState, PenType, renderPen, TopologyPen } from '../pen';
import { hitPoint, Point } from '../point';
import { calcCenter, getRect, pointInRect, Rect, rectToPoints } from '../rect';
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

  width: number;
  height: number;

  externalElements = document.createElement('div');
  bounding?: DOMRect;

  rotateCP: { x: number; y: number; id: string; };
  activeRect: Rect;
  sizeCPs: Point[];

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

    this.store.dpiRatio = (window ? window.devicePixelRatio : 0);

    if (this.store.dpiRatio < 1) {
      this.store.dpiRatio = 1;
    } else if (this.store.dpiRatio > 1 && this.store.dpiRatio < 1.5) {
      this.store.dpiRatio = 1.5;
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

    this.mouseDown = e;

    switch (this.moveType) {
      case MoveType.None:
        if (this.store.active.length) {
          this.store.active.forEach((pen) => {
            pen.active = undefined;
          });
          this.store.active = [];
          this.dirty = true;
          this.store.emitter.emit('space', e);
          this.activeRect = undefined;
          this.sizeCPs = undefined;
        }
        break;
      case MoveType.Nodes:
        if (this.store.hover) {
          if (e.ctrlKey || e.shiftKey) {
            if (this.store.hover.parentId) {
              break;
            }
            if (this.store.hover.active) {
              this.store.hover.active = undefined;
              this.store.active.splice(this.store.active.findIndex((pen) => pen === this.store.hover), 1);
              this.store.emitter.emit('inactive', this.store.hover);
            } else {
              this.store.hover.active = true;
              this.store.active.push(this.store.hover);
              this.store.emitter.emit('active', this.store.hover);
            }
            this.dirty = true;
          } else if (e.altKey) {
            if (this.store.active.length > 1 || !this.store.hover.active) {
              this.store.active.forEach((pen) => {
                pen.active = undefined;
              });
              this.store.active = [this.store.hover];
              this.store.hover.active = true;
              this.store.emitter.emit('active', this.store.hover);
              this.dirty = true;
            }
          } else {
            const pen = getParent(this.store.pens, this.store.hover);
            if (!pen.active) {
              this.store.active.forEach((pen) => {
                pen.active = undefined;
              });
              this.store.active = [pen];
              this.store.hover.active = true;
              this.store.emitter.emit('active', pen);
              this.dirty = true;
            }
          }

          this.activeRect = getRect(this.store.active);
          this.sizeCPs = rectToPoints(this.activeRect);
        }
        break;
    }

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

    this.store.debug && console.time('hover');
    this.getHover(e);
    this.store.debug && console.timeEnd('hover');
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

    const ctx = this.offscreen.getContext('2d');
    let moveType = MoveType.None;

    if (this.store.active.length === 1) {
      if (!this.store.options.disableRotate) {
        // 旋转控制点
        if (this.rotateCP && hitPoint(pt, this.rotateCP, 10)) {
          moveType = MoveType.Rotate;
          this.store.lastHover = this.store.hover;
          this.store.hover = this.store.active[0];
        }
      } else {
        // 大小控制点
        for (let i = 0; i < 4; i++) {
          if (hitPoint(pt, this.sizeCPs[i], 10)) {
            moveType = MoveType.ResizeCP;
            this.store.lastHover = this.store.hover;
            this.store.hover = this.store.active[0];
            this.sizeCP = i;
            break;
          }
        }
      }
    }

    if (moveType === MoveType.None) {
      for (let i = this.store.data.pens.length - 1; i >= 0; --i) {
        const pen = this.store.data.pens[i];
        if (pen.visible == false || pen.locked === LockState.Disable) {
          continue;
        }

        if (!pen.type) {
          if (!this.store.options.disableAnchor) {
            // 锚点
            if (pen.calculative.worldAnchors) {
              for (const anchor of pen.calculative.worldAnchors) {
                if (hitPoint(pt, anchor, 10)) {
                  moveType = MoveType.Anchors;
                  this.anchor = anchor;
                  this.store.lastHover = this.store.hover;
                  this.store.hover = pen;
                  this.externalElements.style.cursor = 'crosshair';
                  break;
                }
              }
            }
          }

          // if (ctx.isPointInPath(this.store.path2dMap.get(pen), pt.x, pt.y)) {
          //   if (!this.store.data.locked && !pen.locked) {
          //     this.externalElements.style.cursor = 'move';
          //   } else {
          //     this.externalElements.style.cursor = this.store.options.hoverCursor;
          //   }

          //   this.store.lastHover = this.store.hover;
          //   this.store.hover = pen;
          //   moveType = MoveType.Nodes;
          //   break;
          // }
          if (pointInRect(pt, pen.calculative.worldRect)) {
            if (!this.store.data.locked && !pen.locked) {
              this.externalElements.style.cursor = 'move';
            } else {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            }

            this.store.lastHover = this.store.hover;
            this.store.hover = pen;
            moveType = MoveType.Nodes;
            break;
          }
        } else {
          if (pen.from) {
            if (hitPoint(pt, pen.from)) {
              moveType = MoveType.LineFrom;
              this.store.lastHover = this.store.hover;
              this.store.hover = pen;
              if (this.store.data.locked || pen.locked) {
                this.externalElements.style.cursor = this.store.options.hoverCursor;
              } else {
                this.externalElements.style.cursor = 'move';
              }
              break;
            }

            if (pen.to && hitPoint(pt, pen.to)) {
              moveType = MoveType.LineTo;
              this.store.lastHover = this.store.hover;
              this.store.hover = pen;
              if (this.store.data.locked || pen.locked) {
                this.externalElements.style.cursor = this.store.options.hoverCursor;
              } else {
                this.externalElements.style.cursor = 'move';
              }
              break;
            }

            if (pen.pointIn && pen.pointIn(pt)) {
              moveType = MoveType.LineTo;
              this.store.lastHover = this.store.hover;
              this.store.hover = pen;
              this.externalElements.style.cursor = this.store.options.hoverCursor;
              break;
            }
          }
        }
      }
    }

    this.moveType = moveType;
    if (moveType === MoveType.None && !this.mouseDown) {
      this.externalElements.style.cursor = 'default';
      this.store.hover = undefined;
    }

    if (this.store.lastHover !== this.store.hover) {
      this.dirty = true;
      if (this.store.lastHover) {
        this.store.emitter.emit('leave', this.store.lastHover);
      }
      if (this.store.hover) {
        this.store.emitter.emit('enter', this.store.hover);
      }
    }
  };

  resize(w?: number, h?: number) {
    w = w || this.parentElement.clientWidth;
    h = h || this.parentElement.clientHeight;

    this.width = w;
    this.height = h;

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

    this.bounding = this.externalElements.getBoundingClientRect();

    this.canvas.getContext('2d').scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.dirtyAll();
    this.render();
  }

  dirtyAll() {
    this.dirty = true;
    this.store.dirty.clear();
    this.store.data.pens.forEach((pen, i) => {
      this.store.dirty.set(pen, i);
      calcWorldRects(this.store.pens, pen);
    });

    this.clearCanvas();
  }

  clearCanvas() {
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen.getContext('2d').clearRect(0, 0, this.offscreen.width, this.offscreen.height);
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

    this.dirtyRect(pen);
    this.store.path2dMap.set(pen, this.store.registerPens[pen.name](pen));

    this.render();
    this.store.emitter.emit('addPen', pen);

    if (edited) {
      if (edited && !this.store.data.locked) {
        this.store.histories.push({
          type: EditType.Add,
          data: pen
        });
      }
    }

    return pen;
  }

  dirtyProps(pen: TopologyPen) {
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  dirtyRect(pen: TopologyPen) {
    calcWorldRects(this.store.pens, pen);
    calcWorldAnchors(pen);
    calcIconRect(pen);
    calcTextRect(pen);
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  render = () => {
    if (!this.dirty) {
      return;
    }

    const now = performance.now();
    if (now - this.lastRender < this.store.options.interval) {
      requestAnimationFrame(this.render);
      return;
    }
    this.lastRender = now;

    // if (!this.store.dirty.size) {
    //   this.offscreen.getContext('2d').drawImage(this.pensLayer, 0, 0, this.pensLayer.width, this.pensLayer.height);
    //   return;
    // }
    this.offscreen.getContext('2d').clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    this.renderPens();
    this.renderAnimate();
    this.renderActive();
    this.renderHover();

    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);
    this.dirty = false;

    // console.log('render');
    if (this.store.animate.size) {
      requestAnimationFrame(this.render);
    }
  };

  renderPens = () => {
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.strokeStyle = this.store.options.color;
    ctx.translate(0.5, 0.5);
    this.store.data.pens.forEach((pen: TopologyPen) => {
      if (this.store.hover === pen && (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground)) {
        return;
      }
      if (pen.active) {
        renderPen(
          ctx,
          pen,
          this.store.path2dMap.get(pen),
          pen.activeColor || this.store.options.activeColor,
          pen.activeBackground || this.store.options.activeBackground,
        );
      } else {
        renderPen(ctx, pen, this.store.path2dMap.get(pen));
      }

    });
    ctx.restore();
    this.store.dirty.clear();
  };

  renderActive = () => {
    if (!this.store.data.locked) {
      // Occupied territory.
      if (this.activeRect) {
        const ctx = this.offscreen.getContext('2d');
        ctx.save();
        ctx.translate(0.5, 0.5);
        ctx.strokeStyle = this.store.options.activeColor;
        if (this.store.active.length === 1 && this.store.active[0].calculative.worldRotate % 360) {
          ctx.translate(this.activeRect.center.x, this.activeRect.center.y);
          ctx.rotate((this.store.active[0].calculative.worldRotate * Math.PI) / 180);
          ctx.translate(-this.activeRect.center.x, -this.activeRect.center.y);
        }

        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.strokeRect(this.activeRect.x, this.activeRect.y, this.activeRect.width, this.activeRect.height);

        ctx.globalAlpha = 1;
        // Draw rotate control point.
        ctx.beginPath();
        ctx.moveTo(this.activeRect.center.x, this.activeRect.y);
        ctx.lineTo(this.activeRect.center.x, this.activeRect.y - 30);
        ctx.stroke();

        // Draw size control points.
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.arc(this.activeRect.center.x, this.activeRect.y - 30, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.fillRect(this.activeRect.x - 4.5, this.activeRect.y - 4.5, 8, 8);
        ctx.strokeRect(this.activeRect.x - 5.5, this.activeRect.y - 5.5, 10, 10);

        ctx.beginPath();
        ctx.fillRect(this.activeRect.ex - 4.5, this.activeRect.y - 4.5, 8, 8);
        ctx.strokeRect(this.activeRect.ex - 5.5, this.activeRect.y - 5.5, 10, 10);

        ctx.beginPath();
        ctx.fillRect(this.activeRect.ex - 4.5, this.activeRect.ey - 4.5, 8, 8);
        ctx.strokeRect(this.activeRect.ex - 5.5, this.activeRect.ey - 5.5, 10, 10);

        ctx.beginPath();
        ctx.fillRect(this.activeRect.x - 4.5, this.activeRect.ey - 4.5, 8, 8);
        ctx.strokeRect(this.activeRect.x - 5.5, this.activeRect.ey - 5.5, 10, 10);

        ctx.restore();
      }
    }
  };

  renderHover = () => {
    if (!this.store.hover) {
      return;
    }
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.translate(0.5, 0.5);
    if (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground) {
      renderPen(
        ctx,
        this.store.hover,
        this.store.path2dMap.get(this.store.hover),
        this.store.hover.hoverColor || this.store.options.hoverColor,
        this.store.hover.hoverBackground || this.store.options.hoverBackground,
      );
    }

    if (!this.store.options.disableAnchor && !this.store.hover.disableAnchor) {
      const anchors = this.store.hover.calculative.worldAnchors;
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
