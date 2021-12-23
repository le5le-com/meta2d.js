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
  randomId,
  getPensLock,
  getToAnchor,
  getFromAnchor,
  calcPadding,
} from '../pen';
import {
  calcRotate,
  distance,
  hitPoint,
  Point,
  PrevNextType,
  rotatePoint,
  samePoint,
  scalePoint,
  translatePoint,
} from '../point';
import {
  calcCenter,
  calcRelativePoint,
  getRect,
  pointInRect,
  pointInSimpleRect,
  Rect,
  rectInRect,
  rectToPoints,
  resizeRect,
  translateRect,
} from '../rect';
import { EditAction, EditType, globalStore, TopologyStore } from '../store';
import { deepClone, formatPadding, isMobile, Padding, rgba, s8 } from '../utils';
import { defaultCursors, defaultDrawLineFns, HotkeyType, HoverType, MouseRight, rotatedCursors } from '../data';
import { createOffscreen } from './offscreen';
import { curve, mind, getLineLength, getLineRect, pointInLine, simplify, smoothLine, lineSegment } from '../diagrams';
import { polyline } from '../diagrams/line/polyline';
import { Tooltip } from '../tooltip';
import { Scroll } from '../scroll';

declare const window: any;

export class Canvas {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();
  magnifierScreen = createOffscreen();

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
  addCaches: Pen[];
  touchCenter?: Point;
  touches?: TouchList;

  lastOffsetX = 0;
  lastOffsetY = 0;

  drawingLineName?: string;
  drawLineFns: string[] = [...defaultDrawLineFns];
  drawingLine?: Pen;

  pencil?: boolean;
  pencilLine?: Pen;

  dirtyLines?: Set<Pen> = new Set();
  dock: { xDock: Point; yDock: Point };

  prevAnchor: Point;
  nextAnchor: Point;

  private lastMouseTime = 0;
  // 即将取消活动状态的画笔，用于Ctrl选中/取消选中画笔
  private willInactivePen: Pen;

  dirty = false;
  lastRender = 0;
  touchStart = 0;
  timer: any;

  private lastAnimateRender = 0;
  animateRendering = false;
  renderTimer: any;

  updatingPens?: boolean;
  initPens?: Pen[];

  pointSize = 8;
  pasteOffset = 10;

  beforeAddPen: (pen: Pen) => boolean;
  beforeAddAnchor: (pen: Pen, anchor: Point) => boolean;
  beforeRemovePen: (pen: Pen) => boolean;
  beforeRemoveAnchor: (pen: Pen, anchor: Point) => boolean;

  customeDock: Function;

  inputParent = document.createElement('div');
  input = document.createElement('textarea');
  inputRight = document.createElement('div');
  dropdown = document.createElement('ul');

  tooltip: Tooltip;
  magnifier: boolean;
  mousePos: Point = { x: 0, y: 0 };
  magnifierSize = 300;

  private alreadyCopy = false;

  scroll: Scroll;

