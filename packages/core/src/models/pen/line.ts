import { Point } from '../point';
import { Pen, LinePathSegment } from './pen';
import { s8 } from '../../utils';
// 二维线性插值，按照百分比（0-1的小数）取得从一个值过度到另外一个值的中间值
export function lerp(from: Point, to: Point, t: number) {
  const r = 1 - t;
  return {
    x: r * from.x + t * to.x,
    y: r * from.y + t * to.y,
  };
}

// 获取线段在t位置的坐标点，等于lerp
export const getLinePoint = lerp;

function getRoundedCorner(prev: Point, current: Point, next: Point, radius: number) {
  const prevDx = current.x - prev.x;
  const prevDy = current.y - prev.y;
  const nextDx = next.x - current.x;
  const nextDy = next.y - current.y;
  const prevLen = Math.hypot(prevDx, prevDy);
  const nextLen = Math.hypot(nextDx, nextDy);

  if (!prevLen || !nextLen || !radius) {
    return;
  }

  const cornerRadius = Math.min(radius, prevLen / 2, nextLen / 2);
  if (!cornerRadius) {
    return;
  }

  return {
    start: {
      x: current.x - (prevDx / prevLen) * cornerRadius,
      y: current.y - (prevDy / prevLen) * cornerRadius,
    },
    control: {
      x: current.x,
      y: current.y,
    },
    end: {
      x: current.x + (nextDx / nextLen) * cornerRadius,
      y: current.y + (nextDy / nextLen) * cornerRadius,
    },
  };
}

function createSegmentPoint(point: Point, segment: number, keepPrecision = false) {
  return {
    x: keepPrecision ? point.x : Math.round(point.x),
    y: keepPrecision ? point.y : Math.round(point.y),
    segment,
  };
}

export function hasLineCrossSegment(pen: Pen) {
  const anchors = pen.anchors;
  if (!anchors?.length) {
    return false;
  }

  for (let i = 1; i < anchors.length; i++) {
    if (isLineCrossSegment(anchors[i - 1], anchors[i])) {
      return true;
    }
  }

  return !!(pen.close && anchors.length > 2 && isLineCrossSegment(anchors[anchors.length - 1], anchors[0]));
}

function isLineCrossSegment(from: Point, to: Point) {
  return !!(from.lineCross && to.lineCross && from.cp1 && to.cp2);
}

// 配置 lineSmooth 时在拐角处插入二阶贝塞尔曲线，跨线入口与出口之间插入三阶贝塞尔曲线。
export function getLinePathSegments(pen: Pen) {
  if (!pen.anchors || pen.anchors.length < 2) {
    return [];
  }
  if (pen.calculative?.lineSegments) {
    return pen.calculative.lineSegments;
  }
  const radius = (pen.lineWidth || 1) * (pen.lineSmooth || 0);
  const { anchors } = pen;
  const lastIndex = anchors.length - 1;
  const segments: LinePathSegment[] = [];
  const corners = new Map<number, ReturnType<typeof getRoundedCorner>>();

  if (radius && anchors.length >= 3) {
    const start = pen.close ? 0 : 1;
    const end = pen.close ? anchors.length : lastIndex;
    for (let i = start; i < end; i++) {
      if (anchors[i].lineCross) {
        continue;
      }
      const prev = anchors[(i - 1 + anchors.length) % anchors.length];
      const next = anchors[(i + 1) % anchors.length];
      corners.set(i, getRoundedCorner(prev, anchors[i], next, radius));
    }
  }

  const edgeCount = pen.close ? anchors.length : lastIndex;
  for (let i = 0; i < edgeCount; i++) {
    const nextIndex = (i + 1) % anchors.length;
    const corner = corners.get(i);
    const nextCorner = corners.get(nextIndex);
    const start = corner?.end ?? anchors[i];
    const end = nextCorner?.start ?? anchors[nextIndex];

    if (isLineCrossSegment(anchors[i], anchors[nextIndex])) {
      segments.push({
        type: 'cubic',
        start,
        end,
        cp1: anchors[i].cp1!,
        cp2: anchors[nextIndex].cp2!,
        segment: i,
        endSegment: i,
      });
    } else {
      segments.push({
        type: 'line',
        start,
        end,
        segment: i,
        endSegment: i,
      });
    }

    if (nextCorner) {
      segments.push({
        type: 'quadratic',
        start: nextCorner.start,
        end: nextCorner.end,
        cp: nextCorner.control,
        segment: i,
        endSegment: nextIndex,
      });
    }
  }

  pen.calculative ??= {};
  pen.calculative.lineSegments = segments;
  return segments;
}

