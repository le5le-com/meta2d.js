import {
  getCurveSegmentPoints,
  getLinePathSegments,
  Gradient,
  hasLineCrossSegment,
  Pen,
  Point,
} from '../../models';
import { fromArrow, toArrow } from './arrow';

type LineGradientContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * 按连线局部法向绘制渐变，使折线和曲线的渐变始终沿线宽方向分布。
 * 返回 false 表示渐变配置无效，调用方应回退到普通连线绘制。
 */
export function renderLineGradientPath(ctx: LineGradientContext, pen: Pen, gradient?: Gradient): boolean {
  const lineGradient = gradient || pen.lineGradient;
  if (!lineGradient?.colorStops?.length || !pen.anchors?.length || pen.anchors.length < 2) {
    return false;
  }

  // 默认渐变来自画布数据时，通过浅拷贝复用现有连线渐变绘制逻辑，不修改原始图元。
  const gradientPen = lineGradient === pen.lineGradient ? pen : { ...pen, lineGradient };

  ctx.save();
  ctx.lineCap = gradientPen.lineCap || 'square';
  ctx.lineJoin = gradientPen.lineJoin || 'round';
  ctx.globalAlpha = gradientPen.opacity ?? 1;
  ctx.setLineDash(gradientPen.lineDash || []);
  ctx.lineDashOffset = gradientPen.lineDashOffset || 0;

  if (
    gradientPen.type === 'curve' ||
    gradientPen.type === 'mind' ||
    (gradientPen.lineSmooth || 0) > 0 ||
    hasLineCrossSegment(gradientPen)
  ) {
    const step = Math.min(0.04, Math.max(0.01, 24 / (gradientPen.length || 1)));
    const points = getCurveSegmentPoints(gradientPen, step, true, true);
    let lastNormal: Point;
    for (let i = 1; i < points.length; i++) {
      lastNormal = drawLineGradientSegment(ctx, gradientPen, points[i - 1], points[i], lastNormal);
    }
  } else {
    drawAnchorGradientPath(ctx, gradientPen);
  }

  drawLineGradientCaps(ctx, gradientPen);
  drawLineGradientArrows(ctx, gradientPen);
  ctx.restore();
  return true;
}

function drawAnchorGradientPath(ctx: LineGradientContext, pen: Pen) {
  const anchors = pen.anchors;
  const smoothLength = (pen.lineWidth || 1) * (pen.lineSmooth || 0);

  for (let i = 0; i < anchors.length - 1; i++) {
    let start = anchors[i];
    let end = anchors[i + 1];

    if (i > 0 && i < anchors.length - 1) {
      drawGradientSmoothTransition(ctx, pen, smoothLength, anchors[i - 1], anchors[i], anchors[i + 1]);
      start = getSmoothAdjacentPoint(smoothLength, anchors[i], anchors[i + 1]);
    }

    if (i < anchors.length - 2) {
      end = getSmoothAdjacentPoint(smoothLength, anchors[i + 1], anchors[i]);
    }

    drawLineGradientSegment(ctx, pen, start, end);
  }
}

function drawGradientSmoothTransition(
  ctx: LineGradientContext,
  pen: Pen,
  smoothLength: number,
  prev: Point,
  current: Point,
  next: Point,
) {
  if (!smoothLength) {
    return;
  }

  const start = getSmoothAdjacentPoint(smoothLength, current, prev);
  const end = getSmoothAdjacentPoint(smoothLength, current, next);
  const steps = getTransitionSteps(ctx, start, current, end);
  let from = start;

  // 用二次贝塞尔采样连接相邻线段，避免渐变折线在圆角处断裂。
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const to = {
      x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * current.x + t * t * end.x,
      y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * current.y + t * t * end.y,
    };
    drawLineGradientSegment(ctx, pen, from, to);
    from = to;
  }
}

/** 圆角折线段与真实二次曲线之间允许的最大偏差（设备像素） */
const TRANSITION_TOLERANCE = 0.1;
const MAX_TRANSITION_STEPS = 20;

/**
 * 圆角要切成几段。原来固定 20 段，每段一个渐变 + 一次 stroke：示例2 有 74 个半径 20 的圆角，
 * 一次整页重绘里 1736 次渐变描边有 1480 次花在圆角上，连线流动动画每帧都要重画，GPU 光栅成了帧率上限。
 *
 * 二次贝塞尔均分 n 段时，折线与曲线的最大偏差 ≤ |P0 − 2P1 + P2| / (8n²)，
 * 按屏幕尺寸（乘上当前变换的缩放）取刚好不超过 TRANSITION_TOLERANCE 的 n：
 * 半径 20 的直角在 0.3 倍缩放下 4 段、1 倍 6 段、4 倍 12 段；上限仍是原来的 20。
 */
function getTransitionSteps(ctx: LineGradientContext, start: Point, control: Point, end: Point) {
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b) || 1;
  const dd = Math.hypot(start.x - 2 * control.x + end.x, start.y - 2 * control.y + end.y) * scale;
  const steps = Math.ceil(Math.sqrt(dd / (8 * TRANSITION_TOLERANCE)));
  return Math.min(MAX_TRANSITION_STEPS, Math.max(2, steps || 2));
}