  constructor(public parent: any, public parentElement: HTMLElement, public store: TopologyStore) {
    parentElement.appendChild(this.canvas);
    this.canvas.style.background = '#f4f4f4';

    this.externalElements.style.position = 'absolute';
    this.externalElements.style.left = '0';
    this.externalElements.style.top = '0';
    this.externalElements.style.outline = 'none';
    this.externalElements.style.background = 'transparent';
    parentElement.style.position = 'relative';
    parentElement.appendChild(this.externalElements);
    this.createInput();
    this.magnifierScreen.width = this.magnifierSize + 5;
    this.magnifierScreen.height = this.magnifierSize + 5;

    this.tooltip = new Tooltip(parentElement);
    if (this.store.options.scroll) {
      this.scroll = new Scroll(this);
    }

    this.store.dpiRatio = window ? window.devicePixelRatio : 1;

    if (this.store.dpiRatio < 1) {
      this.store.dpiRatio = 1;
    } else if (this.store.dpiRatio > 1 && this.store.dpiRatio < 1.5) {
      this.store.dpiRatio = 1.5;
    }

    this.bounding = this.externalElements.getBoundingClientRect();
    this.listen();

    this['curve'] = curve;
    this['polyline'] = polyline;
    this['mind'] = mind;
    this['line'] = lineSegment;

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
        !(e.target as HTMLElement).dataset.l &&
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
          button: e.button,
        });
      };
    }

    this.externalElements.ondblclick = this.ondblclick;
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
    if (e.target !== this.externalElements) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (this.store.options.scroll && !e.ctrlKey && this.scroll) {
      this.scroll.wheel(e.deltaY < 0);
      return;
    }

    if (this.store.options.disableScale) {
      return;
    }
    if (this.store.data.locked === LockState.Disable) return;
    const isTouchPad = e.wheelDeltaY ? e.wheelDeltaY === -3 * e.deltaY : e.deltaMode === 0;
    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }

    this.touchStart = now;

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
      this.store.data.locked >= LockState.DisableMove ||
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
          this.toggleAnchorHand();
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
          this.active(this.store.data.pens.filter((pen) => !pen.parentId));
          e.preventDefault();
        } else {
          this.toggleAnchorMode();
        }
        break;
      case 'Delete':
      case 'Backspace':
        !this.store.data.locked && this.delete();
        break;
      case 'ArrowLeft':
        x = -10;
        if (e.shiftKey) {
          x = -5;
        }
        if (e.ctrlKey) {
          x = -1;
        }
        this.translatePens(this.store.active, x, 0);
        break;
      case 'ArrowUp':
        y = -10;
        if (e.shiftKey) {
          y = -5;
        }
        if (e.ctrlKey) {
          y = -1;
        }
        this.translatePens(this.store.active, 0, y);
        break;
      case 'ArrowRight':
        if (e.shiftKey) {
          x = 5;
        }
        if (e.ctrlKey) {
          x = 1;
        }
        this.translatePens(this.store.active, x, 0);
        break;
      case 'ArrowDown':
        if (e.shiftKey) {
          y = 5;
        }
        if (e.ctrlKey) {
          y = 1;
        }
        this.translatePens(this.store.active, 0, y);
        break;
      case 'x':
      case 'X':
        if (e.ctrlKey || e.metaKey) {
          this.cut();
        }
        break;
      case 'c':
      case 'C':
        if (e.ctrlKey || e.metaKey) {
          this.copy();
        }
        break;
      case 'd':
      case 'D':
        this.removeAnchorHand();
        break;
      case 'h':
      case 'H':
        this.addAnchorHand();
        break;
      case 'm':
      case 'M':
        this.toggleMagnifier();
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          this.paste();
        } else {
          this.drawingLineName = this.drawingLineName ? '' : 'curve';
        }
        break;
      case 'b':
      case 'B':
        this.pencil = true;
        this.externalElements.style.cursor = 'crosshair';
        break;
      case 'y':
      case 'Y':
        if (e.ctrlKey || e.metaKey) {
          this.redo();
        }
        break;
      case 'z':
      case 'Z':
        if (e.ctrlKey || e.metaKey) {
          this.undo();
        } else if (e.shiftKey) {
          this.redo();
        }
        break;
      case 'Enter':
        if (this.drawingLineName) {
          this.finishDrawline();
          this.drawingLineName = this.store.options.drawingLineName;
        } else if (this.store.active) {
          this.store.active.forEach((pen) => {
            if (pen.type) {
              pen.close = !pen.close;
              this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
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
        this.pencil = undefined;
        this.pencilLine = undefined;
        this.hotkeyType = HotkeyType.None;
        this.externalElements.style.cursor = 'default';
        if (this.magnifier) {
          this.magnifier = false;
          this.render(Infinity);
        }
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
      const pt = { x: event.offsetX, y: event.offsetY };
      this.calibrateMouse(pt);
<<<<<<< HEAD
      for (const pen of obj) {
<<<<<<< HEAD
        // 只修改 树根处的 祖先节点
        !pen.parentId && Array.isArray(pen.children) && pen.children.length > 0 && this.randomCombineId(pen, obj);
=======
        // 组合修改 id
        Array.isArray(pen.children) && pen.children.length > 0 && this.randomCombineId(pen, obj);
>>>>>>> 27370d1 (onwheel)
      }
      for (const pen of obj) {
        if (!pen.id) {
          pen.id = s8();
        }
        !pen.calculative && (pen.calculative = { canvas: this });
        this.store.pens[pen.id] = pen;
      }
      // 计算区域
      for (const pen of obj) {
        // 组合节点才需要提前计算
        (Array.isArray(pen.children) && pen.children.length > 0) && this.dirtyPenRect(pen);
      }
      for (const pen of obj) {
        if (!pen.parentId) {
          pen.width *= this.store.data.scale;
          pen.height *= this.store.data.scale;
          pen.x = pt.x - pen.width / 2;
          pen.y = pt.y - pen.height / 2;
        }
      }
      this.addPens(obj);
<<<<<<< HEAD
      this.active(obj.filter(pen => !pen.parentId));
      this.render();
=======
      this.active(obj.filter((pen) => !pen.parentId));
>>>>>>> 27370d1 (onwheel)
=======
      this.dropPens(obj, pt);
>>>>>>> 7750889 (drop 和 click 抽取一个方法出来使用)
    } catch {}
  };

  dropPens(pens: Pen[], e: Point) {
    for (const pen of pens) {
      // 只修改 树根处的 祖先节点
      !pen.parentId && Array.isArray(pen.children) && pen.children.length > 0 && this.randomCombineId(pen, pens);
    }
    for (const pen of pens) {
      if (!pen.id) {
        pen.id = s8();
      }
      !pen.calculative && (pen.calculative = { canvas: this });
      this.store.pens[pen.id] = pen;
    }
    // 计算区域
    for (const pen of pens) {
      // 组合节点才需要提前计算
      Array.isArray(pen.children) && pen.children.length > 0 && this.dirtyPenRect(pen);
    }
    for (const pen of pens) {
      if (!pen.parentId) {
        pen.width *= this.store.data.scale;
        pen.height *= this.store.data.scale;
        pen.x = e.x - pen.width / 2;
        pen.y = e.y - pen.height / 2;
      }
    }
    this.addPens(pens);
    this.active(pens.filter((pen) => !pen.parentId));
    this.render();
  }

  randomCombineId(pen: Pen, pens: Pen[], parentId?: string) {
    randomId(pen);
    pen.parentId = parentId;
    const newChildren = [];
    if (Array.isArray(pen.children)) {
      for (const childId of pen.children) {
        const childPen = pens.find((pen) => pen.id === childId);
        childPen && newChildren.push(this.randomCombineId(childPen, pens, pen.id).id);
      }
    }
    pen.children = newChildren;
    return pen;
  }

  addPens(pens: Pen[], history?: boolean) {
    const list: Pen[] = [];
    for (let pen of pens) {
      if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
        continue;
      }
      this.makePen(pen);
      list.push(pen);
    }
    this.render(Infinity);
    this.store.emitter.emit('add', list);
    if (history) {
      this.pushHistory({ type: EditType.Add, pens: list });
    }
    return list;
  }

  ontouchstart = (e: any) => {
    this.touchStart = performance.now();
    const x = e.changedTouches[0].pageX - (window ? window.scrollX : 0);
    const y = e.changedTouches[0].pageY - (window ? window.scrollY : 0);

    if (e.touches.length > 1) {
      this.touches = e.touches;
      return;
    }

    !(e.target as HTMLElement).dataset.l &&
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

    const touches = event.touches;
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

    const x = event.touches[0].pageX - (window ? window.scrollX : 0);
    const y = event.touches[0].pageY - (window ? window.scrollY : 0);
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
    this.touchCenter = undefined;

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
    this.hideInput();
    if (this.store.data.locked === LockState.Disable || (e.buttons !== 1 && e.buttons !== 2)) {
      this.hoverType = HoverType.None;
      return;
    }

    if (this.magnifier) {
      return;
    }

    if (e.buttons === 2 && !this.drawingLine) {
      this.mouseRight = MouseRight.TranslateOrContextMenu;
    }

    e.x -= this.bounding.left || this.bounding.x;
    e.y -= this.bounding.top || this.bounding.y;
    this.calibrateMouse(e);
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;

    this.mouseDown = e;
    this.lastMouseTime = performance.now();

    // Set anchor of pen.
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      this.setAnchor(e);
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
      if (
        e.buttons === 2 ||
        (this.drawingLineName === 'mind' && this.drawingLine?.calculative.worldAnchors.length > 1)
      ) {
        this.finishDrawline(true);
        this.drawingLineName = this.store.options.drawingLineName;
        return;
      }

      if (this.hoverType === HoverType.Node) {
        let newline = false;
        if (this.store.options.autoAnchor) {
          if (!this.drawingLine) {
            this.drawingLine = {
              id: s8(),
              name: 'line',
              lineName: this.drawingLineName,
              x: pt.x,
              y: pt.y,
              type: PenType.Line,
              calculative: {
                canvas: this,
                active: true,
                worldAnchors: [pt],
                lineWidth: this.store.data.lineWidth || 1,
              },
              fromArrow: this.store.data.fromArrow || this.store.options.fromArrow,
              toArrow: this.store.data.toArrow || this.store.options.toArrow,
              lineWidth: this.store.data.lineWidth || 1,
            };
            newline = true;
          }
          this.store.hoverAnchor = nearestAnchor(this.store.hover, this.drawingLine.calculative.worldAnchors[0]);
          this.drawingLine.autoTo = true;
          pt.connectTo = this.store.hover.id;
          pt.anchorId = this.store.hoverAnchor.id;
          connectLine(this.store.pens[this.store.hover.id], this.drawingLine.id, pt.id, this.store.hoverAnchor.id);
        }

        if (!newline && this.store.hoverAnchor) {
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
          this.drawingLine.calculative.activeAnchor =
            this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 2];
          to.hidden = undefined;
        } else {
          this.drawingLine.calculative.activeAnchor = to;
          this.drawingLine.calculative.worldAnchors.push({
            x: to.x,
            y: to.y,
            penId: to.penId,
          });
        }

        this.drawingLine.calculative.drawlineH = undefined;
        this.drawline();
      } else {
        const id = s8();
        pt.penId = id;
        this.drawingLine = {
          id,
          name: 'line',
          lineName: this.drawingLineName,
          x: pt.x,
          y: pt.y,
          type: PenType.Line,
          calculative: {
            canvas: this,
            active: true,
            worldAnchors: [pt],
            lineWidth: this.store.data.lineWidth || 1,
          },
          fromArrow: this.store.data.fromArrow || this.store.options.fromArrow,
          toArrow: this.store.data.toArrow || this.store.options.toArrow,
          lineWidth: this.store.data.lineWidth || 1,
        };
        this.drawingLine.calculative.activeAnchor = pt;
        this.drawline();
        if (pt.connectTo) {
          connectLine(this.store.pens[pt.connectTo], this.drawingLine.id, pt.id, pt.anchorId);
        }
      }
    } else if (this.pencil) {
      this.inactive(true);
      const id = s8();
      const pt: Point = { x: e.x, y: e.y, id: s8(), penId: id };
      this.pencilLine = {
        id,
        name: 'line',
        x: pt.x,
        y: pt.y,
        type: PenType.Line,
        calculative: {
          canvas: this,
          pencil: true,
          active: true,
          worldAnchors: [pt],
          lineWidth: this.store.data.lineWidth || 1,
        },
        lineWidth: this.store.data.lineWidth || 1,
      };
    } else {
      switch (this.hoverType) {
        case HoverType.None:
          this.inactive();
          break;
        case HoverType.Node:
          if (this.store.hover) {
            const pen = getParent(this.store.hover, true) || this.store.hover;
            if (e.ctrlKey) {
              if (pen.calculative.active) {
                this.willInactivePen = pen;
              } else {
                pen.calculative.active = true;
                this.store.active.push(pen);
                this.store.emitter.emit('active', this.store.active);
              }
              this.dirty = true;
            } else if (
              this.store.hover.parentId &&
              (!this.store.hover.locked || this.store.hover.locked < LockState.DisableMove)
            ) {
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
            const pen = getParent(this.store.hover, true) || this.store.hover;
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

    this.store.emitter.emit('mousedown', {
      x: e.x,
      y: e.y,
      pen: this.store.hover,
    });

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
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
    if (this.magnifier) {
      this.render(Infinity);
      return;
    }

    if (this.drawingLine) {
      const pt: Point = { ...e };
      pt.id = s8();
      pt.penId = this.drawingLine.id;
      if (
        this.mouseDown &&
        this.drawingLineName === 'curve' &&
        !this.drawingLine.calculative.worldAnchors[0].connectTo
      ) {
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
          to.connectTo = undefined;
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
    } else if (this.pencil) {
      if (!this.mouseDown) {
        return;
      }

      const pt: Point = { ...e };
      pt.id = s8();
      pt.penId = this.pencilLine.id;
      this.pencilLine.calculative.worldAnchors.push(pt);
      this.store.path2dMap.set(this.pencilLine, globalStore.path2dDraws[this.pencilLine.name](this.pencilLine));
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
      if (
        this.store.data.locked === LockState.DisableEdit ||
        (e.ctrlKey && !this.hoverType) ||
        this.hotkeyType === HotkeyType.Translate ||
        this.mouseRight === MouseRight.Translate
      ) {
        if (
          this.translateX &&
          this.translateY &&
          (!this.store.data.locked ||
            this.mouseRight === MouseRight.Translate ||
            this.store.data.locked < LockState.DisableMove)
        ) {
          const { scale } = this.store.data;
          this.translate((e.x - this.translateX) / scale, (e.y - this.translateY) / scale);
          return false;
        }
      }

      // Rotate
      if (this.hoverType === HoverType.Rotate) {
        this.rotatePens({ x: e.x, y: e.y });
        return;
      }

      // Resize
      if (this.hoverType === HoverType.Resize) {
        this.resizePens(e);
        return;
      }

      // Move
      if (this.hoverType === HoverType.Node || this.hoverType === HoverType.Line) {
        this.store.hover?.onMouseMove && this.store.hover.onMouseMove(this.store.hover, this.mousePos);

        // TODO: 选中状态 ctrl 点击会失去焦点，不会执行到这里的复制操作
<<<<<<< HEAD
        if (e.ctrlKey && !this.alreadyCopy) {
=======
        if(!this.store.data.locked && e.ctrlKey && !this.alreadyCopy) {
>>>>>>> f36b9f0 (节点与画布的 locked 控制)
          this.alreadyCopy = true;
          this.willInactivePen = undefined;
          this.copy();
          this.paste();
          return;
        }
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

      if (!this.dragRect) {
        return;
      }
    }

    window && window.debug && console.time('hover');
    this.willGetHover(e);
    window && window.debug && console.timeEnd('hover');
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      this.dirty = true;
    }
    this.render();
  };

  private hoverTimer: any;
  willGetHover(e: any) {
    this.hoverTimer && clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.getHover(e);
      this.render();
      this.hoverTimer = undefined;
    }, 10);
  }

  onMouseUp = (e: {
    x: number;
    y: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    button?: number;
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
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
    this.pencil && this.finishPencil();

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

    if (this.drawingLine && this.hoverType === HoverType.Node) {
      if (this.store.options.autoAnchor) {
        this.store.hoverAnchor = nearestAnchor(this.store.hover, this.drawingLine.calculative.worldAnchors[0]);
        this.drawingLine.autoTo = true;
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

    if (
      this.mouseDown &&
      this.hoverType === HoverType.LineAnchor &&
      this.store.hover &&
      this.store.active[0] !== this.store.hover
    ) {
      const line = this.store.active[0];
      const from = getFromAnchor(line);
      const to = getToAnchor(line);
      if (this.store.hoverAnchor) {
        if (from === this.store.activeAnchor) {
          line.autoFrom = undefined;
        } else {
          line.autoTo = undefined;
        }
        this.store.activeAnchor.x = this.store.hoverAnchor.x;
        this.store.activeAnchor.y = this.store.hoverAnchor.y;
        this.store.activeAnchor.prev = undefined;
        this.store.activeAnchor.next = undefined;
        this.store.activeAnchor.connectTo = this.store.hover.id;
        this.store.hover.connectedLines.push({
          lineId: line.id,
          lineAnchor: this.store.activeAnchor.id,
          anchor: this.store.hover.id,
        });
        if (this[line.lineName]) {
          this[line.lineName](this.store, line);
        }
        this.store.path2dMap.set(line, globalStore.path2dDraws.line(line));
        this.initLineRect(line);
      } else {
        if (from === this.store.activeAnchor && line.autoFrom) {
          this.calcAutoAnchor(line, from, this.store.hover);
        } else if (to === this.store.activeAnchor && line.autoTo) {
          this.calcAutoAnchor(line, to, this.store.hover);
        }
      }
    }

    // Add pen
    if (this.addCaches) {
      this.dropPens(this.addCaches, e);
      this.addCaches = undefined;
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
          pen.visible != false &&
          pen.locked !== LockState.Disable &&
          !pen.parentId &&
          rectInRect(pen.calculative.worldRect, this.dragRect, this.store.options.dragAllIn)
        );
      });
      this.active(pens);
    }

    if (e.button !== 2 && this.mouseDown) {
      if (distance(this.mouseDown, e) < 2) {
        if (this.store.hover && this.store.hover.input) {
          this.showInput(this.store.hover);
        }
        this.store.emitter.emit('click', {
          x: e.x,
          y: e.y,
          pen: this.store.hover,
        });
      }

      if (this.store.hover) {
        this.store.emitter.emit('mouseup', {
          x: e.x,
          y: e.y,
          pen: this.store.hover,
        });
      }
    }

    if (this.willInactivePen) {
      this.willInactivePen.calculative.active = undefined;
      this.store.active.splice(
        this.store.active.findIndex((p) => p === this.willInactivePen),
        1
      );
      this.calcActiveRect();
      this.willInactivePen = undefined;
      this.store.emitter.emit('inactive', [this.willInactivePen]);
      this.render(Infinity);
    }

    this.mouseDown = undefined;
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;
    this.dock = undefined;
    this.dragRect = undefined;
    this.initActiveRect = undefined;
    this.updatingPens = undefined;
    this.alreadyCopy = false;
  };

  inactive(drawing?: boolean) {
    if (!this.store.active.length) {
      return;
    }
    this.store.active.forEach((pen) => {
      pen.calculative.active = undefined;
      pen.calculative.activeAnchor = undefined;
      setChildrenActive(pen, false);
    });
    !drawing && this.store.emitter.emit('inactive', this.store.active);
    this.store.active = [];
    this.activeRect = undefined;
    this.sizeCPs = undefined;
    this.store.activeAnchor = undefined;
    this.dirty = true;
  }

  active(pens: Pen[], emit = true) {
    if (this.store.active) {
      for (const pen of this.store.active) {
        pen.calculative.active = undefined;
        setChildrenActive(pen, false);
      }
    }
    this.store.active = [];
    pens.forEach((pen) => {
      pen.calculative.active = true;
      setChildrenActive(pen);
    });
    this.store.active.push(...pens);
    this.calcActiveRect();
    this.dirty = true;
    emit && this.store.emitter.emit('active', this.store.active);
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
      this.resize();
      this.timer = undefined;
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
      const activePensLock = getPensLock(this.store.active);
      if (!this.store.options.disableRotate && !activePensLock) {
        const rotatePt = {
          x: this.activeRect.center.x,
          y: this.activeRect.y - 30,
        };
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
          if (activePensLock) break;
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
      if (this.drawingLineName || this.pencil) {
        this.externalElements.style.cursor = 'crosshair';
      } else if (!this.mouseDown) {
        this.externalElements.style.cursor = 'default';
      }
      this.store.hover = undefined;
    }

    if (this.store.lastHover !== this.store.hover) {
      this.dirty = true;
      if (this.store.lastHover) {
        setHover(getParent(this.store.lastHover, true) || this.store.lastHover, false);
        this.store.emitter.emit('leave', this.store.lastHover);
        this.tooltip.hide();
      }
      if (this.store.hover) {
        this.store.hover.calculative.hover = true;
        setHover(getParent(this.store.hover, true) || this.store.hover);
        this.store.emitter.emit('enter', this.store.hover);
        this.tooltip.show(this.store.hover, pt);
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
      if (
        !pen.calculative.active &&
        !pointInSimpleRect(pt, pen.calculative.worldRect, r) &&
        !pointInRect(pt, pen.calculative.worldRect)
      ) {
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

  addPen(pen: Pen, history?: boolean) {
    if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
      return;
    }

    this.makePen(pen);
    this.active([pen]);
    this.render();
    this.store.emitter.emit('add', [pen]);

    if (history) {
      this.pushHistory({ type: EditType.Add, pens: [pen] });
    }

    return pen;
  }

  pushHistory(action: EditAction) {
    if (this.store.data.locked) {
      return;
    }

    if (action.type !== EditType.Update && action.pens) {
      action.pens.forEach((pen) => {
        pen.calculative.layer = this.store.data.pens.findIndex((p) => p === pen);
      });
    }

    if (this.store.historyIndex < this.store.histories.length - 1) {
      this.store.histories.splice(
        this.store.historyIndex + 1,
        this.store.histories.length - this.store.historyIndex - 1
      );
    }
    this.store.histories.push(action);
    this.store.historyIndex = this.store.histories.length - 1;
  }

  undo() {
    if (this.store.data.locked || this.store.historyIndex == null || this.store.historyIndex < 0) {
      return;
    }

    const action = this.store.histories[this.store.historyIndex--];
    this.doEditAction(action, true);
  }

  redo() {
    if (
      this.store.data.locked ||
      this.store.historyIndex == null ||
      this.store.historyIndex > this.store.histories.length - 2
    ) {
      return;
    }

    const action = this.store.histories[++this.store.historyIndex];
    this.doEditAction(action, false);
  }

  doEditAction(action: EditAction, undo: boolean) {
    this.inactive();
    this.store.hoverAnchor = undefined;
    this.store.hover = undefined;

    switch (action.type) {
      case EditType.Add:
        action.pens.forEach((pen) => {
          const i = this.store.data.pens.findIndex((item) => item.id === pen.id);
          if (i > -1) {
            this.store.data.pens.splice(i, 1);
          }
        });
        action.type = EditType.Delete;
        break;
      case EditType.Update:
        const pens = undo ? action.initPens : action.pens;
        pens.forEach((pen) => {
          const i = this.store.data.pens.findIndex((item) => item.id === pen.id);
          if (i > -1) {
            Object.assign(this.store.data.pens[i], pen);
            pen = this.store.data.pens[i];
            this.store.pens[pen.id] = pen;
            for (const k in pen) {
              if (typeof pen[k] !== 'object' || k === 'lineDash') {
                pen.calculative[k] = pen[k];
              }
            }
            pen.calculative.image = undefined;
            this.dirtyPenRect(pen);
            this.updateLines(pen, true);
          }
        });
        break;
      case EditType.Delete:
        action.pens.forEach((pen) => {
          this.store.data.pens.splice(pen.calculative.layer, 0, pen);
        });
        action.type = EditType.Add;
        break;
    }
    this.render(Infinity);

    this.store.emitter.emit(undo ? 'undo' : 'redo', action);
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

    if (!pen.lineWidth) {
      pen.lineWidth = 1;
    }
    if (!pen.fontSize) {
      pen.fontSize = 12;
    }
    if (!pen.lineHeight) {
      pen.lineHeight = 1.5;
    }
    pen.calculative = { canvas: this };
    if (pen.video || pen.audio) {
      pen.calculative.onended = (pen: Pen) => {
        this.nextAnimate(pen);
      };
    }
    for (const k in pen) {
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.calculative[k] = pen[k];
      }
    }
    pen.calculative.image = undefined;
    pen.calculative.backgroundImage = undefined;
    pen.calculative.strokeImage = undefined;
    if (!pen.anchors && globalStore.anchors[pen.name]) {
      if (!pen.anchors) {
        pen.anchors = [];
      }
      globalStore.anchors[pen.name](pen);
    }

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
    this.store.path2dMap.set(this.drawingLine, globalStore.path2dDraws.line(this.drawingLine));
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
    if (!pen.fontSize) {
      pen.fontSize = 12;
      pen.calculative.fontSize = pen.fontSize * this.store.data.scale;
    }
    if (!pen.lineHeight) {
      pen.lineHeight = 1.5;
      pen.calculative.lineHeight = pen.lineHeight;
    }
    calcCenter(rect);
    pen.calculative.worldRect = rect;
    calcPadding(pen, rect);
    calcTextRect(pen);
    this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
    if (pen.calculative.worldAnchors) {
      pen.anchors = [];
      pen.calculative.worldAnchors.forEach((pt) => {
        pen.anchors.push(calcRelativePoint(pt, pen.calculative.worldRect));
      });
    }
  }

  finishDrawline(end?: boolean) {
    if (!this.drawingLine) {
      return;
    }

    const from = this.drawingLine.calculative.worldAnchors[0];
    const to = this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
    !end && !to.connectTo && this.drawingLine.calculative.worldAnchors.pop();
    if (!end) {
      if (this.drawingLine.calculative.worldAnchors[0] === this.drawingLine.calculative.activeAnchor) {
        this.drawingLine = undefined;
        this.render(Infinity);
        return;
      }
    }
    if (!from.connectTo || !to.connectTo) {
      if (this.store.options.disableEmptyLine) {
        // 两边都没连上锚点，且 禁止创建空线条
        this.drawingLine = undefined;
        this.render(Infinity);
        return;
      }
    } else {
      if (this.store.options.disableRepeatLine) {
        // 两边都连上了锚点，且 禁止创建重复连线
        const line = this.store.data.pens.find((pen) => {
          if (pen.type) {
            const penFrom = pen.calculative.worldAnchors[0];
            const penTo = pen.calculative.worldAnchors[pen.calculative.worldAnchors.length - 1];
            return samePoint(penFrom, from) && samePoint(penTo, to);
          }
        });
        if (line) {
          // 存在重复连线
          this.drawingLine = undefined;
          this.render(Infinity);
          return;
        }
      }
    }
    const rect = getLineRect(this.drawingLine);
    this.drawingLine.x = rect.x;
    this.drawingLine.y = rect.y;
    this.drawingLine.width = rect.width;
    this.drawingLine.height = rect.height;
    this.drawingLine.calculative.worldRect = rect;
    this.drawingLine.calculative.activeAnchor =
      this.drawingLine.calculative.worldAnchors[this.drawingLine.calculative.worldAnchors.length - 1];
    this.store.activeAnchor = this.drawingLine.calculative.activeAnchor;
    if (!this.beforeAddPen || this.beforeAddPen(this.drawingLine)) {
      this.initLineRect(this.drawingLine);
      this.store.data.pens.push(this.drawingLine);
      this.store.pens[this.drawingLine.id] = this.drawingLine;
      this.store.emitter.emit('add', [this.drawingLine]);
      this.active([this.drawingLine]);
      this.pushHistory({ type: EditType.Add, pens: [this.drawingLine] });
    }

    this.store.path2dMap.set(this.drawingLine, globalStore.path2dDraws[this.drawingLine.name](this.drawingLine));
    this.render(Infinity);
    this.drawingLine = undefined;
    this.drawingLineName = undefined;
  }

  finishPencil() {
    if (this.pencilLine) {
      let anchors: Point[] = simplify(
        this.pencilLine.calculative.worldAnchors,
        10,
        0,
        this.pencilLine.calculative.worldAnchors.length - 1
      );
      let p = this.pencilLine.calculative.worldAnchors[0];
      anchors.unshift({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      p = this.pencilLine.calculative.worldAnchors[this.pencilLine.calculative.worldAnchors.length - 1];
      anchors.push({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      this.pencilLine.calculative.worldAnchors = smoothLine(anchors);
      if (this.pencilLine.calculative.worldAnchors.length > 1) {
        this.pencilLine.calculative.pencil = undefined;
        this.store.path2dMap.set(this.pencilLine, globalStore.path2dDraws[this.pencilLine.name](this.pencilLine));
        if (!this.beforeAddPen || this.beforeAddPen(this.pencilLine)) {
          this.initLineRect(this.pencilLine);
          this.store.data.pens.push(this.pencilLine);
          this.store.pens[this.pencilLine.id] = this.pencilLine;
          this.store.emitter.emit('add', [this.pencilLine]);
          this.active([this.pencilLine]);
          this.pushHistory({ type: EditType.Add, pens: [this.pencilLine] });
        }
        this.render(Infinity);
      }
      this.pencilLine = undefined;
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
            this.imageLoaded();
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
            this.imageLoaded();
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
            this.imageLoaded();
          };
        }
      }
      pen.calculative.strokeImage = pen.strokeImage;
    }
  }
  private imageTimer: any;
  // 避免初始化图片加载重复调用 render，此处防抖
  imageLoaded() {
    this.imageTimer && clearTimeout(this.imageTimer);
    this.imageTimer = setTimeout(() => {
      this.render();
    }, 100);
  }

  dirtyPenRect(pen: Pen, worldRectIsReady?: boolean, playingAnimate?: boolean) {
    if (worldRectIsReady) {
      calcPenRect(pen);
    } else {
      calcWorldRects(pen);
    }
    const scale = this.store.data.scale;
    if (!playingAnimate) {
      pen.calculative.lineWidth = pen.lineWidth * scale;
      pen.calculative.fontSize = pen.fontSize * scale;
      pen.calculative.iconSize = pen.iconSize * scale;
      pen.calculative.iconWidth = pen.iconWidth * scale;
      pen.calculative.iconHeight = pen.iconHeight * scale;
      pen.calculative.iconLeft = pen.iconLeft * scale;
      pen.calculative.iconTop = pen.iconTop * scale;
      pen.calculative.textWidth = pen.textWidth * scale;
      pen.calculative.textHeight = pen.textHeight * scale;
      pen.calculative.textLeft = pen.textLeft * scale;
      pen.calculative.textTop = pen.textTop * scale;

      if (pen.type === PenType.Line && pen.borderWidth) {
        pen.calculative.borderWidth = pen.borderWidth * scale;
      }
    }

    calcWorldAnchors(pen);
    calcIconRect(this.store.pens, pen);
    calcTextRect(pen);
    globalStore.path2dDraws[pen.name] && this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
    pen.calculative.dirty = true;
    this.dirty = true;

    if (pen.children) {
      pen.children.forEach((id) => {
        const child: Pen = this.store.pens[id];
        child && this.dirtyPenRect(child);
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
      if (this.renderTimer) {
        cancelAnimationFrame(this.renderTimer);
      }
      this.renderTimer = requestAnimationFrame(this.render);

      return;
    }
    this.renderTimer = undefined;
    this.lastRender = now;
    const offscreenCtx = this.offscreen.getContext('2d');
    offscreenCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    if (this.store.data.background) {
      offscreenCtx.save();
      offscreenCtx.fillStyle = this.store.data.background;
      offscreenCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      offscreenCtx.restore();
    }
    this.renderGrid();
    offscreenCtx.save();
    offscreenCtx.translate(this.store.data.x, this.store.data.y);
    window && window.debugRender && console.time('renderPens');
    this.renderPens();
    window && window.debugRender && console.timeEnd('renderPens');
    this.renderBorder();
    this.renderHoverPoint();
    offscreenCtx.restore();

    this.renderMagnifier();

    this.renderRule();

    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);

    this.dirty = false;
  };

  renderPens = () => {
    const ctx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;
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

    for (const pen of this.store.data.pens) {
      if (pen.visible == false || pen.calculative.visible == false) {
        pen.calculative.inView = false;
        continue;
      }

      const x = pen.calculative.worldRect.x + this.store.data.x;
      const y = pen.calculative.worldRect.y + this.store.data.y;
      const penRect: Rect = {
        x,
        y,
        ex: x + pen.calculative.worldRect.width,
        ey: y + pen.calculative.worldRect.height,
        rotate: pen.calculative.worldRect.rotate,
        center: pen.calculative.worldRect.center,
      };
      if (!rectInRect(penRect, canvasRect)) {
        pen.calculative.inView = false;
        continue;
      }
      pen.calculative.inView = true;
      renderPen(ctx, pen);
    }

    if (this.drawingLine) {
      renderPen(ctx, this.drawingLine);
    }
    if (this.pencilLine) {
      renderPen(ctx, this.pencilLine);
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
        if (getPensLock(this.store.active)) {
          ctx.restore();
          return;
        }
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
      if (!getPensLock(this.store.active)) {
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
    }

    if (!this.store.data.locked && this.dragRect) {
      ctx.save();
      ctx.fillStyle = rgba(this.store.options.dragColor, 0.2);
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

  translate(x: number, y: number) {
    this.store.data.x += x * this.store.data.scale;
    this.store.data.y += y * this.store.data.scale;
    this.store.data.x = Math.round(this.store.data.x);
    this.store.data.y = Math.round(this.store.data.y);
    this.render(Infinity);
    this.store.emitter.emit('translate', {
      x: this.store.data.x,
      y: this.store.data.y,
    });
    this.tooltip.translate(x, y);
    if (this.scroll && this.scroll.isShow) {
      this.scroll.translate(x, y);
    }
    // 有移动操作的 画笔 需要执行移动
    for (const pen of this.store.data.pens) {
      pen.onMove && pen.onMove(pen);
    }
  }

  scale(scale: number, center = { x: 0, y: 0 }) {
    if (scale < this.store.options.minScale || scale > this.store.options.maxScale) {
      return;
    }

    this.calibrateMouse(center);
    this.dirty = true;
    const s = scale / this.store.data.scale;
    this.store.data.scale = scale;
    this.store.data.center = center;

    scalePoint(this.store.data.origin, s, center);
    this.store.data.pens.forEach((pen) => {
      if (pen.parentId) {
        return;
      }
      scalePen(pen, s, center);
      this.dirtyPenRect(pen, true);
      pen.onResize && pen.onResize(pen);
    });
    this.calcActiveRect();

    this.render(Infinity);
    this.store.emitter.emit('scale', this.store.data.scale);
  }

  rotatePens(e: Point) {
    if (!this.initPens) {
      this.initPens = [];
      for (let pen of this.store.active) {
        this.initPens.push(deepClone(pen));
      }
    }

    this.activeRect.rotate = calcRotate(e, this.activeRect.center);
    if (this.store.active.length === 1) {
      this.lastRotate = this.store.active[0].rotate || 0;
    }
    const angle = this.activeRect.rotate - this.lastRotate;
    for (let pen of this.store.active) {
      if (pen.parentId) {
        return;
      }
      this.rotatePen(pen, angle, this.activeRect);
      pen.onRotate && pen.onRotate(pen);
    }
    this.lastRotate = this.activeRect.rotate;
    this.getSizeCPs();
    this.render(Infinity);
    this.store.emitter.emit('rotatePens', this.store.active);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const pens = this.store.active;
      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  resizePens(e: Point) {
    if (!this.initPens) {
      this.initPens = [];
      for (let pen of this.store.active) {
        this.initPens.push(deepClone(pen));
      }
    }

    if (!this.initActiveRect) {
      this.initActiveRect = deepClone(this.activeRect);
      return;
    }

    const p1 = { x: this.mouseDown.x, y: this.mouseDown.y };
    const p2 = { x: e.x, y: e.y };
    // rotatePoint(p1, -this.activeRect.rotate, this.activeRect.center);
    // rotatePoint(p2, -this.activeRect.rotate, this.activeRect.center);

    let x = p2.x - p1.x;
    let y = p2.y - p1.y;

    const rect = deepClone(this.initActiveRect);
    // 得到最准确的 rect 即 resize 后的
    resizeRect(rect, x, y, this.resizeIndex);
    calcCenter(rect);
    if (this.customeDock) {
      this.dock = this.customeDock(this.store, rect);
    } else {
      this.dock = calcRectDock(this.store, rect);
    }
    if (this.dock.xDock) {
      x += this.dock.xDock.step;
    }
    if (this.dock.yDock) {
      y += this.dock.yDock.step;
    }

    const w = this.activeRect.width;
    const h = this.activeRect.height;
    let offsetX = x - this.lastOffsetX;
    let offsetY = y - this.lastOffsetY;
    this.lastOffsetX = x;
    this.lastOffsetY = y;
    if ((e as any).ctrlKey) {
      // 1，3 是右上角和左上角的点，此时的 offsetY 符号与 offsetX 是相反的
      const sign = [1, 3].includes(this.resizeIndex) ? -1 : 1;
      offsetY = (sign * (offsetX * h)) / w;
    }
    resizeRect(this.activeRect, offsetX, offsetY, this.resizeIndex);
    calcCenter(this.activeRect);

    const scaleX = this.activeRect.width / w;
    const scaleY = this.activeRect.height / h;
    this.store.active.forEach((pen, i) => {
      pen.calculative.worldRect.x = this.activeInitPos[i].x * this.activeRect.width + this.activeRect.x;
      pen.calculative.worldRect.y = this.activeInitPos[i].y * this.activeRect.height + this.activeRect.y;
      pen.calculative.worldRect.width *= scaleX;
      pen.calculative.iconWidth && (pen.calculative.iconWidth *= scaleX);
      pen.calculative.worldRect.height *= scaleY;
      pen.calculative.iconHeight && (pen.calculative.iconHeight *= scaleY);
      pen.calculative.worldRect.ex = pen.calculative.worldRect.x + pen.calculative.worldRect.width;
      pen.calculative.worldRect.ey = pen.calculative.worldRect.y + pen.calculative.worldRect.height;
      pen.calculative.worldRect.center = {
        x: pen.calculative.worldRect.x + pen.calculative.worldRect.width / 2,
        y: pen.calculative.worldRect.y + pen.calculative.worldRect.height / 2,
      };
      pen.onResize && pen.onResize(pen);
      this.dirtyPenRect(pen, true);
    });
    this.getSizeCPs();
    this.render(Infinity);
    this.store.emitter.emit('resizePens', this.store.active);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const pens = this.store.active;
      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  movePens(e: { x: number; y: number; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    if (!this.initActiveRect) {
      this.initActiveRect = deepClone(this.activeRect);
      return;
    }

    let x = e.x - this.mouseDown.x;
    let y = e.y - this.mouseDown.y;
    e.shiftKey && (x = 0);
    e.altKey && (y = 0);
    const rect = deepClone(this.initActiveRect);
    translateRect(rect, x, y);
    if (this.customeDock) {
      this.dock = this.customeDock(this.store, rect);
    } else {
      this.dock = calcRectDock(this.store, rect);
    }
    if (this.dock.xDock) {
      rect.x += this.dock.xDock.step;
    }
    if (this.dock.yDock) {
      rect.y += this.dock.yDock.step;
    }

    x = rect.x - this.activeRect.x;
    y = rect.y - this.activeRect.y;

    this.updatingPens = true;
    this.translatePens(this.store.active, x, y, true);
  }

  moveLineAnchor(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }
    if (!this.initPens) {
      this.initPens = [];
      for (let pen of this.store.active) {
        this.initPens.push(deepClone(pen));
      }
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
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render(Infinity);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const pens = this.store.active;
      this.store.emitter.emit('update', pens);

      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  moveLineAnchorPrev(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    if (!this.initPens) {
      this.initPens = [];
      for (let pen of this.store.active) {
        this.initPens.push(deepClone(pen));
      }
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
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render(Infinity);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const pens = this.store.active;
      this.store.emitter.emit('update', pens);

      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  moveLineAnchorNext(e: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }
    if (!this.initPens) {
      this.initPens = [];
      for (let pen of this.store.active) {
        this.initPens.push(deepClone(pen));
      }
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
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render(Infinity);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const pens = this.store.active;
      this.store.emitter.emit('update', pens);

      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  setAnchor(e: { x: number; y: number }) {
    this.initPens = [deepClone(this.store.hover)];

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
        const pt = { id: s8(), x: e.x, y: e.y };
        this.store.activeAnchor = pushPenAnchor(this.store.hover, pt);
      }
    }
    this.hotkeyType = HotkeyType.None;
    this.render(Infinity);

    this.store.emitter.emit('update', [this.store.hover]);
    this.pushHistory({
      type: EditType.Update,
      pens: [deepClone(this.store.hover)],
      initPens: this.initPens,
    });
    this.initPens = undefined;
  }

  translatePens(pens: Pen[], x: number, y: number, doing?: boolean) {
    if (
      !pens ||
      pens.length < 1 ||
      (pens.length === 1 && pens[0].type && pens[0].anchors.findIndex((pt) => pt.connectTo) > -1)
    ) {
      return false;
    }

    if (!doing || (this.updatingPens && !this.initPens)) {
      this.initPens = [];
      for (let pen of pens) {
        this.initPens.push(deepClone(pen));
      }
    }

    translateRect(this.activeRect, x, y);

    pens.forEach((pen) => {
      if (!pen.parentId && pen.type && pen.anchors.findIndex((pt) => pt.connectTo) > -1) {
        return;
      }
      if (pen.locked >= LockState.DisableMove) {
        // 禁止移动
        return;
      }

      if (pen.type) {
        translateLine(pen, x, y);
        this.dirtyLines.add(pen);
        this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
      } else {
        translateRect(pen.calculative.worldRect, x, y);
        calcPenRect(pen);
        pen.calculative.x = pen.x;
        pen.calculative.y = pen.y;
        this.dirtyPenRect(pen, true);
        const children = getAllChildren(pen);
        children.forEach((child) => {
          if (!child.type) {
            this.updateLines(child);
          }
        });
        this.updateLines(pen);
      }
      pen.onMove && pen.onMove(pen);
    });
    this.getSizeCPs();

    this.dirtyLines.forEach((pen) => {
      if (!doing || pen.text) {
        pen.type && this.initLineRect(pen);
      }
    });

    this.render(Infinity);
    this.tooltip.translate(x, y);
    this.store.emitter.emit('translatePens', pens);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;

      const currentPens = [];
      for (let pen of pens) {
        currentPens.push(deepClone(pen));
      }
      this.pushHistory({
        type: EditType.Update,
        pens: currentPens,
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  private calcAutoAnchor(line: Pen, lineAnchor: Point, pen: Pen, penConnection?: any) {
    const from = getFromAnchor(line);
    const to = getToAnchor(line);
    const newAnchor = nearestAnchor(pen, lineAnchor === from ? to : from);
    lineAnchor.x = newAnchor.x;
    lineAnchor.y = newAnchor.y;
    lineAnchor.prev = undefined;
    lineAnchor.next = undefined;
    lineAnchor.connectTo = pen.id;

    if (penConnection) {
      penConnection.anchor = newAnchor.id;
    } else {
      pen.connectedLines.push({
        lineId: line.id,
        lineAnchor: lineAnchor.id,
        anchor: newAnchor.id,
      });
    }

    if (this[line.lineName]) {
      this[line.lineName](this.store, line);
    }

    this.store.path2dMap.set(line, globalStore.path2dDraws.line(line));
    this.initLineRect(line);
  }

  restoreNodeAnimate(pen: Pen) {
    if (pen.calculative.initRect) {
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
      pen.calculative.initRect = undefined;
    }
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

      if (line.autoFrom) {
        const from = getFromAnchor(line);
        if (from.id === lineAnchor.id) {
          this.calcAutoAnchor(line, from, pen, item);
        }
      }

      if (line.autoTo) {
        const to = getToAnchor(line);
        if (to.id === lineAnchor.id) {
          this.calcAutoAnchor(line, to, pen, item);
        }
      }

      const penAnchor = getAnchor(pen, item.anchor);
      if (!penAnchor) {
        return;
      }

      translatePoint(lineAnchor, penAnchor.x - lineAnchor.x, penAnchor.y - lineAnchor.y);
      if (
        line.autoPolyline !== false &&
        (this.store.options.autoPolyline || line.autoPolyline) &&
        line.lineName === 'polyline'
      ) {
        let from = line.calculative.worldAnchors[0];
        let to = line.calculative.worldAnchors[line.calculative.worldAnchors.length - 1];

        let found = false;

        if (from.id === lineAnchor.id) {
          from = lineAnchor;
          found = true;
        } else if (to.id === lineAnchor.id) {
          to = lineAnchor;
          found = true;
        }
        if (found) {
          line.calculative.worldAnchors = [from, to];
          line.calculative.activeAnchor = from;
          this['polyline'](this.store, line, to);
          this.initLineRect(line);
        }
      }

      this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
      this.dirtyLines.add(line);

      change && getLineLength(line);
    });
  }

  calcActiveRect() {
    const canMovePens = this.store.active.filter((pen: Pen) => !pen.locked || pen.locked < LockState.DisableMove);
    if (canMovePens.length === 1) {
      this.activeRect = deepClone(canMovePens[0].calculative.worldRect);
      this.activeRect.rotate = canMovePens[0].calculative.rotate || 0;
      calcCenter(this.activeRect);
    } else {
      this.activeRect = getRect(canMovePens);
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

  nextAnimate(pen: Pen) {
    if (!pen) {
      return;
    }
    this.store.emitter.emit('animateEnd', pen);

    let pens: Pen[];
    if (pen.nextAnimate) {
      pens = this.store.data.pens.filter((p) => {
        return p.id === pen.nextAnimate || (p.tags && p.tags.indexOf(pen.nextAnimate) > -1);
      });
    }

    if (!pens) {
      return;
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
    this.animate();
  }

  animate() {
    if (this.animateRendering) {
      return;
    }

    requestAnimationFrame(() => {
      const now = Date.now();
      if (now - this.lastAnimateRender < this.store.options.animateInterval) {
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
        if (pen.calculative.pause) {
          continue;
        }
        if (pen.calculative.active) {
          active = true;
        }
        if (!pen.type) {
          if (setNodeAnimate(pen, now)) {
            if (pen.calculative.dirty) {
              this.dirtyPenRect(pen, true, true);
            }
          } else {
            this.restoreNodeAnimate(pen);
            dels.push(pen);
            this.nextAnimate(pen);
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
              calcPenRect(pen);
            } else {
              for (const k in pen) {
                if (typeof pen[k] !== 'object' || k === 'lineDash') {
                  pen.calculative[k] = pen[k];
                }
              }
            }
            dels.push(pen);
            this.nextAnimate(pen);
          }
        }

        this.dirty = true;
      }
      if (active) {
        this.calcActiveRect();
      }
      dels.forEach((pen) => {
        this.store.animates.delete(pen);
      });
      this.render();
      this.animateRendering = false;
      this.animate();
    });
  }

  copy(pens?: Pen[]) {
    this.store.clipboard = pens || this.store.active;
    this.pasteOffset = 10;
    const clipboardData = deepClone(this.store.clipboard);
    navigator.clipboard?.writeText(JSON.stringify({ topology: true, data: clipboardData }));
  }

  cut(pens?: Pen[]) {
    this.copy(pens);
    this.delete(this.store.clipboard);
  }

  async paste() {
    if (!this.store.clipboard) {
      const clipboardText = await navigator.clipboard?.readText();
      let clipboard;
      try {
        clipboard = JSON.parse(clipboardText);
      } catch (e) {
        console.warn('剪切板数据不是 json', e.message);
        return;
      }
      if (!clipboard || !clipboard.topology || !clipboard.data) {
        return;
      }
      this.store.clipboard = clipboard.data;
    }
    const pens: Pen[] = [];
    for (const pen of this.store.clipboard) {
      const newPen = this.pastePen(pen);
      newPen && pens.push(newPen);
    }

    this.pasteOffset += 10;

    this.active(pens);
    this.pushHistory({ type: EditType.Add, pens });
    this.store.emitter.emit('add', pens);
  }

  pastePen(pen: Pen, parentId?: string) {
    const newPen: Pen = deepClone(pen);
    randomId(newPen);
    newPen.parentId = parentId;
    // 子节点无需偏移
    !parentId && translateRect(newPen, this.pasteOffset, this.pasteOffset);
    if (!this.beforeAddPen || this.beforeAddPen(pen) == true) {
      this.makePen(newPen);
      const newChildren = [];
      if (Array.isArray(newPen.children)) {
        for (const childId of newPen.children) {
          const pen = this.store.pens[childId];
          pen && newChildren.push(this.pastePen(pen, newPen.id).id);
        }
      }
      newPen.children = newChildren;
      return newPen;
    }
  }

  delete(pens?: Pen[], isSon: boolean = false, delLock = false) {
    if (!pens) {
      pens = this.store.active;
    }
    if (!pens || !pens.length) {
      return;
    }

    pens.forEach((pen) => {
      if (!delLock && pen.locked && !isSon) return;
      const i = this.store.data.pens.findIndex((item) => item.id === pen.id);
      if (i > -1) {
        // 删除画笔关联线的 connectTo
        this.delLineConnectTo(this.store.data.pens[i]);
        this.store.data.pens.splice(i, 1);
        this.store.pens[pen.id] = undefined;
      }
      pen.onDestroy && pen.onDestroy(pen);
      if (Array.isArray(pen.children)) {
        const sonPens = this.store.data.pens.filter((son) => pen.children.includes(son.id));
        this.delete(sonPens, true, delLock); // 递归删除子节点
      }
    });
    this.inactive();
    this.store.hoverAnchor = undefined;
    this.store.hover = undefined;
    this.render(Infinity);
    this.pushHistory({ type: EditType.Delete, pens });
    this.store.emitter.emit('delete', pens);
  }

  /**
   * 删除该画笔关联线的 connectTo 该节点内容
   * @param pen 画笔
   */
  delLineConnectTo(pen: Pen) {
    pen.connectedLines?.forEach((info) => {
      const line = this.store.pens[info.lineId];
      if (line) {
        const from = line.anchors[0];
        const to = line.anchors[line.anchors.length - 1];
        if (from.connectTo === pen.id) {
          from.connectTo = undefined;
          from.anchorId = undefined;
          from.prev && (from.prev.connectTo = undefined);
          from.next && (from.next.connectTo = undefined);
        }
        if (to.connectTo === pen.id) {
          to.connectTo = undefined;
          to.anchorId = undefined;
          to.prev && (to.prev.connectTo = undefined);
          to.next && (to.next.connectTo = undefined);
        }
        calcWorldAnchors(line);
        getLineRect(line);
      }
    });
  }

  private ondblclick = (e: any) => {
    if (this.store.hover && !this.store.data.locked && !this.store.options.disableInput) {
      this.showInput(this.store.hover);
    }

    this.store.emitter.emit('dblclick', {
      x: e.x,
      y: e.y,
      pen: this.store.hover,
    });
  };

  showInput = (pen: Pen, rect?: Rect) => {
    if (
      !this.store.hover ||
      this.store.hover.locked ||
      this.store.hover.externElement ||
      this.store.hover.disableInput
    ) {
      return;
    }
    if (this.input.dataset.penId === pen.id) {
      this.input.focus();
      return;
    }
    const textRect = rect || pen.calculative.worldTextRect;
    this.input.value = pen.calculative.tempText || pen.text || '';
    this.inputParent.style.left = textRect.x + this.store.data.x + 5 + 'px';
    this.inputParent.style.top = textRect.y + this.store.data.y + 5 + 'px';
    this.inputParent.style.width = textRect.width - 10 + 'px';
    this.inputParent.style.height = textRect.height - 10 + 'px';
    this.inputParent.style.zIndex = '1000';
    if (pen.rotate % 360) {
      this.inputParent.style.transform = `rotate(${pen.rotate}deg)`;
    } else {
      this.inputParent.style.transform = null;
    }
    this.inputParent.style.display = 'flex';
    this.input.dataset.penId = pen.id;
    this.input.readOnly = pen.disableInput;
    if (pen.dropdownList && this.dropdown.style.display !== 'block') {
      this.setDropdownList();
    } else {
      this.inputRight.style.display = 'none';
    }
    this.input.focus();

    pen.calculative.text = '';
    this.render(Infinity);
  };

  hideInput = () => {
    if (this.inputParent.style.display === 'flex') {
      this.inputParent.style.display = 'none';
      const pen = this.store.pens[this.input.dataset.penId];
      // pen.calculative.text 恢复
      pen.calculative.text = pen.text;
      if (!pen) {
        return;
      }

      if (pen.onInput) {
        pen.onInput(pen, this.input.value);
      } else if (pen.text !== this.input.value) {
        this.initPens = [deepClone(pen)];
        pen.text = this.input.value;
        pen.calculative.text = pen.text;
        this.input.dataset.penId = undefined;
        calcTextRect(pen);
        this.dirty = true;
        this.pushHistory({
          type: EditType.Update,
          pens: [deepClone(pen)],
          initPens: this.initPens,
        });
        this.store.emitter.emit('valueUpdate', pen);
      }
    }
    this.input.dataset.penId = undefined;
    this.dropdown.style.display = 'none';
  };

  private createInput() {
    this.inputParent.classList.add('topology-input');
    this.inputRight.classList.add('right');
    this.inputParent.appendChild(this.input);
    this.inputParent.appendChild(this.inputRight);
    this.inputParent.appendChild(this.dropdown);
    this.externalElements.appendChild(this.inputParent);

    this.inputParent.dataset.l = '1';
    this.input.dataset.l = '1';
    this.inputRight.dataset.l = '1';
    this.dropdown.dataset.l = '1';
    this.inputRight.style.transform = 'rotate(135deg)';

    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com') {
        sheet = document.styleSheets[i];
      }
    }
    if (!sheet) {
      const style = document.createElement('style');
      style.title = 'le5le.com';
      document.head.appendChild(style);
      sheet = style.sheet;
      sheet.insertRule('.topology-input{display:none;position:absolute;outline:none;align-items: center;}');
      sheet.insertRule(
        '.topology-input textarea{resize:none;border:none;outline:none;background:transparent;flex-grow:1;height:100%;left:0;top:0}'
      );
      sheet.insertRule(
        '.topology-input .right{width:10px;height:10px;flex-shrink:0;border-top: 1px solid;border-right: 1px solid;margin-right: 5px;transition: all .3s cubic-bezier(.645,.045,.355,1);}'
      );
      sheet.insertRule(
        '.topology-input ul{position:absolute;top:100%;left:-5px;width:calc(100% + 10px);min-height:30px;border-radius: 2px;box-shadow: 0 2px 8px #00000026;list-style-type: none;background-color: #fff;padding: 4px 0;}'
      );
      sheet.insertRule(
        '.topology-input ul li{padding: 5px 12px;line-height: 22px;white-space: nowrap;cursor: pointer;}'
      );
      sheet.insertRule('.topology-input ul li:hover{background: #eeeeee;}');
    }
    this.input.onclick = () => {
      if (this.dropdown.style.display === 'block') {
        this.dropdown.style.display = 'none';
        this.inputRight.style.transform = 'rotate(135deg)';
      } else {
        this.dropdown.style.display = 'block';
        this.inputRight.style.transform = 'rotate(315deg)';
      }
      const pen = this.store.pens[this.input.dataset.penId];
      this.store.emitter.emit('clickInput', pen);
    };
    this.input.onkeyup = (e: KeyboardEvent) => {
      this.setDropdownList(true);
      const pen = this.store.pens[this.input.dataset.penId];
      this.store.emitter.emit('input', { pen, text: e.key });
    };
  }

  clearDropdownList() {
    if (this.dropdown.hasChildNodes()) {
      for (let i = 0; i < this.dropdown.childNodes.length; i++) {
        this.dropdown.childNodes[i].remove();
        --i;
      }
    }
  }

  private setDropdownList = (search?: boolean) => {
    this.clearDropdownList();
    this.dropdown.style.display = 'block';
    this.inputRight.style.display = 'block';
    setTimeout(() => {
      this.inputRight.style.transform = 'rotate(315deg)';
    });
    const pen = this.store.pens[this.input.dataset.penId];
    if (!pen || !pen.dropdownList) {
      this.dropdown.style.display = 'none';
      this.inputRight.style.display = 'none';
      this.inputRight.style.transform = 'rotate(135deg)';
      return;
    }
    if (!pen.dropdownList.length) {
      const none = document.createElement('div');
      none.innerText = 'None';
      none.style.padding = '5px 12px';
      none.style.color = '#ddd';
      this.dropdown.appendChild(none);
      return;
    }

    const text = this.input.value;
    let i = 0;
    for (const item of pen.dropdownList) {
      if (search && text) {
        const t: string = item.text || item + '';
        if (t.indexOf(text) > -1) {
          const li = document.createElement('li');
          li.innerText = item.text || item;
          li.dataset.l = '1';
          li.dataset.i = i + '';
          li.onclick = this.selectDropdown;
          this.dropdown.appendChild(li);
        }
      } else {
        const li = document.createElement('li');
        li.innerText = item.text || item;
        li.dataset.l = '1';
        li.dataset.i = i + '';
        li.onclick = this.selectDropdown;
        this.dropdown.appendChild(li);
      }
      ++i;
    }

    if (!this.dropdown.hasChildNodes()) {
      const none = document.createElement('div');
      none.innerText = 'None';
      none.style.padding = '5px 12px';
      none.style.color = '#ddd';
      this.dropdown.appendChild(none);
    }
  };

  private selectDropdown = (e: any) => {
    const li = e.target;
    const pen = this.store.pens[this.input.dataset.penId];
    if (!li || !pen || !pen.dropdownList) {
      return;
    }

    const index = +li.dataset.i;
    if (!pen.dropdownList[index]) {
      return;
    }

    this.initPens = [deepClone(pen)];

    if (typeof pen.dropdownList[index] === 'object') {
      const rect = this.getPenRect(pen);
      this.updateValue(pen, { ...rect, ...pen.dropdownList[index] });
      // 上面会更新 calculative.text 下方置空
      pen.calculative.text = '';
      this.calcActiveRect();
    } else {
      pen.text = pen.dropdownList[index] + '';
    }
    this.input.value = pen.text;
    this.dropdown.style.display = 'none';
    this.inputRight.style.transform = 'rotate(135deg)';
    this.pushHistory({
      type: EditType.Update,
      pens: [deepClone(pen)],
      initPens: this.initPens,
    });
    this.render(Infinity);
    this.store.emitter.emit('valueUpdate', pen);
  };

  updateValue(pen: Pen, data: any) {
    Object.assign(pen, data);
    if (data.newId) {
      pen.id = data.newId;
    }
    if (pen.calculative.text !== pen.text) {
      pen.calculative.text = pen.text;
      calcTextLines(pen);
    }
    for (const k in data) {
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.calculative[k] = data[k];
      }
    }
    pen.calculative.image = undefined;
    pen.calculative.backgroundImage = undefined;
    pen.calculative.strokeImage = undefined;

    if (data.x != null || data.y != null || data.width != null || data.height != null) {
      this.setPenRect(pen, { x: pen.x, y: pen.y, width: pen.width, height: pen.height }, false);
      this.updateLines(pen, true);
    }
    if (data.image || data.backgroundImage || data.strokeImage) {
      this.loadImage(pen);
    }
  }

  setPenRect(pen: Pen, rect: Rect, render = true) {
    pen.x = this.store.data.origin.x + rect.x * this.store.data.scale;
    pen.y = this.store.data.origin.y + rect.y * this.store.data.scale;
    pen.width = rect.width * this.store.data.scale;
    pen.height = rect.height * this.store.data.scale;
    this.dirtyPenRect(pen);

    render && this.render();
  }

  getPenRect(pen: Pen) {
    if (!pen) {
      return;
    }

    return {
      x: (pen.x - this.store.data.origin.x) / this.store.data.scale,
      y: (pen.y - this.store.data.origin.y) / this.store.data.scale,
      width: pen.width / this.store.data.scale,
      height: pen.height / this.store.data.scale,
    };
  }

  renderRule() {
    if (!this.store.options.rule && !this.store.data.rule) {
      return;
    }

    const span = this.store.data.scale * 10;

    const ctx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;
    ctx.save();

    ctx.strokeStyle = rgba(this.store.data.ruleColor || this.store.options.ruleColor, 0.7);

    const x = this.store.data.origin.x + this.store.data.x;
    const y = this.store.data.origin.y + this.store.data.y;

    // horizontal rule
    ctx.beginPath();
    ctx.lineWidth = 12;
    ctx.lineDashOffset = -x % span;
    ctx.setLineDash([1, span - 1]);
    ctx.moveTo(0, 0);
    ctx.lineTo(this.width, 0);
    ctx.stroke();

    // vertical rule
    ctx.beginPath();
    ctx.lineDashOffset = -y % span;
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.height);
    ctx.stroke();

    // the big rule
    ctx.strokeStyle = this.store.data.ruleColor || this.store.options.ruleColor;
    ctx.beginPath();
    ctx.lineWidth = 24;
    ctx.lineDashOffset = -x % (span * 10);
    ctx.setLineDash([1, span * 10 - 1]);
    ctx.moveTo(0, 0);
    ctx.lineTo(this.width, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.lineDashOffset = -y % (span * 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = ctx.strokeStyle;
    let text: number = 0 - Math.floor(x / span / 10) * 100;
    if (x < 0) {
      text -= 100;
    }
    for (let i = x % (span * 10); i < this.width; i += 10 * span, text += 100) {
      if (span < 3 && text % 500) {
        continue;
      }
      ctx.fillText(text.toString(), i + 4, 16);
    }

    text = 0 - Math.floor(y / span / 10) * 100;
    if (y < 0) {
      text -= 100;
    }
    for (let i = y % (span * 10); i < this.height; i += 10 * span, text += 100) {
      if (span < 3 && text % 500) {
        continue;
      }
      ctx.save();
      ctx.beginPath();
      ctx.translate(16, i - 4);
      ctx.rotate((270 * Math.PI) / 180);
      ctx.fillText(text.toString(), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  renderGrid() {
    if (!this.store.options.grid && !this.store.data.grid) {
      return;
    }
    const ctx = this.offscreen.getContext('2d');
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.store.data.gridColor || this.store.options.gridColor;
    ctx.beginPath();
    const size = (this.store.data.gridSize || this.store.options.gridSize) * this.store.data.scale;
    for (let i = size; i < this.width; i += size) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, this.height);
    }
    for (let i = size; i < this.height; i += size) {
      ctx.moveTo(0, i);
      ctx.lineTo(this.width, i);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderMagnifier() {
    if (!this.magnifier) {
      return;
    }

    const r = this.magnifierSize / 2;
    const size = this.magnifierSize + 5;

    const ctx = this.magnifierScreen.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = 5;

    ctx.save();
    ctx.translate(2.5, 2.5);

    ctx.save();
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.clip();
    ctx.fillStyle = this.store.data.background || this.canvas.style.background;
    ctx.fillRect(0, 0, size, size);
    ctx.translate(-r, -r);
    ctx.scale(2, 2);
    const pt = {
      x: (this.mousePos.x + this.store.data.x) * this.store.dpiRatio,
      y: (this.mousePos.y + this.store.data.y) * this.store.dpiRatio,
    };
    ctx.drawImage(
      this.offscreen,
      pt.x - r,
      pt.y - r,
      this.magnifierSize,
      this.magnifierSize,
      0,
      0,
      this.magnifierSize,
      this.magnifierSize
    );
    ctx.restore();

    ctx.beginPath();
    const gradient = ctx.createRadialGradient(r, r, r - 5, r, r, r);
    gradient.addColorStop(0, 'rgba(0,0,0,0.2)');
    gradient.addColorStop(0.8, 'rgb(200,200,200)');
    gradient.addColorStop(0.9, 'rgb(200,200,200)');
    gradient.addColorStop(1.0, 'rgba(200,200,200,0.9)');
    ctx.strokeStyle = gradient;
    ctx.arc(r, r, r, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.restore();

    const offscreenCtx = this.offscreen.getContext('2d');
    offscreenCtx.drawImage(
      this.magnifierScreen,
      0,
      0,
      this.magnifierSize + 5,
      this.magnifierSize + 5,
      (pt.x - r - 2.5) / this.store.dpiRatio,
      (pt.y - r - 2.5) / this.store.dpiRatio,
      (this.magnifierSize + 5) / this.store.dpiRatio,
      (this.magnifierSize + 5) / this.store.dpiRatio
    );
  }

  toPng(padding: Padding = 0, callback?: BlobCallback) {
    const rect = getRect(this.store.data.pens);
    const p = formatPadding(padding || 2);
    rect.x -= p[3];
    rect.y -= p[0];
    rect.width += p[3] + p[1];
    rect.height += p[0] + p[2];
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;

    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(-rect.x, -rect.y);
    for (const pen of this.store.data.pens) {
      renderPen(ctx, pen);
    }
    if (callback) {
      canvas.toBlob(callback);
      return;
    }
    return canvas.toDataURL('image/png', 1);
  }

  toggleAnchorMode() {
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

  addAnchorHand() {
    if (this.store.activeAnchor && this.store.active && this.store.active.length === 1 && this.store.active[0].type) {
      this.initPens = [deepClone(this.store.active[0])];

      if (!this.store.activeAnchor.prev) {
        if (!this.store.activeAnchor.next) {
          this.store.activeAnchor.next = {
            penId: this.store.activeAnchor.penId,
            x: this.store.activeAnchor.x + 50,
            y: this.store.activeAnchor.y,
          };
        }
        this.store.activeAnchor.prev = { ...this.store.activeAnchor.next };
        rotatePoint(this.store.activeAnchor.prev, 180, this.store.activeAnchor);
        this.initLineRect(this.store.active[0]);
        this.dirty = true;
      } else if (!this.store.activeAnchor.next) {
        this.store.activeAnchor.next = { ...this.store.activeAnchor.prev };
        rotatePoint(this.store.activeAnchor.next, 180, this.store.activeAnchor);
        this.initLineRect(this.store.active[0]);
        this.dirty = true;
      }

      this.store.emitter.emit('update', [this.store.active[0]]);
      this.pushHistory({
        type: EditType.Update,
        pens: [deepClone(this.store.active[0])],
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }
  }

  removeAnchorHand() {
    if (this.store.activeAnchor && this.store.active && this.store.active.length === 1 && this.store.active[0].type) {
      this.initPens = [deepClone(this.store.active[0])];

      if (this.hoverType === HoverType.LineAnchorPrev) {
        this.store.activeAnchor.prev = undefined;
        this.initLineRect(this.store.active[0]);
        this.dirty = true;
      } else if (this.hoverType === HoverType.LineAnchorNext) {
        this.store.activeAnchor.next = undefined;
        this.initLineRect(this.store.active[0]);
        this.dirty = true;
      } else {
        this.store.activeAnchor.prev = undefined;
        this.store.activeAnchor.next = undefined;
        this.initLineRect(this.store.active[0]);
        this.dirty = true;
      }

      this.store.emitter.emit('update', [this.store.active[0]]);
      this.pushHistory({
        type: EditType.Update,
        pens: [deepClone(this.store.active[0])],
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }
  }

  toggleAnchorHand() {
    if (this.store.active.length === 1 && this.store.active[0].type && this.store.activeAnchor) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.prevNextType = PrevNextType.Mirror;
      }
      this.store.activeAnchor.prevNextType = (this.store.activeAnchor.prevNextType + 1) % 3;
    }
  }

  gotoView(x: number, y: number) {
    const rect = getRect(this.store.data.pens);
    this.store.data.x = this.canvas.clientWidth / 2 - x * rect.width - rect.x;
    this.store.data.y = this.canvas.clientHeight / 2 - y * rect.height - rect.y;
    this.render(Infinity);
  }

  showMagnifier() {
    this.magnifier = true;
    this.externalElements.style.cursor = 'default';
    this.render(Infinity);
  }

  hideMagnifier() {
    this.magnifier = false;
    this.externalElements.style.cursor = 'default';
    this.render(Infinity);
  }

  toggleMagnifier() {
    this.magnifier = !this.magnifier;
    if (this.magnifier) {
      this.externalElements.style.cursor = 'default';
    }
    this.render(Infinity);
  }

  destroy() {
    this.scroll && this.scroll.destroy();

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
