import { KeydownType } from '../options';
import { addPenAnchor, calcIconRect, calcTextRect, calcWorldAnchors, calcWorldRects, LockState, nearestAnchor, PenType, removePenAnchor, renderPen, scalePen, TopologyPen } from '../pen';
import { calcRotate, hitPoint, Point, rotatePoint } from '../point';
import { calcCenter, calcRelativePoint, getRect, pointInRect, Rect, rectInRect, rectToPoints, translateRect } from '../rect';
import { EditType, globalStore, TopologyStore } from '../store';
import { isMobile, s8 } from '../utils';
import { defaultCursors, defaultDrawLineFns, HotkeyType, HoverType, MouseRight, rotatedCursors } from '../data';
import { createOffscreen } from './offscreen';
import { curve, getLineRect } from '../common-diagram';
import { deepClone } from '../utils/clone';


export class Canvas {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();

  width: number;
  height: number;

  externalElements = document.createElement('div');
  bounding?: DOMRect;
  canvasRect: Rect;

  activeRect: Rect;
  lastRotate = 0;
  sizeCPs: Point[];
  activeInitPos: Point[];

  hoverType = HoverType.None;
  resizeIndex = 0;
  anchor: Point;
  mouseDown: { x: number; y: number; restore?: boolean; };
  hotkeyType: HotkeyType;
  mouseRight: MouseRight;
  translateX: number;
  translateY: number;
  addCache: TopologyPen;
  touchCenter?: Point;
  touches?: TouchList;

  lastOffsetX = 0;
  lastOffsetY = 0;

  drawingLineName?: string;
  drawLineFns: string[] = [...defaultDrawLineFns];
  drawingLine?: TopologyPen;

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

    this['curve'] = curve;

