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
  calcMoveDock,
  calcTextLines,
  setNodeAnimate,
  setLineAnimate,
  calcPenRect,
  setChildrenActive,
  getParent,
  setHover,
  randomId,
  getPensLock,
  getToAnchor,
  getFromAnchor,
  calcPadding,
  getPensDisableRotate,
  getPensDisableResize,
  needCalcTextRectProps,
  calcResizeDock,
  needPatchFlagsPenRectProps,
  needCalcIconRectProps,
  isDomShapes,
  renderPenRaw,
  needSetPenProps,
  getAllChildren,
  calcInView,
  isShowChild,
  ConnectLine,
  IValue,
  getTextColor,
  getGlobalColor,
  clearLifeCycle,
  rotatePen,
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
  calcRightBottom,
  calcRelativePoint,
  getRect,
  getRectOfPoints,
  pointInRect,
  pointInSimpleRect,
  Rect,
  rectInRect,
  rectToPoints,
  resizeRect,
  translateRect,
} from '../rect';
import {
  EditAction,
  EditType,
  globalStore,
  TopologyClipboard,
  TopologyStore,
} from '../store';
import {
  deepClone,
  fileToBase64,
  uploadFile,
  formatPadding,
  isMobile,
  Padding,
  rgba,
  s8,
} from '../utils';
import {
  defaultCursors,
  defaultDrawLineFns,
  HotkeyType,
  HoverType,
  MouseRight,
  rotatedCursors,
} from '../data';
import { createOffscreen } from './offscreen';
import {
  curve,
  mind,
  getLineLength,
  getLineRect,
  pointInLine,
  simplify,
  smoothLine,
  lineSegment,
  getLineR,
  lineInRect,
} from '../diagrams';
import { polyline } from '../diagrams/line/polyline';
import { Tooltip } from '../tooltip';
import { Scroll } from '../scroll';
import { CanvasImage } from './canvasImage';
import { MagnifierCanvas } from './magnifierCanvas';
import { lockedError } from '../utils/error';
import { Topology } from '../core';

export const movingSuffix = '-moving' as const;
export class Canvas {
  canvas = document.createElement('canvas');
  offscreen = createOffscreen();

  width: number;
  height: number;

  externalElements = document.createElement('div');
  clientRect?: DOMRect;
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
  addCaches: Pen[];
  touchCenter?: Point;
  initTouchDis?: number;
  initScale?: number;
  touchScaling?: boolean;
  touchMoving?: boolean;
  startTouches?: TouchList;

  lastOffsetX = 0;
  lastOffsetY = 0;

  drawingLineName?: string;
  drawLineFns: string[] = [...defaultDrawLineFns];
  drawingLine?: Pen;

  pencil?: boolean;
  pencilLine?: Pen;

  movingPens: Pen[];

  patchFlagsLines?: Set<Pen> = new Set();
  dock: { xDock: Point; yDock: Point };

  prevAnchor: Point;
  nextAnchor: Point;

  private lastMouseTime = 0;
  private hoverTimer: number = 0;
  // 即将取消活动状态的画笔，用于Ctrl选中/取消选中画笔
  private willInactivePen: Pen;

  patchFlags = false;
  lastRender = 0;
  touchStart = 0;
  touchStartTimer: any;
  timer: any;

  private lastAnimateRender = 0;
  animateRendering = false;
  renderTimer: number;

  initPens?: Pen[];

  pointSize = 8 as const;
  pasteOffset = 10;
  firstPaste?: boolean;

  /**
   * @deprecated 改用 beforeAddPens
   */
  beforeAddPen: (pen: Pen) => boolean;
  beforeAddPens: (pens: Pen[]) => Promise<boolean>;
  beforeAddAnchor: (pen: Pen, anchor: Point) => Promise<boolean>;
  beforeRemovePens: (pens: Pen[]) => Promise<boolean>;
  beforeRemoveAnchor: (pen: Pen, anchor: Point) => Promise<boolean>;

  customeResizeDock: (
    store: TopologyStore,
    rect: Rect,
    pens: Pen[],
    resizeIndex: number
  ) => { xDock: Point; yDock: Point };
  customeMoveDock: (
    store: TopologyStore,
    rect: Rect,
    pens: Pen[],
    offset: Point
  ) => { xDock: Point; yDock: Point };

  inputParent = document.createElement('div');
  // input = document.createElement('textarea');
  inputDiv = document.createElement('div');
  inputRight = document.createElement('div');
  dropdown = document.createElement('ul');

  tooltip: Tooltip;
  mousePos: Point = { x: 0, y: 0 };

  private alreadyCopy = false;

  scroll: Scroll;
  movingAnchor: Point;  // 正在移动中的瞄点

  canvasImage: CanvasImage;
  canvasImageBottom: CanvasImage;
  magnifierCanvas: MagnifierCanvas;

  stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  constructor(
    public parent: Topology,
    public parentElement: HTMLElement,
    public store: TopologyStore
  ) {
    this.canvasImageBottom = new CanvasImage(parentElement, store, true);

    parentElement.appendChild(this.canvas);
    this.canvas.style.position = 'absolute';
    this.canvas.style.backgroundRepeat = 'no-repeat';
    this.canvas.style.backgroundSize = '100% 100%';

    this.canvasImage = new CanvasImage(parentElement, store);

    this.magnifierCanvas = new MagnifierCanvas(this, parentElement, store);
    this.externalElements.id = 'topology-dom';
    this.externalElements.style.position = 'absolute';
    this.externalElements.style.left = '0';
    this.externalElements.style.top = '0';
    this.externalElements.style.outline = 'none';
    this.externalElements.style.background = 'transparent';
    parentElement.style.position = 'relative';
    parentElement.appendChild(this.externalElements);
    this.createInput();

    this.tooltip = new Tooltip(parentElement, store);
    if (this.store.options.scroll) {
      this.scroll = new Scroll(this);
    }

    this.store.dpiRatio = globalThis.devicePixelRatio || 1;

    if (this.store.dpiRatio < 1) {
      this.store.dpiRatio = 1;
    } else if (this.store.dpiRatio > 1 && this.store.dpiRatio < 1.5) {
      this.store.dpiRatio = 1.5;
    }

    this.clientRect = this.externalElements.getBoundingClientRect();
    this.listen();

    window?.addEventListener('resize', this.onResize);
    window?.addEventListener('scroll', this.onScroll);
  }

  curve = curve;
  polyline = polyline;
  mind = mind;
  line = lineSegment;

  listen() {
    // ios
    this.externalElements.addEventListener('gesturestart', this.onGesturestart);

    this.externalElements.ondragover = (e) => e.preventDefault();
    this.externalElements.ondrop = this.ondrop;
    this.externalElements.oncontextmenu = (e) => e.preventDefault();
    if (isMobile()) {
      this.store.options.interval = 50;
      this.externalElements.ontouchstart = this.ontouchstart;
      this.externalElements.ontouchmove = this.ontouchmove;
      this.externalElements.ontouchend = this.ontouchend;
    } else {
      this.externalElements.onmousedown = (e) => {
        this.onMouseDown({
          x: e.offsetX,
          y: e.offsetY,
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
        });
      };
      this.externalElements.onmousemove = (e) => {
        this.onMouseMove({
          x: e.offsetX,
          y: e.offsetY,
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
        });
      };
      this.externalElements.onmouseup = (e) => {
        this.onMouseUp({
          x: e.offsetX,
          y: e.offsetY,
          clientX: e.clientX,
          clientY: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          ctrlKey: e.ctrlKey || e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          buttons: e.buttons,
          button: e.button,
        });
      };
      this.externalElements.onmouseleave = (e) => {
        if ((e as any).toElement !== this.tooltip.box) {
          this.tooltip.hide();
          this.store.lastHover = undefined;
        }
      };
    }

    this.externalElements.ondblclick = this.ondblclick;
    this.externalElements.tabIndex = 0;
    this.externalElements.onblur = () => {
      this.mouseDown = undefined;
    };
    this.externalElements.onwheel = this.onwheel;

    switch (this.store.options.keydown) {
      case KeydownType.Document:
        document.addEventListener('keydown', this.onkeydown);
        document.addEventListener('keyup', this.onkeyup);
        document.addEventListener('paste', this.pasteImg);
        // TODO: 使用 paste 事件，可以实现 复制桌面图片上画布，但存在两个问题：
        // 1. http 协议，复制桌面图片后，无法清空剪贴板
        // 2. 复制桌面图片，拿不到鼠标位置信息
        break;
      case KeydownType.Canvas:
        this.externalElements.addEventListener('keydown', this.onkeydown);
        this.externalElements.addEventListener('keyup', this.onkeyup);
        break;
    }
  }

  pasteImg = (event: ClipboardEvent) => {
    if ((event.target as any).id !== 'topology-dom') {
      return;
    }
    if (event.clipboardData) {
      const clipboardData = event.clipboardData;
      if (clipboardData.items) {
        // for chrome
        const items = clipboardData.items;
        const len = items.length;
        // event.preventDefault();
        if (len == 0) {
          return;
        }
        const { x, y } = this.mousePos;
        for (let i = 0; i < len; i++) {
          let blob = null;
          if (items[i].type.indexOf('image') !== -1) {
            blob = items[i].getAsFile();
            let name = items[i].type.slice(6) === 'gif' ? 'gif' : 'image';
            if (blob !== null) {
              let base64_str: any;
              const reader = new FileReader();
              reader.onload = (event) => {
                base64_str = event.target.result;
                const image = new Image();
                image.src = base64_str;
                image.onload = () => {
                  const { width, height } = image;
                  const pen = {
                    name,
                    x: x - width / 2,
                    y: y - height / 2,
                    externElement: name === 'gif',
                    width,
                    height,
                    image: base64_str as any,
                  };
                  this.addPens([pen]);
                  this.active([pen]);
                };
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }
    }
  };

  onwheel = (e: WheelEvent) => {
<<<<<<< HEAD
=======
    //输入模式不允许滚动
    if (this.inputDiv.contentEditable === 'true') {
      return;
    }
    const target = e.target as HTMLElement;
    // TODO: 若遇到其它 dom 的滚动影响了画布缩放，需要设置 noWheel 属性
    if (target?.dataset.noWheel) {
      return;
    }
>>>>>>> b67120f (perfect_input)
    e.preventDefault();
    e.stopPropagation();
    if (this.store.options.scroll && !e.ctrlKey && !e.metaKey && this.scroll) {
      this.scroll.wheel(e.deltaY < 0);
      return;
    }

    if (this.store.options.disableScale) {
      return;
    }
    if (this.store.data.locked === LockState.Disable) return;
    // 触摸板平移
    const isTouchPad = !(!e.deltaX && e.deltaY);
    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }

    this.touchStart = now;

    const { offsetX: x, offsetY: y } = e;

    if (isTouchPad) {
      this.translate(e.deltaX, e.deltaY);
    } else {
      if (e.deltaY < 0) {
        this.scale(this.store.data.scale + 0.1, { x, y });
      } else {
        this.scale(this.store.data.scale - 0.1, { x, y });
      }
    }
    this.externalElements.focus(); // 聚焦
  };

  onkeydown = (e: KeyboardEvent) => {
    if (
      this.store.data.locked >= LockState.DisableEdit ||
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
          this.drawingLine.calculative.drawlineH =
            !this.drawingLine.calculative.drawlineH;
        } else if (!this.hotkeyType) {
          this.patchFlags = true;
          this.hotkeyType = HotkeyType.Select;
        }
        break;
      case 'Meta':
        break;
      case 'Shift':
        if (this.drawingLine) {
          const to = getToAnchor(this.drawingLine);
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
          this.drawingLineName =
            this.drawLineFns[(index + 1) % this.drawLineFns.length];
          this.drawline();
          this.patchFlags = true;
        } else if (
          this.store.active.length === 1 &&
          this.store.active[0].type &&
          this.store.activeAnchor
        ) {
          this.toggleAnchorHand();
        } else if (!this.hotkeyType) {
          this.patchFlags = true;
          this.hotkeyType = HotkeyType.Resize;
        }
        break;
      case 'Alt':
        break;
      case 'a':
      case 'A':
        if (e.ctrlKey || e.metaKey) {
          // TODO: ctrl + A 会选中 visible == false 的元素
          this.active(
            this.store.data.pens.filter(
              (pen) => !pen.parentId && pen.locked !== LockState.Disable
            )
          );
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
        if (this.movingAnchor) {
          this.translateAnchor(-1, 0);
          break;
        }
        x = -10;
        if (e.shiftKey) {
          x = -5;
        }
        if (e.ctrlKey || e.metaKey) {
          x = -1;
        }
        this.translatePens(this.store.active, x, 0);
        break;
      case 'ArrowUp':
        if (this.movingAnchor) {
          this.translateAnchor(0, -1);
          break;
        }
        y = -10;
        if (e.shiftKey) {
          y = -5;
        }
        if (e.ctrlKey || e.metaKey) {
          y = -1;
        }
        this.translatePens(this.store.active, 0, y);
        break;
      case 'ArrowRight':
        if (this.movingAnchor) {
          this.translateAnchor(1, 0);
          break;
        }
        if (e.shiftKey) {
          x = 5;
        }
        if (e.ctrlKey || e.metaKey) {
          x = 1;
        }
        this.translatePens(this.store.active, x, 0);
        break;
      case 'ArrowDown':
        if (this.movingAnchor) {
          this.translateAnchor(0, 1);
          break;
        }
        if (e.shiftKey) {
          y = 5;
        }
        if (e.ctrlKey || e.metaKey) {
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
        if (!this.store.active[0]?.locked) {
          this.removeAnchorHand();
        }
        break;
      case 'h':
      case 'H':
        if (!this.store.active[0]?.locked) {
          this.addAnchorHand();
        }
        break;
      case 'm':
      case 'M':
        this.toggleMagnifier();
        break;
      case 'g':
      case 'G':
        // 进入移动瞄点状态
        if (this.hoverType === HoverType.NodeAnchor) {
          this.movingAnchor = this.store.hoverAnchor;
          this.externalElements.style.cursor = 'move';
        }
        break;
      case 's':
      case 'S':
        // 分割线
        if (
          !this.store.data.locked &&
          this.hoverType === HoverType.LineAnchor &&
          this.store.hover === this.store.active[0]
        ) {
          this.splitLine(this.store.active[0], this.store.hoverAnchor);
        }
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          this.paste();
        } else {
          if (this.drawingLineName) {
            this.finishDrawline();
            this.drawingLineName = '';
          } else {
            this.drawingLineName = this.store.options.drawingLineName;
          }
        }
        break;
      case 'b':
      case 'B':
        this.drawingPencil();
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
          this.finishDrawline(true);
          if (this.store.active[0].anchors[0].connectTo) {
            this.drawingLineName = '';
          } else {
            this.drawingLineName = this.store.options.drawingLineName;
          }
        }

        if (this.store.active) {
          this.store.active.forEach((pen) => {
            if (pen.type) {
              pen.close = !pen.close;
              this.store.path2dMap.set(pen, globalStore.path2dDraws.line(pen));
              getLineLength(pen);
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
        this.stopPencil();
        if (this.movingPens) {
          this.getAllByPens(this.movingPens).forEach((pen) => {
            this.store.pens[pen.id] = undefined;
          });
          this.movingPens = undefined;
          this.mouseDown = undefined;
          this.clearDock();
          this.store.active?.forEach((pen) => {
            this.updateLines(pen);
          });
          this.calcActiveRect();
          this.patchFlags = true;
        }
        this.hotkeyType = HotkeyType.None;
        this.movingAnchor = undefined;
        if (this.magnifierCanvas.magnifier) {
          this.magnifierCanvas.magnifier = false;
          this.patchFlags = true;
        }
        break;
    }

    this.render(false);
  };

  /**
   * 分割连线的锚点，变成两条线
   * @param line 连线
   * @param anchor 锚点，连线的某个锚点，引用相同
   */
  splitLine(line: Pen, anchor: Point): void {
    const worldAnchors = line.calculative.worldAnchors;
    const index = worldAnchors.findIndex((a) => a === anchor);
    if ([-1, 0, worldAnchors.length - 1].includes(index)) {
      // 没找到，起终点不处理
      return;
    }

    const initLine = deepClone(line, true);
    const newLine = deepClone(line, true);
    const id = s8();
    newLine.id = id;
    newLine.calculative.canvas = this;
    newLine.calculative.active = false;
    newLine.calculative.hover = false;

    // index 作为公共点
    const preAnchors = deepClone(worldAnchors.slice(0, index + 1));
    const laterAnchors = deepClone(worldAnchors.slice(index)).map((a) => {
      a.penId = id;
      return a;
    });

    line.calculative.worldAnchors = preAnchors;
    newLine.calculative.worldAnchors = laterAnchors;
    this.initLineRect(line);
    this.initLineRect(newLine);
    this.store.data.pens.push(newLine);
    this.store.pens[id] = newLine;

    this.pushHistory({
      type: EditType.Add,
      pens: [deepClone(newLine, true)],
      step: 2,
    });

    this.pushHistory({
      type: EditType.Update,
      initPens: [initLine],
      pens: [deepClone(line, true)],
      step: 2,
    });
  }

  private translateAnchor(x: number, y: number) {
    this.movingAnchor.x += x;
    this.movingAnchor.y += y;
    // 点不在范围内，移动到范围内
    const penId = this.movingAnchor.penId;
    if (penId) {
      const pen = this.store.pens[penId];
      const rect = pen.calculative.worldRect;
      if (this.movingAnchor.x < rect.x) {
        this.movingAnchor.x = rect.x;
      } else if (this.movingAnchor.x > rect.ex) {
        this.movingAnchor.x = rect.ex;
      }
      if (this.movingAnchor.y < rect.y) {
        this.movingAnchor.y = rect.y;
      } else if (this.movingAnchor.y > rect.ey) {
        this.movingAnchor.y = rect.ey;
      }
      const anchor = calcRelativePoint(this.movingAnchor, rect);
      // 更改 pen 的 anchors 属性
      const index = pen.anchors.findIndex(
        (anchor) => anchor.id === this.movingAnchor.id
      );
      pen.anchors[index] = anchor;
      this.patchFlags = true;
    }
  }

  onkeyup = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Alt':
        if (this.drawingLine) {
          this.store.options.autoAnchor = !this.store.options.autoAnchor;
        }
        break;
    }

    if (this.hotkeyType) {
      this.render();
    }
    if (this.hotkeyType < HotkeyType.AddAnchor) {
      this.hotkeyType = HotkeyType.None;
    }
  };

  async fileToPen(file: File, isGif: boolean): Promise<Pen> {
    let url = '';
    if (this.store.options.uploadFn) {
      url = await this.store.options.uploadFn(file);
    } else if (this.store.options.uploadUrl) {
      url = await uploadFile(
        file,
        this.store.options.uploadUrl,
        this.store.options.uploadParams,
        this.store.options.uploadHeaders
      );
    } else {
      url = await fileToBase64(file);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        globalStore.htmlElements[url] = img;
        resolve({
          width: img.width,
          height: img.height,
          name: isGif ? 'gif' : 'image',
          image: url,
        });
      };
      img.onerror = (e) => {
        reject(e);
      };
      img.src = url;
    });
  }

  ondrop = async (event: DragEvent) => {
    if (this.store.data.locked) {
      console.warn('canvas is locked, can not drop');
      return;
    }
    try {
      // TODO: 若画布锁定，阻止默认行为不再执行。在 firefox 上拖拽图片会打开新页
      event.preventDefault();
      event.stopPropagation();
      const json =
        event.dataTransfer.getData('Topology') ||
        event.dataTransfer.getData('Text');
      let obj = null;
      if (!json) {
        const { files } = event.dataTransfer;
        if (files.length && files[0].type.match('image.*')) {
          // 必须是图片类型
          const isGif = files[0].type === 'image/gif';
          obj = await this.fileToPen(files[0], isGif);
        }
      }
      !obj && (obj = JSON.parse(json));
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
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 7750889 (drop 和 click 抽取一个方法出来使用)
    } catch {}
=======
    } catch(e) {}
>>>>>>> a5d70ab (catch e)
=======
    } catch (e) {}
>>>>>>> 41e008b (video)
  };

