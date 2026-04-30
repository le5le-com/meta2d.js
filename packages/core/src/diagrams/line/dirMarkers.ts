import { LineAnimateType, Pen, PenType } from '../../pen/model';
import { Point } from '../../point';
import { Meta2dStore } from '../../store';
import { getLinePoints } from './line';

export type DrawDirMarkers = (
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) => void;

function lineHasArrowOrWaterDropAnimate(pen: Pen): boolean {
  const t = pen.lineAnimateType;
  if (t == null) {
    return false;
  }
  const list = Array.isArray(t) ? t : [t];
  return list.some(
    (x) => x === LineAnimateType.Arrow || x === LineAnimateType.WaterDrop
  );
}

function strokeChevronV(
  ctx: CanvasRenderingContext2D,
  armLength: number,
  halfSpread: number
) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-armLength, -halfSpread);
  ctx.moveTo(0, 0);
  ctx.lineTo(-armLength, halfSpread);
  ctx.stroke();
}

export function drawDefaultLineDirectionChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleRad: number,
  armLength: number,
  halfSpread: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  strokeChevronV(ctx, armLength, halfSpread);
  ctx.restore();
}

function pointAndAngleOnPolyline(
  pts: Point[],
  segs: number[],
  dist: number
): { x: number; y: number; ang: number } {
  // 二分查找找到距离所在的线段
  let left = 0;
  let right = segs.length - 1;
  while (right - left > 1) {
    const mid = (left + right) >> 1;
    if (segs[mid] <= dist) {
      left = mid;
    } else {
      right = mid;
    }
  }
  
  // 计算线段上的点
  const segmentIndex = left;
  const segmentStart = pts[segmentIndex];
  const segmentEnd = pts[segmentIndex + 1];
  const segmentLength = segs[segmentIndex + 1] - segs[segmentIndex];
  
  // 线性插值计算点坐标
  const t = segmentLength > 1e-6 ? (dist - segs[segmentIndex]) / segmentLength : 0;
  const pointX = segmentStart.x + t * (segmentEnd.x - segmentStart.x);
  const pointY = segmentStart.y + t * (segmentEnd.y - segmentStart.y);
  
  // 计算角度
  const angle = Math.atan2(segmentEnd.y - segmentStart.y, segmentEnd.x - segmentStart.x);
  
  return { x: pointX, y: pointY, ang: angle };
}

export function renderLineDirectionMarkers(
  ctx: CanvasRenderingContext2D,
  pen: Pen,
  store: Meta2dStore
) {
  if (pen.type !== PenType.Line) {
    return;
  }

  const show = pen.dirMarkers || store.options.dirMarkers;
  if (!show) {
    return;
  }

  if (pen.calculative.pencil) {
    return;
  }

  const anchors = pen.calculative.worldAnchors;
  if (!anchors || anchors.length < 2) {
    return;
  }

  if (pen.calculative.animatePos && lineHasArrowOrWaterDropAnimate(pen)) {
    return;
  }

  const drawer = store.options.drawDirMarkers;
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.shadowColor = '';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const pts = getLinePoints(pen);
  if (pts.length < 2) {
    ctx.restore();
    return;
  }

  const scale = store.data.scale;
  const interval =
    (pen.dirMarkerInterval ??
      store.options.dirMarkerInterval ??
      40) * scale;
  const color =
    pen.dirMarkerColor ??
    store.options.dirMarkerColor ??
    '#ffffff';
  const lineW = pen.calculative.lineWidth || 2;
  const strokeW =
    (pen.dirMarkerLineWidth ?? store.options.dirMarkerLineWidth) != null
      ? (pen.dirMarkerLineWidth ?? store.options.dirMarkerLineWidth) * scale
      : Math.min(lineW * 0.38, Math.max(0.75, lineW * 0.14));

  const segs: number[] = [0]; // 各个点到起点的累计距离，方便后续根据方向标记的距离计算位置
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
    segs.push(totalLen);
  }
  if (totalLen <= 1e-6) {
    ctx.restore();
    return;
  }

  let ds: number[] = [];
  for (let d = interval / 2; d < totalLen; d += interval) {
    ds.push(d);
  }
  if (ds.length === 0 || ds.length === 1) {
    ds = [totalLen / 2];
  }

  if (drawer) {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const d of ds) {
      const { x, y, ang } = pointAndAngleOnPolyline(pts, segs, d);
      drawer(ctx, x, y, ang, color, pen);
    }
  } else {
    const innerW = Math.max(0, lineW - strokeW);
    const halfSpread = innerW * 0.38;
    const armLength = lineW * 0.52;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const d of ds) {
      const { x, y, ang } = pointAndAngleOnPolyline(pts, segs, d);
      drawDefaultLineDirectionChevron(ctx, x, y, ang, armLength, halfSpread);
    }
  }

  ctx.restore();
}