function getSmoothAdjacentPoint(smoothLength: number, from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!length) {
    return { x: from.x, y: from.y };
  }

  if (smoothLength < length) {
    return {
      x: from.x + ((to.x - from.x) * smoothLength) / length,
      y: from.y + ((to.y - from.y) * smoothLength) / length,
    };
  }

  return {
    x: from.x + (to.x - from.x) / length / 2,
    y: from.y + (to.y - from.y) / length / 2,
  };
}

function drawLineGradientSegment(ctx: LineGradientContext, pen: Pen, start: Point, end: Point, lastNormal?: Point) {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 0.01) {
    return lastNormal;
  }

  const normal = getStableSegmentNormal(start, end, lastNormal);
  ctx.strokeStyle = getSegmentLinearGradient(ctx, pen, start, end, ctx.lineWidth / 2, normal);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  return normal;
}

function getSegmentLinearGradient(
  ctx: LineGradientContext,
  pen: Pen,
  start: Point,
  end: Point,
  radius: number,
  normal = getStableSegmentNormal(start, end),
) {
  const originX = (start.x + end.x) / 2;
  const originY = (start.y + end.y) / 2;
  const gradient = ctx.createLinearGradient(
    originX + normal.x * radius,
    originY + normal.y * radius,
    originX - normal.x * radius,
    originY - normal.y * radius,
  );

  for (const stop of pen.lineGradient.colorStops) {
    gradient.addColorStop(stop.i, stop.color);
  }
  return gradient;
}

function getStableSegmentNormal(start: Point, end: Point, lastNormal?: Point): Point {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 0.01) {
    return lastNormal || { x: 0, y: 1 };
  }

  let normal = {
    x: -(end.y - start.y) / length,
    y: (end.x - start.x) / length,
  };

  // 相邻采样点的法向可能发生 180° 翻转，统一方向可避免颜色顺序突然颠倒。
  if (lastNormal && normal.x * lastNormal.x + normal.y * lastNormal.y < 0) {
    normal = {
      x: -normal.x,
      y: -normal.y,
    };
  }

  return normal;
}

function getLineCapExtension(start: Point, end: Point) {
  if (start.x - end.x === 0) {
    return { x: 0, y: 0.1 };
  }

  return {
    x: 0.1,
    y: ((start.y - end.y) / (start.x - end.x)) * 0.1,
  };
}

function drawLineGradientCaps(ctx: LineGradientContext, pen: Pen) {
  if (pen.close || (!pen.fromLineCap && !pen.toLineCap)) {
    return;
  }

  for (const cap of getLineGradientCapSegments(pen)) {
    if (!cap.lineCap || cap.lineCap === 'butt') {
      continue;
    }

    const extension = getLineCapExtension(cap.start, cap.end);
    ctx.save();
    ctx.lineCap = cap.lineCap;
    drawLineGradientSegment(ctx, pen, { x: cap.end.x - extension.x, y: cap.end.y - extension.y }, cap.end);
    ctx.restore();
  }
}

function drawLineGradientArrows(ctx: LineGradientContext, pen: Pen) {
  if (!pen.fromArrow && !pen.toArrow) {
    return;
  }

  const capSegments = getLineGradientCapSegments(pen);
  if (pen.fromArrow && capSegments[0]) {
    const segment = capSegments[0];
    ctx.strokeStyle = getSegmentLinearGradient(ctx, pen, segment.start, segment.end, ctx.lineWidth / 2);
    fromArrow(ctx as CanvasRenderingContext2D, pen);
  }

  if (pen.toArrow && capSegments[1]) {
    const segment = capSegments[1];
    ctx.strokeStyle = getSegmentLinearGradient(ctx, pen, segment.start, segment.end, ctx.lineWidth / 2);
    toArrow(ctx as CanvasRenderingContext2D, pen);
  }
}

function getLineGradientCapSegments(pen: Pen) {
  if (pen.type === 'curve' || pen.type === 'mind') {
    return getCurveGradientCapSegments(pen);
  }

  if ((pen.lineSmooth || 0) > 0 || hasLineCrossSegment(pen)) {
    const segments = getLinePathSegments(pen);
    if (!segments.length) {
      return [];
    }

    return [
      {
        start: segments[0].start,
        end: segments[0].end,
        lineCap: pen.fromLineCap || pen.lineCap,
      },
      {
        start: segments[segments.length - 1].start,
        end: segments[segments.length - 1].end,
        lineCap: pen.toLineCap || pen.lineCap,
      },
    ];
  }

  return [
    {
      start: pen.anchors[0],
      end: pen.anchors[1],
      lineCap: pen.fromLineCap || pen.lineCap,
    },
    {
      start: pen.anchors[pen.anchors.length - 2],
      end: pen.anchors[pen.anchors.length - 1],
      lineCap: pen.toLineCap || pen.lineCap,
    },
  ];
}

function getCurveGradientCapSegments(pen: Pen) {
  const points = getCurveGradientPoints(pen);
  if (points.length < 2) {
    return [];
  }

  return [
    {
      start: points[0],
      end: points[1],
      lineCap: pen.fromLineCap || pen.lineCap,
    },
    {
      start: points[points.length - 2],
      end: points[points.length - 1],
      lineCap: pen.toLineCap || pen.lineCap,
    },
  ];
}

function getCurveGradientPoints(pen: Pen) {
  const step = Math.min(0.04, Math.max(0.01, 24 / (pen.length || 1)));
  return getCurveSegmentPoints(pen, step, true, true);
}
