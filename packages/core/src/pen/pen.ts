import { getSplitAnchor } from '../common-diagram';
import { Direction } from '../data';
import { distance, facePoint, Point, rotatePoint, translatePoint } from '../point';
import { calcRelativePoint, Rect, scaleRect } from '../rect';
import { globalStore, TopologyStore } from '../store';
import { s8 } from '../utils';

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

export interface Pen {
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
  length?: number;

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
  anchorColor?: string;
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

  children?: Pen[];

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

    dirty?: boolean;

    drawlineH?: boolean;
  };
}

export function getParent(pens: any, pen: Pen) {
  if (!pen.parentId) {
    return undefined;
  }

  return getParent(pens, pens[pen.parentId]) || pens[pen.parentId];
}

export function renderPen(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: Pen,
  path: Path2D,
  store: TopologyStore
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
        ctx.strokeStyle = ctx.createPattern(pen.calculative.strokeImg, 'repeat');
        fill = true;
      }
    } else {
      ctx.strokeStyle = pen.color;
    }

    if (pen.backgroundImage) {
      if (pen.calculative.backgroundImg) {
        ctx.fillStyle = ctx.createPattern(pen.calculative.backgroundImg, 'repeat');
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
      ctx.fillRect(
        pen.calculative.textDrawRect.x - x,
        pen.calculative.textDrawRect.y,
        pen.calculative.textDrawRect.width,
        pen.calculative.textDrawRect.height
      );
      ctx.restore();
    }

    ctx.font = `${pen.fontStyle || 'normal'} normal ${pen.fontWeight || 'normal'} ${pen.fontSize}px/${pen.lineHeight} ${
      pen.fontFamily
    }`;

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
  pen: Pen,
  store: TopologyStore
) {
  ctx.save();
  ctx.fillStyle = pen.activeColor || store.options.activeColor;
  renderAnchor(ctx, pen.calculative.worldFrom, pen.calculative.activeAnchor === pen.calculative.worldFrom);
  pen.calculative.worldAnchors.forEach((pt) => {
    renderAnchor(ctx, pt, pen.calculative.activeAnchor === pt);
  });
  pen.calculative.worldTo &&
    !pen.calculative.worldTo.hidden &&
    renderAnchor(ctx, pen.calculative.worldTo, pen.calculative.activeAnchor === pen.calculative.worldTo);
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

export function calcWorldRects(pens: { [key: string]: Pen }, pen: Pen) {
  if (!pen.calculative) {
    pen.calculative = {};
  }

  let rect: Rect = {
    x: pen.x,
    y: pen.y,
  };

  if (!pen.parentId) {
    rect.ex = pen.x + pen.width;
    rect.ey = pen.y + pen.height;
    rect.width = pen.width;
    rect.height = pen.height;
    rect.rotate = pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  } else {
    let parentRect = pens[pen.parentId].calculative.worldRect;
    if (!parentRect) {
      parentRect = calcWorldRects(pens, pens[pen.parentId]);
    }

    rect.x = parentRect.x + parentRect.width * pen.x;
    rect.y = parentRect.y + parentRect.height * pen.y;
    rect.width = parentRect.width * pen.width;
    rect.height = parentRect.height * pen.height;
    rect.ex = rect.x + rect.width;
    rect.ey = rect.y + rect.height;

    rect.rotate = parentRect.rotate + pen.rotate;
    rect.center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  pen.calculative.worldRect = rect;

  return rect;
}

export function calcWorldAnchors(pen: Pen) {
  const anchors: Point[] = [];
  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      if (!anchor.default) {
        anchors.push(calcWorldPointOfPen(pen, anchor));
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
      default: true,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
      default: true,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * 0.5,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height,
      default: true,
    });

    anchors.push({
      id: s8(),
      penId: pen.id,
      x: pen.calculative.worldRect.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * 0.5,
      default: true,
    });
  }

  pen.from && (pen.calculative.worldFrom = calcWorldPointOfPen(pen, pen.from));
  pen.to && (pen.calculative.worldTo = calcWorldPointOfPen(pen, pen.to));

  if (pen.rotate) {
    anchors.forEach((anchor) => {
      rotatePoint(anchor, pen.rotate, pen.calculative.worldRect.center);
    });

    pen.from && rotatePoint(pen.calculative.worldFrom, pen.rotate, pen.calculative.worldRect.center);
    pen.to && rotatePoint(pen.calculative.worldTo, pen.rotate, pen.calculative.worldRect.center);
  }

  if (!pen.type || pen.anchors) {
    pen.calculative.worldAnchors = anchors;
  }

  if (pen.calculative.activeAnchor) {
    if (anchors.length) {
      pen.calculative.activeAnchor = anchors.find((a) => {
        a.id === pen.calculative.activeAnchor.id;
      });
    }
    if (pen.calculative.worldFrom && pen.calculative.activeAnchor.id === pen.calculative.worldFrom.id) {
      pen.calculative.activeAnchor = pen.calculative.worldFrom;
    }
    if (pen.calculative.worldTo && pen.calculative.activeAnchor.id === pen.calculative.worldTo.id) {
      pen.calculative.activeAnchor = pen.calculative.worldTo;
    }
  }
}

