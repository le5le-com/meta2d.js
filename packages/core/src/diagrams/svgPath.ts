import { Meta2dStore } from './../store/store';
import { Pen } from '../pen';
import { calcCenter } from '../rect';
import {
  getRect,
  parseSvgPath,
  pathToString,
  scalePath,
  translatePath,
} from './svg/parse';

export function svgPath(pen: Pen, ctx?: CanvasRenderingContext2D): Path2D {
  const store: Meta2dStore = pen.calculative.canvas.store;
  const pathText = store.data.paths[pen.pathId];
  if (!pathText) {
    return new Path2D();
  }

  const path = parseSvgPath(pathText);
  pen.calculative.svgRect = getRect(path);
  calcCenter(pen.calculative.svgRect);

  if (
    pen.calculative.svgRect.width !== pen.calculative.worldRect.width ||
    pen.calculative.svgRect.height !== pen.calculative.worldRect.height
  ) {
    scalePath(
      path,
      pen.calculative.worldRect.width / pen.calculative.svgRect.width,
      pen.calculative.worldRect.height / pen.calculative.svgRect.height
    );
  }

  const rect = getRect(path);
  calcCenter(rect);
  translatePath(
    path,
    pen.calculative.worldRect.x - rect.x,
    pen.calculative.worldRect.y - rect.y
  );

  const pathStr = pathToString(path);
  if (ctx) {
    (ctx as any).svgPath?.(pathStr);
    return;
  }

  const path2D = new Path2D(pathStr);
  // TODO: 为何要闭合曲线
  // path2D.closePath();

  return path2D;
}
