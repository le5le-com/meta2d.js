import { Pen, getLinePathSegments, hasLineCrossSegment } from '../../models';
import { fromArrow, toArrow } from './arrow';

export function line(ctx: CanvasRenderingContext2D, pen: Pen, options?: any, data?: any) {
  if (!pen.anchors || pen.anchors.length < 2) {
    return;
  }

  ctx.beginPath();
  if (((pen.lineSmooth || 0) > 0 || hasLineCrossSegment(pen)) && pen.type !== 'curve' && pen.type !== 'mind') {
    const segments = getLinePathSegments(pen);
    if (!segments.length) {
      return;
    }
    ctx.moveTo(segments[0].start.x, segments[0].start.y);
    for (const segment of segments) {
      if (segment.type === 'quadratic') {
        ctx.quadraticCurveTo(segment.cp.x, segment.cp.y, segment.end.x, segment.end.y);
      } else if (segment.type === 'cubic') {
        ctx.bezierCurveTo(segment.cp1.x, segment.cp1.y, segment.cp2.x, segment.cp2.y, segment.end.x, segment.end.y);
      } else {
        ctx.lineTo(segment.end.x, segment.end.y);
      }
    }
  } else {
    ctx.moveTo(pen.anchors[0].x, pen.anchors[0].y);
    for (let i = 1; i < pen.anchors.length; i++) {
      ctx.lineTo(pen.anchors[i].x, pen.anchors[i].y);
    }

    if (pen.close && pen.anchors.length > 2) {
      ctx.closePath();
    }
  }

  ctx.stroke();

  if (pen.fromArrow) {
    fromArrow(ctx, pen);
  }
  if (pen.toArrow) {
    toArrow(ctx, pen);
  }
}
