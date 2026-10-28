import type { Meta2d } from '../meta2d';
import { PenCategory } from '../models/pen/const';
import type { Pen } from '../models/pen/pen';
import type { IValue } from '../models/pen/types';
import type { Point } from '../models/point/point';

const SUPPORTED_LINE_TYPES = new Set(['line', 'orthogonal']);
const INTERSECTION_EPSILON = 1e-6;
const BRIDGE_GAP = 2;

interface LineSegment {
  from: Point;
  to: Point;
  index: number;
  length: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface LineInfo {
  id: string;
  pen: Pen;
  anchors: Point[];
  segments: LineSegment[];
}

interface BridgeCandidate {
  distance: number;
  radius: number;
}

interface Bridge {
  distance: number;
  radius: number;
}

/**
 * 清除由跨线工具生成的锚点，不修改用户原始锚点。
 */
export function clearLineCross(meta2d: Meta2d): void {
  const values: IValue[] = [];

  for (const pen of meta2d.penMap.values()) {
    if (!pen.anchors?.some((anchor) => anchor.lineCross)) {
      continue;
    }

    values.push({
      id: pen.id,
      anchors: pen.anchors.filter((anchor) => !anchor.lineCross),
    });
  }

  applyAnchorValues(meta2d, values);
}

/**
 * 根据当前画布中的可见直线和折线重新生成跨线效果。
 */
export function updateLineCross(meta2d: Meta2d): void {
  const lines = getSupportedLines(meta2d);
  const candidates = new Map<string, Map<number, BridgeCandidate[]>>();

  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const first = lines[i];
      const second = lines[j];
      const firstIndex = first.pen.index ?? 0;
      const secondIndex = second.pen.index ?? 0;

      // 同一层级无法判定谁跨越谁，不生成跨线。
      if (firstIndex === secondIndex) {
        continue;
      }

      const upper = firstIndex > secondIndex ? first : second;
      const lower = upper === first ? second : first;
      collectIntersections(upper, lower, candidates);
    }
  }

  const values: IValue[] = [];
  const updatedIds = new Set<string>();
  for (const line of lines) {
    const lineCandidates = candidates.get(line.id);
    const anchors = createCrossAnchors(line, lineCandidates);

    // 即使当前已没有交点，也要用原始锚点覆盖旧跨线点。
    if (lineCandidates?.size || line.pen.anchors?.some((anchor) => anchor.lineCross)) {
      values.push({ id: line.id, anchors });
      updatedIds.add(line.id);
    }
  }

  // 隐藏、改类型或不再符合条件的连线也要清掉历史生成点。
  for (const pen of meta2d.penMap.values()) {
    if (pen.id && !updatedIds.has(pen.id) && pen.anchors?.some((anchor) => anchor.lineCross)) {
      values.push({
        id: pen.id,
        anchors: pen.anchors.filter((anchor) => !anchor.lineCross),
      });
    }
  }

  applyAnchorValues(meta2d, values);
}

function getSupportedLines(meta2d: Meta2d): LineInfo[] {
  const lines: LineInfo[] = [];

  for (const pen of meta2d.penMap.values()) {
    if (
      pen.category !== PenCategory.Line ||
      pen.visible === false ||
      !pen.id ||
      !pen.type ||
      !SUPPORTED_LINE_TYPES.has(pen.type) ||
      !pen.anchors?.length
    ) {
      continue;
    }

    const anchors = pen.anchors.filter((anchor) => !anchor.lineCross);
    if (anchors.length < 2) {
      continue;
    }

    const segments: LineSegment[] = [];
    for (let index = 0; index < anchors.length - 1; index++) {
      const from = anchors[index];
      const to = anchors[index + 1];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (length <= INTERSECTION_EPSILON) {
        continue;
      }

      segments.push({
        from,
        to,
        index,
        length,
        minX: Math.min(from.x, to.x),
        minY: Math.min(from.y, to.y),
        maxX: Math.max(from.x, to.x),
        maxY: Math.max(from.y, to.y),
      });
    }

    if (segments.length) {
      lines.push({ id: pen.id, pen, anchors, segments });
    }
  }

  return lines;
}

function collectIntersections(
  upper: LineInfo,
  lower: LineInfo,
  candidates: Map<string, Map<number, BridgeCandidate[]>>,
): void {
  for (const upperSegment of upper.segments) {
    for (const lowerSegment of lower.segments) {
      if (!isBoundingBoxIntersected(upperSegment, lowerSegment)) {
        continue;
      }

      const intersection = getSegmentIntersection(upperSegment, lowerSegment);
      if (!intersection) {
        continue;
      }

      const radius = getBridgeRadius(upper.pen, lower.pen);
      const distance = intersection.upperRatio * upperSegment.length;
      if (distance <= radius || upperSegment.length - distance <= radius) {
        continue;
      }

      let lineCandidates = candidates.get(upper.id);
      if (!lineCandidates) {
        lineCandidates = new Map();
        candidates.set(upper.id, lineCandidates);
      }

      let segmentCandidates = lineCandidates.get(upperSegment.index);
      if (!segmentCandidates) {
        segmentCandidates = [];
        lineCandidates.set(upperSegment.index, segmentCandidates);
      }
      segmentCandidates.push({ distance, radius });
    }
  }
}

function isBoundingBoxIntersected(first: LineSegment, second: LineSegment): boolean {
  return !(
    first.maxX < second.minX - INTERSECTION_EPSILON ||
    second.maxX < first.minX - INTERSECTION_EPSILON ||
    first.maxY < second.minY - INTERSECTION_EPSILON ||
    second.maxY < first.minY - INTERSECTION_EPSILON
  );
}

