import type { Meta2d } from '../meta2d';
import { getBoundary } from '../models';
import type { Pen, Point, Rect } from '../models';

const MAP_WIDTH = 320;
const MAP_HEIGHT = 180;
const MAP_PADDING = 5;
const MAP_BORDER = 1;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 画布鹰眼地图。地图使用独立的 DOM 容器和 PNG 缩略图，蓝色框只表示当前主画布视口。
 */
export class ViewMap {
  readonly boxWidth = MAP_WIDTH;
  readonly boxHeight = MAP_HEIGHT;
  readonly padding = MAP_PADDING;
  readonly ratio = MAP_WIDTH / MAP_HEIGHT;

  readonly box: HTMLDivElement;
  readonly img: HTMLImageElement;
  readonly view: HTMLDivElement;

  isShow = false;
  private isDown = false;
  private refreshTimer?: number;
  private requestId = 0;
  private exporting = false;
  private refreshPending = false;
  private dragOffset: Point = { x: 0, y: 0 };
  private imageUrl?: string;
  private contentRect?: Rect;
  private displayRect?: Rect;
  private readonly container: HTMLElement;
  private readonly originalContainerPosition?: string;

  private readonly onViewChange = () => {
    if (this.isShow) {
      this.setView();
    }
  };
  private readonly onContentChange = () => this.scheduleRefresh();

  constructor(private readonly parent: Meta2d) {
    this.box = document.createElement('div');
    this.img = document.createElement('img');
    this.view = document.createElement('div');

    this.box.className = 'meta2d-map';
    this.img.alt = '画布鹰眼地图';
    this.img.draggable = false;
    this.box.append(this.img, this.view);
    this.container = this.parent.parentElement || document.body;
    if (this.container !== document.body && getComputedStyle(this.container).position === 'static') {
      this.originalContainerPosition = this.container.style.position;
      this.container.style.position = 'relative';
    }
    this.container.appendChild(this.box);
    this.initStyle();

    this.box.addEventListener('pointerdown', this.onPointerDown);
    this.box.addEventListener('pointermove', this.onPointerMove);
    this.box.addEventListener('pointerup', this.onPointerUp);
    this.box.addEventListener('pointercancel', this.onPointerUp);
    this.box.addEventListener('wheel', this.onWheel, { passive: false });

    this.parent.on('scale', this.onViewChange);
    this.parent.on('translate', this.onViewChange);
    this.parent.on('resizeView', this.onViewChange);
    this.parent.on('opened', this.onContentChange);
    this.parent.on('layer', this.onContentChange);
    this.parent.on('valueUpdate', this.onContentChange);
  }

  show() {
    this.isShow = true;
    this.box.style.display = 'block';
    this.refreshImage();
  }

  hide() {
    this.isShow = false;
    this.isDown = false;
    this.box.style.display = 'none';
  }

