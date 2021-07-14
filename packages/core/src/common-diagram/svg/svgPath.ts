import { TopologyPen } from '../../pen';

export function svgPath(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }
  const path = new Path2D(pen.path);

  path.closePath();

  return path;
}
