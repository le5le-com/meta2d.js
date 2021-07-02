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
  // Hidden only visible === false
  visible?: boolean;
  locked?: LockState;
  // 作为子节点，是否可以直接点击选中
  stand?: boolean;

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