  scheduleRefresh(delay = 200) {
    if (!this.isShow) {
      return;
    }
    if (this.refreshTimer !== undefined) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = undefined;
      this.refreshImage();
    }, delay);
  }

  setView() {
    const contentRect = this.contentRect || this.getContentRect();
    if (!contentRect) {
      this.img.style.display = 'none';
      this.view.style.display = 'none';
      return;
    }

    const viewport = this.getViewportRect();
    const displayRect = this.getDisplayRect(contentRect, viewport);
    this.displayRect = displayRect;

    const contentLeft = (contentRect.x - displayRect.x) / displayRect.width;
    const contentTop = (contentRect.y - displayRect.y) / displayRect.height;
    const contentWidth = contentRect.width / displayRect.width;
    const contentHeight = contentRect.height / displayRect.height;
    this.img.style.left = `${this.padding + contentLeft * this.boxWidth}px`;
    this.img.style.top = `${this.padding + contentTop * this.boxHeight}px`;
    this.img.style.width = `${contentWidth * this.boxWidth}px`;
    this.img.style.height = `${contentHeight * this.boxHeight}px`;

    const left = clamp((viewport.x - displayRect.x) / displayRect.width, 0, 1);
    const top = clamp((viewport.y - displayRect.y) / displayRect.height, 0, 1);
    const right = clamp((viewport.x + viewport.width - displayRect.x) / displayRect.width, 0, 1);
    const bottom = clamp((viewport.y + viewport.height - displayRect.y) / displayRect.height, 0, 1);
    this.view.style.left = `${this.padding + left * this.boxWidth}px`;
    this.view.style.top = `${this.padding + top * this.boxHeight}px`;
    this.view.style.width = `${Math.max(0, right - left) * this.boxWidth}px`;
    this.view.style.height = `${Math.max(0, bottom - top) * this.boxHeight}px`;
    this.view.style.display = 'block';
  }

  destroy() {
    this.isShow = false;
    this.isDown = false;
    if (this.refreshTimer !== undefined) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.parent.off('scale', this.onViewChange);
    this.parent.off('translate', this.onViewChange);
    this.parent.off('resizeView', this.onViewChange);
    this.parent.off('opened', this.onContentChange);
    this.parent.off('layer', this.onContentChange);
    this.parent.off('valueUpdate', this.onContentChange);
    this.box.removeEventListener('pointerdown', this.onPointerDown);
    this.box.removeEventListener('pointermove', this.onPointerMove);
    this.box.removeEventListener('pointerup', this.onPointerUp);
    this.box.removeEventListener('pointercancel', this.onPointerUp);
    this.box.removeEventListener('wheel', this.onWheel);
    if (this.imageUrl) {
      URL.revokeObjectURL(this.imageUrl);
      this.imageUrl = undefined;
    }
    this.box.remove();
    if (this.originalContainerPosition !== undefined) {
      this.container.style.position = this.originalContainerPosition;
    }
  }

  private refreshImage() {
    if (this.exporting) {
      this.refreshPending = true;
      return;
    }
    const contentRect = this.getContentRect();
    this.contentRect = contentRect;
    if (!contentRect) {
      this.img.style.display = 'none';
      this.view.style.display = 'none';
      return;
    }

    this.img.style.display = 'block';
    this.setView();
    const currentRequest = ++this.requestId;
    const pens = Array.from(this.parent.penMap.values());
    this.exporting = true;
    void this.parent.toPng(
      {
        pens,
        backgroundImage: true,
      },
      (buffer, error) => {
        this.exporting = false;
        if (error) {
          this.consumePendingRefresh();
          return;
        }
        if (!this.isShow || currentRequest !== this.requestId) {
          this.consumePendingRefresh();
          return;
        }
        const url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
        if (this.imageUrl) {
          URL.revokeObjectURL(this.imageUrl);
        }
        this.imageUrl = url;
        this.img.src = url;
        this.setView();
        this.consumePendingRefresh();
      },
    ).catch(() => {
      this.exporting = false;
      this.consumePendingRefresh();
    });
  }

  private consumePendingRefresh() {
    if (!this.refreshPending) {
      return;
    }
    this.refreshPending = false;
    this.scheduleRefresh(0);
  }

  private getContentRect(): Rect | undefined {
    const width = this.parent.data.width;
    const height = this.parent.data.height;
    if (width && height) {
      return { x: 0, y: 0, width, height, ex: width, ey: height };
    }

    const pens = Array.from(this.parent.penMap.values()).filter((pen) => !pen.parentId && pen.visible !== false);
    if (!pens.length) {
      return undefined;
    }
    const boundary = getBoundary(pens, this.parent.textBoxs);
    const rect = boundary.box || boundary;
    const rectWidth = rect.width || ((rect.ex || 0) - (rect.x || 0));
    const rectHeight = rect.height || ((rect.ey || 0) - (rect.y || 0));
    if (!Number.isFinite(rectWidth) || !Number.isFinite(rectHeight) || rectWidth <= 0 || rectHeight <= 0) {
      return undefined;
    }
    return {
      x: rect.x || 0,
      y: rect.y || 0,
      width: rectWidth,
      height: rectHeight,
      ex: (rect.x || 0) + rectWidth,
      ey: (rect.y || 0) + rectHeight,
    };
  }

  private getViewportRect(): Rect {
    const scale = this.parent.data.scale || 1;
    const width = this.parent.topElement.clientWidth || this.parent.renderCanvas.clientWidth;
    const height = this.parent.topElement.clientHeight || this.parent.renderCanvas.clientHeight;
    return {
      x: -this.parent.data.x / scale,
      y: -this.parent.data.y / scale,
      width: width / scale,
      height: height / scale,
    };
  }

  private getDisplayRect(content: Rect, viewport: Rect): Rect {
    let x = Math.min(content.x || 0, viewport.x || 0);
    let y = Math.min(content.y || 0, viewport.y || 0);
    let width = Math.max((content.ex || 0), (viewport.x || 0) + (viewport.width || 0)) - x;
    let height = Math.max((content.ey || 0), (viewport.y || 0) + (viewport.height || 0)) - y;
    width = Math.max(width, 1);
    height = Math.max(height, 1);
    const rectRatio = width / height;
    if (rectRatio > this.ratio) {
      const nextHeight = width / this.ratio;
      y -= (nextHeight - height) / 2;
      height = nextHeight;
    } else {
      const nextWidth = height * this.ratio;
      x -= (nextWidth - width) / 2;
      width = nextWidth;
    }
    return { x, y, width, height, ex: x + width, ey: y + height };
  }

  private getMapPoint(e: PointerEvent | WheelEvent): Point {
    const rect = this.box.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - MAP_BORDER - this.padding, 0, this.boxWidth);
    const y = clamp(e.clientY - rect.top - MAP_BORDER - this.padding, 0, this.boxHeight);
    const display = this.displayRect || this.contentRect;
    return {
      x: (display?.x || 0) + (x / this.boxWidth) * (display?.width || 1),
      y: (display?.y || 0) + (y / this.boxHeight) * (display?.height || 1),
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.isDown = true;
    this.box.setPointerCapture?.(e.pointerId);
    const point = this.getMapPoint(e);
    const viewport = this.getViewportRect();
    const inViewport =
      point.x >= viewport.x &&
      point.x <= viewport.x + viewport.width &&
      point.y >= viewport.y &&
      point.y <= viewport.y + viewport.height;
    this.dragOffset = inViewport
      ? {
          x: point.x - (viewport.x + viewport.width / 2),
          y: point.y - (viewport.y + viewport.height / 2),
        }
      : { x: 0, y: 0 };
    this.gotoView({ x: point.x - this.dragOffset.x, y: point.y - this.dragOffset.y });
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDown) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const point = this.getMapPoint(e);
    this.gotoView({ x: point.x - this.dragOffset.x, y: point.y - this.dragOffset.y });
  };

  private onPointerUp = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.isDown = false;
    this.box.releasePointerCapture?.(e.pointerId);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const point = this.getMapPoint(e);
    const topRect = this.parent.topElement.getBoundingClientRect();
    const scale = this.parent.data.scale || 1;
    this.parent.scale(scale + this.getWheelOffset(e), {
      x: topRect.left + this.parent.data.x + point.x * scale,
      y: topRect.top + this.parent.data.y + point.y * scale,
    });
  };

  private getWheelOffset(e: WheelEvent) {
    let offset = this.parent.options.scaleOffset || 0.015;
    if (this.parent.options.scaleOffset) {
      return e.deltaY > 0 ? -offset : offset;
    }
    const isMac = /mac os /i.test(navigator.userAgent);
    if (isMac && !e.ctrlKey) {
      return offset * ((e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY || 0) / 240;
    }
    if (e.deltaY > 0) {
      return -((e.deltaY.toString().includes('.') ? 0.01 : 0.2));
    }
    return e.deltaY.toString().includes('.') ? 0.01 : 0.2;
  }

  private gotoView(point: Point) {
    const viewport = this.getViewportRect();
    const content = this.contentRect || this.getContentRect();
    if (!content) {
      return;
    }
    // 将视口中心限制在内容边界内，避免连续拖动把画布无限推离地图范围。
    const minCenterX = (content.x || 0) + (viewport.width || 0) / 2;
    const maxCenterX = (content.ex || 0) - (viewport.width || 0) / 2;
    const minCenterY = (content.y || 0) + (viewport.height || 0) / 2;
    const maxCenterY = (content.ey || 0) - (viewport.height || 0) / 2;
    const centerX = clamp(point.x, Math.min(minCenterX, maxCenterX), Math.max(minCenterX, maxCenterX));
    const centerY = clamp(point.y, Math.min(minCenterY, maxCenterY), Math.max(minCenterY, maxCenterY));
    this.parent.setViewPosition(
      this.parent.data.x + (viewport.x + viewport.width / 2 - centerX) * (this.parent.data.scale || 1),
      this.parent.data.y + (viewport.y + viewport.height / 2 - centerY) * (this.parent.data.scale || 1),
    );
  }

  private initStyle() {
    Object.assign(this.box.style, {
      display: 'none',
      position: 'absolute',
      right: '0',
      bottom: '0',
      zIndex: '9999',
      width: `${this.boxWidth}px`,
      height: `${this.boxHeight}px`,
      padding: `${this.padding}px`,
      boxSizing: 'content-box',
      background: '#f4f4f4',
      border: '1px solid #fff',
      borderRadius: '8px',
      boxShadow: '0 0 14px 0 rgba(0,10,38,0.30)',
      overflow: 'hidden',
      userSelect: 'none',
      touchAction: 'none',
    });
    Object.assign(this.img.style, {
      position: 'absolute',
      pointerEvents: 'none',
      objectFit: 'fill',
    });
    Object.assign(this.view.style, {
      display: 'none',
      position: 'absolute',
      pointerEvents: 'none',
      border: '1px solid #1890ff',
      boxSizing: 'border-box',
    });
  }
}
