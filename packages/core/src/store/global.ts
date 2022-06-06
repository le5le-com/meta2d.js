import pkg from '../../package.json';
import { Pen } from '../pen';

export const globalStore: {
  version: string;
  path2dDraws: {
    [key: string]: (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D;
  };
  canvasDraws: {
    [key: string]: (ctx: CanvasRenderingContext2D, pen: Pen) => void;
  };
  anchors: { [key: string]: (pen: Pen) => void }; // TODO: 存储的是 副作用 函数，函数内修改 anchors
  htmlElements: { [key: string]: HTMLImageElement }; // 目前只存在图片资源，此处使用 HTMLImageElement
} = {
  version: pkg.version,
  path2dDraws: {},
  canvasDraws: {},
  anchors: {},
  htmlElements: {},
};

export function register(path2dFns: {
  [key: string]: (pen: Pen, ctx?: CanvasRenderingContext2D) => Path2D;
}) {
  Object.assign(globalStore.path2dDraws, path2dFns);
}

export function registerCanvasDraw(drawFns: {
  [key: string]: (ctx: CanvasRenderingContext2D, pen: Pen) => void;
}) {
  Object.assign(globalStore.canvasDraws, drawFns);
}

export function registerAnchors(anchorsFns: {
  [key: string]: (pen: Pen) => void;
}) {
  Object.assign(globalStore.anchors, anchorsFns);
}
