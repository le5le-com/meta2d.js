import pkg from '../../package.json';

export const globalStore: {
  version: string;
  path2dDraws: { [key: string]: any };
  canvasDraws: { [key: string]: any };
  htmlElements: { [key: string]: any };
  paths: { [key: string]: string };
} = {
  version: pkg.version,
  path2dDraws: {},
  canvasDraws: {},
  htmlElements: {},
  paths: {},
};

export function registerPathDraw(path2dFns: any) {
  Object.assign(globalStore.path2dDraws, path2dFns);
}

export function registerCanvasDraw(drawFns?: any) {
  Object.assign(globalStore.canvasDraws, drawFns);
}