export function calcWorldPointOfPen(pen: Pen, pt: Point) {
  const p: Point = { ...pt };
  p.x = pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.x;
  p.y = pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.y;
  if (pt.prev) {
    p.prev = {
      penId: pen.id,
      connectTo: pt.prev.connectTo,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.prev.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.prev.y,
    };
  }
  if (pt.next) {
    p.next = {
      penId: pen.id,
      connectTo: pt.next.connectTo,
      x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * pt.next.x,
      y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * pt.next.y,
    };
  }

  return p;
}

export function calcIconRect(pens: { [key: string]: Pen }, pen: Pen) {
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

export function scalePen(pen: Pen, scale: number, center: Point) {
  if (!pen.lineWidth) {
    pen.lineWidth = 1;
  }
  pen.lineWidth *= scale;
  pen.lineHeight *= scale;
  pen.fontSize *= scale;
  pen.iconSize *= scale;
  pen.iconWidth *= scale;
  pen.iconHeight *= scale;
  pen.iconLeft *= scale;
  pen.iconTop *= scale;
  pen.textWidth *= scale;
  pen.textHeight *= scale;
  pen.textLeft *= scale;
  pen.textTop *= scale;
  scaleRect(pen, scale, center);
  if (pen.type) {
    calcWorldAnchors(pen);
  }
}

export function pushPenAnchor(pen: Pen, pt: Point) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = {
    id: pt.id,
    penId: pen.id,
    x: pt.x,
    y: pt.y,
  };
  pen.calculative.worldAnchors.push(worldAnchor);

  if (pen.calculative.worldRect) {
    if (pen.rotate % 360) {
      rotatePoint(pt, -pen.rotate, pen.calculative.worldRect.center);
    }

    const anchor = {
      id: pt.id,
      penId: pen.id,
      x: (pt.x - pen.calculative.worldRect.x) / pen.calculative.worldRect.width,
      y: (pt.y - pen.calculative.worldRect.y) / pen.calculative.worldRect.height,
    };
    pen.anchors.push(anchor);
  }

  if (!pen.type) {
    calcWorldAnchors(pen);
  }

  return worldAnchor;
}

export function addLineAnchor(pen: Pen, pt: Point, index: number) {
  if (!pen.anchors) {
    pen.anchors = [];
  }
  if (!pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors = [];
  }

  const worldAnchor = getSplitAnchor(pen, pt, index);
  pen.calculative.worldAnchors.splice(index, 0, worldAnchor);
  pen.anchors.splice(index, 0, calcRelativePoint(worldAnchor, pen.calculative.worldRect));
  pen.calculative.activeAnchor = worldAnchor;
  return worldAnchor;
}

export function removePenAnchor(pen: Pen, anchor: Point) {
  if (!pen.calculative.worldAnchors) {
    return;
  }
  let i = pen.calculative.worldAnchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.calculative.worldAnchors.splice(i, 1);
  }

  i = pen.anchors.findIndex((a) => a.id === anchor.id);
  if (i > -1) {
    pen.anchors.splice(i, 1);
  }
}

export function facePen(pt: Point, pen?: Pen) {
  if (!pen || !pen.calculative || !pen.calculative.worldRect.center) {
    return Direction.None;
  }

  return facePoint(pt, pen.calculative.worldRect.center);
}

export function nearestAnchor(pen: Pen, pt: Point) {
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

export function translateLine(pen: Pen, x: number, y: number) {
  pen.x += x;
  pen.y += y;

  translatePoint(pen.from, x, y);
  translatePoint(pen.calculative.worldFrom, x, y);
  translatePoint(pen.to, x, y);
  translatePoint(pen.calculative.worldTo, x, y);

  if (pen.anchors) {
    pen.anchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }

  if (pen.calculative.worldAnchors) {
    pen.calculative.worldAnchors.forEach((a) => {
      translatePoint(a, x, y);
    });
  }

  pen.calculative.dirty = true;
}
