import { KeydownType } from '../options';
import {
  addLineAnchor,
  calcIconRect,
  calcTextRect,
  calcWorldAnchors,
  calcWorldRects,
  LockState,
  nearestAnchor,
  PenType,
  pushPenAnchor,
  removePenAnchor,
  renderPen,
  scalePen,
  Pen,
  translateLine,
  deleteTempAnchor,
  connectLine,
  disconnectLine,
  getAnchor,
  calcAnchorDock,
  calcRectDock,
  calcTextLines,
  setNodeAnimate,
  setLineAnimate,
  calcPenRect,
  setChildrenActive,
  getParent,
  setHover,
  getAllChildren,
} from '../pen';
import { calcRotate, hitPoint, Point, PrevNextType, rotatePoint, translatePoint } from '../point';
import {
  calcCenter,
  calcRelativePoint,
  getRect,
  pointInRect,
  pointInSimpleRect,
  Rect,
  rectInRect,
  rectToPoints,
  translateRect,
} from '../rect';
import { EditType, globalStore, TopologyStore } from '../store';
import { isMobile, rgba, s8 } from '../utils';
import { defaultCursors, defaultDrawLineFns, HotkeyType, HoverType, MouseRight, rotatedCursors } from '../data';
import { createOffscreen } from './offscreen';
import { curve, curveMind, getLineLength, getLineRect, pointInLine, simplify, smoothLine } from '../diagrams';
import { ployline } from '../diagrams/line/ployline';
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
  initActiveRect: Rect;
  dragRect: Rect;
  lastRotate = 0;
  sizeCPs: Point[];
  activeInitPos: Point[];

  hoverType = HoverType.None;
  resizeIndex = 0;
  mouseDown: { x: number; y: number; restore?: boolean };
  hotkeyType: HotkeyType;
  mouseRight: MouseRight;
  translateX: number;
  translateY: number;
  addCache: Pen;
  touchCenter?: Point;
  touches?: TouchList;

  lastOffsetX = 0;
  lastOffsetY = 0;

  drawingLineName?: string;
  drawLineFns: string[] = [...defaultDrawLineFns];
  drawingLine?: Pen;

  graffiti?: boolean;
  graffitiLine?: Pen;

  dirtyLines?: Set<Pen> = new Set();
  dock: { xDock: Point; yDock: Point };

  prevAnchor: Point;
  nextAnchor: Point;

  lastMouseTime = 0;

  dirty = false;
  lastRender = 0;
  touchStart = 0;
  timer: any;

  lastAnimateRender = 0;
  animateRendering = false;

  pointSize = 8;

  beforeAddPen: (pen: Pen) => boolean;
  beforeAddAnchor: (pen: Pen, anchor: Point) => boolean;
  beforeRemovePen: (pen: Pen) => boolean;
  beforeRemoveAnchor: (pen: Pen, anchor: Point) => boolean;

  constructor(public parentElement: HTMLElement, public store: TopologyStore) {
    parentElement.appendChild(this.canvas);

    this.externalElements.style.position = 'absolute';
    this.externalElements.style.left = '0';
    this.externalElements.style.top = '0';
    this.externalElements.style.outline = 'none';
    this.externalElements.style.background = 'transparent';
    parentElement.appendChild(this.externalElements);

    this.store.dpiRatio = window ? window.devicePixelRatio : 1;

    if (this.store.dpiRatio < 1) {
      this.store.dpiRatio = 1;
    } else if (this.store.dpiRatio > 1 && this.store.dpiRatio < 1.5) {
      this.store.dpiRatio = 1.5;
    }

    this.bounding = this.externalElements.getBoundingClientRect();
    this.listen();

    this['curve'] = curve;
    this['ployline'] = ployline;
    this['curveMind'] = curveMind;

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

    this.externalElements.ondblclick = (e: any) => {};
    this.externalElements.onblur = () => {
      this.mouseDown = undefined;
    };
    this.externalElements.onwheel = this.onwheel;

    switch (this.store.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keydown', this.onkeydown);
        document.addEventListener('keyup', this.onkeyup);
        break;
      case KeydownType.Canvas:
        this.externalElements.addEventListener('keydown', this.onkeydown);
        this.externalElements.addEventListener('keyup', this.onkeyup);
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

  onkeydown = (e: KeyboardEvent) => {
    if (
      this.store.data.locked ||
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }
    let x = 10;
    let y = 10;
    switch (e.key) {
      case ' ':
        this.hotkeyType = HotkeyType.Translate;
        break;
      case 'Control':
        if (this.drawingLine) {
          this.drawingLine.calculative.drawlineH = !this.drawingLine.calculative.drawlineH;
        } else if (!this.hotkeyType) {
          this.dirty = true;
          this.hotkeyType = HotkeyType.Select;
        }
        break;
      case 'Meta':
        break;
      case 'Shift':
        if (this.drawingLine) {
          const to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
          if (to !== this.drawingLine.calculative.activeAnchor) {
            deleteTempAnchor(this.drawingLine);
            this.drawingLine.calculative.worldAnchors.push(to);
          } else {
            this.drawingLine.calculative.worldAnchors.push({
              x: to.x,
              y: to.y,
            });
          }
          const index = this.drawLineFns.indexOf(this.drawingLineName);
          this.drawingLineName = this.drawLineFns[(index + 1) % this.drawLineFns.length];
          this.drawline();
          this.dirty = true;
        } else if (this.store.active.length === 1 && this.store.active[0].type && this.store.activeAnchor) {
          if (!this.store.activeAnchor.prevNextType) {
            this.store.activeAnchor.prevNextType = PrevNextType.Mirror;
          }
          this.store.activeAnchor.prevNextType = (this.store.activeAnchor.prevNextType + 1) % 3;
        } else if (!this.hotkeyType) {
          this.dirty = true;
          this.hotkeyType = HotkeyType.Resize;
        }
        break;
      case 'Alt':
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
        } else {
          if (!this.hotkeyType) {
            this.hotkeyType = HotkeyType.AddAnchor;
            if (this.store.hover) {
              this.externalElements.style.cursor = 'pointer';
            }
          } else if (this.hotkeyType === HotkeyType.AddAnchor) {
            this.hotkeyType = HotkeyType.None;
            if (this.store.hoverAnchor) {
              this.externalElements.style.cursor = 'vertical-text';
            } else if (this.store.hover) {
              this.externalElements.style.cursor = 'move';
            }
          }
          this.dirty = true;
        }
        break;
      case 'Delete':
      case 'Backspace':
        break;
      case 'ArrowLeft':
        x = -10;
        if (e.shiftKey) {
          x = -5;
        }
        if (e.ctrlKey) {
          x = -1;
        }
        this.translatePens(x, 0);
        break;
      case 'ArrowUp':
        y = -10;
        if (e.shiftKey) {
          y = -5;
        }
        if (e.ctrlKey) {
          y = -1;
        }
        this.translatePens(0, y);
        break;
      case 'ArrowRight':
        if (e.shiftKey) {
          x = 5;
        }
        if (e.ctrlKey) {
          x = 1;
        }
        this.translatePens(x, 0);
        break;
      case 'ArrowDown':
        if (e.shiftKey) {
          y = 5;
        }
        if (e.ctrlKey) {
          y = 1;
        }
        this.translatePens(0, y);
        break;
      case 'x':
      case 'X':
        break;
      case 'c':
      case 'C':
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
        } else {
          this.drawingLineName = this.drawingLineName ? '' : 'curve';
        }
        break;
      case 'g':
      case 'G':
        this.graffiti = true;
        this.externalElements.style.cursor = 'crosshair';
        break;
      case 'y':
      case 'Y':
        break;
      case 'z':
      case 'Z':
        break;
      case 'Enter':
        if (this.drawingLineName) {
          this.finishDrawline();
        } else if (this.store.active) {
          this.store.active.forEach((pen) => {
            if (pen.type) {
              pen.close = !pen.close;
              this.store.path2dMap.set(pen, this.store.penPaths[pen.name](pen));
              this.dirty = true;
            }
          });
          this.render();
        }
        break;
      case 'Escape':
        if (this.drawingLineName) {
          this.finishDrawline();
        }
        this.drawingLineName = undefined;
        this.graffiti = undefined;
        this.graffitiLine = undefined;
        this.hotkeyType = HotkeyType.None;
        this.externalElements.style.cursor = 'default';
        break;
    }

    this.render();
  };

  onkeyup = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Alt':
        if (this.drawingLine) {
          this.store.options.autoAnchor = !this.store.options.autoAnchor;
        }
        break;
    }

    if (this.hotkeyType) {
      this.render(Infinity);
    }
    if (this.hotkeyType < HotkeyType.AddAnchor) {
      this.hotkeyType = HotkeyType.None;
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
    } catch {}
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
            Math.hypot(this.touches[0].pageX - this.touches[1].pageX, this.touches[0].pageY - this.touches[1].pageY);
        event.preventDefault();
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
    this.calibrateMouse(e);

    this.mouseDown = e;
    this.lastMouseTime = performance.now();

    // Set anchor of pen.
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      if (this.store.hoverAnchor) {
        removePenAnchor(this.store.hover, this.store.hoverAnchor);
        if (this.store.hover.type) {
          this.initLineRect(this.store.hover);
        }
        this.store.hoverAnchor = undefined;
        this.store.activeAnchor = undefined;
        this.externalElements.style.cursor = 'default';
      } else if (this.store.hover) {
        if (this.store.hover.type) {
          this.store.activeAnchor = addLineAnchor(this.store.hover, this.store.pointAt, this.store.pointAtIndex);
          this.initLineRect(this.store.hover);

          const pt = { x: e.x, y: e.y };
          this.getHover(pt);
        } else {
          const pt = { x: e.x, y: e.y };
          this.store.activeAnchor = pushPenAnchor(this.store.hover, pt);
        }
      }
      this.hotkeyType = HotkeyType.None;
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

      const pt: Point = { x: e.x, y: e.y, id: s8() };

      // 在锚点上，完成绘画
      if (
        this.hoverType &&
        this.hoverType < HoverType.Line &&
        this.drawingLine &&
        this.drawingLine.calculative.worldAnchors.length > 1
      ) {
        const to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
        to.connectTo = this.store.hover.id;
        to.anchorId = this.store.hoverAnchor.id;
        connectLine(this.store.pens[this.store.hover.id], this.drawingLine.id, to.id, to.anchorId);
        this.finishDrawline(true);
        return;
      }

      // 右键，完成绘画
      if (e.buttons === 2) {
        this.finishDrawline(true);
        return;
      }

      if (this.hoverType === HoverType.Node) {
        if (this.store.options.autoAnchor) {
          this.store.hoverAnchor = nearestAnchor(this.store.hover, pt);
        }

        if (this.store.hoverAnchor) {
          if (this.drawingLine) {
            const to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
            to.x = this.store.hoverAnchor.x;
            to.y = this.store.hoverAnchor.y;
            to.connectTo = this.store.hover.id;
            to.anchorId = this.store.hoverAnchor.id;
            connectLine(this.store.pens[this.store.hover.id], this.drawingLine.id, to.id, this.store.hoverAnchor.id);
            this.drawline();
            this.finishDrawline(true);
            return;
          }
        }
      }
      if (this.hoverType && this.hoverType < HoverType.Resize && this.store.hoverAnchor) {
        pt.x = this.store.hoverAnchor.x;
        pt.y = this.store.hoverAnchor.y;
        pt.connectTo = this.store.hover.id;
        pt.anchorId = this.store.hoverAnchor.id;
      }
      if (this.drawingLine) {
        const to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
        if (to.hidden) {
          to.hidden = undefined;
        } else {
          this.drawingLine.calculative.activeAnchor = to;
          this.drawingLine.calculative.worldAnchors.push({ x: to.x, y: to.y, penId: to.penId });
        }

        this.drawingLine.calculative.drawlineH = undefined;
        this.drawline();
      } else {
        const id = s8();
        pt.penId = id;
        this.drawingLine = {
          id,
          name: 'line',
          x: pt.x,
          y: pt.y,
          type: PenType.Line,
          calculative: {
            active: true,
            worldAnchors: [pt],
          },
        };
        this.drawingLine.calculative.activeAnchor = pt;
        this.drawline();
        if (pt.connectTo) {
          connectLine(this.store.pens[pt.connectTo], this.drawingLine.id, pt.id, pt.anchorId);
        }
      }
    } else if (this.graffiti) {
      this.inactive(true);
      const id = s8();
      const pt: Point = { x: e.x, y: e.y, id: s8(), penId: id };
      this.graffitiLine = {
        id,
        name: 'line',
        x: pt.x,
        y: pt.y,
        type: PenType.Line,
        calculative: {
          graffiti: true,
          active: true,
          worldAnchors: [pt],
        },
      };
    } else {
      switch (this.hoverType) {
        case HoverType.None:
          this.inactive();
          break;
        case HoverType.Node:
          if (this.store.hover) {
            const pen = getParent(this.store, this.store.hover) || this.store.hover;
            if (e.ctrlKey) {
              if (pen.calculative.active) {
                pen.calculative.active = undefined;
                this.store.active.splice(
                  this.store.active.findIndex((pen) => pen === pen),
                  1
                );
                this.store.emitter.emit('inactive', [pen]);
              } else {
                pen.calculative.active = true;
                this.store.active.push(pen);
                this.store.emitter.emit('active', [pen]);
              }
              this.dirty = true;
            } else if (e.altKey) {
              if (this.store.active.length) {
                this.store.active.forEach((pen) => {
                  pen.calculative.active = undefined;
                });
              }
              this.store.active = [this.store.hover];
              this.store.hover.calculative.active = true;
              this.store.emitter.emit('active', [this.store.hover]);
              this.dirty = true;
            } else {
              if (!pen.calculative.active) {
                this.active([pen]);
              }
            }

            this.calcActiveRect();
          }
          break;
        case HoverType.Line:
          {
            const pen = getParent(this.store, this.store.hover) || this.store.hover;
            this.active([pen]);
          }
          break;
        case HoverType.LineAnchor:
          this.store.activeAnchor = this.store.hoverAnchor;
          this.store.hover.calculative.activeAnchor = this.store.hoverAnchor;
          this.active([this.store.hover]);
          break;
        case HoverType.LineAnchorPrev:
        case HoverType.LineAnchorNext:
          // 备份，方便移动锚点方向
          this.prevAnchor = { ...this.store.activeAnchor.prev };
          this.nextAnchor = { ...this.store.activeAnchor.next };
          break;
        case HoverType.Resize:
          this.activeInitPos = [];
          this.store.active.forEach((pen) => {
            this.activeInitPos.push({
              x: (pen.calculative.worldRect.x - this.activeRect.x) / this.activeRect.width,
              y: (pen.calculative.worldRect.y - this.activeRect.y) / this.activeRect.height,
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
    if (this.mouseDown && !this.mouseDown.restore && e.buttons !== 1 && e.buttons !== 2) {
      this.onMouseUp(e);
      return;
    }

    // 避免鼠标点击和移动一起触发，误抖动
    if (this.lastMouseTime) {
      const now = performance.now();
      if (now - this.lastMouseTime < 50) {
        this.lastMouseTime = 0;
        return;
      }
      this.lastMouseTime = 0;
    }

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;

    this.calibrateMouse(e);
    if (this.drawingLine) {
      const pt: Point = { ...e };
      pt.id = s8();
      pt.penId = this.drawingLine.id;
      if (this.mouseDown) {
        this.drawline(pt);
      } else {
        let to: Point;
        if (this.drawingLine.calculative.worldAnchors.length > 1) {
          to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
          disconnectLine(this.store.pens[to.connectTo], this.drawingLine.id, to.id, to.anchorId);
        }

        if (to) {
          to.prev = undefined;
          to.next = undefined;
          if (!to.id) {
            to.id = s8();
          }
          to.x = pt.x;
          to.y = pt.y;
        } else {
          to = { ...pt };
          this.drawingLine.calculative.worldAnchors.push(to);
        }

        if (this.hoverType && this.hoverType < HoverType.Line && this.store.hoverAnchor) {
          const from = this.drawingLine.calculative.worldAnchors[0];
          if (!(this.store.hoverAnchor.id === from.anchorId && this.store.hover.id === from.connectTo)) {
            to.x = this.store.hoverAnchor.x;
            to.y = this.store.hoverAnchor.y;
            to.connectTo = this.store.hoverAnchor.penId;
            to.anchorId = this.store.hoverAnchor.id;
          }
        }
        if (to.connectTo) {
          connectLine(this.store.pens[to.connectTo], this.drawingLine.id, to.id, to.anchorId);
        }
        this.drawline();
      }
    } else if (this.graffiti) {
      if (!this.mouseDown) {
        return;
      }

      const pt: Point = { ...e };
      pt.id = s8();
      pt.penId = this.graffitiLine.id;
      this.graffitiLine.calculative.worldAnchors.push(pt);
      this.store.path2dMap.set(this.graffitiLine, this.store.penPaths[this.graffitiLine.name](this.graffitiLine));
      this.dirty = true;
    } else if (this.mouseDown) {
      if (this.mouseRight === MouseRight.TranslateOrContextMenu) {
        this.mouseRight = MouseRight.Translate;
      }

      if (e.buttons !== 2 && !this.store.data.locked && !this.hoverType && !this.hotkeyType) {
        this.dragRect = {
          x: Math.min(this.mouseDown.x, e.x),
          y: Math.min(this.mouseDown.y, e.y),
          ex: Math.max(this.mouseDown.x, e.x),
          ey: Math.max(this.mouseDown.y, e.y),
          width: Math.abs(e.x - this.mouseDown.x),
          height: Math.abs(e.y - this.mouseDown.y),
        };
        this.dirty = true;
      }

      // Translate
      if (this.hotkeyType === HotkeyType.Translate || this.mouseRight === MouseRight.Translate) {
        if (
          this.translateX &&
          this.translateY &&
          (!this.store.data.locked || this.store.data.locked < LockState.DisableMove)
        ) {
          this.translate(e.x - this.translateX, e.y - this.translateY);
          return false;
        }
      }

      // Rotate
      if (this.hoverType === HoverType.Rotate) {
        const pt = { x: e.x, y: e.y };
        this.activeRect.rotate = calcRotate(pt, this.activeRect.center);
        if (this.store.active.length === 1) {
          this.lastRotate = this.store.active[0].rotate || 0;
        }
        const angle = this.activeRect.rotate - this.lastRotate;
        this.store.active.forEach((pen) => {
          if (pen.parentId) {
            return;
          }
          this.rotatePen(pen, angle, this.activeRect);
        });
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
      if (this.hoverType === HoverType.Node || this.hoverType === HoverType.Line) {
        this.movePens(e);
        return;
      }

      // Move line anchor
      if (this.hoverType === HoverType.LineAnchor) {
        this.getAnchorDock(e);
        this.moveLineAnchor(e);
        return;
      }

      // Move line anchor
      if (this.hoverType === HoverType.LineAnchorPrev) {
        this.moveLineAnchorPrev(e);
        return;
      }

      // Move line anchor
      if (this.hoverType === HoverType.LineAnchorNext) {
        this.moveLineAnchorNext(e);
        return;
      }
    }

    (window as any).debug && console.time('hover');
    this.getHover(e);
    (window as any).debug && console.timeEnd('hover');
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      this.dirty = true;
    }
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

    if (this.mouseRight === MouseRight.TranslateOrContextMenu) {
      this.store.emitter.emit('contextmenu', {
        e,
        bounding: this.bounding,
      });
    }
    this.mouseRight = MouseRight.None;

    this.calibrateMouse(e);

    this.graffiti && this.finishGraffiti();

    // Add pen
    if (this.addCache) {
      this.addCache.x = e.x - this.addCache.width / 2;
      this.addCache.y = e.y - this.addCache.height / 2;

      this.addPen(this.addCache);
      this.addCache = undefined;
    }

    // Rotate
    if (this.hoverType === HoverType.Rotate) {
      this.getSizeCPs();
      this.store.active.forEach((pen) => {
        pen.rotate = pen.calculative.rotate;
      });
    }

    this.dirtyLines.forEach((pen) => {
      if (pen.type) {
        this.initLineRect(pen);
      }
    });
    this.dirtyLines.clear();

    if (this.dragRect) {
      const pens = this.store.data.pens.filter((pen) => {
        return (
          pen.visible !== false &&
          pen.locked !== LockState.Disable &&
          !pen.parentId &&
          rectInRect(pen.calculative.worldRect, this.dragRect)
        );
      });
      this.active(pens);
    }

    this.mouseDown = undefined;
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;
    this.dock = undefined;
    this.dragRect = undefined;
    this.initActiveRect = undefined;
  };

  inactive(drawing?: boolean) {
    if (!this.store.active.length) {
      return;
    }
    this.store.active.forEach((pen) => {
      pen.calculative.active = undefined;
      pen.calculative.activeAnchor = undefined;
      setChildrenActive(this.store, pen, false);
    });
    !drawing && this.store.emitter.emit('inactive', this.store.active);
    this.store.active = [];
    this.activeRect = undefined;
    this.sizeCPs = undefined;

    this.dirty = true;
  }

  active(pens: Pen[]) {
    this.store.active.forEach((pen) => {
      pen.calculative.active = undefined;
      setChildrenActive(this.store, pen, false);
    });
    this.store.active = [];

    pens.forEach((pen) => {
      pen.calculative.active = true;
      setChildrenActive(this.store, pen);
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
    if (this.dragRect) {
      return;
    }

    let hoverType = HoverType.None;
    this.store.hover = undefined;
    this.store.hoverAnchor = undefined;
    this.store.pointAt = undefined;
    this.store.pointAtIndex = undefined;
    const activeLine = this.store.active.length === 1 && this.store.active[0].type;
    if (!this.drawingLineName && this.activeRect && !activeLine && !this.store.data.locked) {
      if (!this.store.options.disableRotate) {
        const rotatePt = { x: this.activeRect.center.x, y: this.activeRect.y - 30 };
        if (this.activeRect.rotate) {
          rotatePoint(rotatePt, this.activeRect.rotate, this.activeRect.center);
        }
        // 旋转控制点
        if (!this.hotkeyType && hitPoint(pt, rotatePt, this.pointSize)) {
          hoverType = HoverType.Rotate;
          this.externalElements.style.cursor = 'url("rotate.cur"), auto';
        }
      }

      // 大小控制点
      if (!this.hotkeyType || this.hotkeyType === HotkeyType.Resize) {
        for (let i = 0; i < 4; i++) {
          if (hitPoint(pt, this.sizeCPs[i], this.pointSize)) {
            let cursors = defaultCursors;
            let offset = 0;
            if (Math.abs((this.activeRect.rotate % 90) - 45) < 25) {
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
          if (hitPoint(pt, this.sizeCPs[i], this.pointSize)) {
            let cursors = rotatedCursors;
            let offset = 0;
            if (Math.abs((this.activeRect.rotate % 90) - 45) < 25) {
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
      hoverType = this.inPens(pt, this.store.active);
      if (hoverType === HoverType.None) {
        hoverType = this.inPens(pt, this.store.data.pens);
      }
    }

    if (!hoverType && !activeLine && pointInRect(pt, this.activeRect)) {
      hoverType = HoverType.Node;
      this.externalElements.style.cursor = 'move';
    }

    this.hoverType = hoverType;
    if (hoverType === HoverType.None) {
      if (this.drawingLineName || this.graffiti) {
        this.externalElements.style.cursor = 'crosshair';
      } else if (!this.mouseDown) {
        this.externalElements.style.cursor = 'default';
      }
      this.store.hover = undefined;
    }

    if (this.store.lastHover !== this.store.hover) {
      this.dirty = true;
      if (this.store.lastHover) {
        setHover(this.store, getParent(this.store, this.store.lastHover) || this.store.lastHover, false);
        this.store.emitter.emit('leave', this.store.lastHover);
      }
      if (this.store.hover) {
        this.store.hover.calculative.hover = true;
        setHover(this.store, getParent(this.store, this.store.hover) || this.store.hover);
        this.store.emitter.emit('enter', this.store.hover);
      }
      this.store.lastHover = this.store.hover;
    }
  };

  private inPens = (pt: Point, pens: Pen[]) => {
    let hoverType = HoverType.None;
    for (let i = pens.length - 1; i >= 0; --i) {
      const pen = pens[i];
      if (pen.visible == false || pen.locked === LockState.Disable) {
        continue;
      }

      let r = 4;
      if (pen.lineWidth) {
        r += pen.lineWidth / 2;
      }
      if (!pen.calculative.active && !pointInSimpleRect(pt, pen.calculative.worldRect, r)) {
        continue;
      }
      // 锚点
      if (!this.store.data.locked && !this.store.options.disableAnchor && this.hotkeyType !== HotkeyType.Resize) {
        if (pen.calculative.worldAnchors) {
          for (const anchor of pen.calculative.worldAnchors) {
            hoverType = this.inAnchor(pt, pen, anchor);
            if (hoverType) {
              break;
            }
          }
        }
        if (hoverType) {
          break;
        }
      }
      // 图形
      if (pen.type) {
        const pos = pointInLine(pt, pen);
        if (pos) {
          if (!this.store.data.locked && !pen.locked) {
            if (this.hotkeyType === HotkeyType.AddAnchor) {
              this.externalElements.style.cursor = 'pointer';
            } else {
              this.externalElements.style.cursor = 'move';
            }
          } else {
            this.externalElements.style.cursor = this.store.options.hoverCursor;
          }

          this.store.hover = pen;
          this.store.pointAt = pos.point;
          this.store.pointAtIndex = pos.i;
          hoverType = HoverType.Line;
          break;
        }
      } else {
        if (pen.children) {
          const pens = [];
          pen.children.forEach((id) => {
            pens.push(this.store.pens[id]);
          });

          hoverType = this.inPens(pt, pens);
          if (hoverType) {
            break;
          }
        }
        if (pointInRect(pt, pen.calculative.worldRect)) {
          if (!this.store.data.locked && !pen.locked) {
            if (this.hotkeyType === HotkeyType.AddAnchor) {
              this.externalElements.style.cursor = 'pointer';
            } else {
              this.externalElements.style.cursor = 'move';
            }
          } else {
            this.externalElements.style.cursor = this.store.options.hoverCursor;
          }

          this.store.hover = pen;
          hoverType = HoverType.Node;
          this.store.pointAt = pt;
          break;
        }
      }
    }

    return hoverType;
  };

  private getAnchorDock = (pt: Point) => {
    this.store.hover = undefined;

    let hoverType = HoverType.None;
    for (let i = this.store.data.pens.length - 1; i >= 0; --i) {
      const pen = this.store.data.pens[i];
      if (pen.visible == false || pen.locked === LockState.Disable || pen === this.store.active[0]) {
        continue;
      }

      let r = 4;
      if (pen.lineWidth) {
        r += pen.lineWidth / 2;
      }
      if (!pointInSimpleRect(pt, pen.calculative.worldRect, r)) {
        continue;
      }

      this.store.hover = pen;
      // 锚点
      if (!this.store.options.disableAnchor && this.hotkeyType !== HotkeyType.Resize) {
        if (pen.calculative.worldAnchors) {
          for (const anchor of pen.calculative.worldAnchors) {
            hoverType = this.inAnchor(pt, pen, anchor);
            if (hoverType) {
              break;
            }
          }
        }
        if (hoverType) {
          break;
        }
      }
    }
  };

  inAnchor(pt: Point, pen: Pen, anchor: Point) {
    this.store.hoverAnchor = undefined;
    if (!anchor) {
      return HoverType.None;
    }
    if (hitPoint(pt, anchor, this.pointSize)) {
      if (anchor !== this.store.hoverAnchor) {
        this.dirty = true;
      }
      this.store.hoverAnchor = anchor;
      this.store.hover = pen;
      if (pen.type) {
        if (anchor.connectTo && !pen.calculative.active) {
          this.store.hover = this.store.pens[anchor.connectTo];
          this.store.hoverAnchor = this.store.hover.calculative.worldAnchors.find((a) => a.id === anchor.anchorId);
          this.externalElements.style.cursor = 'crosshair';
          return HoverType.NodeAnchor;
        }
        if (this.hotkeyType === HotkeyType.AddAnchor) {
          this.externalElements.style.cursor = 'vertical-text';
        } else {
          this.externalElements.style.cursor = 'pointer';
        }

        return HoverType.LineAnchor;
      }

      if (this.hotkeyType === HotkeyType.AddAnchor) {
        this.externalElements.style.cursor = 'vertical-text';
      } else {
        this.externalElements.style.cursor = 'crosshair';
      }

      return HoverType.NodeAnchor;
    }

    if (!this.mouseDown && pen.type) {
      if (pen.calculative.active && anchor.prev && hitPoint(pt, anchor.prev, this.pointSize)) {
        this.store.hoverAnchor = anchor;
        this.store.hover = pen;
        this.externalElements.style.cursor = 'pointer';
        return HoverType.LineAnchorPrev;
      }

      if (pen.calculative.active && anchor.next && hitPoint(pt, anchor.next, this.pointSize)) {
        this.store.hoverAnchor = anchor;
        this.store.hover = pen;
        this.externalElements.style.cursor = 'pointer';
        return HoverType.LineAnchorNext;
      }
    }

    return HoverType.None;
  }

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

  addPen(pen: Pen, edited?: boolean) {
    if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
      return;
    }

    this.makePen(pen);

    this.render();
    this.store.emitter.emit('addPen', pen);

    if (edited && !this.store.data.locked) {
      this.store.histories.push({
        type: EditType.Add,
        data: pen,
      });
    }

    return pen;
  }

  makePen(pen: Pen) {
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

    pen.calculative = {};
    for (const k in pen) {
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.calculative[k] = pen[k];
      }
    }
    pen.calculative.image = undefined;

    this.dirtyPenRect(pen);
    if (pen.type) {
      this.initLineRect(pen);
    } else if (!pen.anchors) {
      pen.anchors = [];
      pen.calculative.worldAnchors.forEach((pt) => {
        const anchor = {
          id: pt.id,
          penId: pen.id,
          x: (pt.x - pen.calculative.worldRect.x) / pen.calculative.worldRect.width,
          y: (pt.y - pen.calculative.worldRect.y) / pen.calculative.worldRect.height,
        };
        pen.anchors.push(anchor);
      });
    }
    !pen.rotate && (pen.rotate = 0);
    this.loadImage(pen);
  }

  drawline(mouse?: Point) {
    if (!this.drawingLine) {
      return;
    }
    if (this[this.drawingLineName]) {
      this[this.drawingLineName](this.store, this.drawingLine, mouse);
    }
    this.store.path2dMap.set(this.drawingLine, this.store.penPaths[this.drawingLine.name](this.drawingLine));
    this.dirty = true;
  }

  initLineRect(pen: Pen) {
    const rect = getLineRect(pen);
    if (!pen.parentId) {
      pen.x = rect.x;
      pen.y = rect.y;
      pen.width = rect.width;
      pen.height = rect.height;
    }
    calcCenter(rect);
    pen.calculative.worldRect = rect;
    this.store.path2dMap.set(pen, this.store.penPaths[pen.name](pen));
    if (pen.calculative.worldAnchors) {
      pen.anchors = [];
      pen.calculative.worldAnchors.forEach((pt) => {
        pen.anchors.push(calcRelativePoint(pt, pen.calculative.worldRect));
      });
    }
  }

  finishDrawline(end?: boolean) {
    if (this.drawingLine) {
      const rect = getLineRect(this.drawingLine);
      this.drawingLine.x = rect.x;
      this.drawingLine.y = rect.y;
      this.drawingLine.width = rect.width;
      this.drawingLine.height = rect.height;
      this.drawingLine.calculative.worldRect = rect;
      if (!end) {
        if (this.drawingLine.calculative.worldAnchors[0] === this.drawingLine.calculative.activeAnchor) {
          this.drawingLine = undefined;
          this.render(Infinity);
          return;
        }
        deleteTempAnchor(this.drawingLine);
      }
      this.drawingLine.calculative.activeAnchor =
        this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
      this.store.activeAnchor = this.drawingLine.calculative.activeAnchor;
      if (!this.beforeAddPen || this.beforeAddPen(this.drawingLine)) {
        this.initLineRect(this.drawingLine);
        this.store.data.pens.push(this.drawingLine);
        this.store.pens[this.drawingLine.id] = this.drawingLine;
        this.store.emitter.emit('addPen', this.drawingLine);
        this.active([this.drawingLine]);
        this.store.histories.push({
          type: EditType.Add,
          data: this.drawingLine,
        });
      }
    }
    this.drawline();
    this.render();
    this.drawingLine = undefined;
    this.drawingLineName = undefined;
  }

  finishGraffiti() {
    if (this.graffitiLine) {
      let anchors: Point[] = simplify(
        this.graffitiLine.calculative.worldAnchors,
        10,
        0,
        this.graffitiLine.calculative.worldAnchors.length - 1
      );
      let p = this.graffitiLine.calculative.worldAnchors[0];
      anchors.unshift({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      p = this.graffitiLine.calculative.worldAnchors[this.graffitiLine.calculative.worldAnchors.length - 1];
      anchors.push({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      this.graffitiLine.calculative.worldAnchors = smoothLine(anchors);
      if (this.graffitiLine.calculative.worldAnchors.length > 1) {
        this.graffitiLine.calculative.graffiti = undefined;
        this.store.path2dMap.set(this.graffitiLine, this.store.penPaths[this.graffitiLine.name](this.graffitiLine));
        if (!this.beforeAddPen || this.beforeAddPen(this.graffitiLine)) {
          this.initLineRect(this.graffitiLine);
          this.store.data.pens.push(this.graffitiLine);
          this.store.pens[this.graffitiLine.id] = this.graffitiLine;
          this.store.emitter.emit('addPen', this.graffitiLine);
          this.active([this.graffitiLine]);
          this.store.histories.push({
            type: EditType.Add,
            data: this.graffitiLine,
          });
        }
        this.render(Infinity);
      }
      this.graffitiLine = undefined;
    }
  }

  loadImage(pen: Pen) {
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

  dirtyPenRect(pen: Pen, worldRectIsReady?: boolean) {
    if (worldRectIsReady) {
      calcPenRect(this.store, pen);
    } else {
      calcWorldRects(this.store, pen);
    }
    calcWorldAnchors(pen);
    calcIconRect(this.store.pens, pen);
    calcTextRect(pen);
    this.store.penPaths[pen.name] && this.store.path2dMap.set(pen, this.store.penPaths[pen.name](pen));
    this.dirty = true;

    if (pen.children) {
      pen.children.forEach((id) => {
        const child: Pen = this.store.pens[id];
        this.dirtyPenRect(child);
      });
    }

    pen.type && this.initLineRect(pen);
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
    this.renderHoverPoint();
    offscreenCtx.restore();

    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);
    this.dirty = false;
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

    this.store.data.pens.forEach((pen: Pen) => {
      if (pen.visible === false || pen.calculative.visible === false) {
        pen.calculative.inView = false;
        return;
      }

      const x = pen.calculative.worldRect.x + this.store.data.x;
      const y = pen.calculative.worldRect.y + this.store.data.y;
      const penRect = {
        x,
        y,
        ex: x + pen.calculative.worldRect.width,
        ey: y + pen.calculative.worldRect.height,
      };
      if (!rectInRect(penRect, canvasRect)) {
        pen.calculative.inView = false;
        return;
      }
      pen.calculative.inView = true;
      renderPen(ctx, pen, this.store.path2dMap.get(pen), this.store);
    });
    if (this.drawingLine) {
      renderPen(ctx, this.drawingLine, this.store.path2dMap.get(this.drawingLine), this.store);
    }
    if (this.graffitiLine) {
      renderPen(ctx, this.graffitiLine, this.store.path2dMap.get(this.graffitiLine), this.store);
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
        ctx.fillStyle = '#ffffff';
        ctx.arc(this.activeRect.center.x, this.activeRect.y - 30, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }
  };

  renderHoverPoint = () => {
    if (this.store.data.locked) {
      return;
    }
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.translate(0.5, 0.5);
    if (
      this.store.hover &&
      (this.hotkeyType !== HotkeyType.Resize ||
        this.store.active.length !== 1 ||
        this.store.active[0] !== this.store.hover)
    ) {
      if (!this.store.options.disableAnchor && !this.store.hover.disableAnchor) {
        const anchors = [...this.store.hover.calculative.worldAnchors];

        if (this.store.pointAt && this.hotkeyType === HotkeyType.AddAnchor) {
          anchors.push(this.store.pointAt);
        }
        if (anchors) {
          ctx.strokeStyle = this.store.hover.anchorColor || this.store.options.anchorColor;
          ctx.fillStyle = this.store.hover.anchorBackground || this.store.options.anchorBackground;
          anchors.forEach((anchor) => {
            if (anchor === this.store.hoverAnchor) {
              ctx.save();
              ctx.fillStyle = ctx.strokeStyle;
            }
            ctx.beginPath();
            let size = anchor.radius || this.store.options.anchorRadius;
            if (this.store.hover.type) {
              size = 3;
              if (this.store.hover.calculative.lineWidth > 3) {
                size = this.store.hover.calculative.lineWidth;
              }
            }
            ctx.arc(anchor.x, anchor.y, size, 0, Math.PI * 2);
            if (this.store.hover.type && this.store.hoverAnchor === anchor) {
              ctx.save();
              ctx.strokeStyle = this.store.hover.activeColor || this.store.options.activeColor;
              ctx.fillStyle = ctx.strokeStyle;
            } else if (anchor.color || anchor.background) {
              ctx.save();
              ctx.strokeStyle = anchor.color;
              ctx.fillStyle = anchor.background;
            }
            ctx.fill();
            ctx.stroke();
            if (anchor === this.store.hoverAnchor) {
              ctx.restore();
            }

            if (this.store.hover.type && this.store.hoverAnchor === anchor) {
              ctx.restore();
            } else if (anchor.color || anchor.background) {
              ctx.restore();
            }
          });
        }
      }
    }

    // Draw size control points.
    if (
      this.hotkeyType !== HotkeyType.AddAnchor &&
      this.activeRect &&
      !(this.store.active.length === 1 && this.store.active[0].type)
    ) {
      ctx.strokeStyle = this.store.options.activeColor;
      ctx.fillStyle = '#ffffff';
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

    if (!this.store.data.locked && this.dragRect) {
      ctx.save();
      ctx.fillStyle = rgba(0.2, this.store.options.dragColor);
      ctx.strokeStyle = this.store.options.dragColor;
      ctx.beginPath();
      ctx.strokeRect(this.dragRect.x, this.dragRect.y, this.dragRect.width, this.dragRect.height);
      ctx.fillRect(this.dragRect.x, this.dragRect.y, this.dragRect.width, this.dragRect.height);
      ctx.restore();
    }

    if (this.dock) {
      ctx.strokeStyle = '#eb5ef7';
      if (this.dock.xDock) {
        ctx.beginPath();
        ctx.moveTo(this.dock.xDock.x, this.dock.xDock.y);
        ctx.lineTo(this.dock.xDock.x, this.dock.xDock.prev.y);
        ctx.stroke();
      }

      if (this.dock.yDock) {
        ctx.beginPath();
        ctx.moveTo(this.dock.yDock.x, this.dock.yDock.y);
        ctx.lineTo(this.dock.yDock.prev.x, this.dock.yDock.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  renderAnimate = () => {};

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
      if (pen.parentId) {
        return;
      }
      scalePen(pen, s, center);
      this.dirtyPenRect(pen, true);
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

    let offsetX = x - this.lastOffsetX;
    let offsetY = y - this.lastOffsetY;
    this.lastOffsetX = x;
    this.lastOffsetY = y;

    const w = this.activeRect.width;
    const h = this.activeRect.height;
    switch (this.resizeIndex) {
      case 0:
        if (this.activeRect.width - offsetX < 5 || this.activeRect.height - offsetY < 5) {
          return;
        }
        this.activeRect.x += offsetX;
        this.activeRect.y += offsetY;
        this.activeRect.width -= offsetX;
        this.activeRect.height -= offsetY;
        break;
      case 1:
        if (this.activeRect.width + offsetX < 5 || this.activeRect.height - offsetY < 5) {
          return;
        }
        this.activeRect.ex += offsetX;
        this.activeRect.y += offsetY;
        this.activeRect.width += offsetX;
        this.activeRect.height -= offsetY;
        break;
      case 2:
        if (this.activeRect.width + offsetX < 5 || this.activeRect.height + offsetY < 5) {
          return;
        }
        this.activeRect.ex += offsetX;
        this.activeRect.ey += offsetY;
        this.activeRect.width += offsetX;
        this.activeRect.height += offsetY;
        break;
      case 3:
        if (this.activeRect.width - offsetX < 5 || this.activeRect.height + offsetY < 5) {
          return;
        }
        this.activeRect.x += offsetX;
        this.activeRect.ey += offsetY;
        this.activeRect.width -= offsetX;
        this.activeRect.height += offsetY;
        break;
      case 4:
        if (this.activeRect.height - offsetY < 5) {
          return;
        }
        this.activeRect.y += offsetY;
        this.activeRect.height -= offsetY;
        break;
      case 5:
        if (this.activeRect.width + offsetX < 5) {
          return;
        }
        this.activeRect.ex += offsetX;
        this.activeRect.width += offsetX;
        break;
      case 6:
        if (this.activeRect.height + offsetY < 5) {
          return;
        }
        this.activeRect.ey += offsetY;
        this.activeRect.height += offsetY;
        break;
      case 7:
        if (this.activeRect.width - offsetX < 5) {
          return;
        }
        this.activeRect.x += offsetX;
        this.activeRect.width -= offsetX;
        break;
    }
    calcCenter(this.activeRect);

    const scaleX = this.activeRect.width / w;
    const scaleY = this.activeRect.height / h;
    this.store.active.forEach((pen, i) => {
      pen.calculative.worldRect.x = this.activeInitPos[i].x * this.activeRect.width + this.activeRect.x;
      pen.calculative.worldRect.y = this.activeInitPos[i].y * this.activeRect.height + this.activeRect.y;
      pen.calculative.worldRect.width *= scaleX;
      pen.calculative.worldRect.height *= scaleY;
      pen.calculative.worldRect.ex = pen.calculative.worldRect.x + pen.calculative.worldRect.width;
      pen.calculative.worldRect.ey = pen.calculative.worldRect.y + pen.calculative.worldRect.height;
      pen.calculative.worldRect.center = {
        x: pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
        y: pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2,
      };
      this.dirtyPenRect(pen, true);
    });
    this.getSizeCPs();
    this.render(Infinity);
  }

  movePens(e: { x: number; y: number; ctrlKey?: boolean; shiftKey?: boolean }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    if (!this.initActiveRect) {
      this.initActiveRect = deepClone(this.activeRect);
      return;
    }

    let x = e.x - this.mouseDown.x;
    let y = e.y - this.mouseDown.y;
    const rect = deepClone(this.initActiveRect);
    translateRect(rect, x, y);
    this.dock = calcRectDock(rect, this.store);
    if (this.dock.xDock) {
      rect.x += this.dock.xDock.step;
    }
    if (this.dock.yDock) {
      rect.y += this.dock.yDock.step;
    }

    x = rect.x - this.activeRect.x;
    y = rect.y - this.activeRect.y;
    if (e.shiftKey) {
      x = 0;
    }
    if (e.ctrlKey) {
      y = 0;
    }
    this.translatePens(x, y, true);
  }

  moveLineAnchor(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    if (this.store.activeAnchor) {
      if (this.store.activeAnchor.connectTo) {
        disconnectLine(
          this.store.pens[this.store.activeAnchor.connectTo],
          this.store.activeAnchor.penId,
          this.store.activeAnchor.id,
          this.store.activeAnchor.anchorId
        );
      }
      this.store.activeAnchor.connectTo = undefined;
    }

    let x = e.x - this.mouseDown.x;
    let y = e.y - this.mouseDown.y;

    let offsetX = x - this.lastOffsetX;
    let offsetY = y - this.lastOffsetY;
    this.lastOffsetX = x;
    this.lastOffsetY = y;

    translatePoint(this.store.activeAnchor, offsetX, offsetY);

    if (this.store.hover && this.store.hoverAnchor && this.store.hoverAnchor.penId !== this.store.activeAnchor.penId) {
      this.store.activeAnchor.connectTo = this.store.hover.id;
      this.store.activeAnchor.anchorId = this.store.hoverAnchor.id;
      offsetX = this.store.hoverAnchor.x - this.store.activeAnchor.x;
      offsetY = this.store.hoverAnchor.y - this.store.activeAnchor.y;
      translatePoint(this.store.activeAnchor, offsetX, offsetY);

      connectLine(
        this.store.pens[this.store.activeAnchor.connectTo],
        this.store.activeAnchor.penId,
        this.store.activeAnchor.id,
        this.store.activeAnchor.anchorId
      );
    } else {
      this.dock = calcAnchorDock(e, this.store.activeAnchor, this.store.active[0], this.store);
      if (this.dock.xDock || this.dock.yDock) {
        offsetX = 0;
        offsetY = 0;
        if (this.dock.xDock) {
          offsetX = this.dock.xDock.x - this.store.activeAnchor.x;
        }
        if (this.dock.yDock) {
          offsetY = this.dock.yDock.y - this.store.activeAnchor.y;
        }
        translatePoint(this.store.activeAnchor, offsetX, offsetY);
      }
    }

    const line = this.store.active[0];
    this.dirtyLines.add(line);
    this.store.path2dMap.set(line, this.store.penPaths[line.name](line));
    this.render(Infinity);
  }

  moveLineAnchorPrev(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }
    this.store.activeAnchor.prev.x = e.x;
    this.store.activeAnchor.prev.y = e.y;
    if (this.store.activeAnchor.next) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.next.x = e.x;
        this.store.activeAnchor.next.y = e.y;
        rotatePoint(this.store.activeAnchor.next, 180, this.store.activeAnchor);
      } else if (this.store.activeAnchor.prevNextType === PrevNextType.Bilateral) {
        const rotate = calcRotate(e, this.store.activeAnchor);
        const prevRotate = calcRotate(this.prevAnchor, this.store.activeAnchor);
        this.store.activeAnchor.next.x = this.nextAnchor.x;
        this.store.activeAnchor.next.y = this.nextAnchor.y;
        rotatePoint(this.store.activeAnchor.next, rotate - prevRotate, this.store.activeAnchor);
      }
    }
    const line = this.store.active[0];
    this.dirtyLines.add(line);
    this.store.path2dMap.set(line, this.store.penPaths[line.name](line));
    this.render(Infinity);
  }

  moveLineAnchorNext(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }
    this.store.activeAnchor.next.x = e.x;
    this.store.activeAnchor.next.y = e.y;
    if (this.store.activeAnchor.prev) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.prev.x = e.x;
        this.store.activeAnchor.prev.y = e.y;
        rotatePoint(this.store.activeAnchor.prev, 180, this.store.activeAnchor);
      } else if (this.store.activeAnchor.prevNextType === PrevNextType.Bilateral) {
        const rotate = calcRotate(e, this.store.activeAnchor);
        const nextRotate = calcRotate(this.nextAnchor, this.store.activeAnchor);
        this.store.activeAnchor.prev.x = this.prevAnchor.x;
        this.store.activeAnchor.prev.y = this.prevAnchor.y;
        rotatePoint(this.store.activeAnchor.prev, rotate - nextRotate, this.store.activeAnchor);
      }
    }

    const line = this.store.active[0];
    this.dirtyLines.add(line);
    this.store.path2dMap.set(line, this.store.penPaths[line.name](line));
    this.render(Infinity);
  }

  translatePens(x: number, y: number, doing?: boolean, pens?: Pen[]) {
    if (!pens) {
      pens = this.store.active;
    }
    if (pens.length === 1 && pens[0].type && pens[0].anchors.findIndex((pt) => pt.connectTo) > -1) {
      return;
    }

    translateRect(this.activeRect, x, y);

    pens.forEach((pen) => {
      if (!pen.parentId && pen.type && pen.anchors.findIndex((pt) => pt.connectTo) > -1) {
        return;
      }

      if (pen.type) {
        translateLine(pen, x, y);
        this.dirtyLines.add(pen);
        this.store.path2dMap.set(pen, this.store.penPaths[pen.name](pen));
      } else {
        translateRect(pen.calculative.worldRect, x, y);
        calcPenRect(this.store, pen);
        pen.calculative.x = pen.x;
        pen.calculative.y = pen.y;
        this.dirtyPenRect(pen, true);
        const children = getAllChildren(this.store, pen);
        children.forEach((child) => {
          if (!child.type) {
            this.updateLines(child);
          }
        });
        this.updateLines(pen);
      }
    });
    this.getSizeCPs();

    if (!doing) {
      this.dirtyLines.forEach((pen) => {
        pen.type && this.initLineRect(pen);
      });
    }

    this.render(Infinity);
  }

  updateLines(pen: Pen, change?: boolean) {
    if (!pen.connectedLines) {
      return;
    }
    pen.connectedLines.forEach((item) => {
      const line = this.store.pens[item.lineId];
      if (!line) {
        return;
      }

      const lineAnchor = getAnchor(line, item.lineAnchor);
      if (!lineAnchor) {
        return;
      }

      const penAnchor = getAnchor(pen, item.anchor);
      if (!penAnchor) {
        return;
      }
      translatePoint(lineAnchor, penAnchor.x - lineAnchor.x, penAnchor.y - lineAnchor.y);
      this.store.path2dMap.set(line, this.store.penPaths[line.name](line));
      this.dirtyLines.add(line);

      change && getLineLength(line);
    });
  }

  calcActiveRect() {
    if (this.store.active.length === 1) {
      this.activeRect = deepClone(this.store.active[0].calculative.worldRect);
      this.activeRect.rotate = this.store.active[0].calculative.rotate || 0;
      calcCenter(this.activeRect);
    } else {
      this.activeRect = getRect(this.store.active);
      this.activeRect.rotate = 0;
    }
    this.lastRotate = 0;
    this.getSizeCPs();
  }

  rotatePen(pen: Pen, angle: number, rect: Rect) {
    if (pen.type) {
      pen.calculative.worldAnchors.forEach((anchor) => {
        rotatePoint(anchor, angle, rect.center);
      });
      this.initLineRect(pen);
    } else {
      if (pen.calculative.rotate) {
        pen.calculative.rotate += angle;
      } else {
        pen.calculative.rotate = angle;
      }
      rotatePoint(pen.calculative.worldRect.center, angle, rect.center);
      if (pen.parentId) {
        pen.calculative.worldRect.x = pen.calculative.worldRect.center.x - pen.calculative.worldRect.width / 2;
        pen.calculative.worldRect.y = pen.calculative.worldRect.center.y - pen.calculative.worldRect.height / 2;
        pen.x = (pen.calculative.worldRect.x - rect.x) / rect.width;
        pen.y = (pen.calculative.worldRect.y - rect.y) / rect.height;
      } else {
        pen.x = pen.calculative.worldRect.center.x - pen.width / 2;
        pen.y = pen.calculative.worldRect.center.y - pen.height / 2;
      }
      pen.rotate = pen.calculative.rotate;
      this.dirtyPenRect(pen);

      if (pen.children) {
        pen.children.forEach((id) => {
          const child = this.store.pens[id];
          this.rotatePen(child, angle, pen.calculative.worldRect);
        });
      }
    }
  }

  animate() {
    requestAnimationFrame(() => {
      const now = Date.now();
      if (this.animateRendering || now - this.lastAnimateRender < this.store.options.animateInterval) {
        if (this.store.animates.size > 0) {
          this.animate();
        }
        return;
      }

      this.lastAnimateRender = now;
      this.animateRendering = true;
      const dels: Pen[] = [];
      let active = false;
      for (let pen of this.store.animates) {
        if (pen.calculative.active) {
          active = true;
        }
        if (!pen.type) {
          if (setNodeAnimate(pen, now)) {
            if (pen.calculative.dirty) {
              this.dirtyPenRect(pen, true);
            }
          } else if (pen.calculative.initRect) {
            if (pen.keepAnimateState) {
              for (const k in pen) {
                if (pen.calculative[k] === undefined) {
                  continue;
                }
                if (
                  k !== 'x' &&
                  k !== 'y' &&
                  k !== 'width' &&
                  k !== 'height' &&
                  k !== 'initRect' &&
                  (typeof pen[k] !== 'object' || k === 'lineDash')
                ) {
                  pen[k] = pen.calculative[k];
                }
              }
            } else {
              for (const k in pen) {
                if (
                  k !== 'rotate' &&
                  k !== 'x' &&
                  k !== 'y' &&
                  k !== 'width' &&
                  k !== 'height' &&
                  k !== 'initRect' &&
                  (typeof pen[k] !== 'object' || k === 'lineDash')
                ) {
                  pen.calculative[k] = pen[k];
                }
              }
              pen.calculative.worldRect = pen.calculative.initRect;
            }
            this.dirtyPenRect(pen, !pen.keepAnimateState);
            if (pen.calculative.text !== pen.text) {
              pen.calculative.text = pen.text;
              calcTextLines(pen);
            }
            dels.push(pen);
            pen.calculative.initRect = undefined;
          }
          this.updateLines(pen, true);
        } else {
          if (!setLineAnimate(pen, now)) {
            if (pen.keepAnimateState) {
              for (const k in pen) {
                if (pen.calculative[k] === undefined) {
                  continue;
                }
                if (typeof pen[k] !== 'object' || k === 'lineDash') {
                  pen[k] = pen.calculative[k];
                }
              }
              calcPenRect(this.store, pen);
            } else {
              for (const k in pen) {
                if (typeof pen[k] !== 'object' || k === 'lineDash') {
                  pen.calculative[k] = pen[k];
                }
              }
            }
            dels.push(pen);
          }
        }
      }
      if (active) {
        this.calcActiveRect();
      }
      dels.forEach((pen) => {
        this.store.animates.delete(pen);
      });
      this.animateRendering = false;
      this.dirty = true;
      this.render();

      this.animate();
    });
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
        document.removeEventListener('keydown', this.onkeydown);
        document.removeEventListener('keyup', this.onkeyup);
        break;
      case KeydownType.Canvas:
        this.externalElements.removeEventListener('keydown', this.onkeydown);
        this.externalElements.removeEventListener('keyup', this.onkeyup);
        break;
    }
    window && window.removeEventListener('resize', this.onResize);
  }
}
