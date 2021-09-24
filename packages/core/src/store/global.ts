import pkg from '../../package.json';

export const globalStore: {
  version: string;
  registerPens: { [key: string]: any };
  htmlElements: { [key: string]: any };
  paths: { [key: string]: string };
  draws: { [key: string]: any };
  independentDraws: { [key: string]: any };
} = {
  version: pkg.version,
  registerPens: {},
  htmlElements: {},
  paths: {},
  draws: {},
  independentDraws: {},
};

export function register(penPaths: any) {
  Object.assign(globalStore.registerPens, penPaths);
}

export function registerDraw(name: string, draw?: Function) {
  globalStore.draws[name] = draw;
}

export function registerIndependentDraw(name: string, draw?: Function) {
  globalStore.independentDraws[name] = draw;
}
