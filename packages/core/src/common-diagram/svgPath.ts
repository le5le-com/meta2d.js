import { TopologyPen } from '../pen';
import { calcCenter } from '../rect';
import { getRect, parseSvgPath, pathToString, scalePath, translatePath } from './svg/parse';

export function svgPath(pen: TopologyPen) {
  if (!pen.calculative || !pen.calculative.worldRect) {
    return;
  }

  const path = parseSvgPath(pen.path);
  pen.calculative.svgRect = getRect(path);
  calcCenter(pen.calculative.svgRect);

  if (pen.calculative.svgRect.width !== pen.width || pen.calculative.svgRect.height !== pen.height) {
    scalePath(path, pen.width / pen.calculative.svgRect.width, pen.height / pen.calculative.svgRect.height);
    const rect = getRect(path);
    calcCenter(rect);
    translatePath(path, pen.calculative.worldRect.x - rect.x, pen.calculative.worldRect.y - rect.y);
  }

  const path2D = new Path2D(pathToString(path));
  path2D.closePath();

  return path2D;
}
