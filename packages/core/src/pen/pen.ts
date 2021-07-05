import { Point } from '../point';

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
}

export function renderPen(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, pen: TopologyPen, path: Path2D, rotate = 0) {
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
  } else if (pen.color) {
    ctx.strokeStyle = pen.color;
  }

  if (pen.backgroundImage) {
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

  (pen.background || pen.bkType) && ctx.fill(path);
  ctx.stroke(path);

  ctx.restore();
}

export function calcCenter(pen: TopologyPen) {
  pen.center = {
    x: pen.x + pen.width / 2,
    y: pen.y + pen.height / 2
  };
}