// 计算二阶贝塞尔曲线在百分比percentage（0-1的小数）位置的坐标点
export function getQuadraticPoint(from: Point, cp: Point, to: Point, percentage: number) {
  const r = 1 - percentage;
  const x = r * r * from.x + 2 * r * percentage * cp.x + percentage * percentage * to.x;
  const y = r * r * from.y + 2 * r * percentage * cp.y + percentage * percentage * to.y;
  return { x, y };
}

// 计算三阶贝塞尔曲线在百分比percentage（0-1的小数）位置的坐标点
export function getBezierPoint(from: Point, cp1: Point, cp2: Point, to: Point, percentage: number) {
  const { x: x1, y: y1 } = from;
  const { x: x2, y: y2 } = to;
  const { x: cx1, y: cy1 } = cp1;
  const { x: cx2, y: cy2 } = cp2;

  const r = 1 - percentage;
  const x =
    x1 * r * r * r +
    3 * cx1 * percentage * r * r +
    3 * cx2 * percentage * percentage * r +
    x2 * percentage * percentage * percentage;
  const y =
    y1 * r * r * r +
    3 * cy1 * percentage * r * r +
    3 * cy2 * percentage * percentage * r +
    y2 * percentage * percentage * percentage;
  return { x, y };
}

export function getCurveSegmentPoints(pen: Pen, step = 0.02, all = false, keepPrecision = false) {
  if (all && keepPrecision && pen.calculative?.gradientSegments) {
    return pen.calculative.gradientSegments;
  }
  if (pen.type !== 'curve' && pen.type !== 'mind' && ((pen.lineSmooth || 0) > 0 || hasLineCrossSegment(pen))) {
    const segments = getLinePathSegments(pen);
    if (!segments.length) {
      return [];
    }

    const startSegment = segments[0].segment;
    const points: Point[] = [createSegmentPoint(segments[0].start, startSegment, keepPrecision)];

    for (const segment of segments) {
      if (segment.type === 'quadratic') {
        for (let i = step; i < 1; i += step) {
          const pt = getQuadraticPoint(segment.start, segment.cp, segment.end, i);
          points.push(createSegmentPoint(pt, segment.segment, keepPrecision));
        }
      } else if (segment.type === 'cubic') {
        for (let i = step; i < 1; i += step) {
          const pt = getBezierPoint(segment.start, segment.cp1, segment.cp2, segment.end, i);
          points.push(createSegmentPoint(pt, segment.segment, keepPrecision));
        }
      }

      points.push(createSegmentPoint(segment.end, segment.endSegment, keepPrecision));
    }
    if (all && keepPrecision) {
      pen.calculative ??= {};
      pen.calculative.gradientSegments = points;
    }
    return points;
  }

  const points: Point[] = [];

  let from: Point;
  let segment = 0;
  for (const to of pen.anchors) {
    const current = keepPrecision
      ? {
          ...to,
          segment,
        }
      : {
          ...to,
          x: Math.round(to.x),
          y: Math.round(to.y),
          segment,
        };
    if (!from) {
      from = current;
      points.push(current);
      continue;
    }

    if (from.cp1) {
      if (current.cp2) {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getBezierPoint(from, from.cp1, current.cp2, current, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      } else {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getQuadraticPoint(from, from.cp1, current, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      }
    } else {
      if (current.cp2) {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getQuadraticPoint(from, current.cp2, current, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      }
    }

    from = current;
    points.push(current);
    ++segment;
  }

  if (pen.close && pen.anchors.length > 2) {
    const to = keepPrecision
      ? {
          ...pen.anchors[0],
        }
      : {
          ...pen.anchors[0],
          x: Math.round(pen.anchors[0].x),
          y: Math.round(pen.anchors[0].y),
        };
    if (from.cp1) {
      if (to.cp2) {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getBezierPoint(from, from.cp1, to.cp2, to, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      } else {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getQuadraticPoint(from, from.cp1, to, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      }
    } else {
      if (to.cp2) {
        for (let i = step; i < 1; i += step) {
          const pt: Point = getQuadraticPoint(from, to.cp2, to, i);
          if (!keepPrecision) {
            pt.x = Math.round(pt.x);
            pt.y = Math.round(pt.y);
          }
          pt.segment = segment;
          points.push(pt);
        }
      }
    }
  }

  if (all && keepPrecision) {
    pen.calculative ??= {};
    pen.calculative.gradientSegments = points;
  }
  return points;
}

// 获取连段点组成的的连线总长度
export function getLineSegmentsLength(points: Point[]) {
  let len = 0;

  let last: Point;
  for (const pt of points) {
    if (!last) {
      pt.length = 0;
      last = pt;
      continue;
    }
    len += Math.hypot(pt.x - last.x, pt.y - last.y);
    pt.length = len;

    last = pt;
  }

  return Math.round(len);
}

export function getTotalLength(pen: Pen) {
  const points = getCurveSegmentPoints(pen);
  return getLineSegmentsLength(points);
}

// 通过计算点到直线的距离判断点是否在直线线段上
export function onSegment(x: number, y: number, pt1: Point, pt2: Point, r = 5) {
  r = r * r;

  let dx = pt2.x - pt1.x;
  let dy = pt2.y - pt1.y;
  if (dx === 0 && dy === 0) {
    // 线段为点
    dx = x - pt1.x;
    dy = y - pt1.y;
    if (dx * dx + dy * dy < r) {
      return pt1;
    } else {
      return;
    }
  }

  let t = ((x - pt1.x) * dx + (y - pt1.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  // 投影点坐标
  const px = pt1.x + t * dx;
  const py = pt1.y + t * dy;

  dx = x - px;
  dy = y - py;
  if (dx * dx + dy * dy < r) {
    return { x: px, y: py };
  }
}

// 获取点在直线线段上的投影点到起点的距离
export function getDistanceOnSegment(x: number, y: number, pt1: Point, pt2: Point): number {
  let dx = pt2.x - pt1.x;
  let dy = pt2.y - pt1.y;

  if (dx === 0 && dy === 0) {
    // 线段退化成一个点
    return 0;
  }

  let t = ((x - pt1.x) * dx + (y - pt1.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  // 投影点坐标
  const px = pt1.x + t * dx;
  const py = pt1.y + t * dy;

  // 计算投影点到起点的距离
  return Math.sqrt((px - pt1.x) ** 2 + (py - pt1.y) ** 2);
}

// 获取连线上指定距离targetLength的坐标点
export function getPointAtLength(pen: Pen, targetLength: number, step = 0.02, points?: Point[], totalLength?: number) {
  if (!points) {
    points = getCurveSegmentPoints(pen, step, true);
    totalLength = getLineSegmentsLength(points);
  }
  if (targetLength <= 0) {
    return points[0];
  } else if (targetLength <= 1) {
    targetLength = totalLength * targetLength;
  } else if (targetLength >= totalLength) {
    return points[points.length - 1];
  }

  // 二分查找targetLength所在区间
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midLen = points[mid].length;
    if (midLen < targetLength) low = mid + 1;
    else high = mid - 1;
  }

  // 计算目标坐标
  const p1 = points[low - 1];
  const p2 = points[low];
  const t = (targetLength - p1.length) / (p2.length - p1.length);
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

// 获取点投影到线上面的坐标点到起点的距离
export function getDistanceOnLine(x: number, y: number, pen: Pen, step = 0.02, points?: Point[]) {
  if (!points) {
    points = getCurveSegmentPoints(pen, step, true);
  }

  let d = 0;
  for (const pt of points) {
    if (x > pt.x - 5 && x < pt.x + 5 && y > pt.y - 5 && y < pt.y + 5) {
      return d + pt.length;
    }
  }

  return d;
}

// 在容忍范围内，获取点投影到线上面的坐标点及其到起点的距离
/**
 * 连线上离 (x, y) 最近的点。返回的 segment 为所在线段序号，position 为从该线段起点锚点沿线走到这里的长度
 * （与 updateLineTextPosition → getSegmentPointByPosition 的解读一致；原来是到锚点的直线距离，曲线段上文字会偏），
 * length 为从连线起点沿线走到这里的长度；离连线超过 maxDistance 时返回 undefined。
 *
 * 原来只拿 getCurveSegmentPoints 的采样点去比（±5 以内算命中）—— 可直线段根本不采样，只有两端锚点，
 * 双击直线中间永远找不到点，就新建不了连线文字。改为把 (x, y) 投影到相邻采样点连成的每一小段上取最近。
 */
export function getClosestPoint(x: number, y: number, pen: Pen, step = 0.02, maxDistance = 5) {
  const points = getCurveSegmentPoints(pen, step, true);
  if (!points.length) {
    return;
  }

  let best: Point;
  let bestDistance = Infinity;
  let len = 0;
  // 每条线段起点处的累计长度
  const segmentStart: number[] = [0];
  const consider = (px: number, py: number, segment: number, length: number) => {
    const d = Math.hypot(px - x, py - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = { x: px, y: py, segment, length };
    }
  };

  consider(points[0].x, points[0].y, points[0].segment ?? 0, 0);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    // 终点的 segment 就是这一小段所在的线段（起点可能是上一条线段的末锚点）
    const segment = b.segment ?? 0;
    segmentStart[segment] ??= len;
    if (segLen) {
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (segLen * segLen)));
      consider(a.x + dx * t, a.y + dy * t, segment, len + segLen * t);
    }
    len += segLen;
  }

  if (!best || bestDistance > maxDistance) {
    return;
  }
  best.position = best.length - (segmentStart[best.segment] ?? 0);
  return best;
}

// 获取线段指定位置的坐标点
export function getSegmentPointByPosition(anchors: Point[], targetLength: number, step = 0.02) {
  const points = getCurveSegmentPoints({ anchors }, step, true);

  const totalLength = getLineSegmentsLength(points);

  if (targetLength <= 0) {
    return points[0];
  } else if (targetLength >= totalLength) {
    return points[points.length - 1];
  }

  // 二分查找targetLength所在区间
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midLen = points[mid].length;
    if (midLen < targetLength) low = mid + 1;
    else high = mid - 1;
  }

  // 计算目标坐标
  const p1 = points[low - 1];
  const p2 = points[low];
  const t = (targetLength - p1.length) / (p2.length - p1.length);
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

export function connectLine(pen: Pen, anchor: Point, line: Pen, lineAnchor: Point) {
  // 连线不能连接到自身。否则端点会写入自身连接字段，整线移动时会被连接更新链路重复计算。
  if (!pen || !line || pen.id === line.id) {
    return;
  }

  anchor.id ||= s8();
  lineAnchor.id ||= s8();

  if (!pen.connectedLines) {
    pen.connectedLines = [];
  }

  // 已经连上
  const connected = pen.connectedLines.find(
    (item) => item.penId === line.id && item.penAnchor === lineAnchor.id && item.anchor === anchor.id,
  );
  if (connected) {
    return;
  }
  lineAnchor.connectedPen = pen.id;
  lineAnchor.connectedAnchor = anchor.id;

  pen.connectedLines.push({
    penId: line.id,
    penAnchor: lineAnchor.id,
    anchor: anchor.id,
  });
}

export interface LineConnectionRef {
  penId: string;
  anchorId: string;
}

/**
 * 重建一个连线端点的双向关系。
 * previous 来自修改前的端点，target 为空表示断开到画布空白处。
 */
export function reconnectLine(
  penMap: Map<string, Pen>,
  line: Pen,
  lineAnchor: Point,
  previous?: Pick<Point, 'id' | 'connectedPen' | 'connectedAnchor'>,
  target?: LineConnectionRef,
  beforeChange?: (pen: Pen) => void,
) {
  const changed = new Map<string, Pen>();
  const markBeforeChange = (pen: Pen) => {
    if (!changed.has(pen.id)) {
      beforeChange?.(pen);
    }
    changed.set(pen.id, pen);
  };

  if (previous?.connectedPen) {
    const oldPen = penMap.get(previous.connectedPen);
    if (oldPen) {
      const oldLength = oldPen.connectedLines?.length || 0;
      const connectedLines = (oldPen.connectedLines || []).filter(
        (item) =>
          !(
            item.penId === line.id &&
            item.penAnchor === previous.id &&
            (!previous.connectedAnchor || item.anchor === previous.connectedAnchor)
          ),
      );
      if (connectedLines.length !== oldLength) {
        markBeforeChange(oldPen);
        oldPen.connectedLines = connectedLines;
      }
    }
  }

  delete lineAnchor.connectedPen;
  delete lineAnchor.connectedAnchor;

  if (target) {
    const targetPen = penMap.get(target.penId);
    const targetAnchor = targetPen?.anchors?.find((anchor) => anchor.id === target.anchorId);
    if (targetPen && targetAnchor && targetPen.id !== line.id) {
      markBeforeChange(targetPen);
      connectLine(targetPen, targetAnchor, line, lineAnchor);
    }
  }

  return Array.from(changed.values());
}
