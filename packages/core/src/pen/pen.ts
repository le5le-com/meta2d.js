
import { Direction } from '../data';
import { distance, facePoint, Point, rotatePoint } from '../point';
import { Rect, scaleRect } from '../rect';
import { globalStore, TopologyStore } from '../store';
import { s8 } from '../utils';
import { deepClone } from '../utils/clone';

export enum PenType {
  Node,
  Line,
}

export enum LockState {
  None,
  DisableEdit,
  DisableMove,
  // DisableActive,
  Disable = 10,
}

export enum AnchorMode {
  Default,
  In,
  Out,
}


export interface TopologyPen {
  id: string;
  parentId?: string;
  type: PenType;
  name?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  borderRadius?: number;

  layer?: number;
  // Hidden only visible === false
  visible?: boolean;
  locked?: LockState;

  center?: Point;

  from?: Point;
  to?: Point;
  close?: boolean;
  pointIn?: (pt: Point) => boolean;

  tags?: string[];
  title?: string;
  markdown?: string;
  // 外部用于提示的dom id
  tipDom?: string;

  autoRect?: boolean;

  lineWidth?: number;
  rotate?: number;
  globalAlpha?: number;
  lineDash?: number[];
  lineDashOffset?: number;
  color?: string;
  background?: string;
  hoverAnchorColor?: string;
  hoverColor?: string;
  hoverBackground?: string;
  activeColor?: string;
  activeBackground?: string;
  bkType?: number;
  lineCap?: string;
  lineJoin?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  text?: string;
  textWidth?: number;
  textHeight?: number;
  textLeft?: number;
  textTop?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontStyle?: string;
  fontWeight?: string;
  textAlign?: string;
  textBaseline?: string;
  textBackground?: string;
  whiteSpace?: string;
  ellipsis?: boolean;

  image?: string;
  icon?: string;
  iconRotate?: number;
  iconWidth?: number;
  iconHeight?: number;
  iconTop?: number;
  iconLeft?: number;
  iconColor?: string;
  iconFamily?: string;
  iconSize?: number;
  iconAlign?: string;

  animateStart?: number;
  // Cycle count. Infinite if <= 0.
  animateCycle?: number;
  animateCycleIndex?: number;
  nextAnimate?: string;
  autoPlay?: boolean;

  disableInput?: boolean;
  disableRotate?: boolean;
  disableSize?: boolean;
  disableAnchor?: boolean;

  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;

  backgroundImage?: string;
  strokeImage?: string;

  children?: TopologyPen[];

  anchors?: Point[];
  anchorRadius?: number;
  anchorBackground?: string;

  pathId?: string;
  path?: string;

  calculative?: {
    worldRect?: Rect;
    worldAnchors?: Point[];
    worldIconRect?: Rect;
    worldTextRect?: Rect;
    worldFrom?: Point;
    worldTo?: Point;
    textDrawRect?: Rect;
    svgRect?: Rect;
    textLines?: string[];
    image?: string;
    img?: HTMLImageElement;
    imgNaturalWidth?: number;
    imgNaturalHeight?: number;
    backgroundImage?: string;
    strokeImage?: string;
    backgroundImg?: HTMLImageElement;
    strokeImg?: HTMLImageElement;

    active?: boolean;
    hover?: boolean;
    activeAnchor?: Point;
  };
}

export function getParent(pens: any, pen: TopologyPen) {
  if (!pen.parentId) {
    return undefined;
  }

  return getParent(pens, pens[pen.parentId]) || pens[pen.parentId];
}

