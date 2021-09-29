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

export function register(path2dFns: { [key: string]: (pen: any) => void }) {
  Object.assign(globalStore.path2dDraws, path2dFns);
}

export function registerCanvasDraw(drawFns: { [key: string]: (ctx: any, pen: any) => void }) {
  Object.assign(globalStore.canvasDraws, drawFns);
}
