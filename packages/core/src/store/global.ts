
import pkg from '../../package.json';

export const globalStore: {
  version: string;
  htmlElements: { [key: string]: any; };
  paths: { [key: string]: string; };
  draws: { [key: string]: any; };
  independentDraws: { [key: string]: any; };
} = {
  version: pkg.version,
  htmlElements: {},
  paths: {},
  draws: {},
  independentDraws: {}
};