  async dropPens(pens: Pen[], e: Point) {
    for (const pen of pens) {
      // 只修改 树根处的 祖先节点, randomCombineId 会递归更改子节点
      !pen.parentId && this.randomCombineId(pen, pens);
    }
    for (const pen of pens) {
      // TODO: randomCombineId 会更改 id， 此处应该不存在空 id
      if (!pen.id) {
        pen.id = s8();
      }
      !pen.calculative && (pen.calculative = { canvas: this });
      this.store.pens[pen.id] = pen;
    }
    // // 计算区域
    // for (const pen of pens) {
    //   // 组合节点才需要提前计算
    //   Array.isArray(pen.children) && pen.children.length > 0 && this.updatePenRect(pen);
    // }
    for (const pen of pens) {
      if (!pen.parentId) {
        pen.width *= this.store.data.scale;
        pen.height *= this.store.data.scale;
        pen.x = e.x - pen.width / 2;
        pen.y = e.y - pen.height / 2;
      }
    }
    await this.addPens(pens, true);
    this.active(pens.filter((pen) => !pen.parentId));
    this.render();
    this.externalElements.focus(); // 聚焦
  }

  randomCombineId(pen: Pen, pens: Pen[], parentId?: string) {
    randomId(pen);
    pen.parentId = parentId;
    const newChildren = [];
    if (Array.isArray(pen.children)) {
      for (const childId of pen.children) {
        const childPen = pens.find((pen) => pen.id === childId);
        childPen &&
          newChildren.push(this.randomCombineId(childPen, pens, pen.id).id);
        // TODO: 既已成为 组合节点，连接关系是否仍需要考虑呢？
      }
    }
    pen.children = newChildren;
    return pen;
  }

  async addPens(pens: Pen[], history?: boolean): Promise<Pen[]> {
    if (this.beforeAddPens && (await this.beforeAddPens(pens)) != true) {
      return [];
    }
    const list: Pen[] = [];
    for (const pen of pens) {
      if (this.beforeAddPen && this.beforeAddPen(pen) != true) {
        continue;
      }
      this.makePen(pen);
      list.push(pen);
    }
    this.render();
    this.store.emitter.emit('add', list);
    if (history) {
      this.pushHistory({ type: EditType.Add, pens: deepClone(list, true) });
    }
    return list;
  }

