import pkg from '../../package.json';

export const globalStore: {
  version: string;
  path2dDraws: { [key: string]: any };
  canvasDraws: { [key: string]: any };
  anchors: { [key: string]: any };
  htmlElements: { [key: string]: HTMLImageElement };  // 目前只存在图片资源，此处使用 HTMLImageElement
} = {
  version: pkg.version,
  path2dDraws: {},
  canvasDraws: {},
  anchors: {},
  htmlElements: {},
};

export function register(path2dFns: { [key: string]: (pen: any) => void }) {
  Object.assign(globalStore.path2dDraws, path2dFns);
}

export function registerCanvasDraw(drawFns: { [key: string]: (ctx: any, pen: any) => void }) {
  Object.assign(globalStore.canvasDraws, drawFns);
}

export function registerAnchors(anchorsFns: { [key: string]: (pen: any) => void }) {
  Object.assign(globalStore.anchors, anchorsFns);
}