export function renderPen(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: TopologyPen,
  path: Path2D,
  store: TopologyStore,
) {
  if (globalStore.independentDraws[pen.name]) {
    ctx.save();
    globalStore.independentDraws[pen.name](ctx, pen, store);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.beginPath();
  // for canvas2svg
  if ((ctx as any).setAttrs) {
    (ctx as any).setAttrs(pen);
  }
  // end

  if (pen.rotate) {
    ctx.translate(pen.calculative.worldRect.center.x, pen.calculative.worldRect.center.y);
    ctx.rotate((pen.rotate * Math.PI) / 180);
    ctx.translate(-pen.calculative.worldRect.center.x, -pen.calculative.worldRect.center.y);
  }

  if (pen.lineWidth > 1) {
    ctx.lineWidth = pen.lineWidth;
  }

  let fill: any;
  if (pen.calculative.hover) {
    ctx.strokeStyle = pen.hoverColor || store.options.hoverColor;
    ctx.fillStyle = pen.hoverBackground || store.options.hoverBackground;
    fill = pen.hoverBackground || store.options.hoverBackground;
  } else if (pen.calculative.active) {
    ctx.strokeStyle = pen.activeColor || store.options.activeColor;
    ctx.fillStyle = pen.activeBackground || store.options.activeBackground;
    fill = pen.activeBackground || store.options.activeBackground;
  } else {
    if (pen.strokeImage) {
      if (pen.calculative.strokeImg) {
        ctx.strokeStyle = ctx.createPattern(pen.calculative.strokeImg, "repeat");
        fill = true;
      }
    } else {
      ctx.strokeStyle = pen.color;
    }

    if (pen.backgroundImage) {
      if (pen.calculative.backgroundImg) {
        ctx.fillStyle = ctx.createPattern(pen.calculative.backgroundImg, "repeat");
        fill = true;
      }
    } else {
      ctx.fillStyle = pen.background;
      fill = pen.background;
    }
  }

  if (pen.lineCap) {
    ctx.lineCap = pen.lineCap as CanvasLineCap;
  } else if (pen.type) {
    ctx.lineCap = 'round';
  }

  if (pen.lineJoin) {
    ctx.lineJoin = pen.lineJoin as CanvasLineJoin;
  } else if (pen.type) {
    ctx.lineJoin = 'round';
  }

  if (pen.globalAlpha < 1) {
    ctx.globalAlpha = pen.globalAlpha;
  }

  if (pen.lineDash) {
    ctx.setLineDash(pen.lineDash);
  }
  if (pen.lineDashOffset) {
    ctx.lineDashOffset = pen.lineDashOffset;
  }

  if (pen.shadowColor) {
    ctx.shadowColor = pen.shadowColor;
    ctx.shadowOffsetX = pen.shadowOffsetX;
    ctx.shadowOffsetY = pen.shadowOffsetY;
    ctx.shadowBlur = pen.shadowBlur;
  }

  if (path) {
    fill && ctx.fill(path);
    ctx.stroke(path);
  }

  if (pen.type && pen.calculative.active) {
    renderLineAnchors(ctx, pen, store);
  }

  if (globalStore.draws[pen.name]) {
    ctx.save();
    const ret = globalStore.draws[pen.name](ctx, pen, store);
    ctx.restore();
    // Finished on render.
    if (ret) {
      return;
    }
  }

  if (pen.image && pen.calculative.img) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    const rect = pen.calculative.worldIconRect;
    let x = rect.x;
    let y = rect.y;
    let w = rect.width;
    let h = rect.height;
    if (pen.iconWidth) {
      w = pen.iconWidth;
    }
    if (pen.iconHeight) {
      h = pen.iconHeight;
    }
    if (pen.calculative.imgNaturalWidth && pen.calculative.imgNaturalHeight) {
      let scaleW = rect.width / pen.calculative.imgNaturalWidth;
      let scaleH = rect.height / pen.calculative.imgNaturalHeight;
      let scaleMin = scaleW > scaleH ? scaleH : scaleW;
      if (pen.iconWidth) {
        h = scaleMin * pen.iconWidth; //(pen.calculative.imgNaturalHeight / pen.calculative.imgNaturalWidth) * w;
      } else {
        w = scaleMin * pen.calculative.imgNaturalWidth; // (pen.calculative.imgNaturalWidth / pen.calculative.imgNaturalHeight) * h;
      }
      if (pen.iconHeight) {
        h = scaleMin * pen.iconHeight;
      } else {
        h = scaleMin * pen.calculative.imgNaturalHeight;
      }
    }
    x += (rect.width - w) / 2;
    y += (rect.height - h) / 2;

    if (pen.iconRotate) {
      ctx.translate(rect.center.x, rect.center.y);
      ctx.rotate((pen.iconRotate * Math.PI) / 180);
      ctx.translate(-rect.center.x, -rect.center.y);
    }

    ctx.drawImage(pen.calculative.img, x, y, w, h);
    ctx.restore();
  } else if (pen.icon) {
    ctx.save();
    ctx.shadowColor = '';
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const iconRect = pen.calculative.worldIconRect;
    let x = iconRect.x + iconRect.width / 2;
    let y = iconRect.y + iconRect.height / 2;

    if (pen.iconSize > 0) {
      ctx.font = `${pen.iconSize}px ${pen.iconFamily}`;
    } else if (iconRect.width > iconRect.height) {
      ctx.font = `${iconRect.height}px ${pen.iconFamily}`;
    } else {
      ctx.font = `${iconRect.width}px ${pen.iconFamily}`;
    }
    ctx.fillStyle = pen.iconColor || pen.textColor || store.options.textColor;

    if (pen.calculative.worldRect.rotate) {
      ctx.translate(iconRect.center.x, iconRect.center.y);
      ctx.rotate((pen.calculative.worldRect.rotate * Math.PI) / 180);
      ctx.translate(-iconRect.center.x, -iconRect.center.y);
    }

    ctx.beginPath();
    ctx.fillText(pen.icon, x, y);

    ctx.restore();
  }

  if (pen.text) {
    ctx.save();
    ctx.fillStyle = pen.textColor || pen.color;
    if (pen.textBackground) {
      ctx.save();
      ctx.fillStyle = pen.textBackground;
      let x = 0;
      if (pen.textAlign === 'right') {
        x = pen.calculative.textDrawRect.width;
      }
      ctx.fillRect(pen.calculative.textDrawRect.x - x, pen.calculative.textDrawRect.y, pen.calculative.textDrawRect.width, pen.calculative.textDrawRect.height);
      ctx.restore();
    }

    ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.fontWeight || 'normal'
      } ${pen.fontSize}px/${pen.lineHeight} ${pen.fontFamily}`;

    if (pen.textAlign) {
      ctx.textAlign = pen.textAlign as any;
    } else {
      ctx.textAlign = 'center';
    }

    if (pen.textBaseline) {
      ctx.textBaseline = pen.textBaseline as any;
    }

    let y = 0.5;
    switch (pen.textBaseline) {
      case 'top':
        y = 0;
        break;
      case 'bottom':
        y = 1;
        break;
    }
    pen.calculative.textLines.forEach((text, i) => {
      let x = 0;
      if (!pen.textAlign) {
        x = pen.calculative.textDrawRect.width / 2;
      }
      ctx.fillText(
        text,
        pen.calculative.textDrawRect.x + x,
        pen.calculative.textDrawRect.y + (i + y) * pen.fontSize * pen.lineHeight
      );
    });

    ctx.restore();
  }

  ctx.restore();
}

export function renderLineAnchors(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: TopologyPen,
  store: TopologyStore,
) {
  ctx.save();
  ctx.fillStyle = pen.activeColor || store.options.activeColor;
  renderAnchor(ctx, pen.calculative.worldFrom, pen.calculative.activeAnchor === pen.calculative.worldFrom);
  pen.calculative.worldAnchors.forEach(pt => {
    renderAnchor(ctx, pt, pen.calculative.activeAnchor === pt);
  });
  pen.calculative.worldTo && renderAnchor(ctx, pen.calculative.worldTo, pen.calculative.activeAnchor === pen.calculative.worldTo);
  ctx.restore();
}

export function renderAnchor(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pt: Point,
  active?: boolean
) {
  const r = 3;

  if (active) {
    if (pt.prev) {
      ctx.save();
      ctx.strokeStyle = '#fa541c';
      ctx.beginPath();
      ctx.moveTo(pt.prev.x, pt.prev.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.prev.x, pt.prev.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (pt.next) {
      ctx.save();
      ctx.strokeStyle = '#fa541c';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.next.x, pt.next.y);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.next.x, pt.next.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}


export function calcWorldRects(pens: { [key: string]: TopologyPen; }, pen: TopologyPen) {
  if (!pen.calculative) {
    pen.calculative = {};
  }

  let rect: Rect = {
    x: pen.x,
    y: pen.y
  };

  if (pen.type) {
    pen.calculative.worldFrom = deepClone(pen.from);
    pen.calculative.worldTo = deepClone(pen.to);
  }
  if (!pen.parentId) {
    rect.ex = pen.x + pen.width;
    rect.ey = pen.y + pen.height;
    rect.width = pen.width;
    rect.height = pen.height;
    rect.rotate = pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };
  } else {
    let parentRect = pens[pen.parentId].calculative.worldRect;
    if (!parentRect) {
      parentRect = calcWorldRects(pens, pens[pen.parentId]);
    }

    rect.x = parentRect.x + (pen.x >= 1 ? pen.x : parentRect.width * pen.x);
    rect.y = parentRect.y + (pen.y >= 1 ? pen.y : parentRect.height * pen.y);
    rect.width = pen.width >= 1 ? pen.width : parentRect.width * pen.width;
    rect.height = pen.height >= 1 ? pen.height : parentRect.height * pen.height;
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;

    rect.rotate = parentRect.rotate + pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };

    if (pen.type) {
      pen.calculative.worldFrom.x = parentRect.x + (pen.from.x >= 1 ? pen.x : parentRect.width * pen.from.x);
      pen.calculative.worldFrom.y = parentRect.y + (pen.from.y >= 1 ? pen.y : parentRect.height * pen.from.y);
      pen.calculative.worldTo.x = parentRect.x + (pen.to.x >= 1 ? pen.x : parentRect.width * pen.to.x);
      pen.calculative.worldTo.y = parentRect.y + (pen.to.y >= 1 ? pen.y : parentRect.height * pen.to.y);
    }
  }

  pen.calculative.worldRect = rect;

  return rect;
}

export function calcWorldAnchors(pen: TopologyPen) {
  const anchors: Point[] = [];
  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      if (anchor.custom || pen.type) {
        const p: Point = {
          id: anchor.id || s8(),
          penId: pen.id,
          x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * anchor.x,
          y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * anchor.y,
          color: anchor.color,
          background: anchor.background,
          custom: true
        };
        if (anchor.prev) {
          p.prev = {
            penId: pen.id,
            x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * anchor.prev.x,
            y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * anchor.prev.y,
          };
        }
        if (anchor.next) {
          p.next = {
            penId: pen.id,
            x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * anchor.next.x,
            y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * anchor.next.y,
          };
        }
        anchors.push(p);
      }
    });
  }

  // Default anchors of node
  if (!anchors.length && !pen.type) {
    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * 0.5,
      y: pen.calculative.worldRect.y,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * 0.5,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
    });
  }

  if (pen.rotate) {
    anchors.forEach((anchor) => {
      rotatePoint(anchor, pen.rotate, pen.calculative.worldRect.center);
    });
  }

  if (!pen.type || pen.anchors) {
    pen.calculative.worldAnchors = anchors;
  }
}

export function calcIconRect(pens: { [key: string]: TopologyPen; }, pen: TopologyPen) {
  let x = pen.iconLeft || 0;
  let y = pen.iconTop || 0;
  let width = pen.iconWidth || pen.width;
  let height = pen.iconHeight || pen.height;
  if (x && Math.abs(x) < 1) {
    x = pen.width * pen.iconLeft;
  }

  if (y && Math.abs(y) < 1) {
    y = pen.height * pen.iconLeft;
  }
  if (width && Math.abs(width) < 1) {
    width = pen.width * pen.iconWidth;
  }

  if (height && Math.abs(height) < 1) {
    height = pen.height * pen.iconHeight;
  }

  let rotate = pen.iconRotate || 0;
  if (pen.parentId) {
    const parentRect = pens[pen.parentId].calculative.worldRect;
    if (parentRect) {
      rotate += parentRect.rotate;
      rotate %= 360;
    }
  }

  x = pen.calculative.worldRect.x + x;
  y = pen.calculative.worldRect.y + y;
  pen.calculative.worldIconRect = {
    x,
    y,
    width,
    height,
    ex: x + width,
    ey: y + height,
    rotate,
  };
}

export function scalePen(pen: TopologyPen, scale: number, center: Point) {
  if (!pen.lineWidth) {
    pen.lineWidth = 1;
  }
  pen.lineWidth *= scale;
  pen.lineHeight *= scale;
  pen.fontSize *= scale;
  pen.iconSize *= scale;
  if (pen.iconWidth > 0) {
    pen.iconWidth *= scale;
    if (pen.iconWidth <= 1) {
      pen.iconWidth = 1.01;
    }
  }
  if (pen.iconHeight > 0) {
    pen.iconHeight *= scale;
    if (pen.iconHeight <= 1) {
      pen.iconHeight = 1.01;
    }
  }
  if (pen.iconLeft > 0) {
    pen.iconLeft *= scale;
    if (pen.iconLeft <= 1) {
      pen.iconLeft = 1.01;
    }
  }
  if (pen.iconTop > 0) {
    pen.iconTop *= scale;
    if (pen.iconTop <= 1) {
      pen.iconTop = 1.01;
    }
  }
  if (pen.textWidth > 0) {
    pen.textWidth *= scale;
    if (pen.textWidth <= 1) {
      pen.textWidth = 1.01;
    }
  }
  if (pen.textHeight > 0) {
    pen.textHeight *= scale;
    if (pen.textHeight <= 1) {
      pen.textHeight = 1.01;
    }
  }
  if (pen.textLeft > 0) {
    pen.textLeft *= scale;
    if (pen.textLeft <= 1) {
      pen.textLeft = 1.01;
    }
  }
  if (pen.textTop > 0) {
    pen.textTop *= scale;
    if (pen.textTop <= 1) {
      pen.textTop = 1.01;
    }
  }
  scaleRect(pen, scale, center);
}

export function addPenAnchor(pen: TopologyPen, pt: Point) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  if (pen.rotate % 360) {
    rotatePoint(pt, -pen.rotate, pen.calculative.worldRect.center);
  }
  const anchor = {
    id: s8(),
    penId: pen.id,
    x: (pt.x - pen.calculative.worldRect.x) / pen.calculative.worldRect.width,
    y: (pt.y - pen.calculative.worldRect.y) / pen.calculative.worldRect.height,
    custom: true
  };
  pen.anchors.push(anchor);

  const worldAnchor = { ...anchor };
  worldAnchor.x = pt.x;
  worldAnchor.y = pt.y;
  pen.calculative.worldAnchors.push(worldAnchor);
  return worldAnchor;
}

export function removePenAnchor(pen: TopologyPen, anchor: Point) {
  if (!pen.anchors) {
    return;
  }
  const i = pen.anchors.findIndex(a => a.id === anchor.id);
  if (i < 0) {
    return;
  }

  pen.anchors.splice(i, 1);
  calcWorldAnchors(pen);

  return true;
}

export function facePen(pt: Point, pen?: TopologyPen) {
  if (!pen || !pen.calculative || !pen.calculative.worldRect.center) {
    return Direction.None;
  }

  return facePoint(pt, pen.calculative.worldRect.center);
}


export function nearestAnchor(pt: Point, pen: TopologyPen) {
  let dis = Infinity;
  let anchor: Point;
  pen.calculative.worldAnchors.forEach((a: Point) => {
    const d = distance(pt, a);
    if (dis > d) {
      dis = d;
      anchor = a;
    }
  });

  return anchor;
}
