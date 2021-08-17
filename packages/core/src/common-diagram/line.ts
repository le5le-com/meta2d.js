import { PenType, TopologyPen } from '../pen';
import { Point } from '../point';

export function line(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D();
  if (pen.type === PenType.Polyline) {
    path.moveTo(pen.calculative.worldFrom.x, pen.calculative.worldFrom.y);
    pen.calculative.worldAnchors.forEach((pt: Point) => {
      path.lineTo(pt.x, pt.y);
    });
    path.lineTo(pen.calculative.worldTo.x, pen.calculative.worldTo.y);
  } else if (pen.type === PenType.Curve) {
    path.moveTo(pen.calculative.worldFrom.x, pen.calculative.worldFrom.y);
    path.bezierCurveTo(
      pen.calculative.worldAnchors[0].x,
      pen.calculative.worldAnchors[0].y,
      pen.calculative.worldAnchors[1].x,
      pen.calculative.worldAnchors[1].y,
      pen.calculative.worldTo.x, pen.calculative.worldTo.y
    );
  }

  pen.close && path.closePath();

  return path;
}