    window && window.addEventListener('resize', this.onResize);
  }

  listen() {
    // ios
    this.externalElements.addEventListener('gesturestart', this.onGesturestart);

    this.externalElements.ondragover = (e: any) => e.preventDefault();
    this.externalElements.ondrop = this.ondrop;
    this.externalElements.oncontextmenu = (e: any) => e.preventDefault();
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
          if (this.hotkeyType) {
            this.render(Infinity);
          }
          this.hotkeyType = HotkeyType.None;
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

    const isTouchPad = e.wheelDeltaY ? e.wheelDeltaY === -3 * e.deltaY : e.deltaMode === 0;

    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }

    this.touchStart = now;
    e.preventDefault();
    e.stopPropagation();

    let x = e.x - (this.bounding.left || this.bounding.x);
    let y = e.y - (this.bounding.top || this.bounding.y);

    if (window) {
      x -= window.scrollX;
      y -= window.scrollY;
    }

    if (isTouchPad) {
      this.translate(e.wheelDeltaX, e.wheelDeltaY);
    } else {
      if (e.deltaY < 0) {
        this.scale(this.store.data.scale + 0.1, { x, y });
      } else {
        this.scale(this.store.data.scale - 0.1, { x, y });
      }
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
        this.hotkeyType = HotkeyType.Translate;
        break;
      case 'Control':
        if (this.hotkeyType === HotkeyType.None) {
          this.dirty = true;
          this.hotkeyType = HotkeyType.Select;
        }
        break;
      case 'Meta':
        break;
      case 'Shift':
        if (this.drawingLineName) {
          const index = this.drawLineFns.indexOf(this.drawingLineName);
          this.drawingLineName = this.drawLineFns[(index + 1) % this.drawLineFns.length];
          this.drawline();
          this.dirty = true;
        } else if (this.hotkeyType === HotkeyType.None) {
          this.dirty = true;
          this.hotkeyType = HotkeyType.Resize;
        }
        break;
      case 'Alt':
        if (this.drawingLineName) {
          this.store.options.autoAnchor = !this.store.options.autoAnchor;
        } else if (this.hotkeyType === HotkeyType.None) {
          this.dirty = true;
          this.hotkeyType = HotkeyType.Anchor;
        }
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
        if (this.drawingLineName) {
          this.finishDrawline(true);
        }
        break;
      case 'Escape':
        if (this.drawingLineName) {
          this.finishDrawline();
        }
        break;
    }

    this.render();
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
        if (now - this.touchStart < 200) {
          return;
        }
        const scale =
          (event as any).scale ||
          Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) /
          Math.hypot(
            this.touches[0].pageX - this.touches[1].pageX,
            this.touches[0].pageY - this.touches[1].pageY
          );
        event.preventDefault();
        // this.scale(scale * this.touchScale, this.touchCenter);
        if (scale < 0) {
          this.scale(this.store.data.scale + 0.1, this.touchCenter);
        } else {
          this.scale(this.store.data.scale - 0.1, this.touchCenter);
        }
      } else if (len === 3) {
        this.translate(x, y);
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
    if (this.store.data.locked === LockState.Disable || (e.buttons !== 1 && e.buttons !== 2)) {
      this.hoverType = HoverType.None;
      return;
    }

    if (e.buttons === 2) {
      this.mouseRight = MouseRight.TranslateOrContextMenu;
    }

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    this.mouseDown = e;

    // Set anchor of pen.
    if (this.hotkeyType === HotkeyType.Anchor) {
      if (this.anchor && this.anchor.custom) {
        removePenAnchor(this.store.hover, this.anchor);
        this.anchor = undefined;
      } else if (this.store.hover) {
        const pt = { x: e.x, y: e.y };
        this.calibrateMouse(pt);
        addPenAnchor(this.store.hover, pt);
      }
      this.render(Infinity);
      return;
    }

    this.translateX = e.x;
    this.translateY = e.y;

    if (this.hoverType === HoverType.NodeAnchor && !this.drawingLineName) {
      // Start to draw a line.
      this.drawingLineName = this.store.options.drawingLineName;
    }

    if (this.drawingLineName) {
      this.inactive(true);

      const pt: Point = { x: e.x, y: e.y };
      this.calibrateMouse(pt);

      // 右键，完成绘画
      if (e.buttons === 2) {
        this.finishDrawline();
        return;
      }
      // 在锚点上，完成绘画
      if (this.hoverType && this.hoverType < HoverType.Line && this.drawingLine) {
        this.finishDrawline();
        return;
      }

      if (this.hoverType === HoverType.Node) {
        if (this.store.options.autoAnchor) {
          this.anchor = nearestAnchor(pt, this.store.hover);
        } else {
          this.anchor = addPenAnchor(this.store.hover, pt);
        }
      } else if (this.hoverType === HoverType.Line) {
        this.anchor = addPenAnchor(this.store.hover, pt);
      }
      if (this.hoverType && this.hoverType < HoverType.Resize && this.anchor) {
        pt.x = this.anchor.x;
        pt.y = this.anchor.y;
        pt.penId = this.anchor.penId;
        pt.anchorId = this.anchor.id;
      }
      if (this.drawingLine) {
        const anchor = addPenAnchor(this.drawingLine, pt);
        this.drawingLine.calculative.activeAnchor = anchor;
        this.drawingLine.calculative.worldTo = undefined;
        this.drawingLine.to = undefined;
        this.drawline();
      } else {
        this.drawingLine = {
          id: s8(),
          name: 'line',
          x: pt.x,
          y: pt.y,
          type: PenType.Line,
          from: { ...pt },
          calculative: {
            worldFrom: { ...pt }
          }
        };
        this.drawingLine.calculative.activeAnchor = this.drawingLine.calculative.worldFrom;
        this.drawline();
      }
    } else {
      switch (this.hoverType) {
        case HoverType.None:
          this.inactive();
          break;
        case HoverType.Node:
          if (this.store.hover) {
            if (e.ctrlKey) {
              if (this.store.hover.parentId) {
                break;
              }
              if (this.store.hover.calculative.active) {
                this.store.hover.calculative.active = undefined;
                this.store.active.splice(this.store.active.findIndex((pen) => pen === this.store.hover), 1);
                this.store.emitter.emit('inactive', [this.store.hover]);
              } else {
                this.store.hover.calculative.active = true;
                this.store.active.push(this.store.hover);
                this.store.emitter.emit('active', [this.store.hover]);
              }
              this.dirty = true;
            } else if (e.altKey) {
              if (this.store.active.length > 1 || !this.store.hover.calculative.active) {
                this.store.active.forEach((pen) => {
                  pen.calculative.active = undefined;
                });
                this.store.active = [this.store.hover];
                this.store.hover.calculative.active = true;
                this.store.emitter.emit('active', [this.store.hover]);
                this.dirty = true;
              }
            } else {
              if (!this.store.hover.calculative.active) {
                this.active([this.store.hover]);
              }
            }

            this.calcActiveRect();
          }
          break;
        case HoverType.Resize:
          this.activeInitPos = [];
          this.store.active.forEach((pen) => {
            this.activeInitPos.push({
              x: (pen.x - this.activeRect.x) / this.activeRect.width,
              y: (pen.y - this.activeRect.y) / this.activeRect.height,
            });
          });
          break;
      }
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
      this.hoverType = HoverType.None;
      return;
    }

    // 防止异常情况导致mouseup事件没有触发
    if (this.mouseDown && !this.mouseDown.restore && (e.buttons !== 1 && e.buttons !== 2)) {
      this.onMouseUp(e);
      return;
    }
    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    if (this.drawingLine) {
      const pt: Point = { x: e.x, y: e.y };
      this.calibrateMouse(pt);
      if (this.mouseDown) {
        this.drawline(pt);
      } else {
        this.drawingLine.to = { ...pt };
        if (this.hoverType && this.hoverType < HoverType.Line && this.anchor) {
          if (this.anchor.id !== this.drawingLine.from.anchorId) {
            this.drawingLine.to.x = this.anchor.x;
            this.drawingLine.to.y = this.anchor.y;
            this.drawingLine.to.penId = this.anchor.penId;
            this.drawingLine.to.anchorId = this.anchor.id;
          }
        }
        this.drawingLine.calculative.worldTo = deepClone(this.drawingLine.to);
        this.drawline();
      }
    } else if (this.mouseDown) {
      if (this.mouseRight === MouseRight.TranslateOrContextMenu) {
        this.mouseRight = MouseRight.Translate;
      }

      // Translate
      if (this.hotkeyType === HotkeyType.Translate || this.mouseRight === MouseRight.Translate) {
        if (this.translateX && this.translateY && (!this.store.data.locked || this.store.data.locked < LockState.DisableMove)) {
          const x = e.x - this.translateX;
          const y = e.y - this.translateY;
          this.translateX = e.x;
          this.translateY = e.y;
          this.translate(x, y);
          return false;
        }
      }

      // Rotate
      if (this.hoverType === HoverType.Rotate) {
        const pt = { x: e.x, y: e.y };
        this.calibrateMouse(pt);
        this.activeRect.rotate = calcRotate(pt, this.activeRect.center);
        if (this.store.active.length === 1) {
          this.store.active[0].rotate = this.activeRect.rotate;
          this.dirtyPenRect(this.store.active[0]);
        } else {
          const angle = this.activeRect.rotate - this.lastRotate;

          this.store.active.forEach((pen) => {
            if (pen.parentId) {
              return;
            }
            pen.rotate += angle;
            rotatePoint(pen.calculative.worldRect.center, angle, this.activeRect.center);
            pen.x = pen.calculative.worldRect.center.x - pen.width / 2;
            pen.y = pen.calculative.worldRect.center.y - pen.height / 2;
            this.dirtyPenRect(pen);
          });
        }
        this.lastRotate = this.activeRect.rotate;
        this.getSizeCPs();
        this.render(Infinity);
        return;
      }

      // Resize
      if (this.hoverType === HoverType.Resize) {
        this.resizePens(e);
        return;
      }

      // Move
      if (this.hoverType === HoverType.Node) {
        this.movePens(e);
        return;
      }
    }

    (window as any).debug && console.time('hover');
    this.calibrateMouse(e);
    this.getHover(e);
    (window as any).debug && console.timeEnd('hover');
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
      this.hoverType = HoverType.None;
      return;
    }

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    this.mouseDown = undefined;
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;

    if (this.mouseRight === MouseRight.TranslateOrContextMenu) {
      this.store.emitter.emit('contextmenu', {
        e,
        bounding: this.bounding
      });
    }

    // Add pen
    if (this.addCache) {
      this.addCache.x = e.x - this.addCache.width / 2;
      this.addCache.y = e.y - this.addCache.height / 2;


      this.addPen(this.addCache);
      this.addCache = undefined;
      return;
    }

    // Rotate
    if (this.hoverType === HoverType.Rotate) {
      this.getSizeCPs();
      return;
    }
  };

  inactive(drawing?: boolean) {
    if (!this.store.active.length) {
      return;
    }
    this.store.active.forEach((pen) => {
      pen.calculative.active = undefined;
    });
    !drawing && this.store.emitter.emit('inactive', this.store.active);
    this.store.active = [];
    this.activeRect = undefined;
    this.sizeCPs = undefined;

    this.dirty = true;
  }

  active(pens: TopologyPen[]) {
    this.store.active.forEach((pen) => {
      pen.calculative.active = undefined;
    });
    this.store.active = [];

    pens.forEach((pen) => {
      pen.calculative.active = true;
    });
    this.store.active.push(...pens);
    this.calcActiveRect();
    this.dirty = true;
    this.store.emitter.emit('active', this.store.active);
  }

  getSizeCPs() {
    this.sizeCPs = rectToPoints(this.activeRect);
    let pt = {
      x: this.activeRect.x + this.activeRect.width * 0.5,
      y: this.activeRect.y,
    };
    rotatePoint(pt, this.activeRect.rotate, this.activeRect.center);
    this.sizeCPs.push(pt);

    pt = {
      x: this.activeRect.ex,
      y: this.activeRect.y + this.activeRect.height * 0.5,
    };
    rotatePoint(pt, this.activeRect.rotate, this.activeRect.center);
    this.sizeCPs.push(pt);

    pt = {
      x: this.activeRect.x + this.activeRect.width * 0.5,
      y: this.activeRect.ey,
    };
    rotatePoint(pt, this.activeRect.rotate, this.activeRect.center);
    this.sizeCPs.push(pt);

    pt = {
      x: this.activeRect.x,
      y: this.activeRect.y + this.activeRect.height * 0.5,
    };
    rotatePoint(pt, this.activeRect.rotate, this.activeRect.center);
    this.sizeCPs.push(pt);
  }

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

    return pt;
  };

  private getHover = (pt: Point) => {
    let hoverType = HoverType.None;
    const size = 8;
    this.anchor = undefined;
    if (!this.drawingLineName && this.activeRect && !this.store.data.locked) {
      if (!this.store.options.disableRotate) {
        const rotatePt = { x: this.activeRect.center.x, y: this.activeRect.y - 30 };
        if (this.activeRect.rotate) {
          rotatePoint(rotatePt, this.activeRect.rotate, this.activeRect.center);
        }
        // 旋转控制点
        if (!this.hotkeyType && hitPoint(pt, rotatePt, size)) {
          hoverType = HoverType.Rotate;
          this.externalElements.style.cursor = 'url("rotate.cur"), auto';
        }
      }

      // 大小控制点
      if (!this.hotkeyType || this.hotkeyType === HotkeyType.Resize) {
        for (let i = 0; i < 4; i++) {
          if (hitPoint(pt, this.sizeCPs[i], size)) {
            let cursors = defaultCursors;
            let offset = 0;
            if (Math.abs(this.activeRect.rotate % 90 - 45) < 25) {
              cursors = rotatedCursors;
              offset = Math.round((this.activeRect.rotate - 45) / 90);
            } else {
              offset = Math.round(this.activeRect.rotate / 90);
            }
            hoverType = HoverType.Resize;
            this.resizeIndex = i;
            this.externalElements.style.cursor = cursors[(i + offset) % 4];
            break;
          }
        }
      }
      if (this.hotkeyType === HotkeyType.Resize) {
        for (let i = 4; i < 8; i++) {
          if (hitPoint(pt, this.sizeCPs[i], size)) {
            let cursors = rotatedCursors;
            let offset = 0;
            if (Math.abs(this.activeRect.rotate % 90 - 45) < 25) {
              cursors = defaultCursors;
              offset = Math.round((this.activeRect.rotate - 45) / 90) + 1;
            } else {
              offset = Math.round(this.activeRect.rotate / 90);
            }
            hoverType = HoverType.Resize;
            this.resizeIndex = i;
            this.externalElements.style.cursor = cursors[(i + offset) % 4];
            break;
          }
        }
      }
    }

    if (hoverType === HoverType.None) {
      for (let i = this.store.data.pens.length - 1; i >= 0; --i) {
        const pen = this.store.data.pens[i];
        if (pen.visible == false || pen.locked === LockState.Disable) {
          continue;
        }

        if (!pen.type) {
          if (!this.store.data.locked && !this.store.options.disableAnchor && this.hotkeyType !== HotkeyType.Resize) {
            // 锚点
            if (pen.calculative.worldAnchors) {
              for (const anchor of pen.calculative.worldAnchors) {
                if (hitPoint(pt, anchor, size)) {
                  hoverType = HoverType.NodeAnchor;
                  this.anchor = anchor;
                  this.store.hover = pen;
                  this.externalElements.style.cursor = 'crosshair';
                  break;
                }
              }
            }
          }

          if (hoverType === HoverType.None && pointInRect(pt, pen.calculative.worldRect)) {
            if (!this.store.data.locked && !pen.locked) {
              this.externalElements.style.cursor = 'move';
            } else {
              this.externalElements.style.cursor = this.store.options.hoverCursor;
            }

            this.store.hover = pen;
            hoverType = HoverType.Node;
            break;
          }
        } else {
          if (pen.from) {
            if (hitPoint(pt, pen.calculative.worldFrom)) {
              hoverType = HoverType.LineFrom;
              this.store.hover = pen;
              if (this.store.data.locked || pen.locked) {
                this.externalElements.style.cursor = this.store.options.hoverCursor;
              } else {
                this.externalElements.style.cursor = 'move';
              }
              break;
            }

            if (pen.calculative.active && pen.calculative.worldFrom.prev && hitPoint(pt, pen.calculative.worldFrom.prev, size)) {
              hoverType = HoverType.LineAnchorPrev;
              this.store.hover = pen;
              this.anchor = pen.calculative.worldFrom;
              this.externalElements.style.cursor = 'pointer';
              break;
            }
            if (pen.calculative.active && pen.calculative.worldFrom.next && hitPoint(pt, pen.calculative.worldFrom.next, size)) {
              hoverType = HoverType.LineAnchorNext;
              this.store.hover = pen;
              this.anchor = pen.calculative.worldFrom;
              this.externalElements.style.cursor = 'pointer';
              break;
            }

            if (pen.to && hitPoint(pt, pen.calculative.worldTo)) {
              hoverType = HoverType.LineTo;
              this.store.hover = pen;
              if (this.store.data.locked || pen.locked) {
                this.externalElements.style.cursor = this.store.options.hoverCursor;
              } else {
                this.externalElements.style.cursor = 'move';
              }
              break;
            }
            if (pen.calculative.active && pen.calculative.worldTo.prev && hitPoint(pt, pen.calculative.worldTo.prev, size)) {
              hoverType = HoverType.LineAnchorPrev;
              this.store.hover = pen;
              this.anchor = pen.calculative.worldTo;
              this.externalElements.style.cursor = 'pointer';
              break;
            }
            if (pen.calculative.active && pen.calculative.worldTo.next && hitPoint(pt, pen.calculative.worldTo.next, size)) {
              hoverType = HoverType.LineAnchorNext;
              this.store.hover = pen;
              this.anchor = pen.calculative.worldTo;
              this.externalElements.style.cursor = 'pointer';
              break;
            }

            if (!this.store.data.locked) {
              // 锚点
              if (pen.calculative.worldAnchors) {
                for (const anchor of pen.calculative.worldAnchors) {
                  if (hitPoint(pt, anchor, size)) {
                    hoverType = HoverType.LineAnchor;
                    this.anchor = anchor;
                    this.store.hover = pen;
                    this.externalElements.style.cursor = 'crosshair';
                    break;
                  }

                  if (pen.calculative.active && anchor.prev && hitPoint(pt, anchor.prev, size)) {
                    hoverType = HoverType.LineAnchorPrev;
                    this.anchor = anchor;
                    this.store.hover = pen;
                    this.externalElements.style.cursor = 'pointer';
                    break;
                  }
                  if (pen.calculative.active && anchor.next && hitPoint(pt, anchor.next, size)) {
                    hoverType = HoverType.LineAnchorNext;
                    this.anchor = anchor;
                    this.store.hover = pen;
                    this.externalElements.style.cursor = 'pointer';
                    break;
                  }
                }
              }
            }

            if (pen.pointIn && pen.pointIn(pt)) {
              hoverType = HoverType.Line;
              this.store.hover = pen;
              this.externalElements.style.cursor = this.store.options.hoverCursor;
              break;
            }
          }
        }
      }
    }

    if (hoverType === HoverType.None && pointInRect(pt, this.activeRect)) {
      if (!this.store.data.locked) {
        this.externalElements.style.cursor = 'move';
      }
      this.store.hover = undefined;
      hoverType = HoverType.Node;
    }

    this.hoverType = hoverType;
    if (hoverType === HoverType.None) {
      if (this.drawingLineName) {
        this.externalElements.style.cursor = 'crosshair';
      } else if (!this.mouseDown) {
        this.externalElements.style.cursor = 'default';
      }
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

    this.render(Infinity);
  }

  clearCanvas() {
    this.activeRect = undefined;
    this.sizeCPs = undefined;
    this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen.getContext('2d').clearRect(0, 0, this.offscreen.width, this.offscreen.height);
  }

  addPen(pen: TopologyPen, edited?: boolean) {
    if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
      return;
    }

    this.makePen(pen);

    this.render();
    this.store.emitter.emit('addPen', pen);

    if (edited && !this.store.data.locked) {
      this.store.histories.push({
        type: EditType.Add,
        data: pen
      });
    }

    return pen;
  }

  makePen(pen: TopologyPen) {
    if (!pen.id) {
      pen.id = s8();
    }
    this.store.data.pens.push(pen);
    this.store.pens[pen.id] = pen;

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
    this.dirtyPenRect(pen);
    !pen.rotate && (pen.rotate = 0);
    this.loadImage(pen);
  }

  drawline(mouse?: Point) {
    if (!this.drawingLine) {
      return;
    }
    this.drawingLine.calculative.active = true;
    if (this[this.drawingLineName]) {
      this[this.drawingLineName](this.store, this.drawingLine, mouse);
    }
    const rect = getLineRect(this.drawingLine);
    this.drawingLine.x = rect.x;
    this.drawingLine.y = rect.y;
    this.drawingLine.width = rect.width;
    this.drawingLine.height = rect.height;
    this.drawingLine.calculative.worldRect = rect;
    this.store.path2dMap.set(this.drawingLine, this.store.penPaths[this.drawingLine.name](this.drawingLine));
    if (this.drawingLine.calculative.worldAnchors) {
      this.drawingLine.anchors = [];
      this.drawingLine.calculative.worldAnchors.forEach(pt => {
        this.drawingLine.anchors.push(calcRelativePoint(pt, this.drawingLine.calculative.worldRect));
      });
    }
    this.dirty = true;
  }

  finishDrawline(close?: boolean) {
    if (this.drawingLine) {
      this.drawingLine.close = close;
      if (this.drawingLine.calculative.worldAnchors.length) {
        this.drawingLine.calculative.worldTo = this.drawingLine.calculative.worldAnchors.pop();
        this.drawingLine.to = this.drawingLine.anchors.pop();
        this.store.path2dMap.set(this.drawingLine, this.store.penPaths[this.drawingLine.name](this.drawingLine));
      } else {
        this.drawline();
        this.render();
        this.drawingLine = undefined;
        this.drawingLineName = undefined;
        return;
      }
      this.drawingLine.calculative.activeAnchor = this.drawingLine.calculative.worldTo;
      if (!this.beforeAddPen || this.beforeAddPen(this.drawingLine)) {
        this.store.data.pens.push(this.drawingLine);
        this.store.pens[this.drawingLine.id] = this.drawingLine;
        this.store.emitter.emit('addPen', this.drawingLine);
        this.active([this.drawingLine]);
        this.store.histories.push({
          type: EditType.Add,
          data: this.drawingLine
        });
      }
    }
    this.drawline();
    this.render();
    this.drawingLine = undefined;
    this.drawingLineName = undefined;
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

  dirtyPenRect(pen: TopologyPen) {
    calcWorldRects(this.store.pens, pen);
    calcWorldAnchors(pen);
    calcIconRect(this.store.pens, pen);
    calcTextRect(pen);
    this.store.path2dMap.set(pen, this.store.penPaths[pen.name](pen));
    this.dirty = true;
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
    const offscreenCtx = this.offscreen.getContext('2d');
    offscreenCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    offscreenCtx.save();
    offscreenCtx.translate(this.store.data.x, this.store.data.y);
    this.renderPens();
    this.renderAnimate();
    this.renderBorder();
    this.renderCP();
    offscreenCtx.restore();

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
      if (!rectInRect(penRect, canvasRect)) {
        return;
      }
      renderPen(ctx, pen, this.store.path2dMap.get(pen), this.store);
    });
    if (this.drawingLine) {
      renderPen(ctx, this.drawingLine, this.store.path2dMap.get(this.drawingLine), this.store);
    }
    ctx.restore();
  };

  renderBorder = () => {
    if (!this.store.data.locked) {
      // Occupied territory.
      if (this.activeRect && !(this.store.active.length === 1 && this.store.active[0].type)) {
        const ctx = this.offscreen.getContext('2d');
        ctx.save();
        ctx.translate(0.5, 0.5);
        if (this.activeRect.rotate) {
          ctx.translate(this.activeRect.center.x, this.activeRect.center.y);
          ctx.rotate((this.activeRect.rotate * Math.PI) / 180);
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
    if (this.store.data.locked) {
      return;
    }
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.translate(0.5, 0.5);
    if (this.store.hover && (this.hotkeyType !== HotkeyType.Resize || this.store.active.length !== 1 || this.store.active[0] !== this.store.hover)) {
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
    if (this.hotkeyType !== HotkeyType.Anchor && this.activeRect && !(this.store.active.length === 1 && this.store.active[0].type)) {
      ctx.strokeStyle = this.store.options.activeColor;
      ctx.fillStyle = "#ffffff";
      this.sizeCPs.forEach((pt, i) => {
        if (this.activeRect.rotate) {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate((this.activeRect.rotate * Math.PI) / 180);
          ctx.translate(-pt.x, -pt.y);
        }
        if (i < 4 || this.hotkeyType === HotkeyType.Resize) {
          ctx.beginPath();
          ctx.fillRect(pt.x - 4.5, pt.y - 4.5, 8, 8);
          ctx.strokeRect(pt.x - 5.5, pt.y - 5.5, 10, 10);
        }
        if (this.activeRect.rotate) {
          ctx.restore();
        }
      });
    }
    ctx.restore();
  };

  renderAnimate = () => { };

  translate(x: number, y: number) {
    this.store.data.x += x;
    this.store.data.y += y;
    this.store.data.x = Math.round(this.store.data.x);
    this.store.data.y = Math.round(this.store.data.y);
    this.render(Infinity);
    this.store.emitter.emit('translate', { x: this.store.data.x, y: this.store.data.y });
  }

  scale(scale: number, center = { x: 0, y: 0 }) {
    if (scale < this.store.options.minScale || scale > this.store.options.maxScale) {
      return;
    }

    this.calibrateMouse(center);
    this.dirty = true;
    const s = scale / this.store.data.scale;
    this.store.data.pens.forEach((pen) => {
      scalePen(pen, s, center);
      this.dirtyPenRect(pen);
    });
    this.calcActiveRect();
    this.store.data.scale = scale;
    this.store.data.center = center;

    this.render(Infinity);

    this.store.emitter.emit('scale', this.store.data.scale);
  }

  resizePens(e: Point) {
    const p1 = { x: this.mouseDown.x, y: this.mouseDown.y };
    const p2 = { x: e.x, y: e.y };
    rotatePoint(p1, -this.activeRect.rotate, this.activeRect.center);
    rotatePoint(p2, -this.activeRect.rotate, this.activeRect.center);

    const x = p2.x - p1.x;
    const y = p2.y - p1.y;

    const offsetX = x - this.lastOffsetX;
    const offsetY = y - this.lastOffsetY;
    this.lastOffsetX = x;
    this.lastOffsetY = y;

    const w = this.activeRect.width;
    const h = this.activeRect.height;
    switch (this.resizeIndex) {
      case 0:
        this.activeRect.x += offsetX;
        this.activeRect.y += offsetY;
        this.activeRect.width -= offsetX;
        this.activeRect.height -= offsetY;
        break;
      case 1:
        this.activeRect.ex += offsetX;
        this.activeRect.y += offsetY;
        this.activeRect.width += offsetX;
        this.activeRect.height -= offsetY;
        break;
      case 2:
        this.activeRect.ex += offsetX;
        this.activeRect.ey += offsetY;
        this.activeRect.width += offsetX;
        this.activeRect.height += offsetY;
        break;
      case 3:
        this.activeRect.x += offsetX;
        this.activeRect.ey += offsetY;
        this.activeRect.width -= offsetX;
        this.activeRect.height += offsetY;
        break;
      case 4:
        this.activeRect.y += offsetY;
        this.activeRect.height -= offsetY;
        break;
      case 5:
        this.activeRect.ex += offsetX;
        this.activeRect.width += offsetX;
        break;
      case 6:
        this.activeRect.ey += offsetY;
        this.activeRect.height += offsetY;
        break;
      case 7:
        this.activeRect.x += offsetX;
        this.activeRect.width -= offsetX;
        break;
    }
    calcCenter(this.activeRect);

    const scaleX = this.activeRect.width / w;
    const scaleY = this.activeRect.height / h;
    this.store.active.forEach((pen, i) => {
      if (pen.parentId) {
        return;
      }
      pen.x = (this.activeInitPos[i].x * this.activeRect.width) + this.activeRect.x;
      pen.y = (this.activeInitPos[i].y * this.activeRect.height) + this.activeRect.y;
      pen.width *= scaleX;
      pen.height *= scaleY;
      this.dirtyPenRect(pen);
    });
    this.getSizeCPs();
    this.render(Infinity);
  }

  movePens(e: {
    x: number;
    y: number;
    shiftKey?: boolean;
    altKey?: boolean;
  }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    const p1 = { x: this.mouseDown.x, y: this.mouseDown.y };
    const p2 = { x: e.x, y: e.y };
    rotatePoint(p1, -this.activeRect.rotate, this.activeRect.center);
    rotatePoint(p2, -this.activeRect.rotate, this.activeRect.center);

    const x = p2.x - p1.x;
    const y = p2.y - p1.y;

    let offsetX = x - this.lastOffsetX;
    let offsetY = y - this.lastOffsetY;
    if (e.shiftKey) {
      offsetY = 0;
    }
    if (e.altKey) {
      offsetX = 0;
    }
    this.lastOffsetX = x;
    this.lastOffsetY = y;

    translateRect(this.activeRect, offsetX, offsetY);

    this.store.active.forEach((pen, i) => {
      if (pen.parentId) {
        return;
      }
      translateRect(pen, offsetX, offsetY);
      this.dirtyPenRect(pen);
    });
    this.getSizeCPs();
    this.render(Infinity);
  }

  calcActiveRect() {
    if (this.store.active.length === 1) {
      this.activeRect = this.store.active[0].calculative.worldRect;
      this.activeRect.rotate = this.store.active[0].rotate;
      calcCenter(this.activeRect);
    } else {
      this.activeRect = getRect(this.store.active);
      this.activeRect.rotate = 0;
    }
    this.lastRotate = 0;
    this.getSizeCPs();
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
