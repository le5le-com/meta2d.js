import { Point } from '../point';
import { Rect } from '../rect';
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


export interface TopologyPen {
  id: string;
  parentId?: string;
  type: PenType;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  borderRadius?: number;

  layer?: number;
  // Hidden only visible === false
  visible?: boolean;
  locked?: LockState;
  active?: boolean;

  center?: Point;

  from?: Point;
  to?: Point;
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
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  text?: string;
  textWidth?: number;
  textHeight?: number;
  textOffsetX?: number;
  textOffsetY?: number;
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
  iconWidth?: number;
  iconHeight?: number;
  iconTop?: number;
  iconRight?: number;
  iconBottom?: number;
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

  calculative?: {
    worldRect?: Rect;
    worldRotate?: number;
    worldAnchors?: Point[];
    worldIconRect?: Rect;
    worldTextRect?: Rect;
    textDrawRect?: Rect;
    textLines?: string[];
  };

  beforeAddPen: (pen: TopologyPen) => boolean;
  beforeAddAnchor: (pen: TopologyPen, anchor: Point) => boolean;
  beforeRemovePen: (pen: TopologyPen) => boolean;
  beforeRemoveAnchor: (pen: TopologyPen, anchor: Point) => boolean;
}

export function getParent(pens: any, pen: TopologyPen) {
  if (!pen.parentId) {
    return pen;
  }

  return getParent(pens, pens[pen.parentId]);
}

export function renderPen(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: TopologyPen,
  path: Path2D,
  color = '',
  background = ''
) {
  if (!path) {
    return;
  }

  ctx.save();
  ctx.beginPath();

  // for canvas2svg
  if ((ctx as any).setAttrs) {
    (ctx as any).setAttrs(pen);
  }
  // end

  if (pen.calculative.worldRotate) {
    ctx.translate(pen.center.x, pen.center.y);
    ctx.rotate((pen.calculative.worldRotate * Math.PI) / 180);
    ctx.translate(-pen.center.x, -pen.center.y);
  }

  if (pen.lineWidth > 1) {
    ctx.lineWidth = pen.lineWidth;
  }

  if (color) {
    ctx.strokeStyle = color;
  } else if (pen.strokeImage) {
    // if (pen.strokeImage === pen.lastStrokeImage && pen.strokeImg) {
    //   ctx.strokeStyle = ctx.createPattern(pen.strokeImg, "repeat");
    // } else {
    //   pen.loadStrokeImg();
    // }
  } else if (pen.color) {
    ctx.strokeStyle = pen.color;
  }

  if (background) {
    ctx.fillStyle = background;
  } else if (pen.backgroundImage) {
    // if (pen.fillImage === pen.lastFillImage && pen.fillImg) {
    //   ctx.fillStyle = ctx.createPattern(pen.fillImg, "repeat");
    // } else {
    //   pen.loadFillImg();
    // }
  } else if (pen.background) {
    ctx.fillStyle = pen.background;
  }

  if (pen.lineCap) {
    ctx.lineCap = pen.lineCap as CanvasLineCap;
  } else if (pen.type === PenType.Line) {
    ctx.lineCap = 'round';
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

  (background || pen.background || pen.bkType) && ctx.fill(path);
  ctx.stroke(path);

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

export function calcWorldRects(pens: { [key: string]: TopologyPen; }, pen: TopologyPen) {
  const rect: Rect = {
    x: pen.x,
    y: pen.y
  };

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
  }

  if (!pen.calculative) {
    pen.calculative = {};
  }
  pen.calculative.worldRect = rect;

  return rect;
}

export function calcWorldAnchors(pen: TopologyPen) {
  const anchors: Point[] = [];
  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      if (anchor.custom) {
        anchors.push({
          id: anchor.id || s8(),
          penId: pen.id,
          x: pen.calculative.worldRect.x + pen.calculative.worldRect.width * anchor.x,
          y: pen.calculative.worldRect.y + pen.calculative.worldRect.height * anchor.y,
          color: anchor.color,
          background: anchor.background,
          custom: true
        });
      }
    });
  }

  if (!anchors.length) {
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

  pen.calculative.worldAnchors = anchors;
}

export function calcIconRect(pen: TopologyPen) {
  let x = pen.iconLeft || 0;
  let y = pen.iconTop || 0;
  let width = pen.iconWidth || pen.width;
  let height = pen.iconHeight || pen.height;

  if (Math.abs(x) < 1) {
    x = pen.width * pen.iconLeft;
  }

  if (Math.abs(y) < 1) {
    x = pen.height * pen.iconLeft;
  }

  if (Math.abs(width) < 1) {
    width = pen.width * pen.iconWidth;
  }

  if (Math.abs(height) < 1) {
    height = pen.height * pen.iconHeight;
  }

  pen.calculative.worldIconRect = {
    x: pen.calculative.worldRect.x + x,
    y: pen.calculative.worldRect.y + y,
    width,
    height,
    ex: pen.calculative.worldRect.x + x + width,
    ey: pen.calculative.worldRect.y + y + height,
  };
}
