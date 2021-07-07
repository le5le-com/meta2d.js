import { Point } from '../point';
import { Rect } from '../rect';
import { s8 } from '../utils';

export enum PenType {
  Node,
  Line,
}

export enum LockState {
  None,
  Readonly,
  DisableMove,
  DisableActive,
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
  // 作为子节点，是否可以直接点击选中
  stand?: boolean;


  center?: Point;

  from?: Point;
  to?: Point;
  pointIn?: (pt: Point) => boolean;

  text?: string;
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
  bkType?: number;
  lineCap?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  textX?: number;
  textY?: number;
  textWidth?: number;
  textHeight?: number;
  textOffsetX: number;
  textOffsetY: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  fontStyle?: string;
  fontWeight?: string;
  textAlign?: string;
  textBaseline?: string;
  textBackground?: string;
  textMaxLines: number;
  whiteSpace?: string;

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

  beforeAddPen: (pen: TopologyPen) => boolean;
  beforeAddAnchor: (pen: TopologyPen, anchor: Point) => boolean;
  beforeRemovePen: (pen: TopologyPen) => boolean;
  beforeRemoveAnchor: (pen: TopologyPen, anchor: Point) => boolean;
}

export function renderPen(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pen: TopologyPen, path: Path2D,
  rotate = 0,
  color = '',
  background = ''
) {
  ctx.save();
  ctx.beginPath();

  // for canvas2svg
  if ((ctx as any).setAttrs) {
    (ctx as any).setAttrs(pen);
  }
  // end

  if (rotate) {
    ctx.translate(pen.center.x, pen.center.y);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.translate(-pen.center.x, -pen.center.y);
  }

  if (pen.lineWidth > 1) {
    ctx.lineWidth = pen.lineWidth;
  }

  if (pen.strokeImage) {
    // if (pen.strokeImage === pen.lastStrokeImage && pen.strokeImg) {
    //   ctx.strokeStyle = ctx.createPattern(pen.strokeImg, "repeat");
    // } else {
    //   pen.loadStrokeImg();
    // }
  } else if (color) {
    ctx.strokeStyle = color;
  } else if (pen.color) {
    ctx.strokeStyle = pen.color;
  }

  if (pen.backgroundImage) {
    // if (pen.fillImage === pen.lastFillImage && pen.fillImg) {
    //   ctx.fillStyle = ctx.createPattern(pen.fillImg, "repeat");
    // } else {
    //   pen.loadFillImg();
    // }
  } else if (background) {
    ctx.fillStyle = background;
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

  ctx.restore();
}

export function calcWorldRects(pens: any, worldRects: WeakMap<TopologyPen, Rect>, pen: TopologyPen) {
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
    let parentRect = worldRects.get(pens[pen.parentId]);
    if (!parentRect) {
      parentRect = calcWorldRects(pens, worldRects, pens[pen.parentId]);
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

  worldRects.set(pen, rect);

  return rect;
}

export function calcWorldAnchors(worldAnchors: WeakMap<TopologyPen, Point[]>, pen: TopologyPen, wordRect: Rect) {
  const anchors: Point[] = [];
  if (pen.anchors) {
    pen.anchors.forEach((anchor) => {
      anchors.push(pen, {
        id: anchor.id || s8(),
        penId: pen.id,
        x: wordRect.x + wordRect.width * anchor.x,
        y: wordRect.y + wordRect.height * anchor.y,
        color: anchor.color,
        background: anchor.background
      });
    });
  }

  if (!anchors.length) {
    anchors.push(pen, {
      id: s8(),
      penId: pen.id,
      x: wordRect.x + wordRect.width * 0.5,
      y: wordRect.y,
    });

    anchors.push(pen, {
      id: s8(),
      penId: pen.id,
      x: wordRect.x + wordRect.width,
      y: wordRect.y + wordRect.height * 0.5,
    });

    anchors.push(pen, {
      id: s8(),
      penId: pen.id,
      x: wordRect.x + wordRect.width * 0.5,
      y: wordRect.y + wordRect.height,
    });

    anchors.push(pen, {
      id: s8(),
      penId: pen.id,
      x: wordRect.x,
      y: wordRect.y + wordRect.height * 0.5,
    });
  }

  worldAnchors.set(pen, anchors);
}