  ontouchstart = (e: TouchEvent) => {
    if (this.store.data.locked === LockState.Disable) {
      return;
    }
    if (this.touchStartTimer) {
      clearTimeout(this.touchStartTimer);
    }
    this.touchStartTimer = setTimeout(() => {
      this.touchStart = performance.now();
      const x = e.touches[0].pageX - this.clientRect.x;
      const y = e.touches[0].pageY - this.clientRect.y;
      const pos: Point = { x, y };
      this.calibrateMouse(pos);
      this.getHover(pos);
      this.onMouseDown({
        x,
        y,
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
        pageX: e.touches[0].pageX,
        pageY: e.touches[0].pageY,
        ctrlKey: e.ctrlKey || e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        buttons: 1,
      });

      if (e.touches.length === 2) {
        this.initTouchDis = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY
        );
        this.initScale = this.store.data.scale;
        this.startTouches = e.touches;
        this.touchCenter = {
          x:
            e.touches[0].pageX +
            (e.touches[1].pageX - e.touches[0].pageX) / 2 -
            this.clientRect.x,
          y:
            e.touches[0].pageY +
            (e.touches[1].pageY - e.touches[0].pageY) / 2 -
            this.clientRect.y,
        };

        return;
      } else if (e.touches.length === 3) {
        this.store.emitter.emit('contextmenu', {
          e: {
            x,
            y,
            clientX: e.touches[0].clientX,
            clientY: e.touches[0].clientY,
            pageX: e.touches[0].pageX,
            pageY: e.touches[0].pageY,
          },
          clientRect: this.clientRect,
        });

        e.preventDefault();
        e.stopPropagation();
      }

      this.touchStartTimer = undefined;
    }, 50);
  };

  ontouchmove = (event: TouchEvent) => {
    if (this.store.data.locked === LockState.Disable) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const now = performance.now();
    if (now - this.touchStart < 50) {
      return;
    }
    this.touchStart = now;

    const touches = event.touches;
    const len = touches.length;

    const x = event.touches[0].pageX - this.clientRect.x;
    const y = event.touches[0].pageY - this.clientRect.y;

    if (len === 1) {
      this.onMouseMove({
        x,
        y,
        clientX: event.changedTouches[0].clientX,
        clientY: event.changedTouches[0].clientY,
        pageX: event.changedTouches[0].pageX,
        pageY: event.changedTouches[0].pageY,
        ctrlKey: event.ctrlKey || event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        buttons: 1,
      });
    } else if (len === 2 && this.startTouches?.length === 2) {
      if (!this.touchMoving && !this.touchScaling) {
        const x1 = this.startTouches[0].pageX - touches[0].pageX;
        const x2 = this.startTouches[1].pageX - touches[1].pageX;
        const y1 = this.startTouches[0].pageY - touches[0].pageY;
        const y2 = this.startTouches[1].pageY - touches[1].pageY;
        if (
          ((x1 >= 0 && x2 < 0) || (x1 <= 0 && x2 > 0)) &&
          ((y1 >= 0 && y2 < 0) || (y1 <= 0 && y2 > 0))
        ) {
          this.touchScaling = true;
        } else {
          this.touchMoving = true;
        }
      }

      if (this.touchScaling) {
        if (this.store.options.disableScale) {
          return;
        }
        const scale =
          Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          ) / this.initTouchDis;
        this.scale(this.initScale * scale, deepClone(this.touchCenter));
      }

      if (this.touchMoving) {
        if (
          this.store.data.locked >= LockState.DisableMove ||
          this.store.options.disableScale
        ) {
          return;
        }
        if (this.lastOffsetX) {
          const { scale } = this.store.data;
          this.translate(
            (x - this.lastOffsetX) / scale,
            (y - this.lastOffsetY) / scale
          );
        }

        this.lastOffsetX = x;
        this.lastOffsetY = y;
      }
    }
  };

  ontouchend = (event: TouchEvent) => {
    if (this.store.data.locked === LockState.Disable) {
      return;
    }
    this.touchCenter = undefined;
    this.touchScaling = undefined;
    this.touchMoving = undefined;
    this.startTouches = undefined;
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;

    const x = event.changedTouches[0].pageX - this.clientRect.x;
    const y = event.changedTouches[0].pageY - this.clientRect.y;

    this.onMouseUp({
      x,
      y,
      clientX: event.changedTouches[0].clientX,
      clientY: event.changedTouches[0].clientY,
      pageX: event.changedTouches[0].pageX,
      pageY: event.changedTouches[0].pageY,
      ctrlKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      buttons: 1,
    });
    this.render();
  };

  onGesturestart = (e) => {
    e.preventDefault();
  };

  /**
   * 获取初始化的 pencilLine
   * @param pt 需包含 penId
   */
  private getInitPencilLine(pt: Point): Pen {
    const { data, options } = this.store;
    const scale = data.scale;
    const lineWidth = data.lineWidth || 1;
    return {
      id: pt.penId,
      name: 'line',
      x: pt.x,
      y: pt.y,
      type: PenType.Line,
      calculative: {
        canvas: this,
        pencil: true,
        active: true,
        worldAnchors: [pt],
        lineWidth: lineWidth * scale,
      },
      fromArrow: data.fromArrow || options.fromArrow,
      toArrow: data.toArrow || options.toArrow,
      lineWidth,
    };
  }

  /**
   * 获取初始化的 drawingLine
   * @param pt 需包含 penId
   */
  private createDrawingLine(pt: Point): Pen {
    const { data, options } = this.store;
    const scale = data.scale;
    const lineWidth = data.lineWidth || 1;
    pt.penId = s8();
    return {
      id: pt.penId,
      name: 'line',
      lineName: this.drawingLineName,
      x: pt.x,
      y: pt.y,
      type: PenType.Line,
      calculative: {
        canvas: this,
        active: true,
        worldAnchors: [pt],
        lineWidth: lineWidth * scale,
      },
      fromArrow: data.fromArrow || options.fromArrow,
      toArrow: data.toArrow || options.toArrow,
      lineWidth,
    };
  }

  onMouseDown = (e: {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    buttons?: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) => {
    if (e.buttons === 2 && !this.drawingLine) {
      this.mouseRight = MouseRight.Down;
    }

    this.hideInput();
    if (
      this.store.data.locked === LockState.Disable ||
      (e.buttons !== 1 && e.buttons !== 2)
    ) {
      this.hoverType = HoverType.None;
      return;
    }

    if (this.magnifierCanvas.magnifier) {
      return;
    }

    this.calibrateMouse(e);
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;

    this.mouseDown = e;
    this.lastMouseTime = performance.now();

    // Set anchor of pen.
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      this.setAnchor(this.store.pointAt);
      return;
    }

    // Translate
    if (
      this.hotkeyType === HotkeyType.Translate ||
      this.mouseRight === MouseRight.Down
    ) {
      return;
<<<<<<< HEAD
    }
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    if (this.hoverType === HoverType.NodeAnchor && !this.drawingLineName) {
=======
    }   
    if (this.hoverType === HoverType.NodeAnchor && !this.drawingLineName && !this.movingAnchor) {
>>>>>>> 0689a6b (g moveAnchor)
=======
    if (
      this.hoverType === HoverType.NodeAnchor &&
      !this.drawingLineName &&
      !this.movingAnchor
    ) {
>>>>>>> 5475d7d (modify_锁定时下拉&enter闭合连线)
=======
    if (this.hoverType === HoverType.NodeAnchor && !this.drawingLineName && !this.movingAnchor) {
>>>>>>> c03a35c (mouse event optimize)
      // Start to draw a line.
      this.drawingLineName = this.store.options.drawingLineName;
    }
=======
>>>>>>> 748935f (draw line and pad)

    // 正在连线
    if (this.drawingLine) {
      // 单击在锚点上，完成绘画
      if (this.store.hoverAnchor) {
        const to = getToAnchor(this.drawingLine);
        to.x = this.store.hoverAnchor.x;
        to.y = this.store.hoverAnchor.y;
        connectLine(
          this.store.hover,
          this.store.hoverAnchor,
          this.drawingLine,
          to
        );
        this.drawline();
        this.finishDrawline(true);
        return;
      }

      // 右键，完成绘画
      if (
        e.buttons === 2 ||
        (this.drawingLineName === 'mind' &&
          this.drawingLine?.calculative.worldAnchors.length > 1)
      ) {
        this.finishDrawline(true);
        if (this.store.active[0].anchors[0].connectTo) {
          this.drawingLineName = '';
        } else {
          this.drawingLineName = this.store.options.drawingLineName;
        }
        return;
      }

      // 自动锚点（单击节点），完成绘画
      if (this.store.options.autoAnchor && this.hoverType === HoverType.Node) {
        const to = getToAnchor(this.drawingLine);
        const anchor = nearestAnchor(this.store.hover, e);
        to.x = anchor.x;
        to.y = anchor.y;
        this.drawingLine.autoTo = true;
        connectLine(this.store.hover, anchor, this.drawingLine, to);
        this.drawline();
        this.finishDrawline(true);

        return;
      }

      // 添加点
      const to = getToAnchor(this.drawingLine);

      if (to.isTemp) {
        this.drawingLine.calculative.activeAnchor =
          this.drawingLine.calculative.worldAnchors[
            this.drawingLine.calculative.worldAnchors.length - 2
          ];
        to.isTemp = undefined;
      } else {
        this.drawingLine.calculative.activeAnchor = to;
        this.drawingLine.calculative.worldAnchors.push({
          x: to.x,
          y: to.y,
          penId: to.penId,
        });
      }
      if (this.drawingLineName === 'polyline') {
        this.drawingLine.autoPolyline = false;
      }
      this.drawingLine.calculative.drawlineH = undefined;
      this.drawingLineName !== 'polyline' && this.drawline();
    }

    // 单击在节点上，通过自动锚点连线
    if (this.drawingLineName) {
      if (this.hoverType === HoverType.Node) {
        if (this.store.options.autoAnchor) {
          this.inactive(true);
          const anchor = nearestAnchor(this.store.hover, e);
          this.store.hoverAnchor = anchor;
          const pt: Point = { id: s8(), x: anchor.x, y: anchor.y };
          this.drawingLine = this.createDrawingLine(pt);
          this.drawingLine.autoFrom = true;
          connectLine(this.store.hover, anchor, this.drawingLine, pt);
        } else {
          this.inactive();
          this.hoverType = HoverType.None;
        }
      } else if (!this.drawingLine && this.drawingLineName !== 'curve') {
        this.inactive(true);
        const pt: Point = { id: s8(), x: e.x, y: e.y };
        this.drawingLine = this.createDrawingLine(pt);
        this.drawingLine.calculative.activeAnchor = pt;
      }
    } else if (this.pencil) {
      this.inactive(true);
      const penId = s8();
      const pt: Point = { x: e.x, y: e.y, id: s8(), penId };
      this.pencilLine = this.getInitPencilLine(pt);
    } else {
      switch (this.hoverType) {
        case HoverType.None:
          this.store.data.rule &&
            !this.store.options.disableRuleLine &&
            this.addRuleLine(e);
          this.inactive();
          break;
        case HoverType.Node:
        case HoverType.Line:
          if (this.store.hover) {
            const pen = getParent(this.store.hover, true) || this.store.hover;
            if (e.ctrlKey && !e.shiftKey) {
              if (pen.calculative.active) {
                this.willInactivePen = pen;
              } else {
                pen.calculative.active = true;
                setChildrenActive(pen); // 子节点也设置为active
                this.store.active.push(pen);
                this.store.emitter.emit('active', this.store.active);
              }
              this.patchFlags = true;
            } else if (e.ctrlKey && e.shiftKey && this.store.hover.parentId) {
              this.active([this.store.hover]);
            } else {
              if (!pen.calculative.active) {
                this.active([pen]);
              }
            }

            this.calcActiveRect();
          }
          break;
        case HoverType.LineAnchor:
          this.store.activeAnchor = this.store.hoverAnchor;
          this.store.hover.calculative.activeAnchor = this.store.hoverAnchor;
          this.active([this.store.hover]);
          break;
        case HoverType.LineAnchorPrev:
        case HoverType.LineAnchorNext:
          if (this.store.activeAnchor) {
            // 备份，方便移动锚点方向
            this.prevAnchor = { ...this.store.activeAnchor.prev };
            this.nextAnchor = { ...this.store.activeAnchor.next };
          }
          break;
        case HoverType.Resize:
          this.activeInitPos = [];
          this.store.active.forEach((pen) => {
            this.activeInitPos.push({
              x:
                (pen.calculative.worldRect.x - this.activeRect.x) /
                this.activeRect.width,
              y:
                (pen.calculative.worldRect.y - this.activeRect.y) /
                this.activeRect.height,
            });
          });
          break;
      }
      this.store.emitter.emit('mousedown', {
        x: e.x,
        y: e.y,
        pen: this.store.hover,
      });
    }

    this.render();
  };

  onMouseMove = (e: {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
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
    if (
      this.mouseDown &&
      !this.mouseDown.restore &&
      e.buttons !== 1 &&
      e.buttons !== 2
    ) {
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

    this.calibrateMouse(e);
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
    if (this.magnifierCanvas.magnifier) {
      this.render();
      return;
    }

    if (this.mouseDown) {
      // 画布平移前提
      if (this.mouseRight === MouseRight.Down) {
        this.mouseRight = MouseRight.Translate;
      }
      // Translate
      if (
        this.store.data.locked === LockState.DisableEdit ||
        this.hotkeyType === HotkeyType.Translate ||
        this.mouseRight === MouseRight.Translate
      ) {
        const { scale } = this.store.data;
        this.translate(
          (e.x - this.mouseDown.x) / scale,
          (e.y - this.mouseDown.y) / scale
        );
        return;
      }

      if (this.store.data.locked) {
        return;
      }

      if (!this.drawingLine && !this.pencil) {
        if (!this.drawingLineName && !this.movingAnchor) {
          // 在锚点上开始连线
          if (this.hoverType === HoverType.NodeAnchor) {
            this.drawingLineName = this.store.options.drawingLineName;
            const pt: Point = {
              id: s8(),
              x: this.store.hoverAnchor.x,
              y: this.store.hoverAnchor.y,
            };
            this.drawingLine = this.createDrawingLine(pt);
            this.drawingLine.calculative.activeAnchor = pt;
            connectLine(
              this.store.hover,
              this.store.hoverAnchor,
              this.drawingLine,
              pt
            );
            this.drawline();
            return;
          }
        }
        // 钢笔画线
        else if (this.drawingLineName && this.hoverType === HoverType.None) {
          const pt: Point = { id: s8(), x: e.x, y: e.y };
          this.drawingLine = this.createDrawingLine(pt);
          this.drawingLine.calculative.activeAnchor = pt;
          this.drawline();
          return;
        }

        // 框选
        if (e.buttons === 1 && !this.hoverType && !this.hotkeyType) {
          this.dragRect = {
            x: Math.min(this.mouseDown.x, e.x),
            y: Math.min(this.mouseDown.y, e.y),
            ex: Math.max(this.mouseDown.x, e.x),
            ey: Math.max(this.mouseDown.y, e.y),
            width: Math.abs(e.x - this.mouseDown.x),
            height: Math.abs(e.y - this.mouseDown.y),
          };
          this.render();
          return;
        }

        // 移动节点瞄点
        if (this.movingAnchor) {
          const x = e.x - this.movingAnchor.x;
          const y = e.y - this.movingAnchor.y;
          this.translateAnchor(x, y);
          this.render();
          return;
        } else if (!this.store.active[0]?.locked) {
          const pt = { x: e.x, y: e.y };
          // Move line anchor
          if (this.hoverType === HoverType.LineAnchor) {
            if (!this.dockInAnchor(e) && !this.store.options.disableDockLine) {
              this.clearDock();

              this.dock = calcAnchorDock(
                this.store,
                pt,
                this.store.activeAnchor
              );
              this.dock?.xDock && (pt.x += this.dock.xDock.step);
              this.dock?.yDock && (pt.y += this.dock.yDock.step);
            }
            this.moveLineAnchor(pt);
            return;
          }

          // Move line anchor prev
          if (this.hoverType === HoverType.LineAnchorPrev) {
            this.moveLineAnchorPrev(e);
            return;
          }

          // Move line anchor next
          if (this.hoverType === HoverType.LineAnchorNext) {
            this.moveLineAnchorNext(e);
            return;
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
        if (
          this.hoverType === HoverType.Node ||
          this.hoverType === HoverType.Line
        ) {
          const x = e.x - this.mouseDown.x;
          const y = e.y - this.mouseDown.y;
          const shake = 20;
          if (
            e.ctrlKey &&
            !e.shiftKey &&
            !this.alreadyCopy &&
            (Math.abs(x) >= shake || Math.abs(y) >= shake)
          ) {
            this.alreadyCopy = true;
            this.willInactivePen = undefined;
          }
          if (this.store.active.length === 1) {
            const activePen = this.store.active[0];
            if (activePen.locked < LockState.DisableMove) {
              activePen?.onMouseMove?.(activePen, this.mousePos);
            }
          }
          this.movePens(e);
          return;
        }
      } else if (this.pencil) {
        const pt: Point = { ...e };
        pt.id = s8();
        pt.penId = this.pencilLine.id;
        this.pencilLine.calculative.worldAnchors.push(pt);
        this.store.path2dMap.set(
          this.pencilLine,
          globalStore.path2dDraws[this.pencilLine.name](this.pencilLine)
        );
        this.patchFlags = true;
      }
    }

    if (this.drawingLine) {
      const pt: Point = { ...e };
      pt.id = s8();
      pt.penId = this.drawingLine.id;

      // dock
      if (!this.store.options.disableDockLine) {
        this.clearDock();
        this.dock = calcAnchorDock(this.store, pt);
        this.dock?.xDock && (pt.x += this.dock.xDock.step);
        this.dock?.yDock && (pt.y += this.dock.yDock.step);
      }
      if (
        this.mouseDown &&
        this.drawingLineName === 'curve' &&
        !this.drawingLine.calculative.worldAnchors[0].connectTo
      ) {
        this.drawline(pt);
      } else {
        let to: Point;
        if (this.drawingLine.calculative.worldAnchors.length > 1) {
          to = getToAnchor(this.drawingLine);
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
        if (this.hoverType === HoverType.NodeAnchor || this.hoverType === HoverType.LineAnchor) {
          to.x = this.store.hoverAnchor.x;
          to.y = this.store.hoverAnchor.y;
          to.connectTo = this.store.hoverAnchor.penId;
        }

        if (this.drawingLineName === 'line') {
          if (e.ctrlKey) {
            to.y =
              this.drawingLine.calculative.worldAnchors[
                this.drawingLine.calculative.worldAnchors.length - 2
              ].y;
          } else if (e.altKey) {
            to.x =
              this.drawingLine.calculative.worldAnchors[
                this.drawingLine.calculative.worldAnchors.length - 2
              ].x;
          }
        }

        this.drawline();
      }
<<<<<<< HEAD
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
      // 移动节点瞄点
      if (this.movingAnchor && !this.store.data.locked) {
        const x = e.x - this.movingAnchor.x;
        const y = e.y - this.movingAnchor.y;
        this.translateMovingAnchor(x, y);
        this.render(false);
        return;
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
<<<<<<< HEAD
<<<<<<< HEAD
      if (this.hoverType === HoverType.Node || this.hoverType === HoverType.Line) {
<<<<<<< HEAD
<<<<<<< HEAD
        // TODO: 选中状态 ctrl 点击会失去焦点，不会执行到这里的复制操作
<<<<<<< HEAD
<<<<<<< HEAD
        if (e.ctrlKey && !this.alreadyCopy) {
=======
        if(!this.store.data.locked && e.ctrlKey && !this.alreadyCopy) {
>>>>>>> f36b9f0 (节点与画布的 locked 控制)
=======
=======
>>>>>>> d5ef910 (设置 fontSize 等属性后，应该重现计算 calculative)
        if (!this.store.data.locked && e.ctrlKey && !e.shiftKey && !this.alreadyCopy) {
>>>>>>> e3ae456 (ctrl shift 同时按下时，可以选中子节点)
=======
=======
      if (
        this.hoverType === HoverType.Node ||
        this.hoverType === HoverType.Line
      ) {
>>>>>>> 5475d7d (modify_锁定时下拉&enter闭合连线)
=======
      if (this.hoverType === HoverType.Node || this.hoverType === HoverType.Line) {
>>>>>>> c03a35c (mouse event optimize)
        const x = e.x - this.mouseDown.x;
        const y = e.y - this.mouseDown.y;
        const shake = 20;
<<<<<<< HEAD
        if (!this.store.data.locked && e.ctrlKey && !e.shiftKey && !this.alreadyCopy && (Math.abs(x) >= shake || Math.abs(y) >= shake)) {
>>>>>>> 48fadae (ctrl + 拖拽复制的操作限制 20防抖，防误操作)
=======
        if (
          !this.store.data.locked &&
          e.ctrlKey &&
          !e.shiftKey &&
          !this.alreadyCopy &&
          (Math.abs(x) >= shake || Math.abs(y) >= shake)
        ) {
>>>>>>> 748e30c (contextmenu log)
          this.alreadyCopy = true;
          this.willInactivePen = undefined;
        }
        if (this.store.active.length === 1) {
          const activePen = this.store.active[0];
          if (this.store.data.locked === LockState.DisableMove || activePen.locked === LockState.DisableMove) {
            activePen?.onMouseMove?.(activePen, this.mousePos);
          }
        }
        this.movePens(e);
        return;
      }

      if (!this.store.active[0]?.locked) {
        // Move line anchor
        if (this.hoverType === HoverType.LineAnchor) {
          this.getAnchorDock(e);
          this.moveLineAnchor(e);
          return;
        }

        // Move line anchor prev
        if (this.hoverType === HoverType.LineAnchorPrev) {
          this.moveLineAnchorPrev(e);
          return;
        }

        // Move line anchor next
        if (this.hoverType === HoverType.LineAnchorNext) {
          this.moveLineAnchorNext(e);
          return;
        }
      }

      if (!this.dragRect) {
        return;
      }
=======
>>>>>>> 748935f (draw line and pad)
    }

    globalThis.debug && console.time('hover');
    const now = performance.now();
    if (now - this.hoverTimer > 50) {
      this.hoverTimer = now;
      this.getHover(e);
    }
    globalThis.debug && console.timeEnd('hover');
    if (this.hotkeyType === HotkeyType.AddAnchor) {
      this.patchFlags = true;
    }
    this.render(false);
  };

  onMouseUp = (e: {
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
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

    if (!this.mouseDown) {
      return;
    }

    if (this.mouseRight === MouseRight.Down) {
      this.store.emitter.emit('contextmenu', {
        e,
        clientRect: this.clientRect,
      });
    }
    this.mouseRight = MouseRight.None;

    this.calibrateMouse(e);
    this.mousePos.x = e.x;
    this.mousePos.y = e.y;
    this.pencil && this.finishPencil();

    if (this.drawingLine) {
      // 在锚点上，完成绘画
      if (this.store.hoverAnchor) {
        const to = getToAnchor(this.drawingLine);
        to.x = this.store.hoverAnchor.x;
        to.y = this.store.hoverAnchor.y;
        connectLine(
          this.store.hover,
          this.store.hoverAnchor,
          this.drawingLine,
          to
        );
        this.drawline();
        this.finishDrawline(true);
        return;
      }

      // 自动锚点（单击节点），完成绘画
      if (this.store.options.autoAnchor && this.hoverType === HoverType.Node) {
        const to = getToAnchor(this.drawingLine);
        const anchor = nearestAnchor(this.store.hover, e);
        to.x = anchor.x;
        to.y = anchor.y;
        this.drawingLine.autoTo = true;
        connectLine(this.store.hover, anchor, this.drawingLine, to);
        this.drawline();
        this.finishDrawline(true);

        return;
      }
    }

    // 拖拽连线锚点
    if (
      this.hoverType === HoverType.LineAnchor &&
      this.store.hover &&
      this.store.active[0] &&
      this.store.active[0].name === 'line' &&
      this.store.active[0] !== this.store.hover
    ) {
      const line = this.store.active[0];
      const from = getFromAnchor(line);
      const to = getToAnchor(line);
      if (this.store.hoverAnchor) {
        const hover = this.store.hover;
        const isHoverFrom = getFromAnchor(hover) === this.store.hoverAnchor;
        const isHoverTo = getToAnchor(hover) === this.store.hoverAnchor;
        const isActiveFrom = from === this.store.activeAnchor;
        const isActiveTo = to === this.store.activeAnchor;
        if (
          (e.ctrlKey || e.altKey) &&
          hover.type === PenType.Line &&
          (isHoverFrom || isHoverTo) &&
          (isActiveFrom || isActiveTo)
        ) {
          // 合并连线
          const hoverAnchors: Point[] = hover.calculative.worldAnchors.map(
            (anchor) => {
              return {
                ...anchor,
                penId: line.id,
              };
            }
          );
          if (isHoverFrom) {
            hoverAnchors.shift();
          } else if (isHoverTo) {
            hoverAnchors.pop();
          }
          if ((isHoverFrom && isActiveFrom) || (isHoverTo && isActiveTo)) {
            hoverAnchors.reverse();
          }
          if (isActiveFrom) {
            line.calculative.worldAnchors[0].connectTo = undefined;
            line.calculative.worldAnchors.unshift(...hoverAnchors);
          } else if (isActiveTo) {
            line.calculative.worldAnchors[
              line.calculative.worldAnchors.length - 1
            ].connectTo = undefined;
            line.calculative.worldAnchors.push(...hoverAnchors);
          }
          this.delete([hover]);
          // TODO: 历史记录

          this.render();
        } else {
          // 连接连线
          if (this.store.activeAnchor) {
            this.store.activeAnchor.x = this.store.hoverAnchor.x;
            this.store.activeAnchor.y = this.store.hoverAnchor.y;

            connectLine(
              this.store.hover,
              this.store.hoverAnchor,
              line,
              this.store.activeAnchor
            );
          }
        }
        if (this[line.lineName]) {
          this[line.lineName](this.store, line);
        }
        this.store.path2dMap.set(line, globalStore.path2dDraws.line(line));
        this.initLineRect(line);
      } else {
        // 连线起始点自动关联 到 pen
        if (from === this.store.activeAnchor && line.autoFrom) {
          this.calcAutoAnchor(line, from, this.store.hover);
        } else if (to === this.store.activeAnchor && line.autoTo) {
          this.calcAutoAnchor(line, to, this.store.hover);
        }
      }
    }

    // Add pen
    if (this.addCaches) {
      if (!this.store.data.locked) {
        this.dropPens(this.addCaches, e);
      }
      this.addCaches = undefined;
    }

    // Rotate
    if (this.hoverType === HoverType.Rotate) {
      this.getSizeCPs();
      this.store.active.forEach((pen) => {
        pen.rotate = pen.calculative.rotate;
      });
    }

    this.patchFlagsLines.forEach((pen) => {
      if (pen.type) {
        this.initLineRect(pen);
      }
    });
    this.patchFlagsLines.clear();

    if (this.dragRect) {
      const pens = this.store.data.pens.filter((pen) => {
        if (
          pen.visible === false ||
          pen.locked === LockState.Disable ||
          pen.parentId
        ) {
          return false;
        }
        if (
          rectInRect(
            pen.calculative.worldRect,
            this.dragRect,
            this.store.options.dragAllIn
          )
        ) {
          // 先判断在区域内，若不在区域内，则锚点肯定不在框选区域内，避免每条连线过度计算
          if (pen.type === PenType.Line && !this.store.options.dragAllIn) {
            return lineInRect(pen, this.dragRect);
          }
          return true;
        }
      });
      this.active(pens);
    }

    if (e.button !== 2) {
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

      this.store.emitter.emit('mouseup', {
        x: e.x,
        y: e.y,
        pen: this.store.hover,
      });
    }

    if (this.willInactivePen) {
      this.willInactivePen.calculative.active = undefined;
      setChildrenActive(this.willInactivePen, false); // 子节点取消激活
      this.store.active.splice(
        this.store.active.findIndex((p) => p === this.willInactivePen),
        1
      );
      this.calcActiveRect();
      this.willInactivePen = undefined;
      this.store.emitter.emit('inactive', [this.willInactivePen]);
      this.render();
    }

    if (this.movingPens) {
      if (!this.alreadyCopy) {
        this.movedActivePens();
      } else {
        this.copyMovedPens();
      }
      this.getAllByPens(this.movingPens).forEach((pen) => {
        this.store.pens[pen.id] = undefined;
      });
      this.movingPens = undefined;
      this.translatePens(this.movingPens, 0, 0);
    }

    this.mouseDown = undefined;
    this.lastOffsetX = 0;
    this.lastOffsetY = 0;
    this.clearDock();
    this.dragRect = undefined;
    this.initActiveRect = undefined;
  };

  private addRuleLine(e: { x: number; y: number }) {
    const { x: offsetX, y: offsetY } = this.store.data;
    // 靠近左上角的 x ，y
    const x = e.x + offsetX;
    const y = e.y + offsetY;
    let lineX = e.x;
    let lineY = e.y;
    let width = 0;
    let height = 0;
    let otherPX = 0;
    let otherPY = 0;
    if (x <= y && x < 20) {
      // 绘制一条水平线
      lineX = -offsetX;
      width = this.width;
      otherPX = 1;
    } else if (y < x && y < 20) {
      // 绘制一条垂直线
      lineY = -offsetY;
      height = this.height;
      otherPY = 1;
    } else {
      return;
    }
    this.addPen({
      isRuleLine: true,
      // locked: LockState.DisableMove,
      type: PenType.Line,
      name: 'line',
      lineName: 'line',
      x: lineX,
      y: lineY,
      width,
      height,
      color: this.store.options.ruleLineColor,
      anchors: [
        {
          x: 0,
          y: 0,
        },
        {
          x: otherPX,
          y: otherPY,
        },
      ],
    });
  }

  /**
   * 拖拽结束，数据更新到 active.pens
   */
  private movedActivePens() {
    // 鼠标松手才更新，此处是更新前的值
    const initPens = deepClone(this.store.active, true);
    this.store.active.forEach((pen, i: number) => {
      const { x, y } = this.movingPens[i];
      Object.assign(pen, {
        x,
        y,
      });
      pen.onMove?.(pen);
      this.updatePenRect(pen);
      this.updateLines(pen);
      // TODO: mouseup 中重复执行 patchFlagsLines
      this.patchFlagsLines.forEach((pen) => {
        if (pen.type) {
          this.initLineRect(pen);
        }
      });
      this.patchFlagsLines.clear();
      pen.calculative.x = pen.x;
      pen.calculative.y = pen.y;
      if (pen.calculative.initRect) {
        pen.calculative.initRect.x = pen.calculative.x;
        pen.calculative.initRect.y = pen.calculative.y;
        pen.calculative.initRect.ex = pen.calculative.x + pen.calculative.width;
        pen.calculative.initRect.ey =
          pen.calculative.y + pen.calculative.height;
      }
    });
    // active 消息表示拖拽结束
    this.store.emitter.emit('active', this.store.active);
    this.initImageCanvas(this.store.active);
    // 此处是更新后的值
    this.pushHistory({
      type: EditType.Update,
      pens: deepClone(this.store.active, true),
      initPens,
    });
  }

  /**
   * 复制移动后的笔
   */
  private copyMovedPens() {
    // 复制行为
    this.copy(
      this.store.active.map((pen, i: number) => {
        // TODO: 移动只更改 x,y 值，不更新其他属性
        // 若需要更改 anchors ，注意 anchors connectTo 问题
        // const { x, y, width, height, anchors } = this.movingPens[i];
        /**
         * TODO: line 类型无法取到移动后的 x，y 值
         * 所以 patchFlagsLines 需要放到 copyMovedPens 前
         * */
        const { x, y } = this.movingPens[i];
        return {
          ...pen,
          x,
          y,
        };
      })
    );
    // 偏移量 0
    this.pasteOffset = 0;
    this.paste();
    this.alreadyCopy = false;
  }

  /**
   * 若本次改变的画笔存在图片，并且在上层 or 下层，需要擦除上层 or 下层
   * 子节点中包含图片，也需要重绘
   * @param pens 本次改变的 pens
   */
  initImageCanvas(pens: Pen[]) {
    pens.some((pen) => this.hasImage(pen, false)) && this.canvasImage.init();
    pens.some((pen) => this.hasImage(pen, true)) &&
      this.canvasImageBottom.init();
  }

  private hasImage(pen: Pen, isBottom: boolean): boolean {
    if (pen.image && pen.name !== 'gif' && !pen.isBottom == !isBottom) {
      return true;
    }
    return pen.children?.some((childId: string) => {
      const child = this.store.pens[childId];
      return child && this.hasImage(child, isBottom);
    });
  }

  private clearDock = () => {
    const xPenId = this.dock?.xDock?.penId;
    const yPenId = this.dock?.yDock?.penId;
    const xPen = this.store.pens[xPenId];
    if (xPen) {
      xPen.calculative.isDock = false;
    }
    const yPen = this.store.pens[yPenId];
    if (yPen) {
      yPen.calculative.isDock = false;
    }
    this.dock = undefined;
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
    this.patchFlags = true;
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
    this.patchFlags = true;
    emit && this.store.emitter.emit('active', this.store.active);
  }

  getSizeCPs() {
    this.sizeCPs = rectToPoints(this.activeRect);
    // 正上 正右 正下 正左
    const pts = [
      { x: 0.5, y: 0 },
      { x: 1, y: 0.5 },
      { x: 0.5, y: 1 },
      { x: 0, y: 0.5 },
    ] as const;
    const { x, y, width, height, rotate, center } = this.activeRect;
    pts.forEach((pt) => {
      const p = {
        x: pt.x * width + x,
        y: pt.y * height + y,
      };
      rotatePoint(p, rotate, center);
      this.sizeCPs.push(p);
    });
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

  onScroll = () => {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.clientRect = this.canvas.getBoundingClientRect();
      this.timer = undefined;
    }, 100);
  };

  calibrateMouse = (pt: Point) => {
    pt.x -= this.store.data.x;
    pt.y -= this.store.data.y;
    return pt;
  };

  clearHover() {
    this.hoverType = HoverType.None;
    this.store.hover = null;
    this.store.hoverAnchor = null;
  }

  private getHover = (pt: Point) => {
    if (this.dragRect) {
      return;
    }
    let hoverType = HoverType.None;
    this.store.hover = undefined;
    this.store.hoverAnchor = undefined;
    this.store.pointAt = undefined;
    this.store.pointAtIndex = undefined;
    const activeLine =
      this.store.active.length === 1 && this.store.active[0].type;
    if (
      !this.drawingLineName &&
      this.activeRect &&
      !activeLine &&
      !this.store.data.locked
    ) {
      const activePensLock = getPensLock(this.store.active);
      const activePensDisableRotate =
        getPensDisableRotate(this.store.active) ||
        this.store.options.disableRotate;
      const activePensDisableResize =
        getPensDisableResize(this.store.active) ||
        this.store.options.disableSize;
      if (!activePensLock && !activePensDisableRotate) {
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
          this.externalElements.style.cursor = `url("${this.store.options.rotateCursor}"), auto`;
        }
      }

      // 大小控制点
      if (!activePensLock && !activePensDisableResize) {
        for (let i = 0; i < 8; i++) {
          const firstFour = i < 4;
          const hotKeyIsResize =
            this.hotkeyType === HotkeyType.Resize ||
            (firstFour && !this.hotkeyType);
          if (hotKeyIsResize && hitPoint(pt, this.sizeCPs[i], this.pointSize)) {
            let cursors = firstFour ? defaultCursors : rotatedCursors;
            let offset = 0;
            if (Math.abs((this.activeRect.rotate % 90) - 45) < 25) {
              cursors = firstFour ? rotatedCursors : defaultCursors;
              offset =
                Math.round((this.activeRect.rotate - 45) / 90) +
                (firstFour ? 0 : 1);
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
      hoverType = this.inPens(pt, this.store.data.pens);
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
      this.patchFlags = true;
      if (this.store.lastHover) {
        this.store.lastHover.calculative.hover = false;
        setHover(
          getParent(this.store.lastHover, true) || this.store.lastHover,
          false
        );
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

    this.store.hover?.onMouseMove?.(this.store.hover, this.mousePos);
  };

  private inPens = (pt: Point, pens: Pen[]) => {
    let hoverType = HoverType.None;
    outer: for (let i = pens.length - 1; i >= 0; --i) {
      const pen = pens[i];
      if (
        pen.visible == false ||
        pen.calculative.inView == false ||
        pen.locked === LockState.Disable
      ) {
        continue;
      }

      const r = getLineR(pen);
      if (
        !pen.calculative.active &&
        !pointInSimpleRect(pt, pen.calculative.worldRect, r) &&
        !pointInRect(pt, pen.calculative.worldRect)
      ) {
        continue;
      }
      // 锚点
      if (!this.store.data.locked && this.hotkeyType !== HotkeyType.Resize) {
        if (pen.calculative.worldAnchors) {
          for (const anchor of pen.calculative.worldAnchors) {
            hoverType = this.inAnchor(pt, pen, anchor);
            if (hoverType) {
              break outer;
            }
          }
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
          const pens = []; // TODO: 只考虑了一级子
          pen.children.forEach((id) => {
            pens.push(this.store.pens[id]);
          });
          hoverType = this.inPens(pt, pens);
          if (hoverType) {
            break;
          }
        }

        let isIn = false;
        if (pen.name === 'line') {
          isIn = pointInSimpleRect(
            pt,
            pen.calculative.worldRect,
            pen.lineWidth
          );
        } else {
          isIn = pointInRect(pt, pen.calculative.worldRect);
        }
        if (isIn) {
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
          // 锚点贴边吸附
<<<<<<< HEAD
          let {x,y, ex, ey, rotate, center} = this.store.hover.calculative.worldRect;
          if (rotate) {
            const pts: Point[] = [
              { x, y },
              { x: ex, y: y },
              { x: ex, y: ey },
              { x: x, y: ey },
            ];
            pts.forEach((item: Point) => {  
              rotatePoint(item, rotate, center);
            });
            let last = pts[pts.length - 1];
            for (const item of pts) {
              if (last.y > pt.y !== item.y > pt.y) {
                const tempx = item.x + (pt.y - item.y) * (last.x - item.x) / (last.y - item.y);
                if (Math.abs(tempx - this.store.pointAt.x) < 7) {
                  this.store.pointAt.x = tempx;
                } 
=======
          if (!(pt as any).ctrlKey) {
            let { x, y, ex, ey, rotate, center } =
              this.store.hover.calculative.worldRect;
            if (rotate) {
              const pts: Point[] = [
                { x, y },
                { x: ex, y: y },
                { x: ex, y: ey },
                { x: x, y: ey },
              ];
              pts.forEach((item: Point) => {
                rotatePoint(item, rotate, center);
              });
              let last = pts[pts.length - 1];
              for (const item of pts) {
                if (last.y > pt.y !== item.y > pt.y) {
                  const tempx =
                    item.x +
                    ((pt.y - item.y) * (last.x - item.x)) / (last.y - item.y);
                  if (Math.abs(tempx - this.store.pointAt.x) < 10) {
                    this.store.pointAt.x = tempx;
                  }
                }
                last = item;
              }
            } else {
              if (this.store.pointAt.x - 10 < x) {
                this.store.pointAt.x = x;
              } else if (this.store.pointAt.x + 10 > ex) {
                this.store.pointAt.x = ex;
              }
              if (this.store.pointAt.y - 10 < y) {
                this.store.pointAt.y = y;
              } else if (this.store.pointAt.y + 10 > ey) {
                this.store.pointAt.y = ey;
>>>>>>> c2df768 (fix bug: line)
              }
              last = item;
            }
          } else {
            if (this.store.pointAt.x - 6 < x) {
              this.store.pointAt.x = x;
            } else if (this.store.pointAt.x + 5 > ex) {
              this.store.pointAt.x = ex;
            }
            if (this.store.pointAt.y - 6 < y) {
              this.store.pointAt.y = y;
            } else if (this.store.pointAt.y + 5 > ey) {
              this.store.pointAt.y = ey;
            }
          }
          break;
        }
      }
    }

    return hoverType;
  };

  private dockInAnchor = (pt: Point) => {
    this.store.hover = undefined;

    for (let i = this.store.data.pens.length - 1; i >= 0; --i) {
      const pen = this.store.data.pens[i];
      if (
        pen.visible == false ||
        pen.locked === LockState.Disable ||
        pen === this.store.active[0]
      ) {
        continue;
      }

      let r = getLineR(pen);
      r += 2 * this.store.options.anchorRadius;
      if (!pointInSimpleRect(pt, pen.calculative.worldRect, r)) {
        continue;
      }

      this.store.hover = pen;
      // 锚点
      if (this.hotkeyType !== HotkeyType.Resize) {
        if (pen.calculative.worldAnchors) {
          for (const anchor of pen.calculative.worldAnchors) {
            if (this.inAnchor(pt, pen, anchor)) {
              return true;
            }
          }
        }
      }
    }
  };

  inAnchor(pt: Point, pen: Pen, anchor: Point) {
    this.store.hoverAnchor = undefined;
    this.movingAnchor = undefined;
    if (!anchor) {
      return HoverType.None;
    }
    if (this.store.options.disableAnchor || pen.disableAnchor) {
      return HoverType.None;
    }
    if (hitPoint(pt, anchor, this.pointSize)) {
      if (anchor !== this.store.hoverAnchor) {
        this.patchFlags = true;
      }
      this.store.hoverAnchor = anchor;
      this.store.hover = pen;
      if (pen.type) {
        if (anchor.connectTo && !pen.calculative.active) {
          this.store.hover = this.store.pens[anchor.connectTo];
          if (this.store.hover) {
            this.store.hoverAnchor =
              this.store.hover.calculative.worldAnchors.find(
                (a) => a.id === anchor.anchorId
              );
            this.externalElements.style.cursor = 'crosshair';
            return HoverType.NodeAnchor;
          }
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
      if (
        pen.calculative.active &&
        anchor.prev &&
        hitPoint(pt, anchor.prev, this.pointSize)
      ) {
        this.store.hoverAnchor = anchor;
        this.store.hover = pen;
        this.externalElements.style.cursor = 'pointer';
        return HoverType.LineAnchorPrev;
      }

      if (
        pen.calculative.active &&
        anchor.next &&
        hitPoint(pt, anchor.next, this.pointSize)
      ) {
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

    this.canvasRect = {
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
    calcRightBottom(this.canvasRect);

    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    this.externalElements.style.width = w + 'px';
    this.externalElements.style.height = h + 'px';

    this.canvasImage.resize(w, h);
    this.canvasImageBottom.resize(w, h);
    this.magnifierCanvas.resize(w, h);

    w = (w * this.store.dpiRatio) | 0;
    h = (h * this.store.dpiRatio) | 0;

    this.canvas.width = w;
    this.canvas.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.clientRect = this.externalElements.getBoundingClientRect();

    this.canvas
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen
      .getContext('2d')
      .scale(this.store.dpiRatio, this.store.dpiRatio);
    this.offscreen.getContext('2d').textBaseline = 'middle';

    this.render();
    // TODO 窗口大小变化没有刷新图纸
    for (const pen of this.store.data.pens) {
      calcInView(pen);
    }
  }

  clearCanvas() {
    this.activeRect = undefined;
    this.sizeCPs = undefined;
    this.canvas
      .getContext('2d')
      .clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.offscreen
      .getContext('2d')
      .clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    this.canvasImage.clear();
    this.canvasImageBottom.clear();
  }

  async addPen(pen: Pen, history?: boolean): Promise<Pen> {
    if (this.beforeAddPens && (await this.beforeAddPens([pen])) != true) {
      return;
    }

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

    const { origin, scale } = this.store.data;
    action.origin = deepClone(origin);
    action.scale = scale;

    if (action.type !== EditType.Update && action.pens) {
      action.pens.forEach((pen) => {
        pen.calculative.layer = this.store.data.pens.findIndex(
          (p) => p.id === pen.id
        );
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
    this.store.emitter.emit('update', {
      previous: action.initPens,
      current: action.pens,
    });
  }

  undo() {
    if (
      this.store.data.locked ||
      this.store.historyIndex == null ||
      this.store.historyIndex < 0
    ) {
      return;
    }

    const action = this.store.histories[this.store.historyIndex--];
    this.doEditAction(action, true);
    let step = action.step;
    while (step > 1) {
      const action = this.store.histories[this.store.historyIndex--];
      this.doEditAction(action, true);
      step--;
    }
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
    let step = action.step;
    while (step > 1) {
      const action = this.store.histories[++this.store.historyIndex];
      this.doEditAction(action, false);
      step--;
    }
  }

  doEditAction(action: EditAction, undo: boolean) {
    this.inactive();
    this.store.hoverAnchor = undefined;
    this.store.hover = undefined;

    switch (action.type) {
      case EditType.Add:
        action.pens.forEach((aPen) => {
          const pen: Pen = deepClone(aPen, true);
          const i = this.store.data.pens.findIndex(
            (item) => item.id === pen.id
          );
          if (i > -1) {
            this.store.data.pens.splice(i, 1);
            this.store.pens[pen.id] = undefined;
            pen.calculative.canvas = this;
            this.store.animates.delete(pen);
            pen.onDestroy?.(pen);
          }
        });
        action.type = EditType.Delete;
        break;
      case EditType.Update:
        const pens = undo ? action.initPens : action.pens;
        pens.forEach((aPen) => {
          const pen: Pen = deepClone(aPen, true);
          const i = this.store.data.pens.findIndex(
            (item) => item.id === pen.id
          );
          if (i > -1) {
            pen.calculative = this.store.data.pens[i].calculative;
            this.store.data.pens[i] = pen;
            this.store.pens[pen.id] = pen;
            for (const k in pen) {
              if (typeof pen[k] !== 'object' || k === 'lineDash') {
                pen.calculative[k] = pen[k];
              }
            }
            pen.calculative.image = undefined;
            const rect = this.getPenRect(pen, action.origin, action.scale);
            this.setPenRect(pen, rect, false);
            this.updateLines(pen, true);
          }
        });
        break;
      case EditType.Delete:
        action.pens.forEach((aPen) => {
          const pen = deepClone(aPen, true);
          this.store.data.pens.splice(pen.calculative.layer, 0, pen);
          // 先放进去，pens 可能是子节点在前，而父节点在后
          this.store.pens[pen.id] = pen;
          pen.calculative.canvas = this;
        });
        action.pens.forEach((aPen) => {
          const pen = this.store.pens[aPen.id];
          const rect = this.getPenRect(pen, action.origin, action.scale);
          this.setPenRect(pen, rect, false);
          pen.calculative.image = undefined;
          pen.calculative.backgroundImage = undefined;
          pen.calculative.strokeImage = undefined;
          this.loadImage(pen);
        });
        action.type = EditType.Add;
        break;
    }
    if (action.type === EditType.Update) {
      this.initImageCanvas([...action.pens, ...action.initPens]);
    } else {
      this.initImageCanvas(action.pens);
    }
    this.render();

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
      !pen.pathId && (pen.pathId = s8());
      const paths = this.store.data.paths;
      !paths[pen.pathId] && (paths[pen.pathId] = pen.path);

      pen.path = undefined;
    }
    // end

    if (pen.lineWidth == undefined) {
      pen.lineWidth = 1;
    }
    const { fontSize, lineHeight } = this.store.options;
    if (!pen.fontSize) {
      pen.fontSize = fontSize;
    }
    if (!pen.lineHeight) {
      pen.lineHeight = lineHeight;
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

    this.updatePenRect(pen);

    if (pen.type) {
      // TODO: 上面 updatePenRect 方法会调用 initLineRect
      this.initLineRect(pen);
    } else if (!pen.anchors) {
      pen.anchors = pen.calculative.worldAnchors.map((pt) => {
        return calcRelativePoint(pt, pen.calculative.worldRect);
      });
    }
    !pen.rotate && (pen.rotate = 0);
    this.loadImage(pen);
  }

  drawline(mouse?: Point) {
    if (!this.drawingLine) {
      return;
    }

    this[this.drawingLineName]?.(this.store, this.drawingLine, mouse);
    this.store.path2dMap.set(
      this.drawingLine,
      globalStore.path2dDraws.line(this.drawingLine)
    );
    this.patchFlags = true;
  }

  initLineRect(pen: Pen) {
    if (!pen.calculative.worldAnchors?.length) {
      this._del([pen]);
      return;
    }
    if (!isFinite(pen.x) || !isFinite(pen.x)) {
      return;
    }
    if (pen.x == null || pen.y == null) {
      return;
    }
    const rect = getLineRect(pen);
    if (!pen.parentId) {
      Object.assign(pen, rect);
    }
    const { fontSize, lineHeight } = this.store.options;
    if (!pen.fontSize) {
      pen.fontSize = fontSize;
      pen.calculative.fontSize = pen.fontSize * this.store.data.scale;
    }
    if (!pen.lineHeight) {
      pen.lineHeight = lineHeight;
      pen.calculative.lineHeight = pen.lineHeight;
    }
    calcCenter(rect);
    pen.calculative.worldRect = rect;
    calcPadding(pen, rect);
    calcTextRect(pen);
    calcInView(pen);
    this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
    if (pen.calculative.worldAnchors) {
      pen.anchors = pen.calculative.worldAnchors.map((pt) => {
        return calcRelativePoint(pt, pen.calculative.worldRect);
      });
    }
  }

  drawingPencil() {
    lockedError(this.store);
    this.pencil = true;
    this.externalElements.style.cursor = 'crosshair';
  }

  stopPencil() {
    this.pencil = false;
    this.pencilLine = undefined;
    this.externalElements.style.cursor = 'default';
  }

  async finishDrawline(end?: boolean) {
    if (!this.drawingLine) {
      return;
    }
    const from = getFromAnchor(this.drawingLine);
    let to = getToAnchor(this.drawingLine);
    if (to.isTemp) {
      this.drawingLine.calculative.worldAnchors.pop();
      to = getToAnchor(this.drawingLine);
    }
    if (!end) {
      !to.connectTo && this.drawingLine.calculative.worldAnchors.pop();
      if (
        getFromAnchor(this.drawingLine) ===
        this.drawingLine.calculative.activeAnchor
      ) {
        this.drawingLine = undefined;
        this.render();
        return;
      }
    }
    if (!from.connectTo || !to.connectTo) {
      if (this.store.options.disableEmptyLine) {
        // 有一端未连线，且 禁止创建空线条
        this.drawingLine = undefined;
        this.render();
        return;
      }
    } else {
      if (this.store.options.disableRepeatLine) {
        // 两边都连上了锚点，且 禁止创建重复连线
        const line = this.store.data.pens.find((pen) => {
          if (pen.type) {
            const penFrom = getFromAnchor(pen);
            const penTo = getToAnchor(pen);
            return samePoint(penFrom, from) && samePoint(penTo, to);
          }
        });
        if (line) {
          // 存在重复连线
          this.drawingLine = undefined;
          this.render();
          return;
        }
      }
    }
    const rect = getLineRect(this.drawingLine);
    Object.assign(this.drawingLine, rect);
    this.drawingLine.calculative.worldRect = rect;
    this.drawingLine.calculative.activeAnchor = getToAnchor(this.drawingLine);
    this.store.activeAnchor = this.drawingLine.calculative.activeAnchor;
    const allowAdd =
      (!this.beforeAddPens || (await this.beforeAddPens([this.drawingLine]))) &&
      (!this.beforeAddPen || this.beforeAddPen(this.drawingLine));
    if (allowAdd) {
      this.initLineRect(this.drawingLine);
      this.store.data.pens.push(this.drawingLine);
      this.store.pens[this.drawingLine.id] = this.drawingLine;
      this.store.emitter.emit('add', [this.drawingLine]);
      this.active([this.drawingLine]);
      this.pushHistory({
        type: EditType.Add,
        pens: deepClone([this.drawingLine], true),
      });
    }

    this.store.path2dMap.set(
      this.drawingLine,
      globalStore.path2dDraws[this.drawingLine.name](this.drawingLine)
    );
    this.drawingLine = undefined;
    this.drawingLineName = undefined;
    this.render();
  }

  async finishPencil() {
    if (this.pencilLine) {
      const anchors: Point[] = simplify(
        this.pencilLine.calculative.worldAnchors,
        10,
        0,
        this.pencilLine.calculative.worldAnchors.length - 1
      );
      let p = getFromAnchor(this.pencilLine);
      anchors.unshift({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      p = getToAnchor(this.pencilLine);
      anchors.push({ id: p.id, penId: p.penId, x: p.x, y: p.y });
      this.pencilLine.calculative.worldAnchors = smoothLine(anchors);
      if (this.pencilLine.calculative.worldAnchors.length > 1) {
        this.pencilLine.calculative.pencil = false;
        this.store.path2dMap.set(
          this.pencilLine,
          globalStore.path2dDraws[this.pencilLine.name](this.pencilLine)
        );
        const allowAdd =
          (!this.beforeAddPens ||
            (await this.beforeAddPens([this.pencilLine]))) &&
          (!this.beforeAddPen || this.beforeAddPen(this.pencilLine));
        if (allowAdd) {
          this.initLineRect(this.pencilLine);
          this.store.data.pens.push(this.pencilLine);
          this.store.pens[this.pencilLine.id] = this.pencilLine;
          this.store.emitter.emit('add', [this.pencilLine]);
          this.active([this.pencilLine]);
          this.pushHistory({
            type: EditType.Add,
            pens: deepClone([this.pencilLine], true),
          });
        }
      }
      this.pencilLine = undefined;
      this.render();
    }
  }

  /**
   * 火狐浏览器无法绘制 svg 不存在 width height 的问题
   * 此方法手动添加 width 和 height 解决火狐浏览器绘制 svg
   * @param pen
   */
  private firefoxLoadSvg(pen: Pen) {
    const img = new Image();
    // request the XML of your svg file
    const request = new XMLHttpRequest();
    request.open('GET', pen.image, true);

    request.onload = () => {
      // once the request returns, parse the response and get the SVG
      const parser = new DOMParser();
      const result = parser.parseFromString(request.responseText, 'text/xml');
      const inlineSVG = result.getElementsByTagName('svg')[0];

      const { width, height } = pen.calculative.worldRect;
      // add the attributes Firefox needs. These should be absolute values, not relative
      inlineSVG.setAttribute('width', `${width}px`);
      inlineSVG.setAttribute('height', `${height}px`);

      // convert the SVG to a data uri
      const svg64 = btoa(
        unescape(
          encodeURIComponent(new XMLSerializer().serializeToString(inlineSVG))
        )
      );
      const image64 = 'data:image/svg+xml;base64,' + svg64;

      // set that as your image source
      img.src = image64;

      // do your canvas work
      img.onload = () => {
        pen.calculative.img = img;
        pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
        pen.calculative.imgNaturalHeight = img.naturalHeight || pen.iconHeight;
        globalStore.htmlElements[pen.image] = img;
        this.imageLoaded();
      };
    };
    // send the request
    request.send();
  }

  loadImage(pen: Pen) {
    if (pen.image !== pen.calculative.image) {
      pen.calculative.img = undefined;
      if (pen.image) {
        if (globalStore.htmlElements[pen.image]) {
          const img = globalStore.htmlElements[pen.image];
          pen.calculative.img = img;
          pen.calculative.imgNaturalWidth = img.naturalWidth || pen.iconWidth;
          pen.calculative.imgNaturalHeight =
            img.naturalHeight || pen.iconHeight;
          this.imageLoaded(); // TODO: 重绘图片层 有延时器，可能卡顿
        } else {
          if (
            navigator.userAgent.includes('Firefox') &&
            pen.image.endsWith('.svg')
          ) {
            // 火狐浏览器 svg 图片需要特殊处理
            this.firefoxLoadSvg(pen);
          } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = pen.image;
            img.onload = () => {
              pen.calculative.img = img;
              pen.calculative.imgNaturalWidth =
                img.naturalWidth || pen.iconWidth;
              pen.calculative.imgNaturalHeight =
                img.naturalHeight || pen.iconHeight;
              globalStore.htmlElements[pen.image] = img;
              this.imageLoaded();
            };
          }
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
            this.imageLoaded();
          };
        }
      }
      pen.calculative.strokeImage = pen.strokeImage;
    }
  }
  private imageTimer: NodeJS.Timeout;
  // 避免初始化图片加载重复调用 render，此处防抖
  imageLoaded() {
    this.imageTimer && clearTimeout(this.imageTimer);
    this.imageTimer = setTimeout(() => {
      // 加载完图片，重新渲染一次图片层
      this.canvasImage.init();
      this.canvasImageBottom.init();
      this.render();
    }, 100);
  }

  setCalculativeByScale(pen: Pen) {
    const scale = this.store.data.scale;
    pen.calculative.lineWidth = pen.lineWidth * scale;
    pen.calculative.fontSize = pen.fontSize * scale;
    if (pen.fontSize < 1) {
      pen.calculative.fontSize =
        pen.fontSize * pen.calculative.worldRect.height;
    }
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

  updatePenRect(
    pen: Pen,
    {
      worldRectIsReady,
      playingAnimate,
    }: {
      worldRectIsReady?: boolean;
      playingAnimate?: boolean;
      noChildren?: boolean;
    } = {}
  ) {
    if (worldRectIsReady) {
      calcPenRect(pen);
    } else {
      calcWorldRects(pen);
    }

    if (!playingAnimate) {
      this.setCalculativeByScale(pen);
    }

    calcWorldAnchors(pen);
    calcIconRect(this.store.pens, pen);
    calcTextRect(pen);
    calcInView(pen);
    globalStore.path2dDraws[pen.name] &&
      this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
    pen.calculative.patchFlags = true;
    this.patchFlags = true;

    if (pen.children) {
      pen.children.forEach((id) => {
        const child: Pen = this.store.pens[id];
        child && this.updatePenRect(child, { worldRectIsReady: false });
      });
    }

    pen.type && this.initLineRect(pen);
  }

  render = (patchFlags?: number | boolean) => {
    let now: number;
    if (patchFlags == null || patchFlags === true || patchFlags === Infinity) {
      now = performance.now();
      this.patchFlags = true;
    } else if (patchFlags > 1) {
      now = patchFlags as number;
    } else {
      now = performance.now();
    }
    if (!this.patchFlags) {
      return;
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
    offscreenCtx.save();
    offscreenCtx.translate(this.store.data.x, this.store.data.y);
    globalThis.debugRender && console.time('renderPens');
    this.renderPens();
    globalThis.debugRender && console.timeEnd('renderPens');
    this.renderBorder();
    this.renderHoverPoint();
    offscreenCtx.restore();
    this.magnifierCanvas.render();
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.offscreen, 0, 0, this.width, this.height);
    this.canvasImageBottom.render();
    this.canvasImage.render();
    this.patchFlags = false;
  };

  renderPens = () => {
    const ctx = this.offscreen.getContext('2d') as CanvasRenderingContext2D;
    ctx.strokeStyle = getGlobalColor(this.store);

    for (const pen of this.store.data.pens) {
      if (!isFinite(pen.x)) {
        continue;
      }

      if (pen.calculative.inView) {
        renderPen(ctx, pen);
      }
    }

    if (this.drawingLine) {
      renderPen(ctx, this.drawingLine);
    }
    if (this.pencilLine) {
      renderPen(ctx, this.pencilLine);
    }
    if (this.movingPens) {
      this.movingPens.forEach((pen) => {
        this.renderPenContainChild(ctx, pen);
      });
    }
  };

  private renderPenContainChild = (ctx: CanvasRenderingContext2D, pen: Pen) => {
    pen.calculative.inView && renderPen(ctx, pen); // 可见才绘制，组合为状态只显示其中一个
    pen.children?.forEach((id) => {
      const child = this.store.pens[id];
      child && this.renderPenContainChild(ctx, child);
    });
  };

  renderBorder = () => {
    if (!this.store.data.locked) {
      // Occupied territory.
      if (
        this.activeRect &&
        !(this.store.active.length === 1 && this.store.active[0].type) &&
        !this.movingPens
      ) {
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
        ctx.strokeRect(
          this.activeRect.x,
          this.activeRect.y,
          this.activeRect.width,
          this.activeRect.height
        );

        ctx.globalAlpha = 1;
        if (
          getPensLock(this.store.active) ||
          getPensDisableRotate(this.store.active) ||
          this.store.options.disableRotate
        ) {
          ctx.restore();
          return;
        }
        // Draw rotate control line.
        ctx.beginPath();
        ctx.moveTo(this.activeRect.center.x, this.activeRect.y);
        ctx.lineTo(this.activeRect.center.x, this.activeRect.y - 30);
        ctx.stroke();

        // Draw rotate control points.
        ctx.beginPath();
        ctx.strokeStyle = this.store.options.activeColor;
        ctx.fillStyle = '#ffffff';
        ctx.arc(
          this.activeRect.center.x,
          this.activeRect.y - 30,
          5,
          0,
          Math.PI * 2
        );
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
      !this.store.options.disableAnchor &&
      this.store.hover &&
      !this.store.hover.disableAnchor &&
      (this.hotkeyType !== HotkeyType.Resize ||
        this.store.active.length !== 1 ||
        this.store.active[0] !== this.store.hover)
    ) {
      const anchors = [...this.store.hover.calculative.worldAnchors];

      if (this.store.pointAt && this.hotkeyType === HotkeyType.AddAnchor) {
        anchors.push(this.store.pointAt);
      }
      if (anchors) {
        ctx.strokeStyle =
          this.store.hover.anchorColor || this.store.options.anchorColor;
        ctx.fillStyle =
          this.store.hover.anchorBackground ||
          this.store.options.anchorBackground;
        anchors.forEach((anchor) => {
          if (anchor === this.store.hoverAnchor) {
            ctx.save();
            const hoverAnchorColor =
              this.store.hover.hoverAnchorColor ||
              this.store.options.hoverAnchorColor;
            ctx.strokeStyle = hoverAnchorColor;
            ctx.fillStyle = hoverAnchorColor;
          }
          ctx.beginPath();
          let size =
            anchor.radius ||
            this.store.hover.anchorRadius ||
            this.store.options.anchorRadius;
          if (this.store.hover.type) {
            size = 3;
            if (this.store.hover.calculative.lineWidth > 3) {
              size = this.store.hover.calculative.lineWidth;
            }
          }
          ctx.arc(anchor.x, anchor.y, size, 0, Math.PI * 2);
          if (this.store.hover.type && this.store.hoverAnchor === anchor) {
            ctx.save();
            ctx.strokeStyle =
              this.store.hover.activeColor || this.store.options.activeColor;
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

    // Draw size control points.
    if (
      this.hotkeyType !== HotkeyType.AddAnchor &&
      !this.movingPens && // 不在移动中
      this.activeRect &&
      !(this.store.active.length === 1 && this.store.active[0].type)
    ) {
      if (
        !getPensLock(this.store.active) &&
        !getPensDisableResize(this.store.active) &&
        !this.store.options.disableSize
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
    }

    if (!this.store.data.locked && this.dragRect) {
      ctx.save();
      ctx.fillStyle = rgba(this.store.options.dragColor, 0.2);
      ctx.strokeStyle = this.store.options.dragColor;
      ctx.beginPath();
      ctx.strokeRect(
        this.dragRect.x,
        this.dragRect.y,
        this.dragRect.width,
        this.dragRect.height
      );
      ctx.fillRect(
        this.dragRect.x,
        this.dragRect.y,
        this.dragRect.width,
        this.dragRect.height
      );
      ctx.restore();
    }

    if (this.dock) {
      ctx.strokeStyle = this.store.options.dockColor;
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

  translate(x: number = 0, y: number = 0) {
    this.store.data.x += x * this.store.data.scale;
    this.store.data.y += y * this.store.data.scale;
    this.store.data.x = Math.round(this.store.data.x);
    this.store.data.y = Math.round(this.store.data.y);
    this.canvasImage.init();
    this.canvasImageBottom.init();
    this.render();
    this.store.emitter.emit('translate', {
      x: this.store.data.x,
      y: this.store.data.y,
    });
    this.tooltip.translate(x, y);
    if (this.scroll && this.scroll.isShow) {
      this.scroll.translate(x, y);
    }
    this.onMovePens();
  }

  onMovePens() {
    const map = this.parent.map;
    if (map && map.isShow) {
      map.setView();
    }
    // 有移动操作的 画笔 需要执行移动
    for (const pen of this.store.data.pens) {
      calcInView(pen);
      pen.onMove?.(pen);
      if (pen.isRuleLine) {
        if (!pen.width) {
          // 垂直线，移动 y 即可
          pen.y = -this.store.data.y;
        } else if (!pen.height) {
          // 水平线
          pen.x = -this.store.data.x;
        }
        this.updatePenRect(pen);
      }
    }
  }

  /**
   * 缩放整个画布
   * @param scale 缩放比例，最终的 data.scale
   * @param center 中心点，引用类型，存在副作用，会更改原值
   */
  scale(scale: number, center = { x: 0, y: 0 }) {
    const { minScale, maxScale } = this.store.options;
    if (!(scale >= minScale && scale <= maxScale)) {
      return;
    }

    this.calibrateMouse(center);
    const s = scale / this.store.data.scale;
    this.store.data.scale = scale;
    this.store.data.center = center;

    scalePoint(this.store.data.origin, s, center);
    this.store.data.pens.forEach((pen) => {
      if (pen.parentId) {
        return;
      }
      scalePen(pen, s, center);
      if (pen.isRuleLine) {
        // 扩大线的比例，若是放大，即不缩小，若是缩小，会放大
        const lineScale = s > 1 ? 1 : 1 / s / s;
        // 中心点即为线的中心
        const lineCenter = pen.calculative.worldRect.center;
        if (!pen.width) {
          // 垂直线
          scalePen(pen, lineScale, lineCenter);
        } else if (!pen.height) {
          // 水平线
          scalePen(pen, lineScale, lineCenter);
        }
      }
      this.updatePenRect(pen, { worldRectIsReady: true });
      this.execPenResize(pen);
    });
    this.calcActiveRect();
    this.canvasImage.init();
    this.canvasImageBottom.init();
    const map = this.parent.map;
    if (map && map.isShow) {
      map.setView();
    }
    this.render();
    this.store.emitter.emit('scale', this.store.data.scale);
  }

  rotatePens(e: Point) {
    if (!this.initPens) {
      this.initPens = deepClone(this.getAllByPens(this.store.active));
    }

    this.activeRect.rotate = calcRotate(e, this.activeRect.center);
    if (this.store.active.length === 1) {
      this.lastRotate = this.store.active[0].rotate || 0;
    }
    const angle = this.activeRect.rotate - this.lastRotate;
    for (const pen of this.store.active) {
      if (pen.parentId) {
        return;
      }
      this.rotatePen(pen, angle, this.activeRect);
      pen.onRotate && pen.onRotate(pen);
      this.updateLines(pen);
    }
    this.lastRotate = this.activeRect.rotate;
    this.getSizeCPs();
    this.initImageCanvas(this.store.active);
    this.render();
    this.store.emitter.emit('rotatePens', this.store.active);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(this.getAllByPens(this.store.active)),
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  resizePens(e: Point) {
    if (!this.initPens) {
      this.initPens = deepClone(this.store.active, true);
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
    if ((e as any).shiftKey) {
      // if (x / y > rect.width / rect.height) {
      //   y = (rect.height / rect.width) * x;
      // } else {
      //   x = (rect.width / rect.height) * y;
      // }
      x = (rect.width / rect.height) * y;
    }
    // 得到最准确的 rect 即 resize 后的
    resizeRect(rect, x, y, this.resizeIndex);
    calcCenter(rect);
    if (!this.store.options.disableDockLine) {
      this.clearDock();
      const resizeDock = this.customeResizeDock || calcResizeDock;
      this.dock = resizeDock(
        this.store,
        rect,
        this.store.active,
        this.resizeIndex
      );
      const { xDock, yDock } = this.dock;
      if (xDock) {
        x += xDock.step;
        const dockPen = this.store.pens[xDock.penId];
        dockPen.calculative.isDock = true;
      }
      if (yDock) {
        y += yDock.step;
        const dockPen = this.store.pens[yDock.penId];
        dockPen.calculative.isDock = true;
      }
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
      pen.calculative.worldRect.x =
        this.activeInitPos[i].x * this.activeRect.width + this.activeRect.x;
      pen.calculative.worldRect.y =
        this.activeInitPos[i].y * this.activeRect.height + this.activeRect.y;
      pen.calculative.worldRect.width *= scaleX;
      pen.calculative.iconWidth && (pen.calculative.iconWidth *= scaleX);
      pen.calculative.worldRect.height *= scaleY;
      pen.calculative.iconHeight && (pen.calculative.iconHeight *= scaleY);
      calcRightBottom(pen.calculative.worldRect);
      calcCenter(pen.calculative.worldRect);
      this.updatePenRect(pen, { worldRectIsReady: true });
      this.execPenResize(pen);
      this.updateLines(pen);
    });
    this.getSizeCPs();
    this.initImageCanvas(this.store.active);
    this.render();
    this.store.emitter.emit('resizePens', this.store.active);

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(this.store.active, true),
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  movePens(e: {
    x: number;
    y: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }

    if (!this.initActiveRect) {
      this.initActiveRect = deepClone(this.activeRect);
      return;
    }

    if (!this.movingPens) {
      this.initMovingPens();
      this.store.active.forEach((pen) => {
        setHover(pen, false);
      });
      this.store.hover = undefined;
    }

    let x = e.x - this.mouseDown.x;
    let y = e.y - this.mouseDown.y;
    e.shiftKey && !e.ctrlKey && (x = 0);
    e.altKey && (y = 0);
    const rect = deepClone(this.initActiveRect);
    translateRect(rect, x, y);
    const offset: Point = {
      x: rect.x - this.activeRect.x,
      y: rect.y - this.activeRect.y,
    };
    if (!this.store.options.disableDockLine) {
      this.clearDock();
      const moveDock = this.customeMoveDock || calcMoveDock;
      this.dock = moveDock(this.store, rect, this.movingPens, offset);
      const { xDock, yDock } = this.dock;
      if (xDock) {
        offset.x += xDock.step;
        const dockPen = this.store.pens[xDock.penId];
        dockPen.calculative.isDock = true;
      }
      if (yDock) {
        offset.y += yDock.step;
        const dockPen = this.store.pens[yDock.penId];
        dockPen.calculative.isDock = true;
      }
    }

    this.translatePens(this.movingPens, offset.x, offset.y, true);
  }

  /**
   * 初始化移动，更改画笔的 id parentId 等关联关系
   * @param pen 要修改的画笔
   * @param pens 本次操作的画笔们，包含子画笔
   */
  private changeIdsByMoving(pen: Pen, pens: Pen[]) {
    pen.id += movingSuffix;
    if (pen.parentId && pens.find((p) => p.id === pen.parentId)) {
      pen.parentId += movingSuffix;
    }
    if (pen.children) {
      pen.children = pen.children.map((child) => child + movingSuffix);
    }
    // 连接关系也需要变，用在 updateLines 中
    if (pen.connectedLines) {
      pen.connectedLines = pen.connectedLines.map((line) => {
        if (pens.find((p) => p.id === line.lineId)) {
          line.lineId += movingSuffix;
        }
        return line;
      });
    }
    if (pen.type && pen.calculative.worldAnchors) {
      pen.calculative.worldAnchors = pen.calculative.worldAnchors.map(
        (anchor) => {
          if (anchor.connectTo && pens.find((p) => p.id === anchor.connectTo)) {
            anchor.connectTo += movingSuffix;
          }
          return anchor;
        }
      );
    }
  }

  /**
   * 初始化 this.movingPens
   * 修改 ids （id parentId children 等）
   * 半透明，去图片
   */
  initMovingPens() {
    this.movingPens = deepClone(this.store.active, true);
    const containChildPens = this.getAllByPens(this.movingPens);
    const copyContainChildPens = deepClone(containChildPens, true);
    // 考虑父子关系，修改 id
    containChildPens.forEach((pen) => {
      this.changeIdsByMoving(pen, copyContainChildPens);
      this.store.pens[pen.id] = pen; // updatePenRect 时需要计算
      pen.calculative.canvas = this;
      const value: Pen = {
        globalAlpha: 0.5,
      };
      // 线宽为 0 ，看不到外边框，拖动过程中给个外边框
      pen.lineWidth === 0 && (value.lineWidth = 1);
      // TODO: 例如 pen.name = 'triangle' 的情况，但有图片，是否还需要变成矩形呢？
      if (isDomShapes.includes(pen.name) || pen.image) {
        // 修改名称会执行 onDestroy ，清空它
        value.name = 'rectangle';
        value.onDestroy = undefined;
      }
      this.updateValue(pen, value);
      pen.calculative.image = undefined;
    });
  }

  moveLineAnchor(pt: { x: number; y: number }) {
    if (!this.activeRect || this.store.data.locked) {
      return;
    }
    if (!this.initPens) {
      this.initPens = deepClone(this.store.active, true);
    }

    if (this.store.activeAnchor?.connectTo) {
      const pen = this.store.pens[this.store.activeAnchor.connectTo];
      disconnectLine(
        pen,
        getAnchor(pen, this.store.activeAnchor.anchorId),
        this.store.pens[this.store.activeAnchor.penId],
        this.store.activeAnchor
      );
    }

    let offsetX = pt.x - this.store.activeAnchor.x;
    let offsetY = pt.y - this.store.activeAnchor.y;
    translatePoint(this.store.activeAnchor, offsetX, offsetY);
    const line = this.store.active[0];
    const from = getFromAnchor(line);
    const to = getToAnchor(line);
    // 移动线锚点，折线自动计算关闭
    if (line.autoPolyline !== false && this.store.activeAnchor !== from && this.store.activeAnchor !== to) {
      line.autoPolyline = false;
    }

<<<<<<< HEAD
    if (this.store.hover && this.store.hoverAnchor && this.store.hoverAnchor.penId !== this.store.activeAnchor.penId) {
=======
    if (
      this.store.hover &&
      this.store.hoverAnchor &&
      this.store.hoverAnchor.penId !== this.store.activeAnchor.penId
    ) {
      // TODO: 移动 lineAnchor , 不改变 connectTo
      // this.store.activeAnchor.connectTo = this.store.hover.id;
      // this.store.activeAnchor.anchorId = this.store.hoverAnchor.id;
>>>>>>> e0ba1cb (perfect_delete)
      offsetX = this.store.hoverAnchor.x - this.store.activeAnchor.x;
      offsetY = this.store.hoverAnchor.y - this.store.activeAnchor.y;
      translatePoint(this.store.activeAnchor, offsetX, offsetY);

      this.store.activeAnchor.connectTo = this.store.hover.id;
      to.prev = undefined;
      // 重新自动计算连线
      if (line.lineName !== 'polyline') {
        this[line.lineName]?.(this.store, line);
      }
    }

    // 重新自动计算连线
    if (line.autoPolyline !== false && line.lineName === 'polyline') {
      this[line.lineName]?.(this.store, line);
    }

    this.patchFlagsLines.add(line);
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render();

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(this.store.active, true),
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 500);
  }

  moveLineAnchorPrev(e: { x: number; y: number }) {
    if (
      !this.activeRect ||
      this.store.data.locked ||
      !this.store.activeAnchor
    ) {
      return;
    }

    if (!this.initPens) {
      this.initPens = deepClone(this.store.active, true);
    }

    this.store.activeAnchor.prev.x = e.x;
    this.store.activeAnchor.prev.y = e.y;
    if (this.store.activeAnchor.next) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.next.x = e.x;
        this.store.activeAnchor.next.y = e.y;
        rotatePoint(this.store.activeAnchor.next, 180, this.store.activeAnchor);
      } else if (
        this.store.activeAnchor.prevNextType === PrevNextType.Bilateral
      ) {
        const rotate = calcRotate(e, this.store.activeAnchor);
        const prevRotate = calcRotate(this.prevAnchor, this.store.activeAnchor);
        this.store.activeAnchor.next.x = this.nextAnchor.x;
        this.store.activeAnchor.next.y = this.nextAnchor.y;
        rotatePoint(
          this.store.activeAnchor.next,
          rotate - prevRotate,
          this.store.activeAnchor
        );
      }
    }
    const line = this.store.active[0];
    this.patchFlagsLines.add(line);
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render();

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(this.store.active, true),
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
      this.initPens = deepClone(this.store.active, true);
    }

    this.store.activeAnchor.next.x = e.x;
    this.store.activeAnchor.next.y = e.y;
    if (this.store.activeAnchor.prev) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.prev.x = e.x;
        this.store.activeAnchor.prev.y = e.y;
        rotatePoint(this.store.activeAnchor.prev, 180, this.store.activeAnchor);
      } else if (
        this.store.activeAnchor.prevNextType === PrevNextType.Bilateral
      ) {
        const rotate = calcRotate(e, this.store.activeAnchor);
        const nextRotate = calcRotate(this.nextAnchor, this.store.activeAnchor);
        this.store.activeAnchor.prev.x = this.prevAnchor.x;
        this.store.activeAnchor.prev.y = this.prevAnchor.y;
        rotatePoint(
          this.store.activeAnchor.prev,
          rotate - nextRotate,
          this.store.activeAnchor
        );
      }
    }

    const line = this.store.active[0];
    this.patchFlagsLines.add(line);
    this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
    this.render();

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(this.store.active, true),
        initPens: this.initPens,
      });
      this.initPens = undefined;
    }, 200);
  }

  async setAnchor(e: { x: number; y: number }) {
    const initPens = [deepClone(this.store.hover, true)];
    const hoverPen = this.store.hover;

    if (this.store.hoverAnchor) {
      if (
        this.beforeRemoveAnchor &&
        !(await this.beforeRemoveAnchor(hoverPen, this.store.hoverAnchor))
      ) {
        return;
      }
      if (
        hoverPen.type === PenType.Line &&
        hoverPen.calculative.worldAnchors?.length <= 2
      ) {
        this.delete([hoverPen]);
      } else {
        removePenAnchor(hoverPen, this.store.hoverAnchor);
        if (hoverPen.type === PenType.Line) {
          this.initLineRect(hoverPen);
        }
      }
      this.store.hoverAnchor = undefined;
      this.store.activeAnchor = undefined;
      this.externalElements.style.cursor = 'default';
    } else if (hoverPen) {
      if (
        this.beforeAddAnchor &&
        !(await this.beforeAddAnchor(hoverPen, this.store.pointAt))
      ) {
        return;
      }
      if (hoverPen.type === PenType.Line) {
        this.store.activeAnchor = addLineAnchor(
          hoverPen,
          this.store.pointAt,
          this.store.pointAtIndex
        );
        this.initLineRect(hoverPen);

        const pt = { x: e.x, y: e.y };
        this.getHover(pt);
      } else {
        const pt = { id: s8(), x: e.x, y: e.y };
        this.store.activeAnchor = pushPenAnchor(hoverPen, pt);
      }
    }
    this.hotkeyType = HotkeyType.None;
    this.render();

    this.pushHistory({
      type: EditType.Update,
      pens: [deepClone(hoverPen, true)],
      initPens,
    });
  }

  /**
   * 连线允许移动，若与其它图形有连接，但其它图形不在此次移动中，会断开连接
   * @param line 连线
   * @param pens 本次移动的全部图形，包含子节点
   */
  private checkDisconnect(line: Pen, pens: Pen[]) {
    if (line.id.indexOf(movingSuffix) > 0) {
      const id = line.id;
      line = this.store.pens[id.replace(movingSuffix, '')];
    }
    // 连接
    line.anchors.forEach((anchor) => {
      if (
        anchor.connectTo &&
        !pens.find(
          (p) =>
            p.id === anchor.connectTo ||
            p.id === anchor.connectTo + movingSuffix
        )
      ) {
        const pen = this.store.pens[anchor.connectTo];
        if (pen.type) {
          return;
        }
        disconnectLine(pen, getAnchor(pen, anchor.anchorId), line, anchor);
      }
    });
  }

  /**
   * 移动 画笔们
   * @param pens 画笔们，不包含子节点
   * @param x 偏移 x
   * @param y 偏移 y
   * @param doing 是否持续移动
   */
  translatePens(
    pens = this.store.active,
    x: number,
    y: number,
    doing?: boolean
  ) {
    if (!pens || !pens.length) {
      return;
    }
    let hasLocked = pens.some((item: Pen) => {
      if (item.locked >= LockState.DisableMove) return true;
    });
    if (hasLocked) {
      return;
    }
    const initPens = !doing && deepClone(pens, true);
    translateRect(this.activeRect, x, y);

    const containChildPens = this.getAllByPens(pens);
    pens.forEach((pen) => {
      if (pen.locked >= LockState.DisableMove) {
        return;
      }

      if (pen.type === PenType.Line) {
        translateLine(pen, x, y);
        this.checkDisconnect(pen, containChildPens);
        this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
        if (!doing) {
          this.initLineRect(pen);
          pen.connectedLines?.forEach((item) => {
            const line = this.store.pens[item.lineId];
            this.initLineRect(line);
          });
        }
      } else {
        translateRect(pen.calculative.worldRect, x, y);
        this.updatePenRect(pen, { worldRectIsReady: true });
        pen.calculative.x = pen.x;
        pen.calculative.y = pen.y;
        if (pen.calculative.initRect) {
          pen.calculative.initRect.x = pen.calculative.x;
          pen.calculative.initRect.y = pen.calculative.y;
          pen.calculative.initRect.ex =
            pen.calculative.x + pen.calculative.width;
          pen.calculative.initRect.ey =
            pen.calculative.y + pen.calculative.height;
        }
      }
      this.updateLines(pen);
      pen.onMove?.(pen);
    });
    this.getSizeCPs();
    this.render();
    this.tooltip.translate(x, y);

    if (!doing) {
      // 单次的移动需要记历史记录
      this.pushHistory({
        type: EditType.Update,
        pens: deepClone(pens, true),
        initPens,
      });
      this.initImageCanvas(pens);
      this.store.emitter.emit('translatePens', pens);
    }
    this.store.emitter.emit('translatingPens', pens);
  }

  private calcAutoAnchor(
    line: Pen,
    lineAnchor: Point,
    pen: Pen,
    penConnection?: ConnectLine
  ) {
    const from = getFromAnchor(line);
    const to = getToAnchor(line);
    const newAnchor = nearestAnchor(pen, lineAnchor === from ? to : from);
    lineAnchor.x = newAnchor.x;
    lineAnchor.y = newAnchor.y;
    lineAnchor.prev = undefined;
    lineAnchor.next = undefined;
    if (penConnection) {
      penConnection.anchor = newAnchor.id;
    } else {
      connectLine(pen, newAnchor, line, lineAnchor);
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
            if (k === 'fontSize') {
              pen[k] =
                pen.calculative[k] / pen.calculative.canvas.store.data.scale;
            } else {
              pen[k] = pen.calculative[k];
            }
          }
        }
      } else {
        const rotate = pen.calculative.initRect.rotate - pen.calculative.rotate;
        for (const k in pen) {
          if (
            k !== 'x' &&
            k !== 'y' &&
            k !== 'width' &&
            k !== 'height' &&
            k !== 'initRect' &&
            k !== 'rotate' &&
            (typeof pen[k] !== 'object' || k === 'lineDash')
          ) {
            pen.calculative[k] = pen[k];
          }
        }
        if (pen.children?.length) {
          if (rotate) {
            rotatePen(pen, rotate, pen.calculative.worldRect);
          }
        } else {
          pen.calculative.rotate = pen.rotate;
        }

        pen.calculative.worldRect = pen.calculative.initRect;
      }
      this.updatePenRect(pen, { worldRectIsReady: true });
      if (pen.calculative.text !== pen.text) {
        pen.calculative.text = pen.text;
        calcTextLines(pen);
      }
      pen.calculative.initRect = undefined;
    }
  }

  updateLines(pen: Pen, change?: boolean) {
    pen.children?.forEach((child: string) => {
      const childPen = this.store.pens[child];
      if (childPen) {
        // 每个子节点都会更新 line，包括子节点是 type 1 的情况
        this.updateLines(childPen, change);
      }
    });
    if (!pen.connectedLines) {
      return;
    }
    pen.connectedLines.forEach((item) => {
      const line = this.store.pens[item.lineId];
      // 活动层的线不需要更新，会在活动层处理
      if (!line || line.calculative.active) {
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

      translatePoint(
        lineAnchor,
        penAnchor.x - lineAnchor.x,
        penAnchor.y - lineAnchor.y
      );
      if (
        (line.autoPolyline ?? this.store.options.autoPolyline) &&
        line.lineName === 'polyline'
      ) {
        let from = getFromAnchor(line);
        let to = getToAnchor(line);

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
          this.polyline(this.store, line, to);
          this.initLineRect(line);
        }
      }

      this.store.path2dMap.set(line, globalStore.path2dDraws[line.name](line));
      this.patchFlagsLines.add(line);

      change && getLineLength(line);
    });
  }

  calcActiveRect() {
    // TODO: visible 不可见， 目前只是不计算 activeRect，考虑它是否进入活动层 store.active
    const canMovePens = this.store.active.filter(
      (pen: Pen) =>
        (!pen.locked || pen.locked < LockState.DisableMove) &&
        pen.visible != false
    );
    if (!canMovePens.length) {
      return;
    } else if (canMovePens.length === 1) {
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

  /**
   * 旋转当前画笔包括子节点
   * @param pen 旋转的画笔
   * @param angle 本次的旋转值，加到 pen.calculative.rotate 上
   */
  rotatePen(pen: Pen, angle: number, rect: Rect) {
    if (pen.type) {
      pen.calculative.worldAnchors.forEach((anchor) => {
        rotatePoint(anchor, angle, rect.center);
      });
      this.initLineRect(pen);
      calcPenRect(pen);
    } else {
      if (pen.calculative.rotate) {
        pen.calculative.rotate += angle;
      } else {
        pen.calculative.rotate = angle;
      }
      rotatePoint(pen.calculative.worldRect.center, angle, rect.center);
      if (pen.parentId) {
        pen.calculative.worldRect.x =
          pen.calculative.worldRect.center.x -
          pen.calculative.worldRect.width / 2;
        pen.calculative.worldRect.y =
          pen.calculative.worldRect.center.y -
          pen.calculative.worldRect.height / 2;
        pen.x = (pen.calculative.worldRect.x - rect.x) / rect.width;
        pen.y = (pen.calculative.worldRect.y - rect.y) / rect.height;
      } else {
        pen.x = pen.calculative.worldRect.center.x - pen.width / 2;
        pen.y = pen.calculative.worldRect.center.y - pen.height / 2;
      }
      pen.rotate = pen.calculative.rotate;
      this.updatePenRect(pen);

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
        return (
          p.id === pen.nextAnimate ||
          (p.tags && p.tags.indexOf(pen.nextAnimate) > -1)
        );
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
        if (pen.name === 'video') {
          pen.calculative.media.currentTime = 0;
          pen.calculative.media?.play();
          pen.onStartVideo?.(pen);
        } else if (pen.frames) {
          this.store.animates.add(pen);
        }
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
      for (const pen of this.store.animates) {
        if (pen.calculative.pause) {
          continue;
        }
        if (pen.calculative.active && !pen.type && !this.movingPens) {
          // 存在节点在活动层，并且不在移动中
          active = true;
        }
        if (!pen.type) {
          if (setNodeAnimate(pen, now)) {
            if (pen.calculative.patchFlags) {
              calcCenter(pen.calculative.worldRect);
              this.updatePenRect(pen, {
                worldRectIsReady: true,
                playingAnimate: true,
              });
            }
          } else {
            // 避免未到绘画帧，用户点击了停止动画，产生了时间差数据
            requestAnimationFrame(() => {
              this.restoreNodeAnimate(pen);
            });

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

        this.patchFlags = true;
      }
      if (active) {
        this.calcActiveRect();
      }
      dels.forEach((pen) => {
        this.store.animates.delete(pen);
      });
      this.render(false);
      this.animateRendering = false;
      this.animate();
    });
  }

  get clipboardName(): string {
    return 'topology-clipboard';
  }

  copy(pens?: Pen[]) {
    // 得到当前活动层的，包括子节点
    const { origin, scale } = this.store.data;
    this.store.clipboard = {
      pens: this.getAllByPens(deepClone(pens || this.store.active, true)),
      origin: deepClone(origin),
      scale,
    };
    this.pasteOffset = 10;
    this.firstPaste = true;
    // 下面使用到的场景为跨页面 复制粘贴
    const clipboardData = this.store.clipboard;
    let page = sessionStorage.getItem('page');
    if (!page) {
      page = s8();
      sessionStorage.setItem('page', page);
    }
    localStorage.setItem(
      this.clipboardName,
      JSON.stringify({
        topology: true,
        page,
        data: clipboardData,
      })
    );
    navigator.clipboard?.writeText(
      JSON.stringify({
        topology: true,
        page,
        data: clipboardData,
      })
    );
  }

  cut(pens?: Pen[]) {
    this.copy(pens);
    this.delete(pens);
  }

  async paste() {
    // 先读剪切板
    let clipboardText = await navigator.clipboard?.readText();
    navigator.clipboard?.writeText('');  // 清空
    if (!clipboardText) {
<<<<<<< HEAD
      navigator.clipboard?.writeText(''); // 清空
=======
>>>>>>> 73ab2ef (echarts deal)
      // 再读 localStorage
      clipboardText = localStorage.getItem(this.clipboardName);
    }
    let samePage = true;
    if (clipboardText) {
      let clipboard: {
        topology: boolean;
        page: string;
        data: TopologyClipboard;
      };
      try {
        clipboard = JSON.parse(clipboardText);
      } catch (e) {
        console.warn('剪切板数据不是 json', e.message);
        return;
      }
      if (!clipboard || !clipboard.topology || !clipboard.data) {
        return;
      }
      let page = sessionStorage.getItem('page');
      if (!page || page !== clipboard.page) {
        samePage = false;
      }
      this.store.clipboard = clipboard.data;
    }
    if (
      this.beforeAddPens &&
      (await this.beforeAddPens(this.store.clipboard.pens)) != true
    ) {
      return;
    }
    this.store.clipboard = deepClone(this.store.clipboard, true);
    // this.store.clipboard 已经包括子节点
    // pastePen 是一个递归操作，只要遍历 父亲节点即可
    if (this.store.clipboard) {
      const rootPens = this.store.clipboard.pens.filter((pen) => !pen.parentId);
      for (const pen of rootPens) {
        this.pastePen(pen, undefined, this.store.clipboard, samePage);
      }

      this.active(rootPens);
      this.pushHistory({ type: EditType.Add, pens: this.store.clipboard.pens });
      this.render();
      this.store.emitter.emit('add', this.store.clipboard.pens);
    }
    localStorage.removeItem(this.clipboardName); // 清空缓存
  }

  /**
   * 获取 pens 列表中的所有节点（包含子节点）
   * @param pens 不包含子节点
   */
  getAllByPens(pens: Pen[]): Pen[] {
    const retPens: Pen[] = [];
    for (const pen of pens) {
      retPens.push(...deepClone(getAllChildren(pen, this.store), true));
    }
    return retPens.concat(pens);
  }

  /**
   *
   * @param pen 当前复制的画笔
   * @param parentId 父节点 id
   * @param clipboard 本次复制的全部画笔，包含子节点, 以及 origin 和 scale
   * @returns 复制后的画笔
   */
  private pastePen(
    pen: Pen,
    parentId: string,
    clipboard: TopologyClipboard,
    samePage: boolean = true
  ): Pen {
    const oldId = pen.id;
    randomId(pen);
    pen.parentId = parentId;
    // 子节点无需偏移
    !parentId && translateRect(pen, this.pasteOffset, this.pasteOffset);
    if (pen.type === PenType.Line) {
      // TODO: 仍然存在 节点类型的 连线，此处判断需要更改
      this.changeNodeConnectedLine(oldId, pen, clipboard.pens);
    } else {
      this.changeLineAnchors(oldId, pen, clipboard.pens);
    }
    if (!this.beforeAddPen || this.beforeAddPen(pen) == true) {
      this.makePen(pen);
      if (!pen.parentId) {
        let scale = samePage ? this.store.data.scale : clipboard.scale;
        let origin = this.store.data.origin;
        if (this.firstPaste) {
          this.firstPaste = false;
          scale = clipboard.scale;
          origin = clipboard.origin;
        }
        const rect = this.getPenRect(pen, origin, scale);
        if (!samePage) {
          rect.x = this.mousePos.x - this.store.data.origin.x - rect.width / 2;
          rect.y = this.mousePos.y - this.store.data.origin.y - rect.height / 2;
        }
        this.setPenRect(pen, rect, false);
      }
      const newChildren = [];
      if (Array.isArray(pen.children)) {
        for (const childId of pen.children) {
          const childPen = clipboard.pens.find((pen) => pen.id === childId);
          childPen &&
            newChildren.push(this.pastePen(childPen, pen.id, clipboard).id);
        }
      }
      pen.children = newChildren;
      return pen;
    }
    return {};
  }
  /**
   * 修改对应连线的 anchors
   * @param oldId 老 id
   * @param pen 节点
   * @param pastePens 本次复制的 pens 包含子节点
   */
  changeLineAnchors(oldId: string, pen: Pen, pastePens: Pen[]) {
    if (!Array.isArray(pen.connectedLines)) {
      return;
    }
    for (let index = 0; index < pen.connectedLines.length; index++) {
      const { lineId } = pen.connectedLines[index];
      const line = pastePens.find((pen) => pen.id === lineId);
      if (line) {
        const from = line.anchors[0];
        const to = line.anchors[line.anchors.length - 1];
        from.connectTo === oldId && (from.connectTo = pen.id);
        to.connectTo === oldId && (to.connectTo = pen.id);
      } else {
        // 说明它的连接线不在本次复制的范围内
        pen.connectedLines.splice(index, 1);
        index--;
      }
    }
  }

  /**
   * 复制连线的过程，修改 与 此线连接 node 的 connectedLines
   * @param oldId 线原 id
   * @param line 线
   * @param pastePens 此处复制的全部 pens (包含子节点)
   */
  changeNodeConnectedLine(oldId: string, line: Pen, pastePens: Pen[]) {
    const from = line.anchors[0];
    const to = line.anchors[line.anchors.length - 1];
    // 修改对应节点的 connectedLines
    const anchors = [from, to];
    for (const anchor of anchors) {
      const nodeId = anchor.connectTo;
      if (nodeId) {
        const node = pastePens.find((pen) => pen.id === nodeId);
        if (node) {
          node.connectedLines?.forEach((cl) => {
            if (cl.lineId === oldId) {
              cl.lineId = line.id;
              cl.lineAnchor = anchor.id;
            }
          });
        } else {
          // 节点不在本次复制的范围内
          anchor.connectTo = undefined;
          if (anchor.prev) {
            anchor.prev.connectTo = undefined;
          }
          if (anchor.next) {
            anchor.next.connectTo = undefined;
          }
        }
      }
    }
  }

  async delete(pens = this.store.active, canDelLocked = false, history = true) {
    if (!pens || !pens.length) {
      return;
    }
    if (this.beforeRemovePens && (await this.beforeRemovePens(pens)) != true) {
      return;
    }
    if (!canDelLocked) {
      pens = pens.filter((pen) => !pen.locked);
    }
    if (!pens || !pens.length) {
      return;
    }
    const deletePens: Pen[] = [];
    this._del(pens, deletePens);
    this.initImageCanvas(pens);
    this.inactive();
    this.clearHover();
    this.render();
    // TODO: 连线的删除 ，连接的 node 的 connectLines 会变化（删除 node ，line 的 anchors 类似），未记历史记录
    if (history) {
      this.pushHistory({ type: EditType.Delete, pens: deletePens });
    }
    this.store.emitter.emit('delete', pens);
  }

  private _del(pens: Pen[], delPens?: Pen[]) {
    if (!pens) {
      return;
    }
    pens.forEach((pen) => {
      if (!pen.parentId) {
        if (pen.locked) {
          return;
        } else {
          if (delPens) {
            this.getDelPens(pen, delPens);
          }
          this.delForce(pen);
        }
      } else {
        const lockedParent = this.getLockedParent(pen);
        if (lockedParent) {
          console.warn('父节点锁定');
          return;
        } else {
          const parentPen = this.store.data.pens[pen.parentId];
          const _index = parentPen.children.indexOf(pen.id);
          parentPen.children.splice(_index, 1);
          if (delPens) {
            this.getDelPens(pen, delPens);
          }
          this.delForce(pen);
        }
      }
<<<<<<< HEAD
    });
  }

  getDelPens(pen: Pen, delPens: Pen[]) {
    if (!pen) {
      return;
    }
    const i = this.store.data.pens.findIndex((item) => item.id === pen.id);
    if (i > -1) {
      const delPen = this.store.pens[pen.id];
      delPen.calculative.active = undefined;
      delPens.push(delPen);
    }
    if (pen.children) {
      pen.children.forEach((id) => {
        this.getDelPens(this.store.pens[id], delPens);
      });
    }
  }

  private getLockedParent(pen: Pen) {
    if (!pen.parentId) {
      return false;
    }
    const parentPen = getParent(pen);
    if (parentPen.locked) {
      return parentPen;
    } else {
      this.getLockedParent(parentPen);
    }
  }

  delForce(pen: Pen) {
    if (!pen) {
      return;
    }
    const i = this.store.data.pens.findIndex((item) => item.id === pen.id);
    if (i > -1) {
      this.delConnectedLines(this.store.data.pens[i]);
      this.store.data.pens.splice(i, 1);
      this.store.pens[pen.id] = undefined;
      delete this.store.pens[pen.id];
    }
    this.store.animates.delete(pen);
    if (pen.children) {
      pen.children.forEach((id) => {
        this.delForce(this.store.pens[id]);
      });
    }

    pen.onDestroy?.(pen);
  }

=======
      this.store.animates.delete(pen);
        this._del(pen.children);
        pen.onDestroy?.(pen);
    });
  }
  
>>>>>>> fb245f7 (add anchor)
  private delConnectedLines(pen: Pen) {
    if (pen.connectedLines) {
      for (let i = 0; i < pen.connectedLines.length; i++) {
        const { lineId, lineAnchor } = pen.connectedLines[i];
        const line = this.store.pens[lineId];
        if (line) {
          let anchor = line.anchors.find((anchor) => anchor.id === lineAnchor);
          if (anchor?.connectTo === pen.id) {
            anchor.connectTo = undefined;
            anchor.anchorId = undefined;
            anchor.prev && (anchor.prev.connectTo = undefined);
            anchor.next && (anchor.next.connectTo = undefined);
          }
          anchor = getAnchor(line, lineAnchor);
          if (anchor) {
            anchor.connectTo = undefined;
            anchor.anchorId = undefined;
            anchor.prev && (anchor.prev.connectTo = undefined);
            anchor.next && (anchor.next.connectTo = undefined);
          }
        }
      }
    }

    if (!pen.type) {
      return;
    }

    pen.calculative.worldAnchors?.forEach((lineAnchor, index) => {
      if (!lineAnchor.connectTo) {
        return;
      }
      const connectTo = this.store.pens[lineAnchor.connectTo];
      if (connectTo) {
        connectTo.calculative.worldAnchors?.forEach((anchor) => {
          disconnectLine(connectTo, anchor, pen, lineAnchor);
        });
      }
    });
  }

  private ondblclick = (e: MouseEvent) => {
    if (
      this.store.hover &&
      !this.store.data.locked &&
      !this.store.options.disableInput
    ) {
      if (this.store.hover.onShowInput) {
        this.store.hover.onShowInput(this.store.hover, e);
      } else {
        this.showInput(this.store.hover);
      }
    }

    this.store.emitter.emit('dblclick', {
      x: e.x,
      y: e.y,
      pen: this.store.hover,
    });
  };

  showInput = (pen: Pen, rect?: Rect, background = 'transparent') => {
    if (
      !window ||
      !this.store.hover ||
      this.store.hover.locked ||
      this.store.hover.externElement ||
      this.store.hover.disableInput
    ) {
      return;
    }

    if (this.inputDiv.dataset.penId === pen.id) {
      this.inputDiv.dataset.isInput = 'true';
      this.inputDiv.contentEditable = 'true';
      this.inputDiv.focus();
      const range = window.getSelection(); //创建range
      range.selectAllChildren(this.inputDiv); //range 选择obj下所有子内容
      range.collapseToEnd(); //光标移至最后
      this.inputDiv.scrollTop = this.inputDiv.scrollHeight;
      this.inputDiv.scrollLeft = this.inputDiv.scrollWidth;

      return;
    }
    //过滤table2图元
    if (!rect) {
      this.setInputStyle(pen);
    }
    const textRect = rect || pen.calculative.worldTextRect;

    //value和innerText问题
    const preInputText = pen.calculative.tempText || pen.text + '' || '';
    const textArr = preInputText.split(/[\s\n]/);
    const finalText = `${textArr.join('</div><div>')}</div>`
      .replace('</div>', '')
      .replace(/\<div\>\<\/div\>/g, '<div><br></div>');
    this.inputDiv.innerHTML = finalText;
    // this.inputDiv.style.fontSize = pen.calculative.fontSize + 'px';
    // this.inputDiv.style.color = getTextColor(pen, this.store);

    this.inputParent.style.left =
      textRect.x + this.store.data.x - (pen.textLeft || 0) + 'px'; //+ 5
    this.inputParent.style.top =
      textRect.y + this.store.data.y - (pen.textTop || 0) + 'px'; //+ 5
    this.inputParent.style.width = textRect.width + (pen.textLeft || 0) + 'px'; //(textRect.width < pen.width ? 0 : 10)
    this.inputParent.style.height = textRect.height + (pen.textTop || 0) + 'px'; //   (textRect.height < pen.height ? 0 : 10)
    this.inputParent.style.zIndex = '1000';
    this.inputParent.style.background = background;
    if (pen.rotate % 360) {
      this.inputParent.style.transform = `rotate(${pen.rotate}deg)`;
    } else {
      this.inputParent.style.transform = null;
    }
    this.inputParent.style.display = 'flex';
    this.inputDiv.dataset.penId = pen.id;
    this.inputDiv.contentEditable =
      pen.disableInput == undefined ? 'true' : pen.disableInput.toString();

    if (pen.dropdownList && this.dropdown.style.display !== 'block') {
      if (!this.store.data.locked) {
        this.inputRight.style.display = 'none';
      }
      this.setDropdownList();
    } else {
      this.inputRight.style.display = 'none';
    }
    this.inputDiv.contentEditable = 'true';
    this.inputDiv.focus();
    const range = window.getSelection(); //创建range
    range.selectAllChildren(this.inputDiv); //range 选择obj下所有子内容
    range.collapseToEnd(); //光标移至最后
    this.inputDiv.scrollTop = this.inputDiv.scrollHeight;
    this.inputDiv.scrollLeft = this.inputDiv.scrollWidth;
    pen.calculative.text = undefined;
    this.render();
  };

  setInputStyle = (pen: Pen) => {
    if (!pen.text) {
      pen.text = '';
    }
    let sheet: any;
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].title === 'le5le.com') {
        sheet = document.styleSheets[i];
      }
    }
    let style = 'overflow: scroll;';
    let div_style = '';
    let font_scale = 1;
    const { scale } = this.store.data;
    if (pen.fontSize < 12) {
      font_scale = 12 / pen.fontSize;
    }
    if (pen.textAlign) {
      style += `text-align: ${pen.textAlign};`;
    } else {
      style += 'text-align: center;';
    }
    if (pen.textAlign && pen.whiteSpace === 'pre-line') {
      let textAlign = {
        left: 'start',
        center: 'center',
        right: 'end',
      };
      style += `align-items: ${textAlign[pen.textAlign]};`;
    }

    if (pen.textBaseline) {
      let baseLine = {
        top: 'start',
        middle: 'center',
        bottom: 'end',
      };
      style += `justify-content: ${baseLine[pen.textBaseline]};`;
    } else {
      // if (pen.textWidth < pen.calculative.) {
      //   style += 'justify-content: start;';
      // } else {
      //文字高度超出整个rect高度时
      style += 'justify-content: center;';
      // }
    }
    if (pen.fontFamily) {
      style += `font-family: ${pen.fontFamily};`;
    }
    if (pen.fontSize) {
      if (pen.fontSize * scale < 12) {
        style += `font-size:${pen.fontSize}px;`;
        style += `zoom:${(pen.fontSize / 12) * scale};`;
      } else {
        style += `font-size:${pen.fontSize * scale}px;`;
      }
    }
    style += `color:${getTextColor(pen, this.store)};`;
    if (pen.fontStyle) {
      style += `font-style: ${pen.fontStyle};`;
    }
    if (pen.fontWeight) {
      style += `font-weight: ${pen.fontWeight};`;
    }
    if (pen.textLeft) {
      style += `margin-left:${
        scale > 1
          ? pen.textLeft * font_scale
          : (pen.textLeft * font_scale) / scale
      }px;`;
    }
    if (pen.textTop) {
      style += `margin-top:${
        scale > 1
          ? pen.textTop * font_scale
          : (pen.textTop * font_scale) / scale
      }px;`;
    }
    if (pen.lineHeight) {
      style += `line-height:${
        scale > 1
          ? pen.fontSize * pen.lineHeight * scale
          : pen.fontSize * pen.lineHeight * font_scale
      }px;`;
    }
    if (pen.textHeight) {
      style += `height:${
        scale > 1
          ? pen.textHeight * font_scale * scale
          : pen.textHeight * font_scale
      }px;`;
    } else {
      let tem = pen.height / scale - (pen.textTop || 0);
      if (tem < 0) {
        tem = 0;
      }
      style += `height:${
        pen.fontSize * scale < 12 ? tem * font_scale : tem * scale * font_scale
      }px;`;
    }
    if (pen.textWidth) {
      if (pen.whiteSpace !== 'pre-line') {
        if (pen.textWidth < pen.fontSize) {
          style += `width:${pen.fontSize * 1.2 * font_scale}px;`;
        } else {
          style += `width:${
            scale > 1
              ? pen.textWidth * font_scale * scale
              : pen.textWidth * font_scale
          }px;`;
        }
      }
    } else {
      if (pen.whiteSpace === undefined || pen.whiteSpace === 'break-all') {
        let tem = pen.width / scale - (pen.textLeft || 0);
        if (tem < 0) {
          tem = 0;
        }
        style += `width:${
          pen.fontSize * scale < 12 ? tem * font_scale : tem * scale
        }px;`;
      }
      // if (pen.whiteSpace === 'pre-line') {
      //   //回车换行
      //   style += `overflow: visible;`;
      // }
    }
    if (pen.whiteSpace) {
      if (pen.whiteSpace === 'pre-line') {
        style += `white-space:pre;`;
        // if (!pen.textAlign) {
        //   style += `align-items: center;`;
        // }
      } else {
        style += `white-space:${pen.whiteSpace};`;
        if (pen.whiteSpace === 'nowrap') {
          div_style += 'display:contents;';
        }
      }
    }
    if (pen.whiteSpace !== 'nowrap') {
      let textWidth = pen.fontSize * 1.2 * pen.text.length;
      let contentWidth =
        (pen.textWidth || pen.width / scale) *
        Math.floor(pen.height / scale / (pen.lineHeight * pen.fontSize));
      if (textWidth > contentWidth) {
        style += 'justify-content: start;';
      }
    }
    sheet.deleteRule(0);
    sheet.deleteRule(0);
    sheet.insertRule(
      `.topology-input
      .input-div{
        resize:none;border:none;outline:none;background:transparent;position:absolute;flex-grow:1;height:100%;width: 100%;position:absolute;left:0;top:0;display:flex;flex-direction: column;cursor: text;${style}}`
    );
    sheet.insertRule(`.input-div div{${div_style}}`);

    // sheet.insertRule(`.topology-input .input-div-font{${style_font}}`);
  };

  hideInput = () => {
    console.log('hideInput');
    if (this.inputParent.style.display === 'flex') {
      this.inputParent.style.display = 'none';
      const pen = this.store.pens[this.inputDiv.dataset.penId];
      if (!pen) {
        return;
      }
      pen.calculative.text = pen.text;
      this.inputDiv.dataset.value = this.inputDiv.innerHTML
        .replace(/\<div\>/g, '\n')
        .replace(/\<\/div\>/g, '')
        .replace(/\<br\>/g, '');
      if (pen.onInput) {
        pen.onInput(pen, this.inputDiv.dataset.value);
      } else if (pen.text !== this.inputDiv.dataset.value) {
        const initPens = [deepClone(pen, true)];
        pen.text = this.inputDiv.dataset.value;
        pen.calculative.text = pen.text;
        this.inputDiv.dataset.penId = undefined;
        calcTextRect(pen);
        this.patchFlags = true;
        this.pushHistory({
          type: EditType.Update,
          pens: [deepClone(pen, true)],
          initPens,
        });
        this.store.emitter.emit('valueUpdate', pen);
      }
    }
    this.inputDiv.dataset.penId = undefined;
    this.dropdown.style.display = 'none';
    this.inputDiv.dataset.isInput = 'false';
    this.inputDiv.contentEditable = 'false';
    this.render();
  };

  private createInput() {
    this.inputParent.classList.add('topology-input');
    this.inputRight.classList.add('right');
    this.inputDiv.classList.add('input-div');
    this.inputParent.appendChild(this.inputDiv);
    this.inputParent.appendChild(this.inputRight);
    this.inputParent.appendChild(this.dropdown);
    this.externalElements.appendChild(this.inputParent);
<<<<<<< HEAD

    this.inputParent.onmousedown = this.stopPropagation;
<<<<<<< HEAD
    this.input.onmousedown = this.stopPropagation;
    this.input.onmousedown = this.stopPropagation;
    this.inputRight.onmousedown = this.stopPropagation;
    this.dropdown.onmousedown = this.stopPropagation;
=======
    this.inputParent.dataset.l = '1';

    //TODO input
    // this.input.dataset.l = '1';
    // this.input.dataset.noWheel = '1';

    this.inputDiv.dataset.l = '1';
    this.inputDiv.dataset.noWheel = '1';
    this.inputDiv.contentEditable = 'true';

    this.inputRight.dataset.l = '1';
    this.dropdown.dataset.l = '1';
>>>>>>> 076a9f4 (add_divinput)
=======
    this.inputDiv.onmousedown = this.stopPropagation;
    this.inputDiv.contentEditable = 'true';
    this.inputRight.onmousedown = this.stopPropagation;
    this.dropdown.onmousedown = this.stopPropagation;
>>>>>>> 57526f8 (perfect_merge_newInput)
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
      sheet.insertRule(
        '.topology-input{display:none;position:absolute;outline:none;align-items: center;}'
      );
      sheet.insertRule(
        '.topology-input textarea{resize:none;border:none;outline:none;background:transparent;flex-grow:1;height:100%;left:0;top:0}'
      );
      sheet.insertRule(
        '.topology-input .right{width:10px;height:10px;flex-shrink:0;border-top: 1px solid;border-right: 1px solid;margin-right: 5px;transition: all .3s cubic-bezier(.645,.045,.355,1);position:absolute;right:1px;}'
      );
      sheet.insertRule(
        '.topology-input ul{position:absolute;top:100%;left:-5px;width:calc(100% + 10px);min-height:30px;border-radius: 2px;box-shadow: 0 2px 8px #00000026;list-style-type: none;background-color: #fff;padding: 4px 0;}'
      );
      sheet.insertRule(
        '.topology-input ul li{padding: 5px 12px;line-height: 22px;white-space: nowrap;cursor: pointer;}'
      );
      sheet.insertRule('.topology-input ul li:hover{background: #eeeeee;}');
      sheet.insertRule(`.input-div::-webkit-scrollbar {display:none}`);
      sheet.insertRule(
        '.topology-input .input-div{resize:none;border:none;outline:none;background:transparent;flex-grow:1;height:100%;width: 100%;left:0;top:0;display:flex;text-align: center;justify-content: center;flex-direction: column;}'
      );
      sheet.insertRule(`.input-div div{}`);
    }

    this.inputDiv.onclick = (e) => {
      e.stopPropagation();
      const pen = this.store.pens[this.inputDiv.dataset.penId];
      if (this.dropdown.style.display === 'block') {
        this.dropdown.style.display = 'none';
        this.inputRight.style.transform = 'rotate(135deg)';
      } else if (pen?.dropdownList && this.store.data.locked) {
        this.dropdown.style.display = 'block';
        this.inputRight.style.transform = 'rotate(315deg)';
      }
      this.store.emitter.emit('clickInput', pen);
    };
    this.inputDiv.onkeyup = (e: KeyboardEvent) => {
      this.setDropdownList(true);
      const pen = this.store.pens[this.inputDiv.dataset.penId];
      this.store.emitter.emit('input', { pen, text: e.key });
      e.stopPropagation();
    };
    this.inputDiv.onkeydown = (e: KeyboardEvent) => {
      e.stopPropagation();
    };
    this.inputDiv.onmousedown = this.stopPropagation;
    this.inputDiv.onwheel = (e) => {
      e.stopPropagation();
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
    if (!this.store.data.locked) {
      return;
    }
    this.dropdown.style.display = 'block';
    this.inputRight.style.display = 'block';
    setTimeout(() => {
      this.inputRight.style.transform = 'rotate(315deg)';
    });
    const pen = this.store.pens[this.inputDiv.dataset.penId];
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
    const text = this.inputDiv.innerHTML
      .replace(/\<div\>/g, '\n')
      .replace(/\<\/div\>/g, '')
      .replace(/\<br\>/g, '');
    let i = 0;
    for (const item of pen.dropdownList) {
      const t = typeof item === 'string' ? item : item.text;
      if (search && text) {
        if (t.includes(text)) {
          // 过滤
          this.dropdownAppendOption(t, i);
        }
      } else {
        this.dropdownAppendOption(t, i);
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

  /**
   * 添加一个选项到 dropdown dom 中
   * @param text 选项文字
   * @param index 选项索引
   */
  private dropdownAppendOption(text: string, index: number) {
    const li = document.createElement('li');
    li.onwheel = this.stopPropagation;
    li.innerText = text;
    li.style.overflow = 'hidden';
    li.style.textOverflow = 'ellipsis';
    li.title = text;
    li.onmousedown = this.stopPropagation;
    li.dataset.i = index + '';
    li.onclick = this.selectDropdown;
    this.dropdown.appendChild(li);
  }

  private selectDropdown = (e: MouseEvent) => {
    const li = e.target as HTMLElement;
    const pen = this.store.pens[this.inputDiv.dataset.penId];
    if (!li || !pen || !pen.dropdownList) {
      return;
    }

    const index = +li.dataset.i;
    const dropdown = pen.dropdownList[index];
    if (!dropdown) {
      return;
    }

    const initPens = [deepClone(pen, true)];

    if (typeof dropdown === 'object') {
      this.updateValue(pen, { ...dropdown });
      pen.calculative.text = undefined;
      this.calcActiveRect();
    } else {
      pen.text = dropdown + '';
    }
    this.inputDiv.innerText = pen.text;
    // this.dropdown.style.display = 'none';
    // this.inputRight.style.transform = 'rotate(135deg)';
    this.hideInput();
    this.pushHistory({
      type: EditType.Update,
      pens: [deepClone(pen, true)],
      initPens,
    });
    this.render();
    this.store.emitter.emit('valueUpdate', pen);
  };

  find(idOrTag: string) {
    return this.store.data.pens.filter((pen) => {
      return pen.id == idOrTag || (pen.tags && pen.tags.indexOf(idOrTag) > -1);
    });
  }

  findOne(idOrTag: string): Pen | undefined {
    return this.store.data.pens.find((pen) => {
      return pen.id == idOrTag || (pen.tags && pen.tags.indexOf(idOrTag) > -1);
    });
  }

  changePenId(oldId: string, newId: string): void {
    if (oldId === newId) {
      throw new Error('oldId is same as newId');
    }
    const pen = this.store.pens[oldId];
    if (!pen) {
      throw new Error("old pen isn't exist");
    }
    if (this.store.pens[newId]) {
      throw new Error('new pen already exists');
    }
    // 若新画笔不存在
    pen.id = newId;
    this.store.pens[newId] = this.store.pens[oldId];
    // dom 节点，需要更改 id
    pen.onChangeId?.(pen, oldId, newId);
    delete this.store.pens[oldId];
    // 父子
    if (pen.parentId) {
      const parent = this.store.pens[pen.parentId];
      const index = parent.children?.findIndex((id) => id === oldId);
      index !== -1 && parent.children?.splice(index, 1, newId);
    }
    pen.children?.forEach((childId) => {
      const child = this.store.pens[childId];
      child.parentId = newId;
    });
    // 连接关系
    if (pen.type === PenType.Line) {
      // TODO: 仍然存在 节点类型的 连线，此处判断需要更改
      this.changeNodeConnectedLine(oldId, pen, this.store.data.pens);
    } else {
      this.changeLineAnchors(oldId, pen, this.store.data.pens);
      pen.connectedLines?.forEach(({ lineId }) => {
        const line = this.store.pens[lineId];
        calcWorldAnchors(line);
      });
    }
  }

  updateValue(pen: Pen, data: IValue): void {
    const penRect = this.getPenRect(pen);
    const oldName = pen.name;
    Object.assign(pen, data);
    // data 可能没有 name 属性
    const isChangedName = oldName !== pen.name; // name changed
    data.newId && this.changePenId(pen.id, data.newId);
    let willUpdatePath = false;
    let willCalcTextRect = false;
    let willPatchFlagsPenRect = false; // 是否需要重新计算世界坐标
    let willCalcIconRect = false; // 是否需要重现计算 icon 区域
<<<<<<< HEAD
<<<<<<< HEAD
    let willRenderImage = false;  // 是否重新渲染图片
=======
>>>>>>> 6b96b90 (setValue image need render again)
    let willSetPenRect = false; // 是否重新 setPenRect
<<<<<<< HEAD
=======
    let willRenderImage = false; // 是否重新渲染图片
>>>>>>> 88a6a57 (mouse right)
=======
    let containIsBottom = false; // 是否包含 isBottom 属性修改
<<<<<<< HEAD
>>>>>>> 5ccc423 (setValue use _setValue , setProps contain visible will change son visible)
=======
    let oldRotate: number = undefined;
<<<<<<< HEAD
>>>>>>> 9ada8b1 (updateValue rotate use rotatePen; rotatePens cancel)
=======
    let willRenderImage = false; // 是否需要重新渲染图片
>>>>>>> c91ea01 (pen set image, next set image null, will render image canvas)
    for (const k in data) {
      if (k === 'rotate') {
        oldRotate = pen.calculative.rotate || 0;
      }
      if (typeof pen[k] !== 'object' || k === 'lineDash') {
        pen.calculative[k] = data[k];
      }
      if (needCalcTextRectProps.includes(k)) {
        willCalcTextRect = true;
      }
      if (['name', 'borderRadius'].includes(k)) {
        willUpdatePath = true;
      }
      if (needSetPenProps.includes(k)) {
        willSetPenRect = true;
      }
      if (needPatchFlagsPenRectProps.includes(k)) {
        willPatchFlagsPenRect = true;
      }
      if (needCalcIconRectProps.includes(k)) {
        willCalcIconRect = true;
      }
<<<<<<< HEAD
<<<<<<< HEAD
      if ([...needRenderImageProps, ...needSetPenProps, ...needDirtyPenRectProps, ...needCalcIconRectProps].includes(k)) {
        willRenderImage = true;
      }
=======
>>>>>>> 6b96b90 (setValue image need render again)
=======
      if (k === 'isBottom') {
        containIsBottom = true;
      }
<<<<<<< HEAD
>>>>>>> 5ccc423 (setValue use _setValue , setProps contain visible will change son visible)
=======
      if (k === 'image') {
        willRenderImage = true;
      }
>>>>>>> c91ea01 (pen set image, next set image null, will render image canvas)
    }

    this.setCalculativeByScale(pen); // 该方法计算量并不大，所以每次修改都计算一次
    if (isChangedName) {
      pen.onDestroy?.(pen);
      clearLifeCycle(pen);
      // 后续代码会重算 path2D
    }
    if (willSetPenRect) {
      const rect: Rect = {
        x: data.x ?? penRect.x,
        y: data.y ?? penRect.y,
        width: data.width ?? penRect.width,
        height: data.height ?? penRect.height,
      };
      console.log(rect.x);
      this.setPenRect(pen, rect, false);
      this.updateLines(pen, true);
    } else if (willPatchFlagsPenRect) {
      this.updatePenRect(pen);
    } else {
      willCalcTextRect && calcTextRect(pen);
      willCalcIconRect && calcIconRect(this.store.pens, pen);
      if (willUpdatePath) {
        globalStore.path2dDraws[pen.name] &&
          this.store.path2dMap.set(pen, globalStore.path2dDraws[pen.name](pen));
      }
    }
    // 若同时设置 x,y,width,height 与 rotate ，先 setPenRect ，再计算 rotate
    if (oldRotate !== undefined) {
      const currentRotate = pen.calculative.rotate;
      pen.calculative.rotate = oldRotate;
      // TODO: rotatePen 会执行 updatePenRect ，上面已经执行 updatePenRect
      this.rotatePen(pen, currentRotate - oldRotate, pen.calculative.worldRect);
    }
    if (data.image || data.backgroundImage || data.strokeImage) {
      pen.calculative.image = undefined;
      pen.calculative.backgroundImage = undefined;
      pen.calculative.strokeImage = undefined;
      this.loadImage(pen);
    }
    if (containIsBottom) {
      this.canvasImage.init();
      this.canvasImageBottom.init();
    } else if (willRenderImage) {
      // 存在先有 image 后无 image 的情况
      if (pen.isBottom) {
        this.canvasImageBottom.init();
      } else {
        this.canvasImage.init();
      }
    } else {
      this.initImageCanvas([pen]);
    }
  }

  /**
   * 执行 pen ，以及 pen 的子孙节点的 onResize 生命周期函数
   */
  private execPenResize(pen: Pen) {
    pen.onResize?.(pen);
    pen.children?.forEach((chlidId) => {
      const child = this.store.pens[chlidId];
      child && this.execPenResize(child);
    });
  }

  setPenRect(pen: Pen, rect: Rect, render = true) {
    if (pen.parentId) {
      // 子节点的 rect 值，一定得是比例值
      Object.assign(pen, rect);
    } else {
      const { origin, scale } = this.store.data;
      pen.x = origin.x + rect.x * scale;
      pen.y = origin.y + rect.y * scale;
      pen.width = rect.width * scale;
      pen.height = rect.height * scale;
      console.log(origin.x, scale, pen.x);
    }
    this.updatePenRect(pen);
    this.execPenResize(pen);

    render && this.render();
  }

  getPenRect(
    pen: Pen,
    origin = this.store.data.origin,
    scale = this.store.data.scale
  ) {
    if (!pen) {
      return;
    }

    if (pen.parentId) {
      // 子节点的 rect 只与父节点 rect 有关
      return {
        x: pen.x,
        y: pen.y,
        width: pen.width,
        height: pen.height,
      };
    }

    return {
      x: (pen.x - origin.x) / scale,
      y: (pen.y - origin.y) / scale,
      width: pen.width / scale,
      height: pen.height / scale,
    };
  }

  toPng(padding: Padding = 2, callback?: BlobCallback, containBkImg = false) {
    const rect = getRect(this.store.data.pens);
    if (!isFinite(rect.width)) {
      throw new Error('can not to png, because width is not finite');
    }
    const oldRect = deepClone(rect);
    const storeData = this.store.data;
    // TODO: 目前背景颜色优先级更高
    const isDrawBkImg =
      containBkImg && !storeData.background && this.store.bkImg;
    // 主体在背景的右侧，下侧
    let isRight = false,
      isBottom = false;
    if (isDrawBkImg) {
      rect.x += storeData.x;
      rect.y += storeData.y;
      calcRightBottom(rect);
      if (rectInRect(rect, this.canvasRect, true)) {
        // 全部在区域内，那么 rect 就是 canvasRect
        Object.assign(rect, this.canvasRect);
      } else {
        // 合并区域
        const mergeArea = getRectOfPoints([
          ...rectToPoints(rect),
          ...rectToPoints(this.canvasRect),
        ]);
        Object.assign(rect, mergeArea);
      }
      isRight = rect.x === 0;
      isBottom = rect.y === 0;
    }

    // 有背景图，也添加 padding
    const p = formatPadding(padding);
    rect.x -= p[3];
    rect.y -= p[0];
    rect.width += p[3] + p[1];
    rect.height += p[0] + p[2];
    calcRightBottom(rect);

    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'middle'; // 默认垂直居中
    if (isDrawBkImg) {
      const x = rect.x < 0 ? -rect.x : 0;
      const y = rect.y < 0 ? -rect.y : 0;
      ctx.drawImage(
        this.store.bkImg,
        x,
        y,
        this.canvasRect.width,
        this.canvasRect.height
      );
    }
    const background =
      this.store.data.background || this.store.options.background;
    if (background) {
      // 绘制背景颜色
      ctx.save();
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (!isDrawBkImg) {
      ctx.translate(-rect.x, -rect.y);
    } else {
      // 平移画布，画笔的 worldRect 不变化
      ctx.translate(
        isRight ? storeData.x : -oldRect.x,
        isBottom ? storeData.y : -oldRect.y
      );
    }
    for (const pen of this.store.data.pens) {
      // 不使用 calculative.inView 的原因是，如果 pen 在 view 之外，那么它的 calculative.inView 为 false，但是它的绘制还是需要的
      if (!isShowChild(pen, this.store) || pen.visible == false) {
        continue;
      }
      // TODO: hover 待考虑，若出现再补上
      const { active } = pen.calculative;
      pen.calculative.active = false;
      if (pen.calculative.img) {
        renderPenRaw(ctx, pen);
      } else {
        renderPen(ctx, pen);
      }
      pen.calculative.active = active;
    }
    if (callback) {
      canvas.toBlob(callback);
      return;
    }
    return canvas.toDataURL();
  }

  toggleAnchorMode() {
    if (!this.hotkeyType) {
      if (this.store.options.disableAnchor || this.store.hover?.disableAnchor) {
        return;
      }
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
    this.patchFlags = true;
  }

  addAnchorHand() {
    if (
      this.store.activeAnchor &&
      this.store.active &&
      this.store.active.length === 1 &&
      this.store.active[0].type
    ) {
      const initPens = [deepClone(this.store.active[0], true)];

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
        this.patchFlags = true;
      } else if (!this.store.activeAnchor.next) {
        this.store.activeAnchor.next = { ...this.store.activeAnchor.prev };
        rotatePoint(this.store.activeAnchor.next, 180, this.store.activeAnchor);
        this.initLineRect(this.store.active[0]);
        this.patchFlags = true;
      }

      this.pushHistory({
        type: EditType.Update,
        pens: [deepClone(this.store.active[0], true)],
        initPens,
      });
    }
  }

  removeAnchorHand() {
    if (
      this.store.activeAnchor &&
      this.store.active &&
      this.store.active.length === 1 &&
      this.store.active[0].type
    ) {
      const initPens = [deepClone(this.store.active[0], true)];

      if (this.hoverType === HoverType.LineAnchorPrev) {
        this.store.activeAnchor.prev = undefined;
        this.initLineRect(this.store.active[0]);
        this.patchFlags = true;
      } else if (this.hoverType === HoverType.LineAnchorNext) {
        this.store.activeAnchor.next = undefined;
        this.initLineRect(this.store.active[0]);
        this.patchFlags = true;
      } else {
        this.store.activeAnchor.prev = undefined;
        this.store.activeAnchor.next = undefined;
        this.initLineRect(this.store.active[0]);
        this.patchFlags = true;
      }

      this.pushHistory({
        type: EditType.Update,
        pens: [deepClone(this.store.active[0])],
        initPens,
      });
    }
  }

  toggleAnchorHand() {
    if (
      this.store.active.length === 1 &&
      this.store.active[0].type &&
      this.store.activeAnchor
    ) {
      if (!this.store.activeAnchor.prevNextType) {
        this.store.activeAnchor.prevNextType = PrevNextType.Mirror;
      }
      this.store.activeAnchor.prevNextType =
        (this.store.activeAnchor.prevNextType + 1) % 3;
    }
  }

  gotoView(x: number, y: number) {
    const rect = getRect(this.store.data.pens);
    if (!isFinite(rect.width)) {
      throw new Error('can not move view, because width is not finite');
    }
    this.store.data.x = this.canvas.clientWidth / 2 - x * rect.width - rect.x;
    this.store.data.y = this.canvas.clientHeight / 2 - y * rect.height - rect.y;
    this.onMovePens();
    this.canvasImage.init();
    this.canvasImageBottom.init();
    this.render();
  }

  showMagnifier() {
    this.magnifierCanvas.magnifier = true;
    this.externalElements.style.cursor = 'default';
    this.render();
  }

  hideMagnifier() {
    this.magnifierCanvas.magnifier = false;
    this.externalElements.style.cursor = 'default';
    this.render();
  }

  toggleMagnifier() {
    this.magnifierCanvas.magnifier = !this.magnifierCanvas.magnifier;
    if (this.magnifierCanvas.magnifier) {
      this.externalElements.style.cursor = 'default';
    }
    this.render();
  }

  destroy() {
    this.scroll && this.scroll.destroy();
    this.tooltip?.destroy();

    // ios
    this.externalElements.removeEventListener(
      'gesturestart',
      this.onGesturestart
    );

    this.externalElements.ondragover = (e) => e.preventDefault();
    this.externalElements.ondrop = undefined;
    if (isMobile()) {
      this.externalElements.ontouchstart = undefined;
      this.externalElements.ontouchmove = undefined;
      this.externalElements.ontouchend = undefined;
    } else {
      this.externalElements.onmousedown = undefined;
      this.externalElements.onmousemove = undefined;
      this.externalElements.onmouseup = undefined;
      this.externalElements.onmouseleave = undefined;
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
    window && window.removeEventListener('scroll', this.onScroll);
  }
}
