import { KeydownType } from '../options';
import { calcIconRect, calcTextRect, calcWorldAnchors, calcWorldRects, getParent, LockState, PenType, renderPen, TopologyPen } from '../pen';
import { calcDistance, calcRotate, hitPoint, Point, rotatePoint, scalePoint } from '../point';
import { calcCenter, getRect, pointInRect, Rect, rectInRect, rectToPoints } from '../rect';
import { EditType, globalStore, TopologyStore } from '../store';
import { isMobile, s8 } from '../utils';
import { defaultCursors, rotatedCursors } from './cursor';
import { createOffscreen } from './offscreen';

enum MoveType {
  None,
  Line,
  LineFrom,
  LineTo,
  LineControlPoint,
  Nodes,
  Resize,
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
  canvasRect: Rect;

  activeRect: Rect;
  activeRotate = 0;
  sizeCPs: Point[];

  moveType = MoveType.None;
  resizeIndex = 0;
  anchor: Point;
  mouseDown: { x: number; y: number; restore?: boolean; };
  isTranslate: boolean;
  translateX: number;
  translateY: number;
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

    this.store.dpiRatio = (window ? window.devicePixelRatio : 1);

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
    this.externalElements.onwheel = this.onwheel;

    switch (this.store.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keydown', this.onkey);
        document.addEventListener('keyup', () => {
          this.isTranslate = false;
        });
        break;
      case KeydownType.Canvas:
        this.externalElements.addEventListener('keydown', this.onkey);
        break;
    }
  }

  onwheel = (e: any) => {
    if (this.store.options.disableScale) {
      return;
    }

    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }
    this.touchStart = now;
    e.preventDefault();
    e.stopPropagation();

    const center = {
      x: e.x - (this.bounding.left || this.bounding.x),
      y: e.y - (this.bounding.top || this.bounding.y)
    };
    if (window) {
      center.x -= window.scrollX;
      center.y -= window.scrollY;
    }
    if (e.deltaY < 0) {
      this.scale(this.store.data.scale + 0.1, center);
    } else {
      this.scale(this.store.data.scale - 0.1, center);
    }
  };

  onkey = (e: KeyboardEvent) => {
    if (
      this.store.data.locked ||
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }

    switch (e.key) {
      case ' ':
      case 'Control':
      case 'Meta':
        this.isTranslate = true;
        break;
      case 'a':
      case 'A':

        break;
      case 'Delete':
      case 'Backspace':

        break;
      case 'ArrowLeft':

        break;
      case 'ArrowUp':

        break;
      case 'ArrowRight':

        break;
      case 'ArrowDown':

        break;
      case 'x':
      case 'X':

        break;
      case 'c':
      case 'C':

        break;
      case 'v':
      case 'V':

        break;
      case 'y':
      case 'Y':

        break;
      case 'z':
      case 'Z':

        break;
      case 'Enter':

        break;
      case 'Escape':

        break;
    }
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
    if (this.store.data.locked === LockState.Disable) {
      this.moveType = MoveType.None;
      return;
    }

    if (e.buttons !== 1 && e.buttons !== 2) return;

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    this.mouseDown = e;
    if (e.ctrlKey || (this.store.options.rightMouseTranslate && e.buttons == 2)) {
      this.isTranslate = true;
    }
    if (this.isTranslate) {
      this.translateX = e.x;
      this.translateY = e.y;
    }

    switch (this.moveType) {
      case MoveType.None:
        if (this.store.active.length) {
          this.store.active.forEach((pen) => {
            pen.calculative.active = undefined;
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
            if (this.store.hover.calculative.active) {
              this.store.hover.calculative.active = undefined;
              this.store.active.splice(this.store.active.findIndex((pen) => pen === this.store.hover), 1);
              this.store.emitter.emit('inactive', this.store.hover);
            } else {
              this.store.hover.calculative.active = true;
              this.store.active.push(this.store.hover);
              this.store.emitter.emit('active', this.store.hover);
            }
            this.dirty = true;
          } else if (e.altKey) {
            if (this.store.active.length > 1 || !this.store.hover.calculative.active) {
              this.store.active.forEach((pen) => {
                pen.calculative.active = undefined;
              });
              this.store.active = [this.store.hover];
              this.store.hover.calculative.active = true;
              this.store.emitter.emit('active', this.store.hover);
              this.dirty = true;
            }
          } else {
            const pen = getParent(this.store.pens, this.store.hover);
            if (!pen.active) {
              this.store.active.forEach((pen) => {
                pen.calculative.active = undefined;
              });
              this.store.active = [pen];
              this.store.hover.calculative.active = true;
              this.store.emitter.emit('active', pen);
              this.dirty = true;
            }
          }

          if (this.store.active.length === 1) {
            this.activeRect = this.store.active[0].calculative.worldRect;
            this.activeRotate = this.store.active[0].rotate;
            this.activeRect.rotate = this.activeRotate;
          } else {
            this.activeRotate = 0;
            this.activeRect = getRect(this.store.active);
          }
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
    if (this.store.data.locked === LockState.Disable) {
      this.moveType = MoveType.None;
      return;
    }

    // 防止异常情况导致mouseup事件没有触发
    if (this.mouseDown && !this.mouseDown.restore && (e.buttons !== 1 && e.buttons !== 2)) {
      this.onMouseUp(e);
      return;
    }
    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    if (this.mouseDown) {
      // Translate
      if (this.translateX && this.translateY && this.isTranslate && (!this.store.data.locked || this.store.data.locked < LockState.DisableMove)) {
        const x = e.x - this.translateX;
        const y = e.y - this.translateY;
        this.translateX = e.x;
        this.translateY = e.y;
        this.translate(x, y);
        return false;
      }

      // Rotate
      if (this.moveType === MoveType.Rotate) {
        this.activeRotate = calcRotate(e, this.activeRect.center);
        if (this.store.active.length === 1) {
          this.store.active[0].calculative.worldRotate = this.activeRotate;
        } else {
          this.store.active.forEach((pen) => {
            pen.calculative.worldRotate = pen.rotate + this.activeRotate;
          });
        }

        this.render(Infinity);
        return;
      }

      // Resize
      if (this.moveType === MoveType.Resize) {
        this.resizePens(e);
        return;
      }
    }

    this.store.debug && console.time('hover');
    this.calibrateMouse(e);
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
    if (this.store.data.locked === LockState.Disable) {
      this.moveType = MoveType.None;
      return;
    }

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    this.mouseDown = undefined;

    // Add pen
    if (this.cacheNode) {
      this.cacheNode.x = e.x - this.cacheNode.width / 2;
      this.cacheNode.y = e.y - this.cacheNode.height / 2;


      this.addPen(this.cacheNode);
      this.cacheNode = undefined;
      return;
    }

    if (this.isTranslate) {
      this.isTranslate = false;
      this.store.emitter.emit('translate');
    }

    // Rotate
    if (this.moveType === MoveType.Rotate) {
      this.store.active.forEach((pen) => {
        pen.rotate = pen.calculative.worldRotate;
        pen.calculative.worldRect.rotate = pen.rotate;
        calcWorldAnchors(pen);
      });

      this.sizeCPs = rectToPoints(this.activeRect);
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

  calibrateMouse = (pt: Point) => {
    pt.x -= this.store.data.x;
    pt.y -= this.store.data.y;

    pt.x /= this.store.data.scale;
    pt.y /= this.store.data.scale;

    return pt;
  };

  private getHover = (pt: Point) => {
    let moveType = MoveType.None;
    const size = this.store.data.scale * 10;
    if (this.activeRect) {
      if (!this.store.options.disableRotate) {
        const rotatePt = { x: this.activeRect.center.x, y: this.activeRect.y - 30 };
        if (this.activeRotate) {
          rotatePoint(rotatePt, this.activeRotate, this.activeRect.center);
        }
        // 旋转控制点
        if (hitPoint(pt, rotatePt, size)) {
          moveType = MoveType.Rotate;
          this.externalElements.style.cursor = 'url("rotate.cur"), auto';
        }
      }

      // 大小控制点
      for (let i = 0; i < 4; i++) {
        if (hitPoint(pt, this.sizeCPs[i], size)) {
          let cursors = defaultCursors;
          let offset = 0;
          if (Math.abs(this.activeRotate % 90 - 45) < 25) {
            cursors = rotatedCursors;
            offset = Math.round((this.activeRotate - 45) / 90);
          } else {
            offset = Math.round(this.activeRotate / 90);
          }
          moveType = MoveType.Resize;
          this.store.hover = this.store.active[0];
          this.resizeIndex = i;
          this.externalElements.style.cursor = cursors[(i + offset) % 4];
          break;
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
                if (hitPoint(pt, anchor, size)) {
                  moveType = MoveType.Anchors;
                  this.anchor = anchor;
                  this.store.hover = pen;
                  this.externalElements.style.cursor = 'crosshair';
                  break;
                }
              }
            }
          }

          if (pointInRect(pt, pen.calculative.worldRect)) {
            if (!this.store.data.locked && !pen.locked) {
              this.externalElements.style.cursor = 'move';
            } else {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            }

            this.store.hover = pen;
            moveType = MoveType.Nodes;
            break;
          }
        } else {
          if (pen.from) {
            if (hitPoint(pt, pen.from)) {
              moveType = MoveType.LineFrom;
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
        this.store.lastHover.calculative.hover = undefined;
        this.store.emitter.emit('leave', this.store.lastHover);
      }
      if (this.store.hover) {
        this.store.hover.calculative.hover = true;
        this.store.emitter.emit('enter', this.store.hover);
      }
      this.store.lastHover = this.store.hover;
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

    this.makePen(pen);

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

  makePen(pen: TopologyPen) {
    if (!pen.id) {
      pen.id = s8();
    }
    this.store.data.pens.push(pen);
    this.store.pens[pen.id] = pen;
    calcCenter(pen);

    // 集中存储path，避免数据冗余过大
    if (pen.path) {
      if (!pen.pathId) {
        pen.pathId = s8();
      }
      if (!globalStore.paths[pen.pathId]) {
        globalStore.paths[pen.pathId] = pen.path;
      }

      pen.path = undefined;
    }
    // end
    this.dirtyRect(pen);
    !pen.rotate && (pen.rotate = 0);
    pen.calculative.worldRotate = pen.rotate;
    this.store.path2dMap.set(pen, this.store.registerPens[pen.name](pen));
    this.loadImage(pen);
  }

  loadImage(pen: TopologyPen) {
    if (pen.image !== pen.calculative.image) {
      pen.calculative.img = undefined;
      if (pen.image) {
        if (globalStore.htmlElements[pen.image]) {
          const img = globalStore.htmlElements[pen.image];
          pen.calculative.img = img;
          pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
          pen.calculative.imgNaturalHeight = img.naturalHeight || pen.iconHeight;
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = pen.image;
          img.onload = () => {
            pen.calculative.img = img;
            pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
            pen.calculative.imgNaturalHeight = img.naturalHeight || pen.iconHeight;
            globalStore.htmlElements[pen.image] = img;
            this.dirty = true;
            this.render();
          };
        }
      }
      pen.calculative.image = pen.image;
    }

    if (pen.backgroundImage !== pen.calculative.backgroundImage) {
      pen.calculative.backgroundImg = undefined;
      if (pen.backgroundImage) {
        if (globalStore.htmlElements[pen.backgroundImage]) {
          const img = globalStore.htmlElements[pen.backgroundImage];
          pen.calculative.backgroundImg = img;
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = pen.backgroundImage;
          img.onload = () => {
            pen.calculative.backgroundImg = img;
            globalStore.htmlElements[pen.backgroundImage] = img;
            this.dirty = true;
            this.render();
          };
        }
      }
      pen.calculative.backgroundImage = pen.backgroundImage;
    }

    if (pen.strokeImage !== pen.calculative.strokeImage) {
      pen.calculative.strokeImg = undefined;
      if (pen.strokeImage) {
        if (globalStore.htmlElements[pen.strokeImage]) {
          const img = globalStore.htmlElements[pen.strokeImage];
          pen.calculative.strokeImg = img;
        } else {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = pen.strokeImage;
          img.onload = () => {
            pen.calculative.strokeImg = img;
            globalStore.htmlElements[pen.strokeImage] = img;
            this.dirty = true;
            this.render();
          };
        }
      }
      pen.calculative.strokeImage = pen.strokeImage;
    }
  }

  dirtyProps(pen: TopologyPen) {
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  dirtyRect(pen: TopologyPen) {
    calcWorldRects(this.store.pens, pen);
    calcWorldAnchors(pen);
    calcIconRect(this.store.pens, pen);
    calcTextRect(pen);
    this.dirty = true;
    this.store.dirty.set(pen, 1);
  }

  render = (now?: number) => {
    if (now === Infinity) {
      this.dirty = true;
      now = performance.now();
    }
    if (!this.dirty) {
      return;
    }
    if (now == null) {
      now = performance.now();
    }

    if (now - this.lastRender < this.store.options.interval) {
      requestAnimationFrame(this.render);
      return;
    }
    this.lastRender = now;

    const offscreen = this.offscreen.getContext('2d');
    offscreen.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    offscreen.save();
    offscreen.translate(this.store.data.x, this.store.data.y);
    offscreen.scale(this.store.data.scale, this.store.data.scale);
    this.renderPens();
    this.renderAnimate();
    this.renderBorder();
    this.renderCP();
    offscreen.restore();

    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);

    this.dirty = false;

    if (this.store.animate.size) {
      requestAnimationFrame(this.render);
    }
  };

  renderPens = () => {
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.strokeStyle = this.store.options.color;
    ctx.translate(0.5, 0.5);
    const canvasRect = {
      x: 0,
      y: 0,
      ex: this.width,
      ey: this.height,
      width: this.width,
      height: this.height,
    };



    this.store.data.pens.forEach((pen: TopologyPen) => {
      const x = pen.calculative.worldRect.x + this.store.data.x;
      const y = pen.calculative.worldRect.y + this.store.data.y;
      const penRect = {
        x,
        y,
        ex: x + pen.calculative.worldRect.width,
        ey: y + pen.calculative.worldRect.height
      };
      scalePoint(canvasRect, this.store.data.scale, this.store.data.center);
      if (!rectInRect(penRect, canvasRect)) {
        return;
      }
      if (this.store.hover === pen && (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground)) {
        return;
      }
      renderPen(ctx, pen, this.store.path2dMap.get(pen), this.store.options);

    });
    ctx.restore();
    this.store.dirty.clear();
  };

  renderBorder = () => {
    if (!this.store.data.locked) {
      // Occupied territory.
      if (this.activeRect) {
        const ctx = this.offscreen.getContext('2d');
        ctx.save();
        ctx.translate(0.5, 0.5);
        if (this.activeRotate) {
          ctx.translate(this.activeRect.center.x, this.activeRect.center.y);
          ctx.rotate((this.activeRotate * Math.PI) / 180);
          ctx.translate(-this.activeRect.center.x, -this.activeRect.center.y);
        }
        ctx.strokeStyle = this.store.options.activeColor;

        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.strokeRect(this.activeRect.x, this.activeRect.y, this.activeRect.width, this.activeRect.height);

        ctx.globalAlpha = 1;
        // Draw rotate control point.
        ctx.beginPath();
        ctx.moveTo(this.activeRect.center.x, this.activeRect.y);
        ctx.lineTo(this.activeRect.center.x, this.activeRect.y - 30);
        ctx.stroke();

        // Draw rotate control points.
        ctx.beginPath();
        ctx.strokeStyle = this.store.options.activeColor;
        ctx.fillStyle = "#ffffff";
        ctx.arc(this.activeRect.center.x, this.activeRect.y - 30, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }
  };

  renderCP = () => {
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.translate(0.5, 0.5);
    if (this.store.hover) {
      if (this.store.hover.hoverColor || this.store.hover.hoverBackground || this.store.options.hoverColor || this.store.options.hoverBackground) {
        renderPen(ctx, this.store.hover, this.store.path2dMap.get(this.store.hover), this.store.options);
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
    }

    // Draw size control points.
    if (!this.store.data.locked && this.activeRect) {
      if (this.activeRotate) {
        ctx.translate(this.activeRect.center.x, this.activeRect.center.y);
        ctx.rotate((this.activeRotate * Math.PI) / 180);
        ctx.translate(-this.activeRect.center.x, -this.activeRect.center.y);
      }
      ctx.strokeStyle = this.store.options.activeColor;
      ctx.fillStyle = "#ffffff";

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
    }
    ctx.restore();
  };

  renderAnimate = () => { };

  translate(x: number, y: number) {
    this.store.data.x += x * this.store.data.scale;
    this.store.data.y += y * this.store.data.scale;
    this.store.x += x;
    this.store.y += y;
    this.render(Infinity);
    !this.isTranslate && this.store.emitter.emit('translate');
  }

  scale(scale: number, center = { x: 0, y: 0 }) {
    if (scale < 0.01) {
      return;
    }

    this.calibrateMouse(center);

    if (this.store.data.scale !== scale) {
      this.calibrateMouse(this.store.data.center);
      scalePoint(this.store.data, 1 / this.store.data.scale, this.store.data.center);
    }

    this.store.data.scale = scale;
    this.store.data.center = center;
    scalePoint(this.store.data, scale, center);

    this.render(Infinity);
  }

  rotating() {
    this.store.active.forEach((pen) => {
      pen.calculative.worldRotate = pen.rotate + this.activeRotate;
    });

    this.render(Infinity);
    this.store.emitter.emit('rotate', { angle: this.activeRotate, pens: 1 });
  }

  resizePens(e: Point) {
    const distance = calcDistance(this.mouseDown, e);

  }

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