function getSegmentIntersection(
  upper: LineSegment,
  lower: LineSegment,
): { upperRatio: number; lowerRatio: number } | undefined {
  const upperX = upper.to.x - upper.from.x;
  const upperY = upper.to.y - upper.from.y;
  const lowerX = lower.to.x - lower.from.x;
  const lowerY = lower.to.y - lower.from.y;
  const denominator = cross(upperX, upperY, lowerX, lowerY);

  // 平行线和重合线都不生成跨线。
  if (Math.abs(denominator) <= INTERSECTION_EPSILON) {
    return;
  }

  const offsetX = lower.from.x - upper.from.x;
  const offsetY = lower.from.y - upper.from.y;
  const upperRatio = cross(offsetX, offsetY, lowerX, lowerY) / denominator;
  const lowerRatio = cross(offsetX, offsetY, upperX, upperY) / denominator;

  // 严格限定在两条线段内部，排除共享端点和端点接触。
  if (
    upperRatio <= INTERSECTION_EPSILON ||
    upperRatio >= 1 - INTERSECTION_EPSILON ||
    lowerRatio <= INTERSECTION_EPSILON ||
    lowerRatio >= 1 - INTERSECTION_EPSILON
  ) {
    return;
  }

  return { upperRatio, lowerRatio };
}

function cross(firstX: number, firstY: number, secondX: number, secondY: number): number {
  return firstX * secondY - firstY * secondX;
}

function getBridgeRadius(upper: Pen, lower: Pen): number {
  const upperHalfWidth = Math.max(upper.lineWidth || 1, 1) / 2;
  const lowerHalfWidth = Math.max(lower.lineWidth || 1, 1) / 2;
  return Math.max(6, upperHalfWidth + lowerHalfWidth + 2);
}

function createCrossAnchors(line: LineInfo, candidates?: Map<number, BridgeCandidate[]>): Point[] {
  const anchors: Point[] = [line.anchors[0]];

  for (let index = 0; index < line.anchors.length - 1; index++) {
    const from = line.anchors[index];
    const to = line.anchors[index + 1];
    const segmentCandidates = candidates?.get(index);
    if (segmentCandidates?.length) {
      const bridges = mergeBridgeCandidates(segmentCandidates, Math.hypot(to.x - from.x, to.y - from.y));
      for (let bridgeIndex = 0; bridgeIndex < bridges.length; bridgeIndex++) {
        anchors.push(...createBridgeAnchors(line.id, index, bridgeIndex, from, to, bridges[bridgeIndex]));
      }
    }
    anchors.push(to);
  }

  return anchors;
}

function mergeBridgeCandidates(candidates: BridgeCandidate[], segmentLength: number): Bridge[] {
  const sorted = [...candidates].sort((first, second) => first.distance - second.distance);
  const merged: Array<{ start: number; end: number }> = [];

  for (const candidate of sorted) {
    const start = candidate.distance - candidate.radius;
    const end = candidate.distance + candidate.radius;
    const previous = merged.at(-1);

    if (previous && start <= previous.end + BRIDGE_GAP) {
      previous.start = Math.min(previous.start, start);
      previous.end = Math.max(previous.end, end);
    } else {
      merged.push({ start, end });
    }
  }

  return merged
    .filter((bridge) => bridge.start > INTERSECTION_EPSILON && bridge.end < segmentLength - INTERSECTION_EPSILON)
    .map((bridge) => ({
      distance: (bridge.start + bridge.end) / 2,
      radius: (bridge.end - bridge.start) / 2,
    }));
}

function createBridgeAnchors(
  penId: string,
  segmentIndex: number,
  bridgeIndex: number,
  from: Point,
  to: Point,
  bridge: Bridge,
): Point[] {
  const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);
  const unitX = (to.x - from.x) / segmentLength;
  const unitY = (to.y - from.y) / segmentLength;
  const centerX = from.x + unitX * bridge.distance;
  const centerY = from.y + unitY * bridge.distance;
  let normalX = -unitY;
  let normalY = unitX;

  // 水平线固定向上跨越，垂直线固定向右跨越，避免锚点顺序改变弧线方向。
  if (normalY > INTERSECTION_EPSILON || (Math.abs(normalY) <= INTERSECTION_EPSILON && normalX < 0)) {
    normalX *= -1;
    normalY *= -1;
  }

  const controlOffset = (4 * bridge.radius) / 3;
  const entryX = centerX - unitX * bridge.radius;
  const entryY = centerY - unitY * bridge.radius;
  const exitX = centerX + unitX * bridge.radius;
  const exitY = centerY + unitY * bridge.radius;

  return [
    {
      id: `line-cross-${penId}-${segmentIndex}-${bridgeIndex}-from`,
      x: entryX,
      y: entryY,
      cp1: {
        x: entryX + normalX * controlOffset,
        y: entryY + normalY * controlOffset,
      },
      lineCross: true,
      visible: false,
      disabled: true,
    },
    {
      id: `line-cross-${penId}-${segmentIndex}-${bridgeIndex}-to`,
      x: exitX,
      y: exitY,
      cp2: {
        x: exitX + normalX * controlOffset,
        y: exitY + normalY * controlOffset,
      },
      lineCross: true,
      visible: false,
      disabled: true,
    },
  ];
}

function applyAnchorValues(meta2d: Meta2d, values: IValue[]): void {
  if (!values.length) {
    return;
  }

  meta2d.setValue(values, {
    render: true,
    preventEvent: true,
  });
}
